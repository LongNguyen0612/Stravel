import structlog

from app.agents.compliance.accessibility import check_accessibility
from app.agents.compliance.age_restrictions import check_age_restrictions
from app.agents.compliance.budget_check import check_budget
from app.agents.compliance.health import check_health
from app.agents.compliance.passport import check_passport
from app.agents.compliance.schemas import ComplianceReport
from app.agents.compliance.seasonal import check_seasonal
from app.agents.compliance.travel_advisory import check_travel_advisory
from app.agents.compliance.visa import check_visa
from app.agents.state import AdvisoryState

logger = structlog.get_logger()


async def compliance_gate_node(state: AdvisoryState) -> dict:
    """Run all compliance checks and produce a ComplianceReport. Final gate before proposal delivery."""
    logger.info("agent.compliance.started", session_id=state.session_id)

    report = ComplianceReport()
    profile = state.traveler_profile

    try:
        # Extract profile data
        nationalities = []
        destinations = []
        traveler_ages = []
        activities = []
        accessibility_needs = []
        passport_expiry = None
        travel_start = None
        travel_end = None
        budget_total = 0.0

        if profile:
            nationalities = getattr(profile, "nationalities", None) or []
            destinations = getattr(profile, "destination_preferences", None) or []
            traveler_ages = getattr(profile, "traveler_ages", None) or []
            activities = getattr(profile, "activity_preferences", None) or []
            accessibility_needs = getattr(profile, "accessibility_needs", None) or []
            passport_expiry = getattr(profile, "passport_expiry_date", None)
            travel_start = getattr(profile, "travel_start_date", None)
            travel_end = getattr(profile, "travel_end_date", None)
            budget_total = getattr(profile, "budget_total", 0) or 0

        # 1. Visa checks (per nationality)
        for nationality in nationalities:
            report.add_check(check_visa(nationality, destinations))

        # 2. Passport check
        report.add_check(check_passport(passport_expiry, travel_start))

        # 3. Health advisories
        report.add_check(check_health())

        # 4. Travel advisory
        report.add_check(check_travel_advisory())

        # 5. Age restrictions
        report.add_check(check_age_restrictions(activities, traveler_ages))

        # 6. Seasonal feasibility
        report.add_check(check_seasonal(destinations, travel_start, travel_end))

        # 7. Budget feasibility
        estimated_total = 0.0
        if state.calculations:
            calcs = state.calculations if isinstance(state.calculations, dict) else {}
            budget_data = calcs.get("budget", {})
            if isinstance(budget_data, dict):
                estimated_total = budget_data.get("total_budget", 0)

        if budget_total > 0 and estimated_total > 0:
            report.add_check(check_budget(budget_total, estimated_total))

        # 8. Accessibility
        report.add_check(check_accessibility(destinations, accessibility_needs))

        logger.info(
            "agent.compliance.completed",
            session_id=state.session_id,
            overall=report.overall_status.value,
            blocks=report.block_count,
            warnings=report.warning_count,
        )

        return {
            "stage": "validating",
            "compliance_report": report.model_dump(),
        }

    except Exception as e:
        logger.error("agent.compliance.failed", session_id=state.session_id, error=str(e))
        return {"errors": [*state.errors, {"agent": "compliance", "message": str(e)}]}
