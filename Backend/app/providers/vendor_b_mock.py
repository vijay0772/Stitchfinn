import random
import asyncio


async def vendor_b_chat(prompt: str) -> dict:
    await asyncio.sleep(random.choice([80, 120, 200, 300]) / 1000)

    # Can return HTTP 429 with retryAfterMs
    if random.random() < 0.15:
        return {"_error": {"http_code": 429, "retryAfterMs": random.choice([200, 400, 800])}}

    input_tokens = max(1, len(prompt) // 4)
    output_tokens = random.randint(30, 120)

    return {
        "choices": [{"message": {"content": f"[VendorB] {prompt[:60]} ..."}}],
        "usage": {"input_tokens": input_tokens, "output_tokens": output_tokens},
    }
