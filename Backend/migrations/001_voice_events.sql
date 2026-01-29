-- Voice channel: store metadata per voice turn (STT -> chat -> TTS)
-- Run this against your DB (e.g. psql $DATABASE_URL -f migrations/001_voice_events.sql)
CREATE TABLE IF NOT EXISTS voice_events (
    id BIGSERIAL PRIMARY KEY,
    correlation_id UUID NOT NULL UNIQUE,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id),
    session_id BIGINT NOT NULL,
    audio_duration_sec NUMERIC(10, 3),
    user_transcript TEXT NOT NULL,
    assistant_text TEXT NOT NULL,
    stt_provider VARCHAR(32) NOT NULL DEFAULT 'mock',
    tts_provider VARCHAR(32) NOT NULL DEFAULT 'mock',
    chat_provider VARCHAR(32),
    latency_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_events_tenant_session ON voice_events(tenant_id, session_id);
CREATE INDEX IF NOT EXISTS idx_voice_events_correlation ON voice_events(correlation_id);
