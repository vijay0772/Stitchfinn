from app.models import Provider

PRICING_PER_1K = {
    Provider.vendorA: 0.002,
    Provider.vendorB: 0.003,
}


def compute_cost(provider: Provider, tokens_in: int, tokens_out: int) -> float:
    total = tokens_in + tokens_out
    return float((total / 1000.0) * PRICING_PER_1K[provider])
