from datetime import date, timedelta

import structlog

from app.agents.calculation.schemas import SeasonalPricePoint

logger = structlog.get_logger()

# Tet (Lunar New Year) dates — approximate
TET_DATES = {
    2026: (date(2026, 2, 17), date(2026, 2, 22)),
    2027: (date(2027, 2, 6), date(2027, 2, 11)),
    2028: (date(2028, 1, 26), date(2028, 1, 31)),
    2029: (date(2029, 2, 13), date(2029, 2, 18)),
    2030: (date(2030, 2, 3), date(2030, 2, 8)),
}

CHRISTMAS_RANGE = (12, 20, 1, 5)  # Dec 20 to Jan 5

# Per-destination peak multipliers
DESTINATION_PEAK_MULTIPLIERS = {
    "phuquoc": 2.0,
    "danang": 1.5,
    "hoian": 1.5,
    "nhatrang": 1.6,
    "dalat": 1.4,
    "sapa": 1.3,
    "hanoi": 1.2,
    "hcmc": 1.2,
    "halong": 1.5,
    "hue": 1.3,
    "mekong": 1.1,
}


def _is_tet_period(d: date) -> bool:
    for year, (start, end) in TET_DATES.items():
        expanded_start = start - timedelta(days=3)
        expanded_end = end + timedelta(days=3)
        if expanded_start <= d <= expanded_end:
            return True
    return False


def _is_christmas_period(d: date) -> bool:
    if d.month == 12 and d.day >= 20:
        return True
    if d.month == 1 and d.day <= 5:
        return True
    return False


def _get_season_type(d: date, destination: str) -> tuple[str, float]:
    if _is_tet_period(d):
        mult = DESTINATION_PEAK_MULTIPLIERS.get(destination, 1.3) * 1.5
        return "peak_tet", min(mult, 2.5)
    if _is_christmas_period(d):
        mult = DESTINATION_PEAK_MULTIPLIERS.get(destination, 1.2) * 1.2
        return "peak_christmas", min(mult, 1.8)
    # Shoulder seasons
    if d.month in (6, 7, 8):  # Summer
        return "shoulder_summer", DESTINATION_PEAK_MULTIPLIERS.get(destination, 1.1)
    # Low season
    return "low", 1.0


def analyze_seasonal_pricing(
    destination: str,
    start_date: date,
    end_date: date,
) -> list[SeasonalPricePoint]:
    """Analyze week-by-week pricing for a destination across a date range."""
    dest = destination.lower().strip()
    points: list[SeasonalPricePoint] = []

    current = start_date
    while current <= end_date:
        week_end = min(current + timedelta(days=6), end_date)
        season_type, multiplier = _get_season_type(current, dest)

        notes = ""
        if season_type == "peak_tet":
            notes = "Tet holiday — highest prices, book early"
        elif season_type == "peak_christmas":
            notes = "Christmas/New Year peak"
        elif season_type == "shoulder_summer":
            notes = "Summer shoulder season"

        points.append(
            SeasonalPricePoint(
                week_start=current.isoformat(),
                multiplier=round(multiplier, 2),
                season_type=season_type,
                notes=notes,
            )
        )

        current = week_end + timedelta(days=1)

    logger.info("pricing.analyzed", destination=dest, weeks=len(points))
    return points
