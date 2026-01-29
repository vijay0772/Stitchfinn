export type UsageRollup = {
  fromDate: string;
  toDate: string;
  totals: { tokensIn: number; tokensOut: number; cost: number };
  byProvider: Record<string, { tokensIn: number; tokensOut: number; cost: number }>;
  topAgentsByCost: Array<{ agentId: number; agentName: string; cost: number }>;
};

const DEFAULT_BASE =
  (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_API_BASE_URL) ||
  'http://127.0.0.1:8000';

let API_BASE_URL = DEFAULT_BASE;
let API_KEY: string | null = null;

export function setApiBaseUrl(url: string) {
  API_BASE_URL = url.replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export function setApiKey(key: string) {
  API_KEY = key;
}

function getHeaders(extra?: HeadersInit): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
    ...(extra || {}),
  };
}

export async function getUsageRollup(from: string, to: string): Promise<UsageRollup> {
  const url = `${API_BASE_URL}/usage?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Usage fetch failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Agents
export type BackendAgent = {
  id: number;
  tenant_id: number;
  name: string;
  primary_provider: 'vendorA' | 'vendorB';
  fallback_provider: 'vendorA' | 'vendorB' | null;
  system_prompt: string;
  enabled_tools: string[];
};

export async function listAgents(): Promise<BackendAgent[]> {
  const res = await fetch(`${API_BASE_URL}/agents`, { headers: getHeaders() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`List agents failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function createAgent(payload: {
  name: string;
  primaryProvider: 'VendorA' | 'VendorB';
  fallbackProvider?: 'VendorA' | 'VendorB';
  systemPrompt: string;
  enabledTools: string[];
}): Promise<BackendAgent> {
  const body = {
    name: payload.name,
    primaryProvider: payload.primaryProvider === 'VendorA' ? 'vendorA' : 'vendorB',
    fallbackProvider: payload.fallbackProvider
      ? payload.fallbackProvider === 'VendorA' ? 'vendorA' : 'vendorB'
      : null,
    systemPrompt: payload.systemPrompt,
    enabledTools: payload.enabledTools,
  };
  const res = await fetch(`${API_BASE_URL}/agents`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create agent failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Sessions and messages
export async function createSession(agentId: number, customerId: string): Promise<{ sessionId: number }> {
  const res = await fetch(`${API_BASE_URL}/sessions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ agentId, customerId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create session failed: ${res.status} ${text}`);
  }
  return res.json();
}

export type SendMessageResponse = {
  replyText: string;
  providerUsed: 'vendorA' | 'vendorB';
  tokensIn: number;
  tokensOut: number;
  cost: number;
  latencyMs?: number;
};

export async function sendMessage(sessionId: number, text: string, idempotencyKey: string): Promise<SendMessageResponse> {
  const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: getHeaders({ 'Idempotency-Key': idempotencyKey }),
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const textBody = await res.text();
    throw new Error(`Send message failed: ${res.status} ${textBody}`);
  }
  return res.json();
}

// Sessions listing
export type BackendSessionRow = {
  id: number;
  agentName: string;
  customerId: string;
  messageCount: number;
  timestamp: string;
  status: 'completed' | 'active' | 'error';
  totalTokens: number;
  totalCost: number;
};

export async function listSessions(): Promise<BackendSessionRow[]> {
  const res = await fetch(`${API_BASE_URL}/sessions`, { headers: getHeaders() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`List sessions failed: ${res.status} ${text}`);
  }
  return res.json();
}

export type TranscriptMessage = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  // Optional per-message metrics; currently not populated by backend, but left
  // for future extension without breaking the frontend.
  provider?: 'vendorA' | 'vendorB';
  tokens?: number;
  cost?: number;
};

export type SessionTranscriptResponse = {
  session: BackendSessionRow;
  messages: TranscriptMessage[];
};

export async function getSessionTranscript(sessionId: number): Promise<SessionTranscriptResponse> {
  const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/transcript`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Get transcript failed: ${res.status} ${text}`);
  }
  return res.json();
}

// Voice channel: upload audio -> backend STT -> session/message flow -> backend TTS -> return audio
export type VoiceTurnResponse = {
  audioBlob: Blob;
  correlationId: string;
  transcript: string;
  assistantTranscript: string;
};

export async function sendVoiceMessage(sessionId: number, audioBlob: Blob): Promise<VoiceTurnResponse> {
  const form = new FormData();
  form.append('audio', audioBlob, 'recording.webm');
  const headers: HeadersInit = API_KEY ? { 'X-API-Key': API_KEY } : {};
  const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/voice`, {
    method: 'POST',
    headers,
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Voice turn failed: ${res.status} ${text}`);
  }
  const correlationId = res.headers.get('X-Correlation-Id') || '';
  const transcript = res.headers.get('X-Transcript') || '';
  const assistantTranscript = res.headers.get('X-Assistant-Transcript') || '';
  const audioBlobOut = await res.blob();
  return { audioBlob: audioBlobOut, correlationId, transcript, assistantTranscript };
}

// Simple API key validation helper. Does NOT mutate global API_KEY.
export async function validateApiKeyOnce(key: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/agents`, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': key,
    },
  });
  if (res.status === 401) {
    throw new Error('Invalid API key');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API key validation failed: ${res.status} ${text}`);
  }
}

export async function getTenantMe(): Promise<{ tenantId: number; name: string }> {
  const res = await fetch(`${API_BASE_URL}/tenants/me`, { headers: getHeaders() });
  if (res.status === 401) {
    throw new Error('Invalid API key');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Get tenant failed: ${res.status} ${text}`);
  }
  return res.json();
}
