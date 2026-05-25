# Story 2.3: Hybrid Search

Status: pending

## Story

As a travel agent (via the system),
I want to search for travel entities using both exact names and natural language descriptions,
so that the system finds relevant results whether I search "Rex Hotel Saigon" or "quiet beach resort with pool under $100."

## Acceptance Criteria

1. `rag/hybrid_search.py` implements combined keyword and semantic search with a `HybridSearchService` class
2. A keyword search for "Rex Hotel Saigon" returns the exact match as the top result
3. A semantic search for "quiet beach resort with pool under $100 in Phu Quoc" returns relevant entities ranked by semantic similarity combined with metadata filters
4. Hybrid mode merges keyword and semantic results with configurable weighting (default: 0.3 keyword / 0.7 semantic)
5. Results can be filtered by metadata: `region`, `type`, `price_range`, `rating` (minimum threshold)
6. Search returns within 2 seconds for the seed dataset (measured end-to-end including embedding generation)
7. `HybridSearchService` implements a `SearchServiceProtocol` defined in `agents/protocols.py` so agents access search via DI
8. All search operations include `tenant_id` filtering for multi-tenancy isolation
9. Search results include relevance scores and match source (keyword, semantic, or both)
10. Unit tests pass without a running Qdrant instance (mock `VectorStoreProtocol`)

## Dependencies

- **Story 2.1** (Qdrant Vector Store Setup & Entity Model) -- provides `VectorStoreProtocol`, `rag/vector_store.py`, `rag/embeddings.py`, `models/entity.py`
- **Story 2.2** (Entity Ingestion Pipeline) -- provides seed data in Qdrant for integration testing

## Tasks / Subtasks

