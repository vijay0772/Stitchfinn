from fastapi import HTTPException
from sqlalchemy import text, bindparam
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime, date, time, timezone
from zoneinfo import ZoneInfo

from app.models import Provider, SendMessageOut
from app.settings import settings
from app.services.reliability import call_with_reliability
from app.services.metering import compute_cost
from app.models import UsageRollupOut


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


CHICAGO = ZoneInfo("America/Chicago")


async def get_usage_rollup(
    db: AsyncSession,
    tenant_id: int,
    from_date: str,
    to_date: str
) -> UsageRollupOut:
    # Interpret YYYY-MM-DD as calendar dates in America/Chicago; convert to UTC for DB comparison
    try:
        from_dt = datetime.combine(date.fromisoformat(from_date), time.min).replace(tzinfo=CHICAGO)
        to_dt = datetime.combine(date.fromisoformat(to_date), time.max).replace(tzinfo=CHICAGO)
        from_dt_utc = from_dt.astimezone(timezone.utc)
        to_dt_utc = to_dt.astimezone(timezone.utc)
    except Exception:
        from_dt = datetime.fromisoformat(from_date)
        to_dt = datetime.fromisoformat(to_date)
        from_dt_utc = from_dt
        to_dt_utc = to_dt

    # Totals
    q_totals = text("""
        select
            coalesce(sum(tokens_in), 0) as tokens_in,
            coalesce(sum(tokens_out), 0) as tokens_out,
            coalesce(sum(cost), 0) as cost
        from usage_events
        where tenant_id = :tid
          and created_at >= :from_date
          and created_at <= :to_date
    """)
    t_res = await db.execute(q_totals, {"tid": tenant_id, "from_date": from_dt_utc, "to_date": to_dt_utc})
    t_row = t_res.mappings().first() or {"tokens_in": 0, "tokens_out": 0, "cost": 0.0}

    totals = {
        "tokensIn": int(t_row["tokens_in"] or 0),
        "tokensOut": int(t_row["tokens_out"] or 0),
        "cost": float(t_row["cost"] or 0.0),
    }

    # By provider
    q_by_provider = text("""
        select
            provider,
            coalesce(sum(tokens_in), 0) as tokens_in,
            coalesce(sum(tokens_out), 0) as tokens_out,
            coalesce(sum(cost), 0) as cost
        from usage_events
        where tenant_id = :tid
          and created_at >= :from_date
          and created_at <= :to_date
        group by provider
    """)
    p_res = await db.execute(q_by_provider, {"tid": tenant_id, "from_date": from_dt_utc, "to_date": to_dt_utc})
    by_provider_rows = p_res.mappings().all()
    by_provider = {}
    for r in by_provider_rows:
        by_provider[str(r["provider"])] = {
            "tokensIn": int(r["tokens_in"] or 0),
            "tokensOut": int(r["tokens_out"] or 0),
            "cost": float(r["cost"] or 0.0),
        }

    # Top agents by cost
    q_top_agents = text("""
        select
            ue.agent_id as agent_id,
            a.name as agent_name,
            coalesce(sum(ue.cost), 0) as cost,
            coalesce(sum(ue.tokens_in + ue.tokens_out), 0) as tokens,
            count(distinct ue.session_id) as sessions_count
        from usage_events ue
        join agents a on a.id = ue.agent_id and a.tenant_id = ue.tenant_id
        where ue.tenant_id = :tid
          and ue.created_at >= :from_date
          and ue.created_at <= :to_date
        group by ue.agent_id, a.name
        order by cost desc
        limit 5
    """)
    a_res = await db.execute(q_top_agents, {"tid": tenant_id, "from_date": from_dt_utc, "to_date": to_dt_utc})
    top_rows = a_res.mappings().all()
    top_agents = [
        {
            "agentId": int(r["agent_id"]),
            "agentName": r["agent_name"],
            "cost": float(r["cost"] or 0.0),
            "tokens": int(r["tokens"] or 0),
            "sessions": int(r["sessions_count"] or 0),
        }
        for r in top_rows
    ]

    return UsageRollupOut(
        fromDate=from_date,
        toDate=to_date,
        totals=totals,
        byProvider=by_provider,
        topAgentsByCost=top_agents,
    )
