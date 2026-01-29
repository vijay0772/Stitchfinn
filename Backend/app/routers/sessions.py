import logging
import time
import uuid
from fastapi import APIRouter, Depends, HTTPException, Header, File, UploadFile
from fastapi.responses import Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_tenant
from app.models import (
    SessionCreateIn,
    SessionCreateOut,
    MessageCreateIn,
    SendMessageOut,
    TranscriptOut,
)
from app.services.orchestrator import handle_send_message
from app.services.stt_mock import transcribe as stt_transcribe
from app.services.tts_mock import synthesize_async as tts_synthesize_async

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/sessions", tags=["sessions"])

@router.get("")
async def list_sessions(
    tenant=Depends(get_tenant),
    db: AsyncSession = Depends(get_db),
):
    q = text("""
        select
            s.id,
            a.name as agent_name,
            s.customer_id,
            coalesce((
                select count(1)
                from messages m
                where m.tenant_id = s.tenant_id and m.session_id = s.id
            ), 0) as message_count,
            s.created_at as created_at,
            coalesce(sum(ue.tokens_in + ue.tokens_out), 0) as total_tokens,
            coalesce(sum(ue.cost), 0) as total_cost
        from sessions s
        join agents a on a.id = s.agent_id and a.tenant_id = s.tenant_id
        left join usage_events ue on ue.session_id = s.id and ue.tenant_id = s.tenant_id
        where s.tenant_id = :tid
        group by s.id, a.name, s.customer_id, s.created_at
        order by s.id desc
    """)
    res = await db.execute(q, {"tid": tenant["tenant_id"]})
    rows = res.mappings().all()
    return [
        {
            "id": r["id"],
            "agentName": r["agent_name"],
            "customerId": r["customer_id"],
            "messageCount": int(r["message_count"] or 0),
            "timestamp": str(r["created_at"]),
            "status": "completed",
            "totalTokens": int(r["total_tokens"] or 0),
            "totalCost": float(r["total_cost"] or 0.0),
        }
        for r in rows
    ]


@router.get("/{session_id}/transcript", response_model=TranscriptOut)
async def get_session_transcript(
    session_id: int,
    tenant=Depends(get_tenant),
    db: AsyncSession = Depends(get_db),
):
    # Load aggregate session row (mirrors list_sessions shape, but for a single id)
    session_q = text(
        """
        select
            s.id,
            a.name as agent_name,
            s.customer_id,
            coalesce((
                select count(1)
                from messages m
                where m.tenant_id = s.tenant_id and m.session_id = s.id
            ), 0) as message_count,
            s.created_at as created_at,
            coalesce(sum(ue.tokens_in + ue.tokens_out), 0) as total_tokens,
            coalesce(sum(ue.cost), 0) as total_cost
        from sessions s
        join agents a on a.id = s.agent_id and a.tenant_id = s.tenant_id
        left join usage_events ue on ue.session_id = s.id and ue.tenant_id = s.tenant_id
        where s.tenant_id = :tid and s.id = :sid
        group by s.id, a.name, s.customer_id, s.created_at
        limit 1
        """
    )
    s_res = await db.execute(session_q, {"tid": tenant["tenant_id"], "sid": session_id})
    s_row = s_res.mappings().first()
    if not s_row:
        raise HTTPException(status_code=404, detail="Session not found")

    # Load messages for the session
    messages_q = text(
        """
        select id, role, content, created_at
        from messages
        where tenant_id = :tid and session_id = :sid
        order by id asc
        """
    )
    m_res = await db.execute(messages_q, {"tid": tenant["tenant_id"], "sid": session_id})
    m_rows = m_res.mappings().all()

    session_payload = {
        "id": s_row["id"],
        "agentName": s_row["agent_name"],
        "customerId": s_row["customer_id"],
        "messageCount": int(s_row["message_count"] or 0),
        "timestamp": str(s_row["created_at"]),
        "status": "completed",
        "totalTokens": int(s_row["total_tokens"] or 0),
        "totalCost": float(s_row["total_cost"] or 0.0),
    }

    messages_payload = [
        {
            "id": r["id"],
            "role": r["role"],
            "content": r["content"],
            "timestamp": str(r["created_at"]),
        }
        for r in m_rows
    ]

    return TranscriptOut(session=session_payload, messages=messages_payload)


