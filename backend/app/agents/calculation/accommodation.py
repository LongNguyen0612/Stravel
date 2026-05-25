import structlog

from app.agents.calculation.schemas import AccommodationMatch

logger = structlog.get_logger()

REGION_ALIASES = {
    "saigon": "hcmc",
    "ho chi minh": "hcmc",
    "ho chi minh city": "hcmc",
    "da nang": "danang",
    "hoi an": "hoian",
    "phu quoc": "phuquoc",
    "ha long": "halong",
    "nha trang": "nhatrang",
    "da lat": "dalat",
}

ADJACENT_REGIONS = {
    "hcmc": ["mekong", "phuquoc", "nhatrang"],
    "hanoi": ["halong", "sapa", "ninhbinh"],
    "danang": ["hoian", "hue"],
    "hoian": ["danang", "hue"],
}


def normalize_region(region: str) -> str:
    r = region.lower().strip()
    return REGION_ALIASES.get(r, r)


def score_accommodation(
    entity: dict,
    budget_per_night: float,
    target_region: str,
    target_style: str | None = None,
) -> float:
    """Score an accommodation entity (0-1) based on multiple factors."""
    price = entity.get("pricing", 0) or 0
    rating = entity.get("rating", 0) or 0
    region = normalize_region(entity.get("region", ""))
    style = entity.get("accommodation_style", "")
    if not style:
        meta = entity.get("metadata_extra") or {}
        style = meta.get("accommodation_style", "") if isinstance(meta, dict) else ""

    # Price score (0-1): closer to budget = better, over budget penalized
    if budget_per_night > 0 and price > 0:
        ratio = price / budget_per_night
        if ratio <= 1.0:
            price_score = ratio  # Under budget: higher ratio = using budget well
        else:
            price_score = max(0, 1.0 - (ratio - 1.0) * 2)  # Over budget: penalize
    else:
        price_score = 0.5

    # Rating score (0-1)
    rating_score = min(rating / 5.0, 1.0) if rating > 0 else 0.5

    # Style score
    style_score = 1.0 if target_style and style.lower() == target_style.lower() else 0.5

    # Freshness score
    freshness = entity.get("freshness_status", "fresh")
    freshness_score = 1.0 if freshness == "fresh" else 0.5 if freshness == "stale" else 0.0

    # Location score
    target_norm = normalize_region(target_region)
    if region == target_norm:
        location_score = 1.0
    elif region in ADJACENT_REGIONS.get(target_norm, []):
        location_score = 0.7
    else:
        location_score = 0.3

    # Weighted combination
    score = (
        price_score * 0.35 + rating_score * 0.25 + style_score * 0.20 + freshness_score * 0.10 + location_score * 0.10
    )
    return round(score, 4)


def build_why_it_fits(entity: dict, budget_per_night: float, target_style: str | None = None) -> str:
    """Build a deterministic explanation string from entity data."""
    parts = []
    price = entity.get("pricing", 0)
    if price and budget_per_night:
        if price <= budget_per_night:
            parts.append(f"Within budget at ${price}/night")
        else:
            parts.append(f"${price}/night (${price - budget_per_night:.0f} over budget)")

    rating = entity.get("rating")
    if rating:
        parts.append(f"Rated {rating}/5")

    desc = entity.get("description", "")
    if desc:
        parts.append(desc[:80])

    return ". ".join(parts) if parts else "Matches search criteria"


async def match_accommodations(
    vector_store,
    region: str,
    budget_per_night: float,
    style: str | None = None,
    group_size: int = 1,
    accessibility_needs: list[str] | None = None,
    limit: int = 10,
) -> list[AccommodationMatch]:
    """Search Vector Store for matching accommodations and score them."""
    filters = {"entity_type": "hotel", "region": normalize_region(region)}
    results = await vector_store.search(f"hotel in {region}", filters, limit=limit * 3)

    if not results:
        logger.info("accommodation.no_results", region=region, budget=budget_per_night)
        return []

    scored = []
    for entity in results:
        s = score_accommodation(entity, budget_per_night, region, style)
        scored.append(
            AccommodationMatch(
                entity_id=entity.get("id", ""),
                name=entity.get("name", ""),
                region=entity.get("region", ""),
                price_per_night=entity.get("pricing", 0) or 0,
                rating=entity.get("rating"),
                style=entity.get("accommodation_style", ""),
                score=s,
                why_it_fits=build_why_it_fits(entity, budget_per_night, style),
                source_url=entity.get("source_url", ""),
                freshness_status=entity.get("freshness_status", "fresh"),
            )
        )

    scored.sort(key=lambda x: x.score, reverse=True)
    logger.info("accommodation.matched", region=region, count=len(scored[:limit]))
    return scored[:limit]
