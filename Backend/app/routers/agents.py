from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text, bindparam
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import JSONB

from app.db import get_db
from app.deps import get_tenant
from app.models import AgentCreateIn, AgentUpdateIn, AgentOut


router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("", response_model=list[AgentOut])
async def list_agents(
    tenant=Depends(get_tenant),
    db: AsyncSession = Depends(get_db)
):
    q = text("""
        select id, tenant_id, name, primary_provider, fallback_provider, system_prompt, enabled_tools
        from agents
        where tenant_id = :tenant_id
        order by id asc
    """)
    res = await db.execute(q, {"tenant_id": tenant["tenant_id"]})
    return [dict(r) for r in res.mappings().all()]


@router.post("", response_model=AgentOut)
async def create_agent(
    payload: AgentCreateIn,
    tenant=Depends(get_tenant),
    db: AsyncSession = Depends(get_db)
):
    q = text("""
        insert into agents (tenant_id, name, primary_provider, fallback_provider, system_prompt, enabled_tools)
        values (:tenant_id, :name, :primary_provider, :fallback_provider, :system_prompt, :enabled_tools)
        returning id, tenant_id, name, primary_provider, fallback_provider, system_prompt, enabled_tools
    """).bindparams(bindparam("enabled_tools", type_=JSONB))
    res = await db.execute(q, {
        "tenant_id": tenant["tenant_id"],
        "name": payload.name,
        "primary_provider": payload.primaryProvider.value,
        "fallback_provider": payload.fallbackProvider.value if payload.fallbackProvider else None,
        "system_prompt": payload.systemPrompt,
        "enabled_tools": payload.enabledTools,
    })
    row = res.mappings().first()
    await db.commit()
    return dict(row)


@router.put("/{agent_id}", response_model=AgentOut)
async def update_agent(
    agent_id: int,
    payload: AgentUpdateIn,
    tenant=Depends(get_tenant),
    db: AsyncSession = Depends(get_db)
):
    # Ensure agent belongs to tenant
    check = text("select id from agents where id = :id and tenant_id = :tenant_id")
    res = await db.execute(check, {"id": agent_id, "tenant_id": tenant["tenant_id"]})
    if not res.first():
        raise HTTPException(status_code=404, detail="Agent not found")

    updates = []
    params = {"id": agent_id, "tenant_id": tenant["tenant_id"]}

    if payload.name is not None:
        updates.append("name = :name"); params["name"] = payload.name
    if payload.primaryProvider is not None:
        updates.append("primary_provider = :primary_provider"); params["primary_provider"] = payload.primaryProvider.value
    # Note: fallbackProvider can be explicitly set to null
    if payload.fallbackProvider is not None:
        updates.append("fallback_provider = :fallback_provider"); params["fallback_provider"] = payload.fallbackProvider.value
    if payload.systemPrompt is not None:
        updates.append("system_prompt = :system_prompt"); params["system_prompt"] = payload.systemPrompt
    if payload.enabledTools is not None:
        updates.append("enabled_tools = :enabled_tools")
        params["enabled_tools"] = payload.enabledTools

    if not updates:
        # Return current row
        q = text("""
            select id, tenant_id, name, primary_provider, fallback_provider, system_prompt, enabled_tools
            from agents where id = :id and tenant_id = :tenant_id
        """)
        out = await db.execute(q, params)
        return dict(out.mappings().first())

    q = text(f"""
        update agents
        set {", ".join(updates)}, updated_at = now()
        where id = :id and tenant_id = :tenant_id
        returning id, tenant_id, name, primary_provider, fallback_provider, system_prompt, enabled_tools
    """)
    # Bind JSONB type if enabled_tools is present
    if "enabled_tools" in params:
        q = q.bindparams(bindparam("enabled_tools", type_=JSONB))
    out = await db.execute(q, params)
    await db.commit()
    return dict(out.mappings().first())
