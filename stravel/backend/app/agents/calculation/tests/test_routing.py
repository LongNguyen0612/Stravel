from datetime import date

from app.agents.calculation.pricing import analyze_seasonal_pricing
from app.agents.calculation.routing import get_transport, optimize_route


def test_direct_route():
    route = optimize_route(["hanoi", "halong"])
    assert len(route.legs) == 1
    assert route.total_cost > 0


def test_multi_city_route():
    route = optimize_route(["hanoi", "danang", "hcmc"])
    assert len(route.legs) == 2
    assert route.total_cost > 0


def test_single_destination():
    route = optimize_route(["hanoi"])
    assert len(route.legs) == 0
    assert route.total_cost == 0


def test_empty_destinations():
    route = optimize_route([])
    assert len(route.legs) == 0


def test_sapa_to_phuquoc_no_direct():
    """No direct route — route via intermediate cities."""
    route = optimize_route(["sapa", "hanoi", "hcmc", "phuquoc"])
    assert len(route.legs) >= 2
    assert route.total_cost > 0


def test_duplicate_destinations():
    route = optimize_route(["hanoi", "hanoi", "danang"])
    assert len(set(route.destinations)) == len(route.destinations)


def test_get_transport_bidirectional():
    opts_fwd = get_transport("hanoi", "halong")
    opts_rev = get_transport("halong", "hanoi")
    assert len(opts_fwd) > 0
    assert len(opts_rev) > 0


def test_get_transport_unknown():
    opts = get_transport("hanoi", "tokyo")
    assert len(opts) == 0


# Pricing tests
def test_low_season_pricing():
    points = analyze_seasonal_pricing("hanoi", date(2026, 3, 1), date(2026, 3, 28))
    assert len(points) == 4  # 4 weeks
    assert all(p.season_type == "low" for p in points)
    assert all(p.multiplier == 1.0 for p in points)


def test_tet_pricing():
    points = analyze_seasonal_pricing("phuquoc", date(2026, 2, 14), date(2026, 2, 25))
    tet_weeks = [p for p in points if "tet" in p.season_type]
    assert len(tet_weeks) > 0
    assert tet_weeks[0].multiplier > 1.5


def test_christmas_pricing():
    points = analyze_seasonal_pricing("danang", date(2026, 12, 20), date(2027, 1, 5))
    xmas_weeks = [p for p in points if "christmas" in p.season_type]
    assert len(xmas_weeks) > 0
    assert xmas_weeks[0].multiplier > 1.0


def test_summer_shoulder():
    points = analyze_seasonal_pricing("hanoi", date(2026, 7, 1), date(2026, 7, 28))
    assert all(p.season_type == "shoulder_summer" for p in points)


def test_pricing_unknown_destination():
    points = analyze_seasonal_pricing("unknown_city", date(2026, 3, 1), date(2026, 3, 14))
    assert len(points) == 2
    assert all(p.multiplier >= 1.0 for p in points)
