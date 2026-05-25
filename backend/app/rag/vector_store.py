import structlog
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, FieldCondition, Filter, MatchValue, PointStruct, VectorParams

from app.core.config import settings

logger = structlog.get_logger()

COLLECTION_NAME = "entities"
VECTOR_SIZE = 384  # all-MiniLM-L6-v2 dimension


class QdrantVectorStore:
    """Qdrant-backed vector store implementing VectorStoreProtocol."""

    def __init__(self, url: str | None = None) -> None:
        self.url = url or getattr(settings, "qdrant_url", "http://localhost:6333")
        self.client = AsyncQdrantClient(url=self.url)

    async def ensure_collection(self) -> None:
        collections = await self.client.get_collections()
        existing = [c.name for c in collections.collections]
        if COLLECTION_NAME not in existing:
            await self.client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
            )
            logger.info("qdrant.collection_created", collection=COLLECTION_NAME)

    async def search(self, query: str, filters: dict, limit: int = 10) -> list[dict]:
        from app.rag.embeddings import EmbeddingService

        embedder = EmbeddingService()
        vector = embedder.embed(query)

        qdrant_filter = self._build_filter(filters)

        results = await self.client.query_points(
            collection_name=COLLECTION_NAME,
            query=vector,
            query_filter=qdrant_filter,
            limit=limit,
            with_payload=True,
        )

        return [{"id": str(point.id), "score": point.score, **point.payload} for point in results.points]

    async def get_by_id(self, entity_id: str) -> dict | None:
        results = await self.client.retrieve(
            collection_name=COLLECTION_NAME,
            ids=[entity_id],
            with_payload=True,
        )
        if not results:
            return None
        point = results[0]
        return {"id": str(point.id), **point.payload}

    async def upsert(self, entity_id: str, vector: list[float], payload: dict) -> None:
        await self.client.upsert(
            collection_name=COLLECTION_NAME,
            points=[PointStruct(id=entity_id, vector=vector, payload=payload)],
        )

    async def delete(self, entity_id: str) -> None:
        await self.client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=[entity_id],
        )

    def _build_filter(self, filters: dict) -> Filter | None:
        conditions = []
        for key, value in filters.items():
            if value is not None:
                conditions.append(FieldCondition(key=key, match=MatchValue(value=value)))
        return Filter(must=conditions) if conditions else None

    async def close(self) -> None:
        await self.client.close()
