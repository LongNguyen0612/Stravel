import time
from dataclasses import dataclass, field

import structlog

from app.rag.embeddings import EmbeddingService

logger = structlog.get_logger()


@dataclass
class SearchResult:
    id: str
    name: str
    score: float
    entity_type: str = ""
    region: str = ""
    payload: dict = field(default_factory=dict)


class HybridSearchService:
    """Combines keyword and semantic search with configurable weighting using Reciprocal Rank Fusion."""

    def __init__(self, vector_store, embedder: EmbeddingService | None = None) -> None:
        self.vector_store = vector_store
        self.embedder = embedder or EmbeddingService()

    async def search(
        self,
        query: str,
        filters: dict | None = None,
        limit: int = 10,
        keyword_weight: float = 0.3,
        semantic_weight: float = 0.7,
    ) -> list[SearchResult]:
        start = time.monotonic()
        filters = filters or {}

        # Run keyword and semantic in parallel conceptually (sequential for simplicity)
        keyword_results = await self._keyword_search(query, filters, limit=limit * 2)
        semantic_results = await self._semantic_search(query, filters, limit=limit * 2)

        merged = self._merge_results(keyword_results, semantic_results, keyword_weight, semantic_weight)
        final = merged[:limit]

        duration_ms = int((time.monotonic() - start) * 1000)
        logger.info(
            "search.hybrid",
            query=query[:50],
            keyword_count=len(keyword_results),
            semantic_count=len(semantic_results),
            merged_count=len(final),
            duration_ms=duration_ms,
        )
        return final

    async def _keyword_search(self, query: str, filters: dict, limit: int = 20) -> list[SearchResult]:
        """Keyword search — exact name matching via filter."""
        search_filters = {**filters, "name": query}
        results = await self.vector_store.search(query, search_filters, limit=limit)
        return [
            SearchResult(
                id=r.get("id", ""),
                name=r.get("name", ""),
                score=r.get("score", 0.0),
                entity_type=r.get("entity_type", ""),
                region=r.get("region", ""),
                payload=r,
            )
            for r in results
        ]

    async def _semantic_search(self, query: str, filters: dict, limit: int = 20) -> list[SearchResult]:
        """Semantic search — vector similarity."""
        results = await self.vector_store.search(query, filters, limit=limit)
        return [
            SearchResult(
                id=r.get("id", ""),
                name=r.get("name", ""),
                score=r.get("score", 0.0),
                entity_type=r.get("entity_type", ""),
                region=r.get("region", ""),
                payload=r,
            )
            for r in results
        ]

    def _merge_results(
        self,
        keyword_results: list[SearchResult],
        semantic_results: list[SearchResult],
        keyword_weight: float,
        semantic_weight: float,
    ) -> list[SearchResult]:
        """Merge using Reciprocal Rank Fusion (RRF)."""
        k = 60  # RRF constant
        scores: dict[str, float] = {}
        result_map: dict[str, SearchResult] = {}

        for rank, r in enumerate(keyword_results):
            rrf_score = keyword_weight / (k + rank + 1)
            scores[r.id] = scores.get(r.id, 0) + rrf_score
            result_map[r.id] = r

        for rank, r in enumerate(semantic_results):
            rrf_score = semantic_weight / (k + rank + 1)
            scores[r.id] = scores.get(r.id, 0) + rrf_score
            if r.id not in result_map:
                result_map[r.id] = r

        sorted_ids = sorted(scores, key=lambda x: scores[x], reverse=True)
        return [
            SearchResult(
                id=result_map[rid].id,
                name=result_map[rid].name,
                score=scores[rid],
                entity_type=result_map[rid].entity_type,
                region=result_map[rid].region,
                payload=result_map[rid].payload,
            )
            for rid in sorted_ids
        ]
