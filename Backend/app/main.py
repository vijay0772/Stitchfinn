from fastapi import FastAPI
from app.routers.tenants import router as tenants_router
from app.routers.agents import router as agents_router
from app.routers.sessions import router as sessions_router
from app.routers.usage import router as usage_router
from starlette.middleware.cors import CORSMiddleware

app = FastAPI(title="VocalBridge Agent Gateway (Supabase + FastAPI)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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
