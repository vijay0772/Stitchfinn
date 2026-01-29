from __future__ import annotations
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class Provider(str, Enum):
    vendorA = "vendorA"
    vendorB = "vendorB"


# ---------- Requests / Responses (API Schemas) ----------

class TenantCreateIn(BaseModel):
    name: str = "Unnamed Tenant"


class TenantCreateOut(BaseModel):
    tenantId: int
    apiKey: str


class AgentCreateIn(BaseModel):
    name: str
    primaryProvider: Provider
    fallbackProvider: Optional[Provider] = None
    systemPrompt: str
    enabledTools: List[str] = Field(default_factory=list)


class AgentUpdateIn(BaseModel):
    name: Optional[str] = None
    primaryProvider: Optional[Provider] = None
    fallbackProvider: Optional[Provider] = None
    systemPrompt: Optional[str] = None
    enabledTools: Optional[List[str]] = None


class AgentOut(BaseModel):
    id: int
    tenant_id: int
    name: str
    primary_provider: Provider
    fallback_provider: Optional[Provider]
    system_prompt: str
    enabled_tools: List[str]


class SessionCreateIn(BaseModel):
    agentId: int
    customerId: str


class SessionCreateOut(BaseModel):
    sessionId: int


class MessageCreateIn(BaseModel):
    text: str


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: str


class TranscriptOut(BaseModel):
    session: Dict[str, Any]
    messages: List[Dict[str, Any]]


class SendMessageOut(BaseModel):
    replyText: str
    providerUsed: Provider
    tokensIn: int
    tokensOut: int
    cost: float
    latencyMs: Optional[int] = None


class UsageRollupOut(BaseModel):
    fromDate: str
    toDate: str
    totals: Dict[str, Any]
    byProvider: Dict[str, Any]
    topAgentsByCost: List[Dict[str, Any]]
