from app.agents.calculation.insurance import classify_activity_risk, estimate_insurance, get_age_multiplier


def test_classify_high_risk():
    assert classify_activity_risk("scuba diving") == "high"
    assert classify_activity_risk("Motorbike Tour") == "high"
    assert classify_activity_risk("PARAGLIDING") == "high"


def test_classify_medium_risk():
    assert classify_activity_risk("trekking") == "medium"
    assert classify_activity_risk("kayaking") == "medium"


def test_classify_low_risk():
    assert classify_activity_risk("sightseeing") == "low"
    assert classify_activity_risk("museum visit") == "low"


def test_age_multiplier():
    assert get_age_multiplier(10) == 0.8  # Child
    assert get_age_multiplier(25) == 1.0  # Young adult
    assert get_age_multiplier(45) == 1.2  # Middle age
    assert get_age_multiplier(65) == 1.6  # Senior
    assert get_age_multiplier(75) == 2.2  # Elderly


def test_basic_estimate():
    result = estimate_insurance(traveler_count=1, duration_days=7)
    assert result.premium_low > 0
    assert result.premium_high > result.premium_low


def test_high_risk_increases_premium():
    safe = estimate_insurance(1, [30], 7, ["sightseeing"])
    risky = estimate_insurance(1, [30], 7, ["scuba diving"])
    assert risky.premium_high > safe.premium_high
    assert "scuba diving" in risky.high_risk_activities


def test_multiple_travelers():
    single = estimate_insurance(1, [30], 7)
    double = estimate_insurance(2, [30, 30], 7)
    assert abs(double.premium_low - single.premium_low * 2) < 0.01


def test_senior_traveler_higher():
    young = estimate_insurance(1, [25], 7)
    senior = estimate_insurance(1, [70], 7)
    assert senior.premium_high > young.premium_high


def test_zero_duration():
    result = estimate_insurance(1, [30], 0)
    assert result.premium_low == 0
    assert result.premium_high == 0


def test_coverage_notes_for_high_risk():
    result = estimate_insurance(1, [30], 7, ["motorbike", "trekking"])
    assert any("High-risk" in n for n in result.coverage_notes)


def test_coverage_notes_for_senior():
    result = estimate_insurance(1, [70], 7)
    assert any("Senior" in n for n in result.coverage_notes)


def test_long_trip_discount():
    short = estimate_insurance(1, [30], 7)
    long = estimate_insurance(1, [30], 21)
    # Long trip should have lower per-day cost
    per_day_short = short.premium_high / 7
    per_day_long = long.premium_high / 21
    assert per_day_long < per_day_short
