from fastapi import FastAPI
from app.routers.tenants import router as tenants_router
from app.routers.agents import router as agents_router
from app.routers.sessions import router as sessions_router
from app.routers.usage import router as usage_router
from app.settings import settings
from starlette.middleware.cors import CORSMiddleware

app = FastAPI(title="VocalBridge Agent Gateway (Supabase + FastAPI)")

_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
if settings.cors_origins:
    _origins.extend(o.strip() for o in settings.cors_origins.split(",") if o.strip())

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Correlation-Id", "X-Transcript", "X-Assistant-Transcript"],
)

@app.get("/")
def root():
    return {"ok": True, "service": "agent-gateway"}

app.include_router(tenants_router)
app.include_router(agents_router)
app.include_router(sessions_router)
app.include_router(usage_router)
