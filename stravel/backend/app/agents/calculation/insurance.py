import structlog

from app.agents.calculation.schemas import InsuranceEstimate

logger = structlog.get_logger()

# Activity risk classification
HIGH_RISK_ACTIVITIES = {
    "scuba",
    "diving",
    "motorbike",
    "motorbiking",
    "motorbike tour",
    "rock climbing",
    "bungee jumping",
    "paragliding",
    "skydiving",
}
MEDIUM_RISK_ACTIVITIES = {
    "trekking",
    "hiking",
    "cycling",
    "kayaking",
    "surfing",
    "snorkeling",
    "zip lining",
    "canyoning",
}

# Base premium per day (USD)
BASE_PREMIUM_LOW = 3.50
BASE_PREMIUM_HIGH = 7.00

# Age multipliers
AGE_MULTIPLIERS = {
    (0, 17): 0.8,  # Child
    (18, 35): 1.0,  # Young adult
    (36, 55): 1.2,  # Middle age
    (56, 70): 1.6,  # Senior
    (71, 120): 2.2,  # Elderly
}

# Activity surcharges
RISK_SURCHARGES = {
    "high": 0.60,  # 60% surcharge
    "medium": 0.25,  # 25% surcharge
    "low": 0.0,
}


def classify_activity_risk(activity: str) -> str:
    """Classify activity risk level. Word-boundary matching to avoid false positives."""
    import re

    a = activity.lower().strip()
    for h in HIGH_RISK_ACTIVITIES:
        if re.search(r"\b" + re.escape(h) + r"\b", a):
            return "high"
    for m in MEDIUM_RISK_ACTIVITIES:
        if re.search(r"\b" + re.escape(m) + r"\b", a):
            return "medium"
    return "low"


def get_age_multiplier(age: int) -> float:
    for (low, high), mult in AGE_MULTIPLIERS.items():
        if low <= age <= high:
            return mult
    return 1.0


def estimate_insurance(
    traveler_count: int = 1,
    traveler_ages: list[int] | None = None,
    duration_days: int = 7,
    activities: list[str] | None = None,
) -> InsuranceEstimate:
    """Estimate travel insurance premium range."""
    if duration_days <= 0 or traveler_count <= 0:
        return InsuranceEstimate(premium_low=0, premium_high=0)

    ages = traveler_ages or [30] * traveler_count
    acts = activities or []

    # Classify activities
    high_risk = [a for a in acts if classify_activity_risk(a) == "high"]
    medium_risk = [a for a in acts if classify_activity_risk(a) == "medium"]

    # Max surcharge from activities
    if high_risk:
        activity_surcharge = RISK_SURCHARGES["high"]
    elif medium_risk:
        activity_surcharge = RISK_SURCHARGES["medium"]
    else:
        activity_surcharge = 0.0

    # Calculate per-person premiums and sum
    total_low = 0.0
    total_high = 0.0

    for age in ages:
        age_mult = get_age_multiplier(age)
        person_low = BASE_PREMIUM_LOW * duration_days * age_mult * (1 + activity_surcharge)
        person_high = BASE_PREMIUM_HIGH * duration_days * age_mult * (1 + activity_surcharge)
        total_low += person_low
        total_high += person_high

    # Duration discount for longer trips
    if duration_days > 14:
        total_low *= 0.9
        total_high *= 0.9
    elif duration_days > 30:
        total_low *= 0.8
        total_high *= 0.8

    coverage_notes = []
    if high_risk:
        coverage_notes.append(f"High-risk activities require additional coverage: {', '.join(high_risk)}")
    if medium_risk:
        coverage_notes.append(f"Medium-risk activities included: {', '.join(medium_risk)}")
    if any(a >= 65 for a in ages):
        coverage_notes.append("Senior traveler(s) — verify age limits on policy")

    logger.info("insurance.estimated", travelers=traveler_count, days=duration_days, high_risk=len(high_risk))

    return InsuranceEstimate(
        premium_low=round(total_low, 2),
        premium_high=round(total_high, 2),
        high_risk_activities=high_risk,
        coverage_notes=coverage_notes,
    )
