from datetime import datetime
from enum import Enum

import structlog

logger = structlog.get_logger()

# Default freshness thresholds in days
FRESHNESS_THRESHOLDS = {
    "hotel": 7,
    "restaurant": 7,
    "attraction": 30,
    "visa_rule": 30,
    "health_advisory": 30,
    "travel_warning": 7,
}


class FreshnessStatus(str, Enum):
    FRESH = "fresh"
    STALE = "stale"
    EXPIRED = "expired"


def evaluate_freshness(entity: dict, now: datetime | None = None) -> FreshnessStatus:
    """Evaluate the freshness of an entity based on its type and timestamps."""
    now = now or datetime.utcnow()

    expires_at_str = entity.get("expires_at")
    if not expires_at_str:
        return FreshnessStatus.STALE

    if isinstance(expires_at_str, str):
        expires_at = datetime.fromisoformat(expires_at_str)
    else:
        expires_at = expires_at_str

    if now > expires_at:
        return FreshnessStatus.EXPIRED

    # Warn if within 20% of expiry
    ingested_at_str = entity.get("ingested_at")
    if ingested_at_str:
        if isinstance(ingested_at_str, str):
            ingested_at = datetime.fromisoformat(ingested_at_str)
        else:
            ingested_at = ingested_at_str
        total_lifespan = (expires_at - ingested_at).total_seconds()
        elapsed = (now - ingested_at).total_seconds()
        if total_lifespan > 0 and elapsed / total_lifespan > 0.8:
            return FreshnessStatus.STALE

    return FreshnessStatus.FRESH


def filter_fresh(entities: list[dict]) -> list[dict]:
    """Return only fresh entities."""
    return [e for e in entities if evaluate_freshness(e) == FreshnessStatus.FRESH]


def filter_with_warnings(entities: list[dict]) -> list[dict]:
    """Return entities with freshness status attached."""
    results = []
    for entity in entities:
        status = evaluate_freshness(entity)
        entity["freshness_status"] = status.value
        if status != FreshnessStatus.EXPIRED:
            results.append(entity)
    return results
