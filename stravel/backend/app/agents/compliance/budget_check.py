from app.agents.compliance.schemas import ComplianceCheck, ComplianceCheckType, ComplianceFlag, ComplianceSeverity


def check_budget(stated_budget: float, estimated_total: float) -> ComplianceCheck:
    """Check if estimated costs exceed stated budget by more than 10%."""
    if stated_budget <= 0 or estimated_total <= 0:
        return ComplianceCheck(check_type=ComplianceCheckType.BUDGET, status=ComplianceSeverity.PASS, flags=[])

    overage_pct = ((estimated_total - stated_budget) / stated_budget) * 100

    if overage_pct > 10:
        suggestions = []
        if overage_pct > 30:
            suggestions.append("Switch to budget accommodations (saves ~40% on hotels)")
        suggestions.append("Reduce trip duration by 1-2 days")
        suggestions.append("Choose lower-cost destinations (Dalat, Mekong Delta)")
        suggestions.append("Use buses instead of flights between cities")

        return ComplianceCheck(
            check_type=ComplianceCheckType.BUDGET,
            status=ComplianceSeverity.WARNING,
            flags=[
                ComplianceFlag(
                    check_type=ComplianceCheckType.BUDGET,
                    severity=ComplianceSeverity.WARNING,
                    message=(
                        f"Estimated total ${estimated_total:.0f} exceeds budget ${stated_budget:.0f} "
                        f"by {overage_pct:.0f}%"
                    ),
                    resolution="Cost-reduction suggestions: " + "; ".join(suggestions),
                )
            ],
        )

    return ComplianceCheck(
        check_type=ComplianceCheckType.BUDGET,
        status=ComplianceSeverity.PASS,
        flags=[
            ComplianceFlag(
                check_type=ComplianceCheckType.BUDGET,
                severity=ComplianceSeverity.PASS,
                message=f"Estimated total ${estimated_total:.0f} is within budget ${stated_budget:.0f}",
            )
        ],
    )
