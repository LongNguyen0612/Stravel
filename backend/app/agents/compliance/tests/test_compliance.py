from datetime import date, timedelta

import pytest

from app.agents.compliance.accessibility import check_accessibility
from app.agents.compliance.age_restrictions import check_age_restrictions
from app.agents.compliance.budget_check import check_budget
from app.agents.compliance.health import check_health
from app.agents.compliance.passport import check_passport
from app.agents.compliance.schemas import ComplianceSeverity
from app.agents.compliance.seasonal import check_seasonal
from app.agents.compliance.travel_advisory import check_travel_advisory
from app.agents.compliance.visa import check_visa

# === VISA CHECKS ===


def test_visa_free_german():
    result = check_visa("DE", ["hanoi", "hcmc"])
    assert result.status == ComplianceSeverity.PASS


def test_visa_evisa_australian():
    result = check_visa("AU", ["hanoi"])
    assert result.status == ComplianceSeverity.WARNING
    assert any("e-visa" in f.message.lower() for f in result.flags)


def test_visa_phu_quoc_trap():
    """Australian visiting Phu Quoc + HCMC — must get e-visa, can't use Phu Quoc exemption."""
    result = check_visa("AU", ["phuquoc", "hcmc"])
    assert result.status == ComplianceSeverity.BLOCK
    assert any("phu quoc" in f.message.lower() for f in result.flags)


def test_visa_phu_quoc_only():
    """Australian staying only on Phu Quoc — visa-free warning (not block)."""
    result = check_visa("AU", ["phuquoc"])
    assert result.status == ComplianceSeverity.WARNING


def test_visa_unknown_nationality():
    result = check_visa("XX", ["hanoi"])
    assert result.status == ComplianceSeverity.WARNING
    assert any("manual verification" in f.message.lower() for f in result.flags)


# === PASSPORT CHECKS ===


def test_passport_valid():
    expiry = date.today() + timedelta(days=365)
    result = check_passport(expiry)
    assert result.status == ComplianceSeverity.PASS


def test_passport_expired():
    expiry = date.today() - timedelta(days=30)
    result = check_passport(expiry)
    assert result.status == ComplianceSeverity.BLOCK


def test_passport_insufficient_validity():
    expiry = date.today() + timedelta(days=90)  # Only 3 months — need 6
    result = check_passport(expiry)
    assert result.status == ComplianceSeverity.BLOCK


def test_passport_not_provided():
    result = check_passport(None)
    assert result.status == ComplianceSeverity.WARNING
    assert any("not provided" in f.message.lower() for f in result.flags)


# === HEALTH CHECKS ===


def test_health_advisory():
    result = check_health()
    assert result.status == ComplianceSeverity.WARNING
    assert len(result.flags) >= 1


# === TRAVEL ADVISORY ===


def test_travel_advisory_normal():
    result = check_travel_advisory()
    assert result.status == ComplianceSeverity.PASS


# === AGE RESTRICTIONS ===


def test_age_restriction_scuba_child():
    result = check_age_restrictions(["scuba diving"], [8, 35])
    assert result.status == ComplianceSeverity.BLOCK
    assert any("scuba" in f.message.lower() for f in result.flags)


def test_age_restriction_scuba_adult():
    result = check_age_restrictions(["scuba diving"], [25, 30])
    assert result.status == ComplianceSeverity.PASS


def test_age_restriction_motorbike_teen():
    result = check_age_restrictions(["motorbike tour"], [16, 35])
    assert result.status == ComplianceSeverity.BLOCK


def test_age_restriction_alternative_suggested():
    result = check_age_restrictions(["scuba diving"], [8])
    assert result.status == ComplianceSeverity.BLOCK
    assert any("snorkeling" in f.alternative.lower() for f in result.flags)


def test_age_restriction_no_activities():
    result = check_age_restrictions([], [8])
    assert result.status == ComplianceSeverity.PASS


# === SEASONAL CHECKS ===


def test_seasonal_monsoon_north():
    result = check_seasonal(["hanoi"], date(2026, 7, 1), date(2026, 7, 14))
    assert result.status == ComplianceSeverity.WARNING
    assert any("monsoon" in f.message.lower() for f in result.flags)


def test_seasonal_dry_south():
    result = check_seasonal(["hcmc"], date(2026, 12, 20), date(2027, 1, 5))
    assert result.status == ComplianceSeverity.PASS


def test_seasonal_monsoon_central():
    result = check_seasonal(["danang"], date(2026, 10, 1), date(2026, 10, 14))
    assert result.status == ComplianceSeverity.WARNING


def test_seasonal_no_dates():
    result = check_seasonal(["hanoi"], None, None)
    assert result.status == ComplianceSeverity.PASS


# === BUDGET CHECKS ===


def test_budget_within():
    result = check_budget(3000, 2800)
    assert result.status == ComplianceSeverity.PASS


def test_budget_over_10_percent():
    result = check_budget(3000, 3500)
    assert result.status == ComplianceSeverity.WARNING
    assert any("exceeds" in f.message.lower() for f in result.flags)


def test_budget_way_over():
    result = check_budget(3000, 5000)
    assert result.status == ComplianceSeverity.WARNING
    assert any("budget accommodations" in f.resolution.lower() for f in result.flags)


# === ACCESSIBILITY CHECKS ===


def test_accessibility_sapa_wheelchair():
    result = check_accessibility(["sapa"], ["wheelchair"])
    assert result.status == ComplianceSeverity.WARNING
    assert any("sapa" in f.message.lower() for f in result.flags)


def test_accessibility_no_needs():
    result = check_accessibility(["sapa"], None)
    assert result.status == ComplianceSeverity.PASS


def test_accessibility_flat_city():
    result = check_accessibility(["hcmc"], ["wheelchair"])
    assert result.status == ComplianceSeverity.PASS  # HCMC not in challenges list


# === COMPLIANCE GATE ===


@pytest.mark.asyncio
async def test_compliance_gate_node():
    from app.agents.compliance.agent import compliance_gate_node
    from app.agents.state import AdvisoryState

    state = AdvisoryState(session_id="test-1", tenant_id="default", stage="validating")
    result = await compliance_gate_node(state)
    assert result["stage"] == "validating"
    assert "compliance_report" in result
    report = result["compliance_report"]
    assert "overall_status" in report


@pytest.mark.asyncio
async def test_compliance_gate_with_blocks():
    """German family with 8-year-old doing scuba — should block."""
    import uuid

    from app.agents.compliance.agent import compliance_gate_node
    from app.agents.state import AdvisoryState
    from app.schemas.profile import TravelerProfileResponse

    state = AdvisoryState(
        session_id="test-2",
        tenant_id="default",
        stage="validating",
        traveler_profile=TravelerProfileResponse(
            id=str(uuid.uuid4()),
            advisory_session_id=str(uuid.uuid4()),
            nationalities=["DE"],
            destination_preferences=["hanoi"],
            traveler_ages=[35, 33, 8],
            activity_preferences=["scuba diving"],
            passport_expiry_date=str(date.today() + timedelta(days=365)),
            created_at="2026-01-01T00:00:00",
            updated_at="2026-01-01T00:00:00",
        ),
    )
    result = await compliance_gate_node(state)
    report = result["compliance_report"]
    assert report["block_count"] > 0
    assert report["overall_status"] == "block"
