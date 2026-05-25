from datetime import date
from pathlib import Path

from app.agents.compliance.schemas import ComplianceCheck, ComplianceCheckType, ComplianceFlag, ComplianceSeverity

SEASONS_FILE = Path(__file__).parent / "rules" / "vietnam_seasons.json"

# Destination to region mapping
DESTINATION_REGIONS: dict[str, str] = {
    "hanoi": "north",
    "halong": "north",
    "sapa": "north",
    "ninhbinh": "north",
    "danang": "central",
    "hoian": "central",
    "hue": "central",
    "hcmc": "south",
    "mekong": "south",
    "phuquoc": "south",
    "nhatrang": "south",
    "dalat": "south",
    "phanthiet": "south",
}

# Monsoon months by region
MONSOON_MONTHS: dict[str, set[int]] = {
    "north": {5, 6, 7, 8, 9, 10},
    "central": {9, 10, 11, 12, 1},
    "south": {5, 6, 7, 8, 9, 10},
}


def check_seasonal(destinations: list[str], travel_start: date | None, travel_end: date | None) -> ComplianceCheck:
    """Check seasonal suitability for each destination."""
    if not destinations or not travel_start:
        return ComplianceCheck(check_type=ComplianceCheckType.SEASONAL, status=ComplianceSeverity.PASS, flags=[])

    end = travel_end or travel_start
    travel_months = set()
    current = travel_start
    while current <= end:
        travel_months.add(current.month)
        current = (
            current.replace(day=28) if current.month < 12 else current.replace(year=current.year + 1, month=1, day=1)
        )
        if current > end:
            break

    flags: list[ComplianceFlag] = []

    for dest in destinations:
        dest_norm = dest.lower().strip().replace(" ", "")
        region = DESTINATION_REGIONS.get(dest_norm)
        if not region:
            continue

        monsoon = MONSOON_MONTHS.get(region, set())
        overlap = travel_months & monsoon

        if overlap:
            month_names = [date(2026, m, 1).strftime("%B") for m in sorted(overlap)]
            flags.append(
                ComplianceFlag(
                    check_type=ComplianceCheckType.SEASONAL,
                    severity=ComplianceSeverity.WARNING,
                    message=(
                        f"{dest} ({region} Vietnam): monsoon season during {', '.join(month_names)}. "
                        f"Expect heavy rain and possible flooding."
                    ),
                    resolution="Consider shifting dates or choosing a different region",
                    alternative=f"Best time for {region}: "
                    + ("Feb-May" if region == "north" else "Feb-May" if region == "central" else "Nov-Apr"),
                )
            )

    status = ComplianceSeverity.WARNING if flags else ComplianceSeverity.PASS
    return ComplianceCheck(check_type=ComplianceCheckType.SEASONAL, status=status, flags=flags)
