# Stitchfinn

Agent Gateway (FastAPI) + React dashboard — multi-tenant, conversation API, usage metering, and voice channel.

## Repo layout

- **Backend/** — FastAPI, Postgres (Neon), mocked vendors, usage analytics, voice (STT/TTS)
- **Frontend/** — React + Vite dashboard (agents, chat, sessions, usage, voice)

## Run locally

**Backend:** `cd Backend && pip install -r requirements.txt && uvicorn app.main:app --reload`  
**Frontend:** `cd Frontend && npm i && npm run dev`

Set `Backend/.env` with `DATABASE_URL` and `API_KEY_PEPPER`. Create a tenant and use the API key to log in to the dashboard.

## Deploy

- Backend: e.g. Railway (set env vars, use Neon `DATABASE_URL`)
- Frontend: e.g. Vercel (set `VITE_API_BASE_URL` to backend URL, add CORS origin on backend)
