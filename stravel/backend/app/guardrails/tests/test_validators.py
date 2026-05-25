import pytest

from app.guardrails.entity_validator import EntityValidator
from app.guardrails.price_validator import PriceValidator


class MockVectorStore:
    def __init__(self, data=None):
        self._data = data or []

    async def search(self, query, filters, limit=10):
        results = []
        for item in self._data:
            if query.lower() in item.get("name", "").lower():
                results.append(item)
        return results[:limit]


@pytest.fixture
def store_with_data():
    return MockVectorStore(
        [
            {"name": "Rex Hotel", "region": "hcmc", "pricing": 120, "entity_type": "hotel"},
            {"name": "Pho 24", "region": "hcmc", "pricing": 5, "entity_type": "restaurant"},
            {"name": "War Museum", "region": "hcmc", "pricing": 3, "entity_type": "attraction"},
        ]
    )


@pytest.fixture
def empty_store():
    return MockVectorStore([])


# Entity Validator Tests
@pytest.mark.asyncio
async def test_validate_existing_entities(store_with_data):
    validator = EntityValidator(store_with_data)
    result = await validator.validate_entities(["Rex Hotel", "Pho 24"])
    assert len(result["valid"]) == 2
    assert len(result["invalid"]) == 0


@pytest.mark.asyncio
async def test_validate_missing_entity(store_with_data):
    validator = EntityValidator(store_with_data)
    result = await validator.validate_entities(["Fake Hotel", "Rex Hotel"])
    assert len(result["valid"]) == 1
    assert len(result["invalid"]) == 1
    assert "Fake Hotel" in result["invalid"]


@pytest.mark.asyncio
async def test_validate_empty_store(empty_store):
    validator = EntityValidator(empty_store)
    result = await validator.validate_entities(["Any Hotel"])
    assert len(result["valid"]) == 0
    assert len(result["invalid"]) == 1


@pytest.mark.asyncio
async def test_validate_and_filter(store_with_data):
    validator = EntityValidator(store_with_data)
    entities = [
        {"name": "Rex Hotel", "region": "hcmc"},
        {"name": "Fake Place", "region": "hcmc"},
        {"name": "Pho 24", "region": "hcmc"},
    ]
    filtered = await validator.validate_and_filter(entities)
    assert len(filtered) == 2


# Price Validator Tests
@pytest.mark.asyncio
async def test_price_valid(store_with_data):
    validator = PriceValidator(store_with_data)
    result = await validator.validate_price("Rex Hotel", 120)
    assert result["valid"]


@pytest.mark.asyncio
async def test_price_within_tolerance(store_with_data):
    validator = PriceValidator(store_with_data)
    result = await validator.validate_price("Rex Hotel", 125)  # 4% over — within 10%
    assert result["valid"]


@pytest.mark.asyncio
async def test_price_mismatch(store_with_data):
    validator = PriceValidator(store_with_data)
    result = await validator.validate_price("Rex Hotel", 200)  # 67% over — invalid
    assert not result["valid"]
    assert result["source_price"] == 120


@pytest.mark.asyncio
async def test_price_no_entity(empty_store):
    validator = PriceValidator(empty_store)
    result = await validator.validate_price("Fake Hotel", 100)
    assert not result["valid"]


@pytest.mark.asyncio
async def test_validate_multiple_prices(store_with_data):
    validator = PriceValidator(store_with_data)
    claims = [
        {"name": "Rex Hotel", "price": 120, "region": "hcmc"},
        {"name": "Pho 24", "price": 5, "region": "hcmc"},
        {"name": "Rex Hotel", "price": 999, "region": "hcmc"},
    ]
    result = await validator.validate_prices(claims)
    assert len(result["valid"]) == 2
    assert len(result["invalid"]) == 1
    assert not result["all_valid"]
