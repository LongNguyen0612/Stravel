from app.agents.compliance.schemas import ComplianceCheck, ComplianceCheckType, ComplianceFlag, ComplianceSeverity

# Vietnam accessibility challenges by destination
ACCESSIBILITY_CHALLENGES: dict[str, list[str]] = {
    "sapa": ["steep mountain terrain", "limited wheelchair access on trekking trails"],
    "halong": ["boat access requires steps", "cave tours have uneven surfaces"],
    "hoian": ["narrow streets in Ancient Town", "flooding during rainy season"],
    "mekong": ["small boats with no wheelchair access", "uneven riverbank paths"],
}


def check_accessibility(
    destinations: list[str],
    accessibility_needs: list[str] | None = None,
) -> ComplianceCheck:
    """Check if destinations and activities meet stated accessibility needs."""
    if not accessibility_needs:
        return ComplianceCheck(check_type=ComplianceCheckType.ACCESSIBILITY, status=ComplianceSeverity.PASS, flags=[])

    flags: list[ComplianceFlag] = []

    for dest in destinations:
        dest_norm = dest.lower().strip().replace(" ", "")
        challenges = ACCESSIBILITY_CHALLENGES.get(dest_norm, [])

        if challenges:
            flags.append(
                ComplianceFlag(
                    check_type=ComplianceCheckType.ACCESSIBILITY,
                    severity=ComplianceSeverity.WARNING,
                    message=f"{dest}: accessibility challenges — {'; '.join(challenges)}",
                    resolution="Verify accommodation and activity accessibility before booking",
                    alternative="Consider accessible alternatives: HCMC, Da Nang (flat terrain, modern infrastructure)",
                )
            )

    status = ComplianceSeverity.WARNING if flags else ComplianceSeverity.PASS
    return ComplianceCheck(check_type=ComplianceCheckType.ACCESSIBILITY, status=status, flags=flags)
