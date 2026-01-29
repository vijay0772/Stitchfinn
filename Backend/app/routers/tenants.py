import secrets
import hashlib
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_tenant
from app.settings import settings
from app.models import TenantCreateIn, TenantCreateOut


router = APIRouter(prefix="/tenants", tags=["tenants"])


def _hash_api_key(raw_key: str) -> str:
    data = (raw_key + settings.api_key_pepper).encode("utf-8")
    return hashlib.sha256(data).hexdigest()


@router.post("", response_model=TenantCreateOut)
async def create_tenant(payload: TenantCreateIn, db: AsyncSession = Depends(get_db)):
    # Admin/seed endpoint
    api_key = "tnt_" + secrets.token_hex(24)
    api_key_hash = _hash_api_key(api_key)

    q = text("""
        insert into tenants (name, api_key_hash)
        values (:name, :api_key_hash)
        returning id
    """)
    res = await db.execute(q, {"name": payload.name, "api_key_hash": api_key_hash})
    tenant_id = res.scalar_one()
    await db.commit()

    return TenantCreateOut(tenantId=tenant_id, apiKey=api_key)


@router.get("/me")
async def get_my_tenant(tenant=Depends(get_tenant)):
    # Returns tenant info for the current X-API-Key
    return {"tenantId": tenant["tenant_id"], "name": tenant["tenant_name"]}
