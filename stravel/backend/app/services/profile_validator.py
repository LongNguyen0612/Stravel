from app.schemas.profile import TravelerProfileResponse

REQUIRED_FIELDS = ["traveler_count", "budget_total"]
REQUIRED_ONE_OF = [
    (["travel_start_date", "date_flexibility"], "travel dates or date flexibility"),
    (["destination_preferences"], "at least one destination preference"),
]


def get_missing_fields(profile: TravelerProfileResponse) -> list[str]:
    """Check which minimum required fields are missing from the profile."""
    missing = []

    for field in REQUIRED_FIELDS:
        if getattr(profile, field, None) is None:
            missing.append(field)

    for fields, description in REQUIRED_ONE_OF:
        if not any(getattr(profile, f, None) for f in fields):
            missing.append(description)

    return missing


def is_profile_complete(profile: TravelerProfileResponse) -> bool:
    """Check if the profile has all minimum required fields."""
    return len(get_missing_fields(profile)) == 0


def build_profile_summary(profile: TravelerProfileResponse) -> dict:
    """Build a structured summary organized by category."""
    summary = {
        "demographics": {},
        "dates": {},
        "budget": {},
        "preferences": {},
        "constraints": {},
    }

    if profile.traveler_count is not None:
        summary["demographics"]["traveler_count"] = profile.traveler_count
    if profile.traveler_ages:
        summary["demographics"]["traveler_ages"] = profile.traveler_ages
    if profile.nationalities:
        summary["demographics"]["nationalities"] = profile.nationalities

    if profile.travel_start_date:
        summary["dates"]["start_date"] = str(profile.travel_start_date)
    if profile.travel_end_date:
        summary["dates"]["end_date"] = str(profile.travel_end_date)
    if profile.date_flexibility:
        summary["dates"]["flexibility"] = profile.date_flexibility

    if profile.budget_total is not None:
        summary["budget"]["total"] = profile.budget_total
    if profile.budget_currency:
        summary["budget"]["currency"] = profile.budget_currency

    if profile.destination_preferences:
        summary["preferences"]["destinations"] = profile.destination_preferences
    if profile.accommodation_style:
        summary["preferences"]["accommodation"] = profile.accommodation_style
    if profile.activity_preferences:
        summary["preferences"]["activities"] = profile.activity_preferences
    if profile.special_interests:
        summary["preferences"]["special_interests"] = profile.special_interests

    if profile.dietary_requirements:
        summary["constraints"]["dietary"] = profile.dietary_requirements
    if profile.accessibility_needs:
        summary["constraints"]["accessibility"] = profile.accessibility_needs
    if profile.passport_expiry_date:
        summary["constraints"]["passport_expiry"] = str(profile.passport_expiry_date)

    return {k: v for k, v in summary.items() if v}
