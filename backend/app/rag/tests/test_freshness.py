from datetime import datetime, timedelta

from app.rag.freshness import FreshnessStatus, evaluate_freshness, filter_fresh, filter_with_warnings


def _entity(days_ago: int = 1, expiry_days: int = 7) -> dict:
    now = datetime.utcnow()
    return {
        "name": "Test Hotel",
        "entity_type": "hotel",
        "ingested_at": (now - timedelta(days=days_ago)).isoformat(),
        "expires_at": (now - timedelta(days=days_ago) + timedelta(days=expiry_days)).isoformat(),
    }


def test_fresh_entity():
    entity = _entity(days_ago=1, expiry_days=7)
    assert evaluate_freshness(entity) == FreshnessStatus.FRESH


def test_stale_entity():
    """Entity near 80% of its lifespan should be stale."""
    entity = _entity(days_ago=6, expiry_days=7)
    assert evaluate_freshness(entity) == FreshnessStatus.STALE


def test_expired_entity():
    entity = _entity(days_ago=10, expiry_days=7)
    assert evaluate_freshness(entity) == FreshnessStatus.EXPIRED


def test_no_expires_at():
    entity = {"name": "Test", "entity_type": "hotel"}
    assert evaluate_freshness(entity) == FreshnessStatus.STALE


def test_filter_fresh_removes_expired():
    fresh = _entity(days_ago=1, expiry_days=7)
    expired = _entity(days_ago=10, expiry_days=7)
    result = filter_fresh([fresh, expired])
    assert len(result) == 1


def test_filter_with_warnings_excludes_expired():
    fresh = _entity(days_ago=1, expiry_days=7)
    stale = _entity(days_ago=6, expiry_days=7)
    expired = _entity(days_ago=10, expiry_days=7)
    result = filter_with_warnings([fresh, stale, expired])
    assert len(result) == 2  # fresh + stale, not expired
    statuses = [r["freshness_status"] for r in result]
    assert "fresh" in statuses
    assert "stale" in statuses


def test_filter_with_warnings_adds_status():
    entity = _entity(days_ago=1, expiry_days=7)
    result = filter_with_warnings([entity])
    assert result[0]["freshness_status"] == "fresh"
