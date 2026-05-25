import pytest


class MockVectorStore:
    """In-memory mock for testing without Qdrant."""

    def __init__(self):
        self._store: dict[str, dict] = {}

    async def search(self, query: str, filters: dict, limit: int = 10) -> list[dict]:
        results = []
        for eid, payload in self._store.items():
            match = all(payload.get(k) == v for k, v in filters.items() if v is not None)
            if match:
                results.append({"id": eid, "score": 0.9, **payload})
        return results[:limit]

    async def get_by_id(self, entity_id: str) -> dict | None:
        payload = self._store.get(entity_id)
        if payload:
            return {"id": entity_id, **payload}
        return None

    async def upsert(self, entity_id: str, vector: list[float], payload: dict) -> None:
        self._store[entity_id] = payload

    async def delete(self, entity_id: str) -> None:
        self._store.pop(entity_id, None)


@pytest.fixture
def mock_store():
    return MockVectorStore()


@pytest.mark.asyncio
async def test_upsert_and_get(mock_store):
    await mock_store.upsert("e1", [0.1] * 384, {"name": "Rex Hotel", "region": "hcmc", "entity_type": "hotel"})
    result = await mock_store.get_by_id("e1")
    assert result is not None
    assert result["name"] == "Rex Hotel"


@pytest.mark.asyncio
async def test_search_with_filters(mock_store):
    await mock_store.upsert("e1", [0.1] * 384, {"name": "Rex Hotel", "region": "hcmc", "entity_type": "hotel"})
    await mock_store.upsert("e2", [0.1] * 384, {"name": "Pho 24", "region": "hcmc", "entity_type": "restaurant"})

    results = await mock_store.search("hotel", {"entity_type": "hotel"})
    assert len(results) == 1
    assert results[0]["name"] == "Rex Hotel"


@pytest.mark.asyncio
async def test_search_region_filter(mock_store):
    await mock_store.upsert("e1", [0.1] * 384, {"name": "Hotel A", "region": "hanoi", "entity_type": "hotel"})
    await mock_store.upsert("e2", [0.1] * 384, {"name": "Hotel B", "region": "hcmc", "entity_type": "hotel"})

    results = await mock_store.search("hotel", {"region": "hanoi"})
    assert len(results) == 1
    assert results[0]["region"] == "hanoi"


@pytest.mark.asyncio
async def test_get_nonexistent(mock_store):
    result = await mock_store.get_by_id("nonexistent")
    assert result is None


@pytest.mark.asyncio
async def test_delete(mock_store):
    await mock_store.upsert("e1", [0.1] * 384, {"name": "Hotel A"})
    await mock_store.delete("e1")
    result = await mock_store.get_by_id("e1")
    assert result is None


@pytest.mark.asyncio
async def test_search_limit(mock_store):
    for i in range(20):
        await mock_store.upsert(f"e{i}", [0.1] * 384, {"name": f"Hotel {i}", "entity_type": "hotel"})

    results = await mock_store.search("hotel", {"entity_type": "hotel"}, limit=5)
    assert len(results) == 5
