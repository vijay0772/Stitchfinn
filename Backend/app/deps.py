import hashlib
from fastapi import Header, HTTPException, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.settings import settings

def hash_key(api_key: str) -> str:
    return hashlib.sha256((api_key + settings.api_key_pepper).encode()).hexdigest()

async def get_tenant(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
):
    if not x_api_key:
        raise HTTPException(401, "Missing X-API-Key")

    h = hash_key(x_api_key)
    res = await db.execute(text("SELECT id, name FROM tenants WHERE api_key_hash=:h"), {"h": h})
    row = res.mappings().first()
    if not row:
        raise HTTPException(401, "Invalid API key")

    return {"tenant_id": row["id"], "tenant_name": row["name"]}
