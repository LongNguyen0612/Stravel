import json
import tempfile

import pytest

from app.etl.deduplication import is_duplicate, normalize_name
from app.etl.hotels import HotelPipeline


class MockEmbedder:
    def embed(self, text: str) -> list[float]:
        return [0.1] * 384

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [[0.1] * 384 for _ in texts]


class MockVectorStore:
    def __init__(self):
        self._store = {}

    async def upsert(self, entity_id: str, vector: list[float], payload: dict) -> None:
        self._store[entity_id] = payload

    async def search(self, query: str, filters: dict, limit: int = 10) -> list[dict]:
        return []

    async def get_by_id(self, entity_id: str) -> dict | None:
        return self._store.get(entity_id)


@pytest.fixture
def mock_store():
    return MockVectorStore()


@pytest.fixture
def embedder():
    return MockEmbedder()


@pytest.fixture
def hotel_pipeline(mock_store, embedder):
    return HotelPipeline(mock_store, embedder)


def test_normalize_name():
    assert normalize_name("  Rex Hotel  ") == "rex hotel"
    assert normalize_name("Hôtel de la Paix") == "hotel de la paix"
    assert normalize_name("GRAND  HOTEL") == "grand hotel"


def test_is_duplicate_same_name():
    a = {"name": "Rex Hotel", "location_lat": None, "location_lng": None}
    b = {"name": "rex hotel", "location_lat": None, "location_lng": None}
    assert is_duplicate(a, b)


def test_is_not_duplicate_different_name():
    a = {"name": "Rex Hotel"}
    b = {"name": "Continental Hotel"}
    assert not is_duplicate(a, b)


def test_is_duplicate_same_location():
    a = {"name": "Rex Hotel", "location_lat": 10.776, "location_lng": 106.701}
    b = {"name": "Rex Hotel", "location_lat": 10.7761, "location_lng": 106.7011}
    assert is_duplicate(a, b)


def test_is_not_duplicate_far_location():
    a = {"name": "Rex Hotel", "location_lat": 10.776, "location_lng": 106.701}
    b = {"name": "Rex Hotel", "location_lat": 21.028, "location_lng": 105.854}
    assert not is_duplicate(a, b)


def test_extract_from_json(hotel_pipeline):
    data = [{"name": "Hotel A", "region": "hanoi", "description": "Nice hotel"}]
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(data, f)
        path = f.name

    result = hotel_pipeline.extract(path)
    assert len(result) == 1
    assert result[0]["name"] == "Hotel A"


def test_transform_adds_metadata(hotel_pipeline):
    raw = [{"name": "Hotel A", "region": "hanoi"}]
    transformed = hotel_pipeline.transform(raw)
    assert transformed[0]["entity_type"] == "hotel"
    assert "ingested_at" in transformed[0]
    assert "expires_at" in transformed[0]


@pytest.mark.asyncio
async def test_load_upserts_to_store(hotel_pipeline, mock_store):
    entities = [
        {"name": "Hotel A", "region": "hanoi", "description": "Nice", "entity_type": "hotel"},
        {"name": "Hotel B", "region": "hcmc", "description": "Great", "entity_type": "hotel"},
    ]
    result = await hotel_pipeline.load(entities)
    assert result.total == 2
    assert result.inserted == 2
    assert len(result.errors) == 0
    assert len(mock_store._store) == 2


@pytest.mark.asyncio
async def test_full_pipeline_run(hotel_pipeline, mock_store):
    data = [
        {"name": "Hotel A", "region": "hanoi", "description": "Nice hotel"},
        {"name": "Hotel B", "region": "hcmc", "description": "Great hotel"},
    ]
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(data, f)
        path = f.name

    result = await hotel_pipeline.run(path)
    assert result.total == 2
    assert result.inserted == 2
    assert len(mock_store._store) == 2


def test_pipeline_idempotent_ids(hotel_pipeline):
    """Same entity produces same ID — idempotent upsert."""
    id1 = hotel_pipeline._build_id({"name": "Rex Hotel", "region": "hcmc"})
    id2 = hotel_pipeline._build_id({"name": "Rex Hotel", "region": "hcmc"})
    assert id1 == id2


def test_pipeline_different_entities_different_ids(hotel_pipeline):
    id1 = hotel_pipeline._build_id({"name": "Rex Hotel", "region": "hcmc"})
    id2 = hotel_pipeline._build_id({"name": "Continental Hotel", "region": "hcmc"})
    assert id1 != id2
