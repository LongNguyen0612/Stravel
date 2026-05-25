import uuid
from datetime import datetime, timezone

from app.schemas.profile import TravelerProfileResponse
from app.services.profile_validator import build_profile_summary, get_missing_fields, is_profile_complete

NOW = datetime.now(timezone.utc)


def _profile(**kwargs) -> TravelerProfileResponse:
    defaults = {
        "id": uuid.uuid4(),
        "advisory_session_id": uuid.uuid4(),
        "created_at": NOW,
        "updated_at": NOW,
    }
    return TravelerProfileResponse(**{**defaults, **kwargs})


def test_empty_profile_is_incomplete():
    profile = _profile()
    assert not is_profile_complete(profile)
    missing = get_missing_fields(profile)
    assert "traveler_count" in missing
    assert "budget_total" in missing


def test_complete_profile():
    profile = _profile(
        traveler_count=2,
        budget_total=3000.0,
        travel_start_date="2026-12-20",
        destination_preferences=["Hanoi", "Ha Long Bay"],
    )
    assert is_profile_complete(profile)
    assert len(get_missing_fields(profile)) == 0


def test_flexible_dates_count_as_dates():
    profile = _profile(
        traveler_count=1,
        budget_total=1500.0,
        date_flexibility="flexible_month",
        destination_preferences=["Phu Quoc"],
    )
    assert is_profile_complete(profile)


def test_missing_destinations():
    profile = _profile(traveler_count=2, budget_total=3000.0, travel_start_date="2026-12-20")
    assert not is_profile_complete(profile)
    missing = get_missing_fields(profile)
    assert any("destination" in m for m in missing)


def test_build_summary_organizes_by_category():
    profile = _profile(
        traveler_count=4,
        traveler_ages=[35, 33, 8, 5],
        budget_total=5000.0,
        budget_currency="USD",
        destination_preferences=["Da Nang", "Hoi An"],
        dietary_requirements=["vegetarian"],
    )
    summary = build_profile_summary(profile)
    assert "demographics" in summary
    assert summary["demographics"]["traveler_count"] == 4
    assert "budget" in summary
    assert summary["budget"]["total"] == 5000.0
    assert "preferences" in summary
    assert "constraints" in summary
    assert summary["constraints"]["dietary"] == ["vegetarian"]


def test_build_summary_excludes_empty_categories():
    profile = _profile(traveler_count=1, budget_total=1000.0)
    summary = build_profile_summary(profile)
    assert "constraints" not in summary
    assert "preferences" not in summary
