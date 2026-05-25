from app.agents.compliance.schemas import ComplianceCheck, ComplianceCheckType, ComplianceFlag, ComplianceSeverity

# Activity minimum age requirements
AGE_RESTRICTIONS: dict[str, int] = {
    "scuba diving": 10,
    "diving": 10,
    "motorbike": 18,
    "motorbiking": 18,
    "motorbike tour": 18,
    "bungee jumping": 16,
    "paragliding": 16,
    "zip lining": 12,
    "kayaking": 8,
    "jet ski": 16,
    "atv riding": 16,
}

ALTERNATIVES: dict[str, str] = {
    "scuba diving": "snorkeling (no age restriction)",
    "motorbike": "guided bus tour or bicycle tour",
    "bungee jumping": "zipline (min age 12)",
    "paragliding": "cable car ride",
    "jet ski": "banana boat ride",
}


def check_age_restrictions(
    activities: list[str],
    traveler_ages: list[int] | None = None,
) -> ComplianceCheck:
    """Check activity age restrictions against traveler ages."""
    if not activities or not traveler_ages:
        return ComplianceCheck(
            check_type=ComplianceCheckType.AGE_RESTRICTION,
            status=ComplianceSeverity.PASS,
            flags=[],
        )

    min_age = min(traveler_ages)
    flags: list[ComplianceFlag] = []

    for activity in activities:
        activity_lower = activity.lower().strip()
        # Check against all restriction keys
        for restricted_activity, min_required in AGE_RESTRICTIONS.items():
            if restricted_activity in activity_lower and min_age < min_required:
                alternative = ALTERNATIVES.get(restricted_activity, "")
                flags.append(
                    ComplianceFlag(
                        check_type=ComplianceCheckType.AGE_RESTRICTION,
                        severity=ComplianceSeverity.BLOCK,
                        message=(f"'{activity}' requires minimum age {min_required}. Youngest traveler is {min_age}."),
                        resolution=f"Remove '{activity}' from itinerary",
                        alternative=f"Suggested alternative: {alternative}" if alternative else "",
                    )
                )
                break

    status = ComplianceSeverity.BLOCK if flags else ComplianceSeverity.PASS
    return ComplianceCheck(check_type=ComplianceCheckType.AGE_RESTRICTION, status=status, flags=flags)
