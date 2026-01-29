import random
import asyncio


async def vendor_a_chat(prompt: str) -> dict:
    # Some requests are slow
    latency_ms = random.choice([80, 120, 200, 400, 1800, 2500])
    await asyncio.sleep(latency_ms / 1000)

    # ~10% return HTTP 500
    if random.random() < 0.10:
        return {"_error": {"http_code": 500, "message": "VendorA internal error"}}

    tokens_in = max(1, len(prompt) // 4)
    tokens_out = random.randint(30, 120)

    return {
        "outputText": f"[VendorA] {prompt[:60]} ...",
        "tokensIn": tokens_in,
        "tokensOut": tokens_out,
        "latencyMs": latency_ms,
    }
