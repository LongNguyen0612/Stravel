import uuid
from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.propose_first import (
    DEFAULT_BUDGET_TOTAL,
    DEFAULT_DURATION_DAYS,
    DEFAULT_START_DAYS_FROM_NOW,
    DEFAULT_TRAVELER_COUNT,
    VIETNAM_CITIES,
    build_profile_with_defaults,
    detect_intent,
)


def _mock_db(profile_attrs: dict):
    """Build a mock AsyncSession that returns a mock TravelerProfile."""
    mock_profile = MagicMock()
    for k, v in profile_attrs.items():
        setattr(mock_profile, k, v)
    mock_scalars = MagicMock()
    mock_scalars.first.return_value = mock_profile
    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars
    db = AsyncMock()
    db.execute = AsyncMock(return_value=mock_result)
    return db


_BLANK_PROFILE = dict(
    traveler_count=None,
    budget_total=None,
    accommodation_style=None,
    activity_preferences=None,
    travel_start_date=None,
    travel_end_date=None,
)


# ── detect_intent — city detection ──────────────────────────────────────────

def test_detect_intent_extracts_hanoi():
    result = detect_intent("I want to go to Hanoi")
    assert result["destination"] == "Hanoi"
    assert result["is_surprise_me"] is False


def test_detect_intent_extracts_hcmc():
    result = detect_intent("Trip to Ho Chi Minh City please")
    assert result["destination"] == "Ho Chi Minh City"


def test_detect_intent_city_case_insensitive():
    result = detect_intent("i want to visit hanoi for a week")
    assert result["destination"] == "Hanoi"


def test_detect_intent_city_da_nang():
    result = detect_intent("10 days in Da Nang")
    assert result["destination"] == "Da Nang"


def test_detect_intent_no_destination():
    result = detect_intent("I want to travel somewhere nice")
    assert result["destination"] is None
    assert result["is_surprise_me"] is False


# ── detect_intent — duration extraction ─────────────────────────────────────

def test_detect_intent_duration_days():
    result = detect_intent("10 days in Da Nang")
    assert result["duration_days"] == 10


def test_detect_intent_duration_nights():
    result = detect_intent("3 nights in Hoi An")
    assert result["duration_days"] == 3


def test_detect_intent_duration_week():
    result = detect_intent("I want to visit Hanoi for a week")
    assert result["duration_days"] == 7


def test_detect_intent_no_duration():
    result = detect_intent("I want to visit Hanoi")
    assert result["duration_days"] is None


def test_detect_intent_two_weeks():
    result = detect_intent("2 weeks in Vietnam")
    assert result["duration_days"] == 14


# ── detect_intent — surprise me ─────────────────────────────────────────────

def test_detect_intent_surprise_me():
    result = detect_intent("surprise me with a trip!")
    assert result["is_surprise_me"] is True
    assert result["destination"] is None


def test_detect_intent_surprise_me_case_insensitive():
    result = detect_intent("Surprise Me please")
    assert result["is_surprise_me"] is True


# ── build_profile_with_defaults ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_build_profile_traveler_count_assumed():
    db = _mock_db(_BLANK_PROFILE)
    _, assumed = await build_profile_with_defaults(
        str(uuid.uuid4()), {"destination": "Hanoi", "duration_days": None, "is_surprise_me": False}, db
    )
    assert "traveler_count" in assumed


@pytest.mark.asyncio
async def test_build_profile_traveler_count_default_value():
    db = _mock_db(_BLANK_PROFILE)
    patch_dict, _ = await build_profile_with_defaults(
        str(uuid.uuid4()), {"destination": "Hanoi", "duration_days": None, "is_surprise_me": False}, db
    )
    assert patch_dict["traveler_count"] == DEFAULT_TRAVELER_COUNT


@pytest.mark.asyncio
async def test_build_profile_budget_assumed():
    db = _mock_db(_BLANK_PROFILE)
    _, assumed = await build_profile_with_defaults(
        str(uuid.uuid4()), {"destination": "Hanoi", "duration_days": None, "is_surprise_me": False}, db
    )
    assert "budget" in assumed


@pytest.mark.asyncio
async def test_build_profile_budget_default_value():
    db = _mock_db(_BLANK_PROFILE)
    patch_dict, _ = await build_profile_with_defaults(
        str(uuid.uuid4()), {"destination": "Hanoi", "duration_days": None, "is_surprise_me": False}, db
    )
    assert patch_dict["budget_total"] == DEFAULT_BUDGET_TOTAL


