# Migrations

Run the voice channel migration to create the `voice_events` table (stores voice metadata: correlation ID, transcript, provider, latency).

```bash
# From repo root, with DATABASE_URL set or replace with your connection string:
psql "$DATABASE_URL" -f Backend/migrations/001_voice_events.sql
```

If you skip this, the voice endpoint still works; metadata is just not persisted (a warning is logged).