@router.post("", response_model=SessionCreateOut)
async def create_session(
    payload: SessionCreateIn,
    tenant=Depends(get_tenant),
    db: AsyncSession = Depends(get_db),
):
    # Ensure agent belongs to tenant
    check = text("""
        select id from agents where id = :aid and tenant_id = :tid
    """)
    c_res = await db.execute(check, {"aid": payload.agentId, "tid": tenant["tenant_id"]})
    if not c_res.first():
        raise HTTPException(status_code=404, detail="Agent not found")

    q = text("""
        insert into sessions (tenant_id, agent_id, customer_id)
        values (:tid, :aid, :cid)
        returning id
    """)
    res = await db.execute(q, {"tid": tenant["tenant_id"], "aid": payload.agentId, "cid": payload.customerId})
    row = res.mappings().first()
    await db.commit()
    return SessionCreateOut(sessionId=row["id"])


@router.post("/{session_id}/messages", response_model=SendMessageOut)
async def send_message(
    session_id: int,
    payload: MessageCreateIn,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    tenant=Depends(get_tenant),
    db: AsyncSession = Depends(get_db),
):
    if not idempotency_key:
        raise HTTPException(status_code=400, detail="Missing Idempotency-Key")

    return await handle_send_message(
        db=db,
        tenant_id=tenant["tenant_id"],
        session_id=session_id,
        user_text=payload.text,
        idempotency_key=idempotency_key,
    )


@router.post("/{session_id}/voice")
async def voice_turn(
    session_id: int,
    audio: UploadFile = File(..., description="Audio recording (e.g. WAV/WebM)"),
    tenant=Depends(get_tenant),
    db: AsyncSession = Depends(get_db),
):
    """
    Voice channel: upload audio -> mock STT -> existing session/message flow -> mock TTS -> return audio.
    Returns audio/wav and headers X-Correlation-Id, X-Transcript for debugging.
    """
    correlation_id = uuid.uuid4()
    logger.info("voice_turn start session_id=%s correlation_id=%s", session_id, correlation_id)
    t0 = time.perf_counter()

    # Validate session (tenant-scoped)
    s_q = text(
        "select id from sessions where id = :sid and tenant_id = :tid limit 1"
    )
    s_res = await db.execute(s_q, {"sid": session_id, "tid": tenant["tenant_id"]})
    if not s_res.mappings().first():
        logger.warning("voice_turn session not found session_id=%s correlation_id=%s", session_id, correlation_id)
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        audio_bytes = await audio.read()
    except Exception as e:
        logger.exception("voice_turn read audio failed correlation_id=%s", correlation_id)
        raise HTTPException(status_code=400, detail="Failed to read audio") from e

    if len(audio_bytes) < 1:
        raise HTTPException(status_code=400, detail="Empty audio")

    # Optional: rough duration (16kHz 16-bit mono)
    audio_duration_sec = round(len(audio_bytes) / (16000 * 2), 3) if len(audio_bytes) > 1000 else None

    # Mock STT
    user_transcript = stt_transcribe(audio_bytes)

    # Existing session/message flow (billed, logged, tenant-scoped)
    idempotency_key = f"voice-{correlation_id}"
    try:
        msg_result = await handle_send_message(
            db=db,
            tenant_id=tenant["tenant_id"],
            session_id=session_id,
            user_text=user_transcript,
            idempotency_key=idempotency_key,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("voice_turn handle_send_message failed correlation_id=%s", correlation_id)
        raise HTTPException(status_code=502, detail="Agent unavailable") from e

    assistant_text = msg_result["replyText"]
    provider_used = msg_result.get("providerUsed", "vendorA")

    # TTS: real speech (edge-tts) when available, else beep + silence
    audio_out, media_type = await tts_synthesize_async(assistant_text)

    latency_ms = int((time.perf_counter() - t0) * 1000)
    logger.info(
        "voice_turn done correlation_id=%s latency_ms=%s transcript_len=%s",
        correlation_id, latency_ms, len(user_transcript),
    )

    # Store voice metadata (best-effort; table may not exist until migration is run)
    try:
        ins = text("""
            insert into voice_events
            (correlation_id, tenant_id, session_id, audio_duration_sec, user_transcript, assistant_text, stt_provider, tts_provider, chat_provider, latency_ms)
            values (:cid, :tid, :sid, :dur, :ut, :at, 'mock', 'mock', :chat_prov, :lat)
        """)
        await db.execute(ins, {
            "cid": correlation_id,
            "tid": tenant["tenant_id"],
            "sid": session_id,
            "dur": audio_duration_sec,
            "ut": user_transcript,
            "at": assistant_text,
            "chat_prov": provider_used,
            "lat": latency_ms,
        })
        await db.commit()
    except Exception as e:
        logger.warning("voice_events insert failed (run migrations?): %s", e)
        await db.rollback()

    return Response(
        content=audio_out,
        media_type=media_type,
        headers={
            "X-Correlation-Id": str(correlation_id),
            "X-Transcript": user_transcript[:200].replace("\r", " ").replace("\n", " "),
            "X-Assistant-Transcript": assistant_text[:200].replace("\r", " ").replace("\n", " "),
        },
    )
