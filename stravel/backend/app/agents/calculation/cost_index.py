"""Destination cost index for Vietnam regions. Higher = more expensive."""

DESTINATION_COST_INDEX: dict[str, float] = {
    "hanoi": 0.85,
    "hcmc": 0.90,
    "danang": 0.80,
    "hoian": 0.75,
    "hue": 0.70,
    "sapa": 0.75,
    "halong": 0.95,
    "nhatrang": 0.80,
    "dalat": 0.65,
    "phuquoc": 1.10,
    "mekong": 0.60,
    "cantho": 0.60,
    "phanthiet": 0.75,
    "muine": 0.80,
    "quynhon": 0.65,
    "kontum": 0.55,
    "buonmathuot": 0.55,
    "condao": 1.15,
    "catba": 0.80,
    "ninh binh": 0.65,
    "mai chau": 0.60,
}

# Default allocation percentages by travel style
ALLOCATION_PROFILES: dict[str, dict[str, float]] = {
    "budget": {
        "flights": 0.30,
        "accommodation": 0.25,
        "activities": 0.15,
        "food": 0.15,
        "transport": 0.08,
        "insurance": 0.02,
        "buffer": 0.05,
    },
    "mid-range": {
        "flights": 0.30,
        "accommodation": 0.35,
        "activities": 0.12,
        "food": 0.10,
        "transport": 0.05,
        "insurance": 0.03,
        "buffer": 0.05,
    },
    "luxury": {
        "flights": 0.25,
        "accommodation": 0.40,
        "activities": 0.12,
        "food": 0.08,
        "transport": 0.05,
        "insurance": 0.03,
        "buffer": 0.07,
    },
    "default": {
        "flights": 0.30,
        "accommodation": 0.35,
        "activities": 0.12,
        "food": 0.10,
        "transport": 0.05,
        "insurance": 0.03,
        "buffer": 0.05,
    },
}


def get_cost_index(destination: str) -> float:
    """Get cost index for a destination (case-insensitive). Returns 1.0 for unknown."""
    return DESTINATION_COST_INDEX.get(destination.lower().strip(), 1.0)


def get_average_cost_index(destinations: list[str]) -> float:
    """Get average cost index across multiple destinations."""
    if not destinations:
        return 1.0
    indices = [get_cost_index(d) for d in destinations]
    return sum(indices) / len(indices)
