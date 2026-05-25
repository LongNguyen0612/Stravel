import pytest

from app.rag.hybrid_search import HybridSearchService, SearchResult


class MockVectorStore:
    def __init__(self, data: list[dict] | None = None):
        self._data = data or []

    async def search(self, query: str, filters: dict, limit: int = 10) -> list[dict]:
        results = []
        for item in self._data:
            match = all(item.get(k) == v for k, v in filters.items() if v is not None)
            if match:
                results.append(item)
        return results[:limit]


class MockEmbedder:
    def embed(self, text: str) -> list[float]:
        return [0.1] * 384

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [[0.1] * 384 for _ in texts]


@pytest.fixture
def sample_data():
    return [
        {"id": "h1", "name": "Rex Hotel Saigon", "entity_type": "hotel", "region": "hcmc", "score": 0.95},
        {"id": "h2", "name": "Continental Hotel", "entity_type": "hotel", "region": "hcmc", "score": 0.85},
        {"id": "r1", "name": "Pho 24", "entity_type": "restaurant", "region": "hcmc", "score": 0.90},
        {"id": "a1", "name": "War Museum", "entity_type": "attraction", "region": "hcmc", "score": 0.80},
        {"id": "h3", "name": "Hanoi Hotel", "entity_type": "hotel", "region": "hanoi", "score": 0.75},
    ]


@pytest.fixture
def search_service(sample_data):
    store = MockVectorStore(sample_data)
    return HybridSearchService(store, MockEmbedder())


@pytest.mark.asyncio
async def test_search_returns_results(search_service):
    results = await search_service.search("hotel")
    assert len(results) > 0
    assert all(isinstance(r, SearchResult) for r in results)


@pytest.mark.asyncio
async def test_search_with_type_filter(search_service):
    results = await search_service.search("hotel", filters={"entity_type": "hotel"})
    assert all(r.entity_type == "hotel" for r in results)


@pytest.mark.asyncio
async def test_search_with_region_filter(search_service):
    results = await search_service.search("hotel", filters={"region": "hanoi"})
    assert all(r.region == "hanoi" for r in results)


@pytest.mark.asyncio
async def test_search_limit(search_service):
    results = await search_service.search("anything", limit=2)
    assert len(results) <= 2


@pytest.mark.asyncio
async def test_search_deduplicates_results(search_service):
    results = await search_service.search("hotel")
    ids = [r.id for r in results]
    assert len(ids) == len(set(ids))  # No duplicates


@pytest.mark.asyncio
async def test_empty_results():
    store = MockVectorStore([])
    service = HybridSearchService(store, MockEmbedder())
    results = await service.search("nonexistent hotel")
    assert len(results) == 0


@pytest.mark.asyncio
async def test_merge_rrf_scores():
    """RRF merge produces combined scores."""
    service = HybridSearchService(MockVectorStore([]), MockEmbedder())
    keyword = [SearchResult(id="1", name="A", score=0.9)]
    semantic = [SearchResult(id="1", name="A", score=0.8), SearchResult(id="2", name="B", score=0.7)]

    merged = service._merge_results(keyword, semantic, 0.3, 0.7)
    assert merged[0].id == "1"  # Should be ranked higher (appears in both)
    assert len(merged) == 2


@pytest.mark.asyncio
async def test_configurable_weights(search_service):
    """Different weights should not crash."""
    results_keyword_heavy = await search_service.search("hotel", keyword_weight=0.8, semantic_weight=0.2)
    results_semantic_heavy = await search_service.search("hotel", keyword_weight=0.2, semantic_weight=0.8)
    assert len(results_keyword_heavy) >= 0
    assert len(results_semantic_heavy) >= 0
