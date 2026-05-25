import pytest

from app.agents.calculation.accommodation import (
    build_why_it_fits,
    match_accommodations,
    normalize_region,
    score_accommodation,
)


class MockVectorStore:
    def __init__(self, data=None):
        self._data = data or []

    async def search(self, query, filters, limit=10):
        results = []
        for item in self._data:
            match = all(item.get(k) == v for k, v in filters.items() if v is not None)
            if match:
                results.append(item)
        return results[:limit]


def _hotel(name="Test Hotel", region="hcmc", pricing=100, rating=4.5, style="mid-range", **kwargs):
    return {
        "id": f"h-{name[:5]}",
        "name": name,
        "region": region,
        "pricing": pricing,
        "rating": rating,
        "entity_type": "hotel",
        "accommodation_style": style,
        "source_url": "https://example.com",
        "freshness_status": "fresh",
        "description": f"{name} in {region}",
        **kwargs,
    }


def test_normalize_region():
    assert normalize_region("Ho Chi Minh City") == "hcmc"
    assert normalize_region("Saigon") == "hcmc"
    assert normalize_region("HANOI") == "hanoi"
    assert normalize_region("phu quoc") == "phuquoc"


def test_score_within_budget():
    entity = _hotel(pricing=80)
    score = score_accommodation(entity, budget_per_night=100, target_region="hcmc")
    assert 0 < score <= 1


def test_score_over_budget_penalized():
    cheap = _hotel(pricing=80)
    expensive = _hotel(pricing=200)
    score_cheap = score_accommodation(cheap, 100, "hcmc")
    score_expensive = score_accommodation(expensive, 100, "hcmc")
    assert score_cheap > score_expensive


def test_score_same_region_higher():
    same = _hotel(region="hcmc")
    diff = _hotel(region="hanoi")
    score_same = score_accommodation(same, 100, "hcmc")
    score_diff = score_accommodation(diff, 100, "hcmc")
    assert score_same > score_diff


def test_score_matching_style():
    luxury = _hotel(style="luxury")
    budget = _hotel(style="budget")
    score_lux = score_accommodation(luxury, 100, "hcmc", target_style="luxury")
    score_bud = score_accommodation(budget, 100, "hcmc", target_style="luxury")
    assert score_lux > score_bud


def test_build_why_it_fits():
    entity = _hotel(pricing=80, rating=4.5)
    why = build_why_it_fits(entity, 100)
    assert "Within budget" in why
    assert "4.5" in why


def test_build_why_over_budget():
    entity = _hotel(pricing=150)
    why = build_why_it_fits(entity, 100)
    assert "over budget" in why


@pytest.mark.asyncio
async def test_match_returns_results():
    store = MockVectorStore([_hotel("Hotel A"), _hotel("Hotel B")])
    results = await match_accommodations(store, "hcmc", 100)
    assert len(results) == 2
    assert all(r.entity_id for r in results)


@pytest.mark.asyncio
async def test_match_empty_results():
    store = MockVectorStore([])
    results = await match_accommodations(store, "hcmc", 100)
    assert len(results) == 0


@pytest.mark.asyncio
async def test_match_sorted_by_score():
    store = MockVectorStore([_hotel("Cheap", pricing=50, rating=3.0), _hotel("Nice", pricing=90, rating=4.8)])
    results = await match_accommodations(store, "hcmc", 100)
    assert results[0].score >= results[1].score


@pytest.mark.asyncio
async def test_match_respects_limit():
    hotels = [_hotel(f"Hotel {i}", pricing=50 + i * 10) for i in range(20)]
    store = MockVectorStore(hotels)
    results = await match_accommodations(store, "hcmc", 100, limit=5)
    assert len(results) <= 5
