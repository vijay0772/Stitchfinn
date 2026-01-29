from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_tenant
from app.models import UsageRollupOut
from app.services.analytics import get_usage_rollup


router = APIRouter(prefix="/usage", tags=["usage"])


@router.get("", response_model=UsageRollupOut)
async def usage(
    from_date: str = Query(..., alias="from"),
    to_date: str = Query(..., alias="to"),
    tenant=Depends(get_tenant),
    db: AsyncSession = Depends(get_db)
):
    return await get_usage_rollup(db=db, tenant_id=tenant["tenant_id"], from_date=from_date, to_date=to_date)
