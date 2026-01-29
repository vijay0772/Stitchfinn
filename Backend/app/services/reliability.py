import asyncio
from typing import Optional, Tuple

from app.models import Provider
from app.providers.adapters import call_provider, NormalizedAIResponse, ProviderError


RETRYABLE = {429, 500}


def backoff_seconds(attempt: int) -> float:
    # attempt 1 -> 0.1, attempt 2 -> 0.2, attempt 3 -> 0.4 (cap 0.8)
    return min(0.8, 0.1 * (2 ** (attempt - 1)))


async def call_with_reliability(
    provider: Provider,
    prompt: str,
    timeout_s: float,
    max_retries: int
) -> Tuple[Optional[NormalizedAIResponse], int, Optional[tuple]]:
    """
    Returns: (response_or_none, attempts_used, error_tuple)
    error_tuple: ("timeout"|"http_error", ProviderError|None)
    """
    attempt = 0
    while True:
        attempt += 1
        try:
            resp = await asyncio.wait_for(call_provider(provider, prompt), timeout=timeout_s)
            return resp, attempt, None
        except asyncio.TimeoutError:
            if attempt > max_retries:
                return None, attempt, ("timeout", None)
            await asyncio.sleep(backoff_seconds(attempt))
        except ProviderError as e:
            if e.http_code not in RETRYABLE or attempt > max_retries:
                return None, attempt, ("http_error", e)

            if e.http_code == 429 and e.retry_after_ms:
                await asyncio.sleep(e.retry_after_ms / 1000)
            else:
                await asyncio.sleep(backoff_seconds(attempt))