- [ ] Task 1: Define SearchServiceProtocol and search schemas (AC: #7, #9)
  - [ ] Add `SearchServiceProtocol` to `app/agents/protocols.py` with `search()` method signature
  - [ ] Create `app/rag/schemas.py` with `SearchQuery`, `SearchResult`, `SearchResponse`, `SearchMode` models
  - [ ] `SearchQuery` includes: `query` (str), `mode` (keyword|semantic|hybrid), `filters` (optional dict), `keyword_weight` (float, default 0.3), `limit` (int, default 10), `tenant_id` (str)
  - [ ] `SearchResult` includes: `entity_id`, `name`, `type`, `region`, `score`, `match_source` (keyword|semantic|both), `metadata` (dict)
  - [ ] `SearchResponse` includes: `results` (list[SearchResult]), `total`, `query_time_ms` (int)

- [ ] Task 2: Implement keyword search (AC: #1, #2)
  - [ ] Create `app/rag/hybrid_search.py` with `HybridSearchService` class
  - [ ] Implement `_keyword_search()` method using Qdrant scroll/filter with text matching on `name` and `description` payload fields
  - [ ] Use Qdrant's `models.FieldCondition` with `models.MatchText` for keyword matching
  - [ ] Always apply `tenant_id` filter condition
  - [ ] Return results with `match_source="keyword"` and score based on text match relevance

- [ ] Task 3: Implement semantic search (AC: #1, #3)
  - [ ] Implement `_semantic_search()` method using Qdrant `search()` with query embedding
  - [ ] Use `rag/embeddings.py` (from Story 2.1) to generate query vector
  - [ ] Apply metadata filters as Qdrant `models.Filter` conditions
  - [ ] Always apply `tenant_id` filter condition
  - [ ] Return results with `match_source="semantic"` and cosine similarity score

- [ ] Task 4: Implement metadata filtering (AC: #5)
  - [ ] Implement `_build_filters()` method that converts filter dict to Qdrant `models.Filter`
  - [ ] Support `region` filter (exact match, e.g., "phu_quoc", "hanoi", "da_nang")
  - [ ] Support `type` filter (exact match: "hotel", "attraction", "restaurant")
  - [ ] Support `price_range` filter with `min_price` and `max_price` as range condition
  - [ ] Support `rating` filter as minimum threshold (e.g., rating >= 4.0)
  - [ ] Combine all filters with `must` clause (AND logic)
  - [ ] Always include `tenant_id` as a `must` filter

- [ ] Task 5: Implement hybrid merge with configurable weighting (AC: #4, #9)
  - [ ] Implement `_merge_results()` using Reciprocal Rank Fusion (RRF) with configurable weights
  - [ ] Keyword weight (default 0.3) and semantic weight (default 0.7) must sum to 1.0
  - [ ] Deduplicate results by `entity_id` -- if an entity appears in both keyword and semantic results, mark `match_source="both"` and combine scores
  - [ ] Sort merged results by combined score descending
  - [ ] Truncate to requested `limit`

- [ ] Task 6: Implement main search() method (AC: #1, #6, #8)
  - [ ] Implement `async search(query: SearchQuery) -> SearchResponse` as the public interface
  - [ ] Route to `_keyword_search()`, `_semantic_search()`, or both based on `query.mode`
  - [ ] Measure wall-clock time and populate `query_time_ms` in response
  - [ ] Log search with structlog: `query`, `mode`, `filter_count`, `result_count`, `query_time_ms`, `tenant_id`
  - [ ] Emit OpenTelemetry span for the search operation

- [ ] Task 7: Write unit tests with mocked vector store (AC: #2, #3, #4, #5, #9, #10)
  - [ ] Create `app/rag/tests/test_hybrid_search.py`
  - [ ] Test: keyword search returns exact name match as top result
  - [ ] Test: semantic search returns results ordered by similarity score
  - [ ] Test: hybrid mode merges and deduplicates results correctly
  - [ ] Test: configurable weighting changes result ordering (0.0/1.0 = pure semantic, 1.0/0.0 = pure keyword)
  - [ ] Test: region filter limits results to specified region
  - [ ] Test: type filter limits results to specified entity type
  - [ ] Test: price_range filter excludes entities outside range
  - [ ] Test: rating filter excludes entities below threshold
  - [ ] Test: combined filters (region + type + price) work together
  - [ ] Test: tenant_id is always included in filters
  - [ ] Test: empty result set returns `SearchResponse` with empty list and `total=0`
  - [ ] Test: `match_source` is correctly set to "keyword", "semantic", or "both"
  - [ ] All tests mock `VectorStoreProtocol` -- no Qdrant required

- [ ] Task 8: Write integration test for performance (AC: #6)
  - [ ] Create `app/rag/tests/test_hybrid_search_integration.py`
  - [ ] Mark with `@pytest.mark.integration`
  - [ ] Test: hybrid search completes within 2 seconds against seed dataset
  - [ ] Test: keyword search for known entity name returns correct result
  - [ ] Test: semantic search for descriptive query returns relevant results
  - [ ] Requires running Qdrant with seed data loaded

## Dev Notes

### Architecture Constraints

- **VectorStoreProtocol from Story 2.1** -- `HybridSearchService` depends on `VectorStoreProtocol` for all Qdrant access. Never import Qdrant client directly.
- **Protocol-based DI** -- Agents will access hybrid search via `SearchServiceProtocol`. The `HybridSearchService` is injected, never imported directly by agents.
- **Tenant isolation mandatory** -- Every search MUST include `tenant_id` in filters. No exceptions.
- **No Qdrant for unit tests** -- Mock the `VectorStoreProtocol`. Integration tests require Qdrant.
- **structlog everywhere** -- All logging via structlog with `tenant_id`, `session_id` (when available), `query` context keys.
- **Phase 2 infrastructure** -- Qdrant and Redis available via `docker-compose.full.yml`.

### Existing Code from Story 2.1 (Expected)

`VectorStoreProtocol` in `app/agents/protocols.py`:
```python
class VectorStoreProtocol(Protocol):
    async def search(self, query: str, filters: dict, limit: int = 10) -> list[Entity]: ...
    async def get_by_id(self, entity_id: str) -> Entity | None: ...
```

`Entity` model in `app/models/entity.py`:
```python
class Entity(SQLModel, table=True):
    __tablename__ = "entities"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(index=True)
    type: str = Field(index=True)  # "hotel", "attraction", "restaurant"
    region: str = Field(index=True)  # "hanoi", "hcmc", "phu_quoc", etc.
    description: str
    location_lat: float | None = None
    location_lng: float | None = None
    pricing: dict | None = Field(default=None, sa_type=JSON)
    rating: float | None = None
    source_url: str | None = None
    tenant_id: str = Field(index=True)
    ingested_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime | None = None
```

Embeddings service in `app/rag/embeddings.py`:
```python
class EmbeddingService:
    async def embed(self, text: str) -> list[float]: ...
    async def embed_batch(self, texts: list[str]) -> list[list[float]]: ...
```

### SearchServiceProtocol Definition

```python
# Add to app/agents/protocols.py

class SearchServiceProtocol(Protocol):
    async def search(self, query: "SearchQuery") -> "SearchResponse": ...
```

### Search Schemas

```python
# app/rag/schemas.py
from enum import Enum
from pydantic import BaseModel, Field


class SearchMode(str, Enum):
    KEYWORD = "keyword"
    SEMANTIC = "semantic"
    HYBRID = "hybrid"


class SearchFilters(BaseModel):
    """Metadata filters for narrowing search results."""
    region: str | None = None          # e.g., "phu_quoc", "hanoi"
    type: str | None = None            # "hotel", "attraction", "restaurant"
    min_price: float | None = None     # minimum price per night / per person
    max_price: float | None = None     # maximum price per night / per person
    min_rating: float | None = None    # minimum rating threshold (e.g., 4.0)


class SearchQuery(BaseModel):
    """Input for hybrid search."""
    query: str
    mode: SearchMode = SearchMode.HYBRID
    filters: SearchFilters | None = None
    keyword_weight: float = Field(default=0.3, ge=0.0, le=1.0)
    limit: int = Field(default=10, ge=1, le=100)
    tenant_id: str


class SearchResult(BaseModel):
    """A single search result with scoring metadata."""
    entity_id: str
    name: str
    type: str
    region: str
    description: str
    score: float = Field(ge=0.0, le=1.0)
    match_source: str  # "keyword", "semantic", or "both"
    metadata: dict = Field(default_factory=dict)  # pricing, rating, source_url, etc.


class SearchResponse(BaseModel):
    """Aggregated search response with timing."""
    results: list[SearchResult]
    total: int
    query_time_ms: int
    mode: SearchMode
```

### HybridSearchService Implementation

```python
# app/rag/hybrid_search.py
import time
from typing import Any

import structlog
from opentelemetry import trace

from app.agents.protocols import VectorStoreProtocol
from app.rag.embeddings import EmbeddingService
from app.rag.schemas import (
    SearchFilters,
    SearchMode,
    SearchQuery,
    SearchResponse,
    SearchResult,
)

logger = structlog.get_logger()
tracer = trace.get_tracer(__name__)

# Reciprocal Rank Fusion constant (standard value from literature)
RRF_K = 60


class HybridSearchService:
    """Combined keyword + semantic search with configurable weighting.

    Implements SearchServiceProtocol. Agents access this via DI,
    never by direct import.

    Search modes:
    - keyword: Text matching on name/description fields via Qdrant filters
    - semantic: Vector similarity search using embedded query
    - hybrid: Merges both using Reciprocal Rank Fusion (RRF) with configurable weights
    """

    def __init__(
        self,
        vector_store: VectorStoreProtocol,
        embedding_service: EmbeddingService,
    ) -> None:
        self.vector_store = vector_store
        self.embedding_service = embedding_service

    async def search(self, query: SearchQuery) -> SearchResponse:
        """Execute search in the requested mode.

        Args:
            query: Search parameters including query text, mode, filters, and weighting.

        Returns:
            SearchResponse with scored, deduplicated results and timing.
        """
        with tracer.start_as_current_span("hybrid_search") as span:
            span.set_attribute("search.mode", query.mode.value)
            span.set_attribute("search.query", query.query)
            span.set_attribute("search.tenant_id", query.tenant_id)

            start = time.monotonic()

            keyword_results: list[SearchResult] = []
            semantic_results: list[SearchResult] = []

            if query.mode in (SearchMode.KEYWORD, SearchMode.HYBRID):
                keyword_results = await self._keyword_search(query)

            if query.mode in (SearchMode.SEMANTIC, SearchMode.HYBRID):
                semantic_results = await self._semantic_search(query)

            if query.mode == SearchMode.HYBRID:
                results = self._merge_results(
                    keyword_results=keyword_results,
                    semantic_results=semantic_results,
                    keyword_weight=query.keyword_weight,
                    limit=query.limit,
                )
            elif query.mode == SearchMode.KEYWORD:
                results = keyword_results[: query.limit]
            else:
                results = semantic_results[: query.limit]

            query_time_ms = int((time.monotonic() - start) * 1000)

            span.set_attribute("search.result_count", len(results))
            span.set_attribute("search.query_time_ms", query_time_ms)

            logger.info(
                "search.completed",
                query=query.query,
                mode=query.mode.value,
                filter_count=self._count_active_filters(query.filters),
                result_count=len(results),
                query_time_ms=query_time_ms,
                tenant_id=query.tenant_id,
            )

            return SearchResponse(
                results=results,
                total=len(results),
                query_time_ms=query_time_ms,
                mode=query.mode,
            )

    async def _keyword_search(self, query: SearchQuery) -> list[SearchResult]:
        """Text-based search on name and description fields.

        Uses Qdrant scroll with payload filtering (MatchText).
        """
        filters = self._build_filters(query.filters, query.tenant_id)
        # Add text match condition for the query string
        filters["text_match"] = query.query

        raw_results = await self.vector_store.search(
            query=query.query,
            filters=filters,
            limit=query.limit * 2,  # Fetch extra for merge headroom
        )

        return [
            SearchResult(
                entity_id=str(entity.id),
                name=entity.name,
                type=entity.type,
                region=entity.region,
                description=entity.description,
                score=getattr(entity, "score", 0.5),
                match_source="keyword",
                metadata={
                    "pricing": entity.pricing,
                    "rating": entity.rating,
                    "source_url": entity.source_url,
                    "ingested_at": str(entity.ingested_at),
                },
            )
            for entity in raw_results
        ]

    async def _semantic_search(self, query: SearchQuery) -> list[SearchResult]:
        """Vector similarity search using embedded query.

        Generates an embedding for the query text, then searches
        Qdrant for nearest neighbors with optional metadata filters.
        """
        query_embedding = await self.embedding_service.embed(query.query)

        filters = self._build_filters(query.filters, query.tenant_id)
        filters["vector"] = query_embedding

        raw_results = await self.vector_store.search(
            query=query.query,
            filters=filters,
            limit=query.limit * 2,  # Fetch extra for merge headroom
        )

        return [
            SearchResult(
                entity_id=str(entity.id),
                name=entity.name,
                type=entity.type,
                region=entity.region,
                description=entity.description,
                score=getattr(entity, "score", 0.0),
                match_source="semantic",
                metadata={
                    "pricing": entity.pricing,
                    "rating": entity.rating,
                    "source_url": entity.source_url,
                    "ingested_at": str(entity.ingested_at),
                },
            )
            for entity in raw_results
        ]

    def _build_filters(
        self,
        search_filters: SearchFilters | None,
        tenant_id: str,
    ) -> dict[str, Any]:
        """Convert SearchFilters to a filter dict for VectorStoreProtocol.

        Tenant ID is ALWAYS included. Metadata filters are optional.

        The VectorStoreProtocol implementation (from Story 2.1) translates
        this dict into Qdrant-native models.Filter conditions.
        """
        filters: dict[str, Any] = {"tenant_id": tenant_id}

        if search_filters is None:
            return filters

        if search_filters.region is not None:
            filters["region"] = search_filters.region

        if search_filters.type is not None:
            filters["type"] = search_filters.type

        if search_filters.min_price is not None:
            filters["min_price"] = search_filters.min_price

        if search_filters.max_price is not None:
            filters["max_price"] = search_filters.max_price

        if search_filters.min_rating is not None:
            filters["min_rating"] = search_filters.min_rating

        return filters

    def _merge_results(
        self,
        keyword_results: list[SearchResult],
        semantic_results: list[SearchResult],
        keyword_weight: float,
        limit: int,
    ) -> list[SearchResult]:
        """Merge keyword and semantic results using Reciprocal Rank Fusion.

        RRF formula: score = weight * (1 / (RRF_K + rank))

        Entities appearing in both result sets get combined scores
        and match_source="both".
        """
        semantic_weight = 1.0 - keyword_weight
        scored: dict[str, dict] = {}

        # Score keyword results
        for rank, result in enumerate(keyword_results):
            rrf_score = keyword_weight * (1.0 / (RRF_K + rank + 1))
            scored[result.entity_id] = {
                "result": result,
                "score": rrf_score,
                "sources": {"keyword"},
            }

        # Score semantic results and merge
        for rank, result in enumerate(semantic_results):
            rrf_score = semantic_weight * (1.0 / (RRF_K + rank + 1))
            if result.entity_id in scored:
                scored[result.entity_id]["score"] += rrf_score
                scored[result.entity_id]["sources"].add("semantic")
            else:
                scored[result.entity_id] = {
                    "result": result,
                    "score": rrf_score,
                    "sources": {"semantic"},
                }

        # Build final results
        merged: list[SearchResult] = []
        for entry in sorted(scored.values(), key=lambda x: x["score"], reverse=True):
            result = entry["result"]
            sources = entry["sources"]
            match_source = "both" if len(sources) > 1 else sources.pop()
            merged.append(
                SearchResult(
                    entity_id=result.entity_id,
                    name=result.name,
                    type=result.type,
                    region=result.region,
                    description=result.description,
                    score=round(entry["score"], 6),
                    match_source=match_source,
                    metadata=result.metadata,
                )
            )

        return merged[:limit]

    @staticmethod
    def _count_active_filters(filters: SearchFilters | None) -> int:
        """Count non-None filter fields for logging."""
        if filters is None:
            return 0
        return sum(
            1
            for field in [
                filters.region,
                filters.type,
                filters.min_price,
                filters.max_price,
                filters.min_rating,
            ]
            if field is not None
        )
```

### Unit Test Pattern

```python
# app/rag/tests/test_hybrid_search.py
import pytest
from unittest.mock import AsyncMock
from dataclasses import dataclass

from app.rag.hybrid_search import HybridSearchService
from app.rag.schemas import SearchFilters, SearchMode, SearchQuery


@dataclass
class MockEntity:
    """Lightweight entity for test assertions."""
    id: str
    name: str
    type: str
    region: str
    description: str
    pricing: dict | None = None
    rating: float | None = None
    source_url: str | None = None
    ingested_at: str = "2026-05-20T00:00:00"
    score: float = 0.0


MOCK_ENTITIES = [
    MockEntity(
        id="entity-1",
        name="Rex Hotel Saigon",
        type="hotel",
        region="hcmc",
        description="Historic luxury hotel in the heart of Ho Chi Minh City",
        pricing={"per_night": 120.0},
        rating=4.5,
        source_url="https://example.com/rex",
        score=0.95,
    ),
    MockEntity(
        id="entity-2",
        name="Phu Quoc Beach Resort",
        type="hotel",
        region="phu_quoc",
        description="Quiet beach resort with pool, spa, and ocean views",
        pricing={"per_night": 85.0},
        rating=4.2,
        source_url="https://example.com/pq-resort",
        score=0.88,
    ),
    MockEntity(
        id="entity-3",
        name="Hanoi Old Quarter Hostel",
        type="hotel",
        region="hanoi",
        description="Budget-friendly hostel in Hanoi's historic Old Quarter",
        pricing={"per_night": 15.0},
        rating=3.8,
        source_url="https://example.com/hanoi-hostel",
        score=0.72,
    ),
]


@pytest.fixture
def mock_vector_store():
    store = AsyncMock()
    store.search = AsyncMock(return_value=MOCK_ENTITIES)
    return store


@pytest.fixture
def mock_embedding_service():
    service = AsyncMock()
    service.embed = AsyncMock(return_value=[0.1] * 384)
    return service


@pytest.fixture
def search_service(mock_vector_store, mock_embedding_service):
    return HybridSearchService(
        vector_store=mock_vector_store,
        embedding_service=mock_embedding_service,
    )


async def test_keyword_search_exact_match(search_service, mock_vector_store):
    """Keyword search for exact name returns matching entity as top result."""
    mock_vector_store.search.return_value = [MOCK_ENTITIES[0]]

    query = SearchQuery(
        query="Rex Hotel Saigon",
        mode=SearchMode.KEYWORD,
        tenant_id="test-tenant",
    )
    response = await search_service.search(query)

    assert response.total >= 1
    assert response.results[0].name == "Rex Hotel Saigon"
    assert response.results[0].match_source == "keyword"


async def test_semantic_search_returns_ranked_results(search_service):
    """Semantic search returns results ranked by similarity."""
    query = SearchQuery(
        query="quiet beach resort with pool under $100",
        mode=SearchMode.SEMANTIC,
        tenant_id="test-tenant",
    )
    response = await search_service.search(query)

    assert response.total > 0
    assert response.results[0].match_source == "semantic"
    # Scores should be in descending order
    scores = [r.score for r in response.results]
    assert scores == sorted(scores, reverse=True)


async def test_hybrid_mode_merges_results(search_service):
    """Hybrid mode combines keyword and semantic results."""
    query = SearchQuery(
        query="beach resort Phu Quoc",
        mode=SearchMode.HYBRID,
        tenant_id="test-tenant",
    )
    response = await search_service.search(query)

    assert response.mode == SearchMode.HYBRID
    assert response.total > 0


async def test_hybrid_deduplicates_results(search_service, mock_vector_store):
    """Entity appearing in both keyword and semantic results gets match_source='both'."""
    # Same entity returned by both searches
    mock_vector_store.search.return_value = [MOCK_ENTITIES[1]]

    query = SearchQuery(
        query="Phu Quoc Beach Resort",
        mode=SearchMode.HYBRID,
        tenant_id="test-tenant",
    )
    response = await search_service.search(query)

    pq_results = [r for r in response.results if r.entity_id == "entity-2"]
    assert len(pq_results) == 1
    assert pq_results[0].match_source == "both"


async def test_region_filter(search_service, mock_vector_store):
    """Region filter limits results to specified region."""
    mock_vector_store.search.return_value = [MOCK_ENTITIES[1]]

    query = SearchQuery(
        query="hotel",
        mode=SearchMode.SEMANTIC,
        filters=SearchFilters(region="phu_quoc"),
        tenant_id="test-tenant",
    )
    response = await search_service.search(query)

    # Verify the vector store was called with region filter
    call_args = mock_vector_store.search.call_args
    assert call_args.kwargs["filters"]["region"] == "phu_quoc"


async def test_type_filter(search_service, mock_vector_store):
    """Type filter limits results to specified entity type."""
    query = SearchQuery(
        query="accommodation",
        mode=SearchMode.SEMANTIC,
        filters=SearchFilters(type="hotel"),
        tenant_id="test-tenant",
    )
    await search_service.search(query)

    call_args = mock_vector_store.search.call_args
    assert call_args.kwargs["filters"]["type"] == "hotel"


async def test_price_range_filter(search_service, mock_vector_store):
    """Price range filter passes min/max to vector store."""
    query = SearchQuery(
        query="affordable hotel",
        mode=SearchMode.SEMANTIC,
        filters=SearchFilters(min_price=20.0, max_price=100.0),
        tenant_id="test-tenant",
    )
    await search_service.search(query)

    call_args = mock_vector_store.search.call_args
    assert call_args.kwargs["filters"]["min_price"] == 20.0
    assert call_args.kwargs["filters"]["max_price"] == 100.0


async def test_rating_filter(search_service, mock_vector_store):
    """Rating filter passes minimum threshold to vector store."""
    query = SearchQuery(
        query="top rated hotel",
        mode=SearchMode.SEMANTIC,
        filters=SearchFilters(min_rating=4.0),
        tenant_id="test-tenant",
    )
    await search_service.search(query)

    call_args = mock_vector_store.search.call_args
    assert call_args.kwargs["filters"]["min_rating"] == 4.0


async def test_combined_filters(search_service, mock_vector_store):
    """Multiple filters work together (AND logic)."""
    query = SearchQuery(
        query="luxury resort",
        mode=SearchMode.HYBRID,
        filters=SearchFilters(
            region="phu_quoc",
            type="hotel",
            max_price=150.0,
            min_rating=4.0,
        ),
        tenant_id="test-tenant",
    )
    await search_service.search(query)

    # Verify all filters passed to vector store
    call_args = mock_vector_store.search.call_args
    filters = call_args.kwargs["filters"]
    assert filters["region"] == "phu_quoc"
    assert filters["type"] == "hotel"
    assert filters["max_price"] == 150.0
    assert filters["min_rating"] == 4.0
    assert filters["tenant_id"] == "test-tenant"


async def test_tenant_id_always_in_filters(search_service, mock_vector_store):
    """Tenant ID is always included in search filters regardless of mode."""
    for mode in [SearchMode.KEYWORD, SearchMode.SEMANTIC, SearchMode.HYBRID]:
        query = SearchQuery(
            query="hotel",
            mode=mode,
            tenant_id="tenant-abc",
        )
        await search_service.search(query)

        call_args = mock_vector_store.search.call_args
        assert call_args.kwargs["filters"]["tenant_id"] == "tenant-abc"


async def test_empty_results(search_service, mock_vector_store):
    """Empty result set returns SearchResponse with total=0."""
    mock_vector_store.search.return_value = []

    query = SearchQuery(
        query="nonexistent hotel xyz",
        mode=SearchMode.HYBRID,
        tenant_id="test-tenant",
    )
    response = await search_service.search(query)

    assert response.total == 0
    assert response.results == []


async def test_configurable_weighting(search_service, mock_vector_store):
    """Weight=1.0 for keyword gives pure keyword ordering; 0.0 gives pure semantic."""
    mock_vector_store.search.side_effect = [
        [MOCK_ENTITIES[0]],  # keyword results
        [MOCK_ENTITIES[1]],  # semantic results
    ]

    # Pure keyword weighting
    query_kw = SearchQuery(
        query="hotel",
        mode=SearchMode.HYBRID,
        keyword_weight=1.0,
        tenant_id="test-tenant",
    )
    response_kw = await search_service.search(query_kw)
    assert response_kw.results[0].entity_id == "entity-1"

    mock_vector_store.search.side_effect = [
        [MOCK_ENTITIES[0]],  # keyword results
        [MOCK_ENTITIES[1]],  # semantic results
    ]

    # Pure semantic weighting
    query_sem = SearchQuery(
        query="hotel",
        mode=SearchMode.HYBRID,
        keyword_weight=0.0,
        tenant_id="test-tenant",
    )
    response_sem = await search_service.search(query_sem)
    assert response_sem.results[0].entity_id == "entity-2"


async def test_query_time_ms_populated(search_service):
    """Response includes query_time_ms measurement."""
    query = SearchQuery(
        query="hotel",
        mode=SearchMode.SEMANTIC,
        tenant_id="test-tenant",
    )
    response = await search_service.search(query)

    assert response.query_time_ms >= 0
```

### Integration Test Pattern

```python
# app/rag/tests/test_hybrid_search_integration.py
import time

import pytest

from app.rag.hybrid_search import HybridSearchService
from app.rag.schemas import SearchFilters, SearchMode, SearchQuery


@pytest.mark.integration
async def test_hybrid_search_performance(
    hybrid_search_service: HybridSearchService,
):
    """Hybrid search must complete within 2 seconds for the seed dataset."""
    query = SearchQuery(
        query="quiet beach resort with pool under $100 in Phu Quoc",
        mode=SearchMode.HYBRID,
        filters=SearchFilters(region="phu_quoc", type="hotel"),
        tenant_id="seed-tenant",
    )

    start = time.monotonic()
    response = await hybrid_search_service.search(query)
    elapsed_ms = (time.monotonic() - start) * 1000

    assert elapsed_ms < 2000, f"Search took {elapsed_ms:.0f}ms, exceeds 2s limit"
    assert response.total > 0


@pytest.mark.integration
async def test_keyword_exact_match_integration(
    hybrid_search_service: HybridSearchService,
):
    """Known seed entity is findable by exact name."""
    query = SearchQuery(
        query="Rex Hotel Saigon",
        mode=SearchMode.KEYWORD,
        tenant_id="seed-tenant",
    )
    response = await hybrid_search_service.search(query)

    assert any(r.name == "Rex Hotel Saigon" for r in response.results)


@pytest.mark.integration
async def test_semantic_descriptive_query_integration(
    hybrid_search_service: HybridSearchService,
):
    """Descriptive natural language query returns relevant results."""
    query = SearchQuery(
        query="family-friendly hotel with pool near the beach",
        mode=SearchMode.SEMANTIC,
        tenant_id="seed-tenant",
    )
    response = await hybrid_search_service.search(query)

    assert response.total > 0
    # Results should be hotels (semantic understanding of "hotel")
    assert all(r.type == "hotel" for r in response.results[:3])
```

### Reciprocal Rank Fusion (RRF) Explanation

RRF is used to merge ranked lists from different retrieval methods. The formula for each result is:

```
rrf_score(entity) = weight * (1 / (K + rank))
```

Where:
- `K` is a constant (60 is standard) that controls how much lower-ranked results are penalized
- `rank` is 1-indexed position in the result list
- `weight` is the configurable keyword/semantic weight

For hybrid mode, each entity gets an RRF score from the keyword list and/or the semantic list. These scores are summed. Entities appearing in both lists naturally score higher.

### Filter Translation to Qdrant (Handled by VectorStoreProtocol)

The `_build_filters()` method produces a flat dict that the `VectorStoreProtocol` implementation (from Story 2.1) translates into Qdrant-native filter conditions:

```python
# How the VectorStoreProtocol impl will use these filters (Story 2.1 responsibility):
from qdrant_client import models

def _to_qdrant_filter(filters: dict) -> models.Filter:
    conditions = []

    if "tenant_id" in filters:
        conditions.append(models.FieldCondition(
            key="tenant_id",
            match=models.MatchValue(value=filters["tenant_id"]),
        ))
    if "region" in filters:
        conditions.append(models.FieldCondition(
            key="region",
            match=models.MatchValue(value=filters["region"]),
        ))
    if "type" in filters:
        conditions.append(models.FieldCondition(
            key="type",
            match=models.MatchValue(value=filters["type"]),
        ))
    if "min_price" in filters or "max_price" in filters:
        conditions.append(models.FieldCondition(
            key="pricing.per_night",
            range=models.Range(
                gte=filters.get("min_price"),
                lte=filters.get("max_price"),
            ),
        ))
    if "min_rating" in filters:
        conditions.append(models.FieldCondition(
            key="rating",
            range=models.Range(gte=filters["min_rating"]),
        ))

    return models.Filter(must=conditions)
```

This translation lives in Story 2.1's `rag/vector_store.py`, not in this story. The hybrid search module only produces the filter dict.

### Anti-Patterns -- DO NOT

- **DO NOT** import `qdrant_client` directly in `hybrid_search.py` -- all Qdrant access via `VectorStoreProtocol`
- **DO NOT** skip `tenant_id` in any search filter -- mandatory for multi-tenancy
- **DO NOT** implement the Qdrant filter translation here -- that belongs in Story 2.1's `vector_store.py`
- **DO NOT** use stdlib `logging` -- use `structlog` only
- **DO NOT** require a running Qdrant or embedding model for unit tests -- mock everything
- **DO NOT** hardcode embedding dimensions -- get them from the embedding service
- **DO NOT** use `datetime.now(timezone.utc)` for timestamps -- use `datetime.utcnow()` (project convention)
- **DO NOT** create API endpoints for search in this story -- agents will call `HybridSearchService` directly via DI. An API endpoint for search may be added in a later story if needed
- **DO NOT** implement caching here -- Story 2.4 adds Redis caching for popular queries

### File Structure After This Story

```
backend/app/
├── agents/
│   └── protocols.py          # MODIFIED — add SearchServiceProtocol
├── rag/
│   ├── __init__.py            # Already exists (Story 2.1)
│   ├── vector_store.py        # Already exists (Story 2.1)
│   ├── embeddings.py          # Already exists (Story 2.1)
│   ├── schemas.py             # NEW — SearchQuery, SearchResult, SearchResponse, etc.
│   ├── hybrid_search.py       # NEW — HybridSearchService
│   └── tests/
│       ├── __init__.py        # Already exists (Story 2.1)
│       ├── test_hybrid_search.py              # NEW — unit tests (mocked)
│       └── test_hybrid_search_integration.py  # NEW — integration tests (Qdrant)
```

### Performance Considerations

- **Embedding generation** is the dominant latency contributor. The 2-second budget must include embedding the query text. If the embedding service is slow, consider:
  - Caching repeated query embeddings (deferred to Story 2.4)
  - Using a smaller/faster embedding model for keyword-heavy queries
- **Qdrant search** is typically sub-100ms for datasets under 100K entities. The seed dataset is well under this.
- **RRF merge** is O(n) on the result set size -- negligible.
- **Fetch `limit * 2`** from each source to give the merge step headroom. This is a heuristic; adjust if needed.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md -- VectorStoreProtocol, Data Architecture, Qdrant]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Implementation Patterns & Consistency Rules]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Boundary Rules: agents/ -> rag/ via VectorStoreProtocol]
- [Source: _bmad-output/planning-artifacts/epics.md -- Epic 2, Story 2.3]
- [Source: _bmad-output/planning-artifacts/epics.md -- FR-30: Hybrid Search]
- [Source: _bmad-output/project-context.md -- Testing Rules, Anti-Patterns, Phase 2 infrastructure]
- [RRF Paper: Cormack, Clarke, Buettcher (2009) -- Reciprocal Rank Fusion outperforms Condorcet and individual rankers]
- [Qdrant Hybrid Search: https://qdrant.tech/documentation/concepts/hybrid-queries/]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
