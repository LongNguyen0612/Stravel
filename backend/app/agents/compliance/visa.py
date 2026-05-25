import structlog

from app.agents.compliance.schemas import ComplianceCheck, ComplianceCheckType, ComplianceFlag, ComplianceSeverity
from app.etl.regulatory import RegulatoryLookup

logger = structlog.get_logger()

# All identifiers must be space-stripped to match normalization pipeline
PHU_QUOC_IDENTIFIERS = {"phuquoc", "phúquốc"}


def check_visa(
    nationality_code: str,
    destinations: list[str],
    lookup: RegulatoryLookup | None = None,
) -> ComplianceCheck:
    """Check visa requirements for a nationality visiting Vietnam destinations."""
    lookup = lookup or RegulatoryLookup()
    rule = lookup.get_visa_rule(nationality_code.upper())

    if not rule:
        return ComplianceCheck(
            check_type=ComplianceCheckType.VISA,
            status=ComplianceSeverity.WARNING,
            flags=[
                ComplianceFlag(
                    check_type=ComplianceCheckType.VISA,
                    severity=ComplianceSeverity.WARNING,
                    message=(
                        f"Visa rules not found for country code '{nationality_code}'. Manual verification required."
                    ),
                    resolution="Check with the Vietnamese embassy for your nationality",
                    source_url="https://evisa.gov.vn/",
                )
            ],
        )

    visa_type = rule.get("visa_type", "")
    duration = rule.get("duration_days", 0)
    cost = rule.get("cost_usd", 0)
    nationality = rule.get("nationality", nationality_code)
    has_phu_quoc_exception = rule.get("phu_quoc_exception", False)

    # Normalize destinations
    dest_normalized = {d.lower().strip().replace(" ", "") for d in destinations}

    # Check for Phu Quoc trap
    visiting_phu_quoc = bool(dest_normalized & PHU_QUOC_IDENTIFIERS)
    visiting_mainland = bool(dest_normalized - PHU_QUOC_IDENTIFIERS)

    flags: list[ComplianceFlag] = []

    if visa_type in ("visa_free_45", "visa_free_30"):
        # Already visa-free — Phu Quoc exception not needed
        if visiting_phu_quoc and visiting_mainland and has_phu_quoc_exception:
            # E-visa nationalities visiting Phu Quoc + mainland — this is fine, they need e-visa anyway
            pass
        flags.append(
            ComplianceFlag(
                check_type=ComplianceCheckType.VISA,
                severity=ComplianceSeverity.PASS,
                message=f"{nationality} citizens: visa-free entry for {duration} days",
                resolution="No visa application needed",
            )
        )
        return ComplianceCheck(check_type=ComplianceCheckType.VISA, status=ComplianceSeverity.PASS, flags=flags)

    elif visa_type == "e_visa":
        # PHU QUOC TRAP: e-visa nationals can visit Phu Quoc visa-free (30 days) ONLY if staying on island
        if visiting_phu_quoc and not visiting_mainland and has_phu_quoc_exception:
            flags.append(
                ComplianceFlag(
                    check_type=ComplianceCheckType.VISA,
                    severity=ComplianceSeverity.WARNING,
                    message=(
                        f"{nationality} citizens: Phu Quoc 30-day visa-free available "
                        f"(staying on island only). If you plan to visit mainland Vietnam, "
                        f"apply for e-visa instead (${cost}, {duration} days)."
                    ),
                    resolution="Confirm itinerary is Phu Quoc only, or apply for e-visa",
                    source_url="https://evisa.gov.vn/",
                )
            )
            return ComplianceCheck(check_type=ComplianceCheckType.VISA, status=ComplianceSeverity.WARNING, flags=flags)

        elif visiting_phu_quoc and visiting_mainland and has_phu_quoc_exception:
            # THE TRAP: Phu Quoc + mainland = must get e-visa
            flags.append(
                ComplianceFlag(
                    check_type=ComplianceCheckType.VISA,
                    severity=ComplianceSeverity.BLOCK,
                    message=(
                        f"{nationality} citizens: Phu Quoc visa-free does NOT apply when combined "
                        f"with mainland destinations. E-visa required "
                        f"(${cost}, {rule.get('processing_days', 3)} days processing)."
                    ),
                    resolution=(
                        f"Apply for e-visa at evisa.gov.vn — ${cost}, "
                        f"allow {rule.get('processing_days', 3)} business days"
                    ),
                    alternative="Remove mainland destinations to use Phu Quoc visa-free entry",
                    source_url="https://evisa.gov.vn/",
                )
            )
            return ComplianceCheck(check_type=ComplianceCheckType.VISA, status=ComplianceSeverity.BLOCK, flags=flags)

        # Standard e-visa required
        flags.append(
            ComplianceFlag(
                check_type=ComplianceCheckType.VISA,
                severity=ComplianceSeverity.WARNING,
                message=(
                    f"{nationality} citizens: e-visa required "
                    f"(${cost}, {duration} days, {rule.get('processing_days', 3)} days processing)"
                ),
                resolution=(
                    f"Apply at evisa.gov.vn before travel — allow {rule.get('processing_days', 3)} business days"
                ),
                source_url="https://evisa.gov.vn/",
            )
        )
        return ComplianceCheck(check_type=ComplianceCheckType.VISA, status=ComplianceSeverity.WARNING, flags=flags)

    # Embassy visa or unknown type
    flags.append(
        ComplianceFlag(
            check_type=ComplianceCheckType.VISA,
            severity=ComplianceSeverity.WARNING,
            message=f"{nationality} citizens: visa required — check with Vietnamese embassy",
            resolution="Contact Vietnamese embassy for visa application",
        )
    )
    return ComplianceCheck(check_type=ComplianceCheckType.VISA, status=ComplianceSeverity.WARNING, flags=flags)
