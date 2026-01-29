# StitchFin Agent Gateway

A **multi-tenant AI Agent Gateway** with a React dashboard: manage tenants, agents, and conversations; send text or voice messages; and view usage and cost analytics. All **AI (chat, STT, TTS) is mocked** so the app runs without real LLM or speech APIs.

---

## What This Project Is

- **Backend:** FastAPI + PostgreSQL (Neon). Multi-tenant API key auth, agent config (primary/fallback “AI” provider, system prompt), session-based conversations, idempotent message sending, usage rollups, and an optional voice channel (upload audio → “transcribe” → chat → “synthesize” → return audio).
- **Frontend:** React + Vite dashboard. Sign in with tenant API key; manage agents; create sessions; use Chat or Voice playgrounds; view usage and cost by date range (Chicago time).

Everything is designed to work end-to-end with **simulated AI**: no OpenAI, Anthropic, or real STT/TTS required. You can later swap mocks for real providers without changing the overall flow.

---

## ⚠️ Important: AI Is Mocked

**All AI in this project is simulated.** There are no calls to real LLMs or speech APIs. This is intentional so you can run, demo, and integrate the gateway without API keys or usage costs. Below is exactly how each part behaves.

### Chat (text messages)

Two mock “providers” stand in for real AI APIs:

| Provider  | Role        | Behavior |
|----------|-------------|----------|
| **VendorA** | Primary or fallback | Returns a **fixed-format reply**: `[VendorA] {first 60 chars of your message} ...` |
| **VendorB** | Primary or fallback | Same idea: `[VendorB] {first 60 chars of your message} ...` |

So the “response” is **not** real AI—it’s a short echo of the user prompt plus a prefix. Token counts and latency are **randomized** to simulate real APIs:

- **VendorA:** Latency one of 80, 120, 200, 400, 1800, 2500 ms. ~10% of calls return HTTP 500. Token counts derived from prompt length (input) and random 30–120 (output).
- **VendorB:** Latency one of 80, 120, 200, 300 ms. ~15% return HTTP 429 with `retryAfterMs`. Same style of input/output token counts.

The backend uses **primary + optional fallback**: if the primary “fails” (timeout, 500, 429), it retries with backoff and then tries the fallback. That way the app behaves like a real multi-provider setup even though both are mocks.

### How a chat response is generated

1. User sends a text message (or voice; see below).
2. Backend loads the session’s agent and its **primary** and **fallback** provider (VendorA / VendorB).
3. It calls the **primary** mock with a prompt like `SYSTEM: {agent system_prompt}\nUSER: {user message}`.
4. The mock **does not** call any real LLM. It:
   - Sleeps for the chosen latency.
   - Sometimes returns an error (500 for VendorA, 429 for VendorB).
   - On “success,” returns a normalized response: **text** = `[VendorA] ...` or `[VendorB] ...`, plus **tokens in/out** and **latency**.
5. If the primary fails after retries, the backend calls the **fallback** mock the same way.
6. The first successful response is stored as the assistant message; **usage** (tokens, cost) is recorded and returned to the client.

So every “AI” reply is this **deterministic mock**: same prompt in → same style of echo out, with random latency and occasional errors to exercise retries and fallback.

### Voice: STT and TTS

- **STT (Speech-to-Text):** Mock only. It **ignores** the actual audio content and returns a fixed string:  
  `"User said something via voice."` (or `"Please say something."` if audio is too short). So the “transcript” is never the real words—it’s a placeholder so the rest of the pipeline (chat + TTS) still runs.
- **TTS (Text-to-Speech):**  
  - If **edge-tts** is installed, the backend uses it to synthesize **real** speech (no mock).  
  - If not, it returns a **mock**: a short **beep** (440 Hz) plus silence, duration based on text length, as WAV. So you either get real speech or a beep so the client can play *something*.

Voice flow end-to-end: **upload audio → mock STT → same chat flow as above (mocked AI) → TTS (edge-tts or beep) → return audio.** All “AI” in that chain is still mocked except optional real TTS.

### Usage and cost

- **Tokens:** The mocks return **synthetic** token counts (from prompt length + random output). They are stored and rolled up like real usage.
- **Cost:** Backend applies a fixed **per-1k-token** price for each provider (e.g. VendorA, VendorB). So “cost” is real math on mock tokens, suitable for testing dashboards and analytics.

---

## Project structure

