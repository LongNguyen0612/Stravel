from app.agents.compliance.schemas import ComplianceCheck, ComplianceCheckType, ComplianceFlag, ComplianceSeverity


def check_health() -> ComplianceCheck:
    """Check health advisories for Vietnam travel."""
    return ComplianceCheck(
        check_type=ComplianceCheckType.HEALTH,
        status=ComplianceSeverity.WARNING,
        flags=[
            ComplianceFlag(
                check_type=ComplianceCheckType.HEALTH,
                severity=ComplianceSeverity.WARNING,
                message="Hepatitis A and B vaccinations recommended for Vietnam travel",
                resolution="Consult travel health clinic 4-6 weeks before departure",
                source_url="https://wwwnc.cdc.gov/travel/destinations/traveler/none/vietnam",
            ),
            ComplianceFlag(
                check_type=ComplianceCheckType.HEALTH,
                severity=ComplianceSeverity.WARNING,
                message="Malaria prophylaxis recommended for rural highland areas (Sapa region)",
                resolution="Discuss antimalarial medication with your doctor if visiting highlands",
            ),
        ],
    )