@pytest.mark.asyncio
async def test_build_profile_travel_dates_assumed_when_no_duration():
    db = _mock_db(_BLANK_PROFILE)
    patch_dict, assumed = await build_profile_with_defaults(
        str(uuid.uuid4()), {"destination": "Hanoi", "duration_days": None, "is_surprise_me": False}, db
    )
    assert "travel_dates" in assumed
    start = patch_dict["travel_start_date"]
    end = patch_dict["travel_end_date"]
    assert (end - start).days == DEFAULT_DURATION_DAYS


@pytest.mark.asyncio
async def test_build_profile_travel_dates_not_assumed_when_duration_given():
    db = _mock_db(_BLANK_PROFILE)
    patch_dict, assumed = await build_profile_with_defaults(
        str(uuid.uuid4()), {"destination": "Hanoi", "duration_days": 3, "is_surprise_me": False}, db
    )
    assert "travel_dates" not in assumed
    start = patch_dict["travel_start_date"]
    end = patch_dict["travel_end_date"]
    assert (end - start).days == 3


@pytest.mark.asyncio
async def test_build_profile_destination_not_assumed_when_extracted():
    db = _mock_db(_BLANK_PROFILE)
    patch_dict, assumed = await build_profile_with_defaults(
        str(uuid.uuid4()), {"destination": "Hanoi", "duration_days": None, "is_surprise_me": False}, db
    )
    assert "destination" not in assumed
    assert patch_dict["destination_preferences"] == ["Hanoi"]


@pytest.mark.asyncio
async def test_build_profile_activities_assumed():
    db = _mock_db(_BLANK_PROFILE)
    _, assumed = await build_profile_with_defaults(
        str(uuid.uuid4()), {"destination": "Hanoi", "duration_days": None, "is_surprise_me": False}, db
    )
    assert "activities" in assumed


@pytest.mark.asyncio
async def test_surprise_me_picks_from_vietnam_cities():
    db = _mock_db(_BLANK_PROFILE)
    patch_dict, _ = await build_profile_with_defaults(
        str(uuid.uuid4()), {"destination": None, "duration_days": None, "is_surprise_me": True}, db
    )
    assert patch_dict["destination_preferences"][0] in VIETNAM_CITIES


@pytest.mark.asyncio
async def test_start_date_is_30_days_from_now():
    db = _mock_db(_BLANK_PROFILE)
    patch_dict, _ = await build_profile_with_defaults(
        str(uuid.uuid4()), {"destination": "Hanoi", "duration_days": None, "is_surprise_me": False}, db
    )
    expected_start = date.today() + timedelta(days=DEFAULT_START_DAYS_FROM_NOW)
    assert patch_dict["travel_start_date"] == expected_start


# ── endpoint integration test ────────────────────────────────────────────────

@pytest.mark.integration
@pytest.mark.asyncio
async def test_propose_first_endpoint_returns_200(async_client):
    """POST propose-first returns 200 with valid response shape."""
    from app.core.dependencies import get_current_tenant_id
    from app.main import app

    # Create session first (auth bypassed via dependency override)
    app.dependency_overrides[get_current_tenant_id] = lambda: "test-tenant"
    try:
        create_resp = await async_client.post("/api/v1/advisory_sessions", json={})
        assert create_resp.status_code == 201
        session_id = create_resp.json()["id"]

        with patch("app.services.workflow.run_advisory_workflow", new_callable=AsyncMock):
            resp = await async_client.post(
                f"/api/v1/advisory_sessions/{session_id}/propose-first",
                json={"message": "I want to visit Hanoi for a week"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "bot_message" in data
        assert "assumed_slots" in data
        assert isinstance(data["assumed_slots"], list)
        assert "is_surprise_me" in data
        assert data["is_surprise_me"] is False
    finally:
        app.dependency_overrides.clear()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_propose_first_endpoint_surprise_me(async_client):
    """Surprise-me sets is_surprise_me=True and picks a Vietnam city."""
    from app.core.dependencies import get_current_tenant_id
    from app.main import app

    app.dependency_overrides[get_current_tenant_id] = lambda: "test-tenant"
    try:
        create_resp = await async_client.post("/api/v1/advisory_sessions", json={})
        session_id = create_resp.json()["id"]

        with patch("app.services.workflow.run_advisory_workflow", new_callable=AsyncMock):
            resp = await async_client.post(
                f"/api/v1/advisory_sessions/{session_id}/propose-first",
                json={"message": "surprise me with something nice"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_surprise_me"] is True
        assert data["extracted_slots"]["is_surprise_me"] is True
    finally:
        app.dependency_overrides.clear()
