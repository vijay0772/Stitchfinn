from dataclasses import dataclass
from app.models import Provider
from app.providers.vendor_a_mock import vendor_a_chat
from app.providers.vendor_b_mock import vendor_b_chat


class ProviderError(Exception):
    def __init__(self, http_code: int, message: str = "", retry_after_ms: int | None = None):
        super().__init__(message or f"ProviderError {http_code}")
        self.http_code = http_code
        self.retry_after_ms = retry_after_ms


@dataclass
class NormalizedAIResponse:
    provider: Provider
    text: str
    tokens_in: int
    tokens_out: int
    latency_ms: int | None = None


async def call_provider(provider: Provider, prompt: str) -> NormalizedAIResponse:
    if provider == Provider.vendorA:
        raw = await vendor_a_chat(prompt)
        if "_error" in raw:
            e = raw["_error"]
            raise ProviderError(e["http_code"], e.get("message", "VendorA error"))
        return NormalizedAIResponse(
            provider=Provider.vendorA,
            text=raw["outputText"],
            tokens_in=raw["tokensIn"],
            tokens_out=raw["tokensOut"],
            latency_ms=raw.get("latencyMs")
        )

    raw = await vendor_b_chat(prompt)
    if "_error" in raw:
        e = raw["_error"]
        raise ProviderError(e["http_code"], "VendorB rate limited", e.get("retryAfterMs"))
    return NormalizedAIResponse(
        provider=Provider.vendorB,
        text=raw["choices"][0]["message"]["content"],
        tokens_in=raw["usage"]["input_tokens"],
        tokens_out=raw["usage"]["output_tokens"],
        latency_ms=None
    )
