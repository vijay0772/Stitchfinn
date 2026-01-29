from fastapi import HTTPException
from sqlalchemy import text, bindparam
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import JSONB

from app.models import Provider, SendMessageOut
from app.settings import settings
from app.services.reliability import call_with_reliability
from app.services.metering import compute_cost


async def handle_send_message(
    db: AsyncSession,
    tenant_id: int,
    session_id: int,
    user_text: str,
    idempotency_key: str
) -> SendMessageOut:
    # 1) Idempotency check
    idem_q = text("""
        select response_json
        from idempotency_keys
        where tenant_id = :tid and key = :k
        limit 1
    """)
    idem_res = await db.execute(idem_q, {"tid": tenant_id, "k": idempotency_key})
    existing = idem_res.mappings().first()
    if existing:
        return existing["response_json"]

    # 2) Load session (tenant-scoped)
    s_q = text("""
        select id, agent_id
        from sessions
        where id = :sid and tenant_id = :tid
        limit 1
    """)
    s_res = await db.execute(s_q, {"sid": session_id, "tid": tenant_id})
    sess = s_res.mappings().first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    agent_id = sess["agent_id"]

    # 3) Load agent (tenant-scoped)
    a_q = text("""
        select id, name, primary_provider, fallback_provider, system_prompt
        from agents
        where id = :aid and tenant_id = :tid
        limit 1
    """)
    a_res = await db.execute(a_q, {"aid": agent_id, "tid": tenant_id})
    agent = a_res.mappings().first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    primary = Provider(agent["primary_provider"])
    fallback = Provider(agent["fallback_provider"]) if agent["fallback_provider"] else None
    system_prompt = agent["system_prompt"]

    # 4) Save user message
    ins_user = text("""
        insert into messages (tenant_id, session_id, role, content)
        values (:tid, :sid, 'user', :content)
    """)
    await db.execute(ins_user, {"tid": tenant_id, "sid": session_id, "content": user_text})
    await db.commit()

    # 5) Build prompt (simple)
    prompt = f"SYSTEM: {system_prompt}\nUSER: {user_text}"

    # 6) Call primary with reliability
    resp, attempts, err = await call_with_reliability(
        provider=primary,
        prompt=prompt,
        timeout_s=settings.vendor_timeout_s,
        max_retries=settings.max_retries
    )

    if resp:
        await _record_provider_event(db, tenant_id, agent_id, session_id, resp.provider, attempts, True, 200, resp.latency_ms, None)
        result = await _finalize_success(db, tenant_id, agent_id, session_id, idempotency_key, resp)
        return result

    # record failure of primary
    await _record_failure(db, tenant_id, agent_id, session_id, primary, attempts, err)

    # 7) Fallback if configured
    if fallback:
        resp2, attempts2, err2 = await call_with_reliability(
            provider=fallback,
            prompt=prompt,
            timeout_s=settings.vendor_timeout_s,
            max_retries=settings.max_retries
        )
        if resp2:
            await _record_provider_event(db, tenant_id, agent_id, session_id, resp2.provider, attempts2, True, 200, resp2.latency_ms, None)
            result = await _finalize_success(db, tenant_id, agent_id, session_id, idempotency_key, resp2)
            return result

        await _record_failure(db, tenant_id, agent_id, session_id, fallback, attempts2, err2)

    raise HTTPException(status_code=502, detail="AI providers unavailable (primary+fallback failed)")


async def _record_failure(db: AsyncSession, tenant_id: int, agent_id: int, session_id: int,
                          provider: Provider, attempts: int, err):
    error_type, exc = err if err else ("unknown", None)
    http_code = getattr(exc, "http_code", None) if exc else None
    await _record_provider_event(db, tenant_id, agent_id, session_id, provider, attempts, False, http_code, None, error_type)


async def _record_provider_event(
    db: AsyncSession,
    tenant_id: int,
    agent_id: int,
    session_id: int,
    provider: Provider,
    attempt: int,
    success: bool,
    http_code: int | None,
    latency_ms: int | None,
    error_type: str | None
):
    q = text("""
        insert into provider_events (tenant_id, agent_id, session_id, provider, attempt, status, http_code, latency_ms, error_type)
        values (:tid, :aid, :sid, :provider, :attempt, :status, :http_code, :latency_ms, :error_type)
    """)
    await db.execute(q, {
        "tid": tenant_id,
        "aid": agent_id,
        "sid": session_id,
        "provider": provider.value,
        "attempt": attempt,
        "status": "success" if success else "fail",
        "http_code": http_code,
        "latency_ms": latency_ms,
        "error_type": error_type
    })
    await db.commit()


async def _finalize_success(db: AsyncSession, tenant_id: int, agent_id: int, session_id: int,
                            idempotency_key: str, resp):
    # Save assistant message
    ins_asst = text("""
        insert into messages (tenant_id, session_id, role, content)
        values (:tid, :sid, 'assistant', :content)
    """)
    await db.execute(ins_asst, {"tid": tenant_id, "sid": session_id, "content": resp.text})

    # Usage event
    cost = compute_cost(resp.provider, resp.tokens_in, resp.tokens_out)
    ins_usage = text("""
        insert into usage_events (tenant_id, agent_id, session_id, provider, tokens_in, tokens_out, cost)
        values (:tid, :aid, :sid, :provider, :tin, :tout, :cost)
    """)
    await db.execute(ins_usage, {
        "tid": tenant_id, "aid": agent_id, "sid": session_id,
        "provider": resp.provider.value,
        "tin": resp.tokens_in, "tout": resp.tokens_out,
        "cost": cost
    })

    payload = {
        "replyText": resp.text,
        "providerUsed": resp.provider.value,
        "tokensIn": resp.tokens_in,
        "tokensOut": resp.tokens_out,
        "cost": cost,
        "latencyMs": resp.latency_ms
    }

    # Save idempotency response (prevents double charge)
    ins_idem = text("""
        insert into idempotency_keys (tenant_id, key, response_json)
        values (:tid, :k, :resp)
    """).bindparams(bindparam("resp", type_=JSONB))
    await db.execute(ins_idem, {"tid": tenant_id, "k": idempotency_key, "resp": payload})
    await db.commit()

    return payload
