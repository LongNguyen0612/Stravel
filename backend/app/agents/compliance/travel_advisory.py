from app.agents.compliance.schemas import ComplianceCheck, ComplianceCheckType, ComplianceFlag, ComplianceSeverity

# Current Vietnam travel advisory level
VIETNAM_ADVISORY_LEVEL = "exercise_normal_precautions"


def check_travel_advisory() -> ComplianceCheck:
    """Check government travel warnings for Vietnam."""
    if VIETNAM_ADVISORY_LEVEL == "do_not_travel":
        return ComplianceCheck(
            check_type=ComplianceCheckType.TRAVEL_ADVISORY,
            status=ComplianceSeverity.BLOCK,
            flags=[
                ComplianceFlag(
                    check_type=ComplianceCheckType.TRAVEL_ADVISORY,
                    severity=ComplianceSeverity.BLOCK,
                    message="Government advisory: DO NOT TRAVEL to Vietnam",
                    resolution="Postpone travel until advisory is lifted",
                    source_url="https://travel.state.gov/vietnam",
                )
            ],
        )

    if VIETNAM_ADVISORY_LEVEL in ("reconsider_travel", "exercise_increased_caution"):
        return ComplianceCheck(
            check_type=ComplianceCheckType.TRAVEL_ADVISORY,
            status=ComplianceSeverity.WARNING,
            flags=[
                ComplianceFlag(
                    check_type=ComplianceCheckType.TRAVEL_ADVISORY,
                    severity=ComplianceSeverity.WARNING,
                    message=f"Travel advisory: {VIETNAM_ADVISORY_LEVEL.replace('_', ' ').title()}",
                    resolution="Review specific regional warnings before travel",
                    source_url="https://travel.state.gov/vietnam",
                )
            ],
        )

    return ComplianceCheck(
        check_type=ComplianceCheckType.TRAVEL_ADVISORY,
        status=ComplianceSeverity.PASS,
        flags=[
            ComplianceFlag(
                check_type=ComplianceCheckType.TRAVEL_ADVISORY,
                severity=ComplianceSeverity.PASS,
                message="Vietnam: Exercise normal precautions. Petty crime in tourist areas.",
                source_url="https://travel.state.gov/vietnam",
            )
        ],
    )