```
StitchFin-Assignment/
├── Backend/                    # FastAPI app
│   ├── app/
│   │   ├── main.py             # App, CORS, OPTIONS, routes
│   │   ├── db.py               # Async PostgreSQL (Neon)
│   │   ├── deps.py             # Tenant from X-API-Key
│   │   ├── models.py           # Pydantic + Provider enum
│   │   ├── settings.py         # DATABASE_URL, CORS, etc.
│   │   ├── providers/          # “AI” adapters
│   │   │   ├── adapters.py     # Normalized call_provider()
│   │   │   ├── vendor_a_mock.py
│   │   │   └── vendor_b_mock.py
│   │   ├── routers/            # tenants, agents, sessions, usage
│   │   ├── services/           # orchestration, reliability, metering
│   │   │   ├── orchestrator.py # send-message flow
│   │   │   ├── reliability.py  # retries, fallback
│   │   │   ├── metering.py     # cost per provider
│   │   │   ├── stt_mock.py     # fake transcript
│   │   │   └── tts_mock.py     # edge-tts or beep
│   │   └── ...
│   └── requirements.txt
├── Frontend/                   # React + Vite
│   ├── api/
│   │   └── config.js           # Vercel serverless: returns VITE_API_BASE_URL
│   ├── src/
│   │   ├── App.tsx
│   │   ├── lib/api.ts          # API client, ensureRuntimeConfig()
│   │   └── components/         # Dashboard, Agents, Sessions, Usage, Chat, Voice
│   ├── index.html
│   └── package.json
└── README.md                   # This file
```

---

## Tech stack

- **Backend:** Python 3.x, FastAPI, SQLAlchemy 2 (async), asyncpg, Neon PostgreSQL, Pydantic, optional edge-tts.
- **Frontend:** React 18, Vite 6, TypeScript, Tailwind, Radix UI, Recharts, Lucide icons.

---

## Run locally

### Backend

```bash
cd Backend
pip install -r requirements.txt
```

Create `Backend/.env`:

- `DATABASE_URL` — Neon (or any Postgres) connection string.
- `API_KEY_PEPPER` — Secret used when hashing API keys (any string).

Then:

```bash
uvicorn app.main:app --reload
```

Ensure DB tables exist (schema as needed). Create a tenant (e.g. `POST /tenants`) and use the returned API key in the frontend.

### Frontend

```bash
cd Frontend
npm install
npm run dev
```

Use the API key from the backend to sign in. The app defaults to `http://127.0.0.1:8000`; for a different backend set `VITE_API_BASE_URL` in a `.env` in `Frontend/` (or rely on runtime config when deployed).

---

## Deploy

### Backend (e.g. Railway, Render)

- Set env: `DATABASE_URL`, `API_KEY_PEPPER`, and optionally `CORS_ORIGINS` (e.g. `https://your-frontend.vercel.app`). The app also allows a known Vercel origin by default.
- Ensure DB tables exist on the deployed DB.
- Use the deployed backend URL as the frontend’s API base.

### Frontend (Vercel)

- **Environment variable:** `VITE_API_BASE_URL` = your backend URL (no trailing slash).
- **Runtime config:** The app calls `/api/config` at runtime; the Vercel serverless function in `Frontend/api/config.js` returns `VITE_API_BASE_URL` from the server. So even if the build didn’t have the env, the next load gets the correct API URL after you set it and redeploy.
- **Redeploy** after changing `VITE_API_BASE_URL` so the serverless function (and, if needed, the build) sees it.

CORS: Backend allows localhost and the known Vercel frontend origin; add more via `CORS_ORIGINS` if you use another domain.

---

## API overview

- **Tenants:** `POST /tenants` — create tenant, get API key.
- **Agents:** `GET /agents`, `POST /agents`, `PUT /agents/{id}` — CRUD; each agent has primary/fallback provider (VendorA/VendorB) and system prompt.
- **Sessions:** `POST /sessions` (create), `GET /sessions`, `GET /sessions/{id}/transcript`, `POST /sessions/{id}/messages` (with `Idempotency-Key`), `POST /sessions/{id}/voice` (upload audio, get audio back).
- **Usage:** `GET /usage?from=YYYY-MM-DD&to=YYYY-MM-DD` — rollups by tenant (Chicago time for date interpretation).

All routes (except health) require `X-API-Key`. Data is tenant-scoped.

---

## Summary

- **StitchFin Agent Gateway** = multi-tenant conversation API + React dashboard, with **mocked AI** (chat providers, STT, and optional TTS fallback).
- **Responses** are not from real LLMs: they are deterministic echoes with random latency and occasional errors to test retries and fallback.
- **Voice:** STT is always mock text; TTS is real (edge-tts) or beep. Chat in the middle is the same mock flow as text.
- You can run and deploy everything without any external AI API keys; later you can replace the mocks with real providers using the same adapter interface.
