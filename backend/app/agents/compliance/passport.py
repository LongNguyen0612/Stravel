from datetime import date, timedelta

from app.agents.compliance.schemas import ComplianceCheck, ComplianceCheckType, ComplianceFlag, ComplianceSeverity


def check_passport(
    passport_expiry: date | None,
    travel_start: date | None = None,
) -> ComplianceCheck:
    """Check passport validity against the 6-month rule."""
    if passport_expiry is None:
        return ComplianceCheck(
            check_type=ComplianceCheckType.PASSPORT,
            status=ComplianceSeverity.WARNING,
            flags=[
                ComplianceFlag(
                    check_type=ComplianceCheckType.PASSPORT,
                    severity=ComplianceSeverity.WARNING,
                    message="Passport expiry date not provided — validity not verified",
                    resolution="Provide passport expiry date for verification",
                )
            ],
        )

    departure = travel_start or date.today()
    required_validity = departure + timedelta(days=180)  # 6 months

    if passport_expiry < departure:
        return ComplianceCheck(
            check_type=ComplianceCheckType.PASSPORT,
            status=ComplianceSeverity.BLOCK,
            flags=[
                ComplianceFlag(
                    check_type=ComplianceCheckType.PASSPORT,
                    severity=ComplianceSeverity.BLOCK,
                    message=f"Passport expired on {passport_expiry}. Cannot travel.",
                    resolution="Renew passport immediately",
                )
            ],
        )

    if passport_expiry < required_validity:
        days_remaining = (passport_expiry - departure).days
        return ComplianceCheck(
            check_type=ComplianceCheckType.PASSPORT,
            status=ComplianceSeverity.BLOCK,
            flags=[
                ComplianceFlag(
                    check_type=ComplianceCheckType.PASSPORT,
                    severity=ComplianceSeverity.BLOCK,
                    message=(
                        f"Passport expires {passport_expiry} — only {days_remaining} days from departure. "
                        f"Vietnam requires 6 months (180 days) validity."
                    ),
                    resolution="Renew passport before travel — allow 4-6 weeks for processing",
                )
            ],
        )

    return ComplianceCheck(
        check_type=ComplianceCheckType.PASSPORT,
        status=ComplianceSeverity.PASS,
        flags=[
            ComplianceFlag(
                check_type=ComplianceCheckType.PASSPORT,
                severity=ComplianceSeverity.PASS,
                message=f"Passport valid until {passport_expiry} — meets 6-month requirement",
            )
        ],
    )
