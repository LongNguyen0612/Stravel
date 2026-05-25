# Story 2.1: Qdrant Vector Store Setup & Entity Model

Status: done

## Story

As a developer,
I want a Vector Store service with typed Protocol interface connected to Qdrant,
so that agents can search travel entities through a clean, testable abstraction.

## Acceptance Criteria

1. `docker-compose.full.yml` includes a Qdrant service with persistent volume and health check
2. `docker compose -f docker-compose.full.yml up` starts Qdrant alongside all Phase 1 services (FastAPI, PostgreSQL, Ollama)
3. `rag/vector_store.py` implements `VectorStoreProtocol` from `agents/protocols.py` using the `qdrant-client` Python package
4. The implementation provides `search()` (semantic vector similarity) and `get_by_id()` methods with proper async support
5. The SQLModel `Entity` model in `models/entity.py` stores metadata: name, type, location, region, description, pricing, rating, source_url, ingested_at, expires_at
6. Alembic migration creates the `entities` table in PostgreSQL
7. `rag/embeddings.py` wraps an embedding model (sentence-transformers) for generating vector representations
8. `VectorStoreProtocol` in `agents/protocols.py` is updated to return typed `Entity` objects instead of `list[dict]` (resolves deferred item from Story 1.1)
9. Unit tests in `rag/tests/` pass with a mock Vector Store (no Qdrant required)
10. `.env.example` is updated with Qdrant and embedding model environment variables
11. `pyproject.toml` includes `qdrant-client` and `sentence-transformers` dependencies

## Tasks / Subtasks

- [ ] Task 1: Add Qdrant to docker-compose.full.yml (AC: #1, #2)
  - [ ] Add Qdrant service using `qdrant/qdrant:latest` image
  - [ ] Configure Qdrant port mapping (6333 for REST API, 6334 for gRPC)
  - [ ] Add persistent volume `qdrant_data` mounted at `/qdrant/storage`
  - [ ] Add health check using Qdrant's health endpoint
  - [ ] Add Redis service placeholder (Phase 2 co-requirement from architecture)
  - [ ] Ensure all Phase 1 services (FastAPI, PostgreSQL, Ollama) are preserved in full.yml
  - [ ] Verify `docker compose -f docker-compose.full.yml up -d` starts all services

- [ ] Task 2: Add Python dependencies (AC: #11)
  - [ ] Add `qdrant-client>=1.12.0` to `pyproject.toml` dependencies
  - [ ] Add `sentence-transformers>=3.3.0` to `pyproject.toml` dependencies
  - [ ] Verify `pip install -e ".[dev]"` succeeds with new dependencies

- [ ] Task 3: Create Entity SQLModel model (AC: #5, #6)
  - [ ] Create `backend/app/models/entity.py` with `Entity` SQLModel table model
  - [ ] Create `EntityType` enum (hotel, attraction, restaurant, visa_rule, health_advisory, travel_warning)
  - [ ] Add all metadata fields: name, entity_type, location_lat, location_lng, region, description, pricing_json, rating, source_url, ingested_at, expires_at, qdrant_point_id, tenant_id
  - [ ] Add indexes: `ix_entities_tenant_id`, `ix_entities_entity_type`, `ix_entities_region`
  - [ ] Update `models/__init__.py` to export Entity
  - [ ] Create Alembic migration: `alembic revision --autogenerate -m "create entities table"`
  - [ ] Verify migration applies and reverses cleanly

- [ ] Task 4: Create embedding wrapper (AC: #7)
  - [ ] Create `backend/app/rag/embeddings.py` with `EmbeddingService` class
  - [ ] Implement `embed_text(text: str) -> list[float]` method
  - [ ] Implement `embed_batch(texts: list[str]) -> list[list[float]]` for bulk operations
  - [ ] Use sentence-transformers `all-MiniLM-L6-v2` as default model (configurable via env var)
  - [ ] Add embedding model config to `core/config.py` Settings
  - [ ] Handle model download on first use with structlog logging

- [ ] Task 5: Implement Qdrant Vector Store client (AC: #3, #4)
  - [ ] Create `backend/app/rag/vector_store.py` with `QdrantVectorStore` class
  - [ ] Implement `VectorStoreProtocol` interface (search, get_by_id)
  - [ ] Implement `upsert()` method for ETL pipeline use (Story 2.2)
  - [ ] Implement `delete()` method for entity removal
  - [ ] Implement collection creation with proper vector dimensions
  - [ ] Use `qdrant_client.AsyncQdrantClient` for async compatibility
  - [ ] Add Qdrant connection config to `core/config.py` Settings
  - [ ] Add structlog logging for all operations with tenant_id context

- [ ] Task 6: Update VectorStoreProtocol to return typed Entity (AC: #8)
  - [ ] Update `agents/protocols.py` — change `search()` return from `list[dict]` to `list[Entity]`
  - [ ] Update `agents/protocols.py` — change `get_by_id()` return from `dict | None` to `Entity | None`
  - [ ] Add `upsert()` and `delete()` methods to the Protocol
  - [ ] Verify existing code that depends on VectorStoreProtocol still compiles

- [ ] Task 7: Create mock Vector Store for testing (AC: #9)
  - [ ] Create `backend/app/rag/tests/__init__.py`
  - [ ] Create `backend/app/rag/tests/test_vector_store.py`
  - [ ] Implement `MockVectorStore` implementing `VectorStoreProtocol`
  - [ ] Test: `test_search_returns_entities` — search returns list of Entity objects
  - [ ] Test: `test_search_with_filters` — filters by entity_type, region, price range
  - [ ] Test: `test_get_by_id_found` — returns Entity when ID exists
  - [ ] Test: `test_get_by_id_not_found` — returns None for missing ID
  - [ ] Test: `test_upsert_and_retrieve` — entity can be upserted then retrieved
  - [ ] Test: `test_embedding_service_interface` — embedding wrapper returns correct dimensions
  - [ ] All tests pass without Qdrant running (mock only)

- [ ] Task 8: Update environment configuration (AC: #10)
  - [ ] Add to `.env.example`: `QDRANT_HOST`, `QDRANT_PORT`, `QDRANT_COLLECTION_NAME`
  - [ ] Add to `.env.example`: `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`
  - [ ] Update `core/config.py` with Qdrant and embedding settings
  - [ ] Add Qdrant environment variables to `docker-compose.full.yml` backend service

- [ ] Task 9: Register QdrantVectorStore in FastAPI DI (AC: #3)
  - [ ] Add `get_vector_store()` dependency provider in `core/dependencies.py`
  - [ ] Provider should return `QdrantVectorStore` when Qdrant is configured, or raise clear error if not
  - [ ] Add `get_embedding_service()` dependency provider in `core/dependencies.py`
  - [ ] Verify DI works in a test endpoint or health check extension

- [ ] Task 10: Address deferred item from Story 1.1 (AC: #8)
  - [ ] Resolve: "VectorStoreProtocol.search returns list[dict] -- should return typed Entity" from deferred-work.md
  - [ ] Update deferred-work.md to mark this item as resolved

## Dev Notes

### Critical Architecture Constraints

- **Phase 2 services**: This story adds Qdrant + Redis to `docker-compose.full.yml`. The base `docker-compose.yml` remains Phase 1 only (FastAPI + PostgreSQL + Ollama).
- **Protocol boundary**: `QdrantVectorStore` MUST implement `VectorStoreProtocol` from `agents/protocols.py`. Agents never import `rag/vector_store.py` directly -- they receive the service via DI.
- **Unit tests pass without Qdrant**: All tests in `rag/tests/` must use `MockVectorStore`. Mark any Qdrant-dependent tests with `@pytest.mark.integration`.
- **Async all the way**: Use `qdrant_client.AsyncQdrantClient`, not the sync client.
- **Tenant isolation**: All Vector Store operations must include `tenant_id` filtering. Qdrant payload filters enforce this at the search level.

### SQLAlchemy Async -- MOST COMMON BUG SOURCE

```python
# NEVER use session.exec() with AsyncSession -- use session.execute()
# ALWAYS call .scalars() before .first() or .all()

# WRONG
result = await session.exec(select(Entity).where(...))
item = result.first()

# CORRECT
result = await session.execute(select(Entity).where(...))
item = result.scalars().first()
```

### SQLModel Relationships -- CAUSES STARTUP CRASH

```python
# NEVER use "Model | None" in SQLModel Relationship fields
# NEVER use `from __future__ import annotations` in model files

# WRONG
from __future__ import annotations
advisory_session: "AdvisorySession | None" = Relationship(...)

# CORRECT
from typing import Optional
advisory_session: Optional["AdvisorySession"] = Relationship(  # noqa: F821
    back_populates="entities",
    sa_relationship_kwargs={"uselist": False},
)
```

### Datetime -- CAUSES INSERT FAILURES

```python
# NEVER use timezone-aware datetimes with PostgreSQL TIMESTAMP WITHOUT TIME ZONE
# asyncpg raises: DataError: can't subtract offset-naive and offset-aware datetimes

# WRONG
from datetime import datetime, timezone
ingested_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# CORRECT
from datetime import datetime
ingested_at: datetime = Field(default_factory=datetime.utcnow)
```

### Entity SQLModel Model -- `models/entity.py`

```python
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class EntityType(str, Enum):
    HOTEL = "hotel"
    ATTRACTION = "attraction"
    RESTAURANT = "restaurant"
    VISA_RULE = "visa_rule"
    HEALTH_ADVISORY = "health_advisory"
    TRAVEL_WARNING = "travel_warning"


class Entity(SQLModel, table=True):
    __tablename__ = "entities"

    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        primary_key=True,
    )
    tenant_id: str = Field(index=True)
    name: str = Field(max_length=255)
    entity_type: EntityType = Field(index=True)
    region: str = Field(index=True, max_length=100)  # e.g., "hanoi", "phu_quoc"
    description: str = Field(default="")
    location_lat: Optional[float] = Field(default=None)
    location_lng: Optional[float] = Field(default=None)
    pricing_json: Optional[str] = Field(default=None)  # JSON string for flexible pricing
    rating: Optional[float] = Field(default=None, ge=0.0, le=5.0)
    source_url: Optional[str] = Field(default=None, max_length=500)
    qdrant_point_id: Optional[str] = Field(default=None)  # Links to Qdrant vector

    # Freshness tracking (Story 2.4)
    ingested_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = Field(default=None)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

### Updated VectorStoreProtocol -- `agents/protocols.py`

```python
from typing import Protocol, AsyncIterator

# Import from models when the module loads
from app.models.entity import Entity


class VectorStoreProtocol(Protocol):
    """Typed Protocol for Vector Store access. All agents use this interface."""

    async def search(
        self,
        query: str,
        filters: dict,
        limit: int = 10,
        tenant_id: str = "",
    ) -> list[Entity]: ...

    async def get_by_id(
        self, entity_id: str, tenant_id: str = ""
    ) -> Entity | None: ...

    async def upsert(
        self, entity: Entity, embedding: list[float]
    ) -> None: ...

    async def delete(
        self, entity_id: str, tenant_id: str = ""
    ) -> bool: ...
```

### Qdrant Vector Store Client -- `rag/vector_store.py`

```python
import structlog
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

from app.agents.protocols import VectorStoreProtocol
from app.models.entity import Entity
from app.rag.embeddings import EmbeddingService

logger = structlog.get_logger()

COLLECTION_NAME = "stravel_entities"


class QdrantVectorStore:
    """Qdrant implementation of VectorStoreProtocol."""

    def __init__(
        self,
        client: AsyncQdrantClient,
        embedding_service: EmbeddingService,
        collection_name: str = COLLECTION_NAME,
    ):
        self._client = client
        self._embedding_service = embedding_service
        self._collection_name = collection_name

    async def ensure_collection(self, vector_size: int = 384) -> None:
        """Create collection if it does not exist."""
        collections = await self._client.get_collections()
        existing = [c.name for c in collections.collections]
        if self._collection_name not in existing:
            await self._client.create_collection(
                collection_name=self._collection_name,
                vectors_config=VectorParams(
                    size=vector_size,
                    distance=Distance.COSINE,
                ),
            )
            logger.info(
                "qdrant.collection.created",
                collection=self._collection_name,
                vector_size=vector_size,
            )

    async def search(
        self,
        query: str,
        filters: dict,
        limit: int = 10,
        tenant_id: str = "",
    ) -> list[Entity]:
        """Semantic search with tenant isolation."""
        query_vector = self._embedding_service.embed_text(query)

        must_conditions = []
        if tenant_id:
            must_conditions.append(
                FieldCondition(
                    key="tenant_id", match=MatchValue(value=tenant_id)
                )
            )
        for key, value in filters.items():
            must_conditions.append(
                FieldCondition(key=key, match=MatchValue(value=value))
            )

        qdrant_filter = Filter(must=must_conditions) if must_conditions else None

        results = await self._client.search(
            collection_name=self._collection_name,
            query_vector=query_vector,
            query_filter=qdrant_filter,
            limit=limit,
        )

        entities = []
        for hit in results:
            payload = hit.payload or {}
            entity = Entity(**payload)
            entities.append(entity)

        logger.info(
            "vectorstore.search",
            query=query[:80],
            filters=filters,
            tenant_id=tenant_id,
            results_count=len(entities),
        )
        return entities

    async def get_by_id(
        self, entity_id: str, tenant_id: str = ""
    ) -> Entity | None:
        """Retrieve a single entity by ID with tenant check."""
        results = await self._client.retrieve(
            collection_name=self._collection_name,
            ids=[entity_id],
        )
        if not results:
            return None
        payload = results[0].payload or {}
        entity = Entity(**payload)
        if tenant_id and entity.tenant_id != tenant_id:
            return None
        return entity

    async def upsert(
        self, entity: Entity, embedding: list[float]
    ) -> None:
        """Insert or update an entity in the Vector Store."""
        point_id = entity.qdrant_point_id or entity.id
        payload = entity.model_dump(mode="json")

        await self._client.upsert(
            collection_name=self._collection_name,
            points=[
                PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload=payload,
                )
            ],
        )
        logger.info(
            "vectorstore.upsert",
            entity_id=entity.id,
            entity_type=entity.entity_type,
            tenant_id=entity.tenant_id,
        )

    async def delete(
        self, entity_id: str, tenant_id: str = ""
    ) -> bool:
        """Delete an entity from the Vector Store."""
        await self._client.delete(
            collection_name=self._collection_name,
            points_selector=[entity_id],
        )
        logger.info(
            "vectorstore.delete",
            entity_id=entity_id,
            tenant_id=tenant_id,
        )
        return True
```

### Embedding Wrapper -- `rag/embeddings.py`

```python
import structlog
from sentence_transformers import SentenceTransformer

logger = structlog.get_logger()

DEFAULT_MODEL = "all-MiniLM-L6-v2"
DEFAULT_DIMENSIONS = 384


class EmbeddingService:
    """Wraps sentence-transformers for generating vector embeddings."""

    def __init__(
        self,
        model_name: str = DEFAULT_MODEL,
    ):
        self._model_name = model_name
        self._model: SentenceTransformer | None = None

    def _load_model(self) -> SentenceTransformer:
        if self._model is None:
            logger.info(
                "embedding.model.loading",
                model=self._model_name,
            )
            self._model = SentenceTransformer(self._model_name)
            logger.info(
                "embedding.model.loaded",
                model=self._model_name,
                dimensions=self._model.get_sentence_embedding_dimension(),
            )
        return self._model

    def embed_text(self, text: str) -> list[float]:
        """Generate embedding vector for a single text."""
        model = self._load_model()
        embedding = model.encode(text, convert_to_numpy=True)
        return embedding.tolist()

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embedding vectors for multiple texts."""
        model = self._load_model()
        embeddings = model.encode(texts, convert_to_numpy=True)
        return [e.tolist() for e in embeddings]

    @property
    def dimensions(self) -> int:
        """Return the embedding dimension for the loaded model."""
        model = self._load_model()
        return model.get_sentence_embedding_dimension()
```

### docker-compose.full.yml Structure

```yaml
# docker-compose.full.yml -- Phase 2: adds Qdrant + Redis to Phase 1 services
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-stravel}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-stravel_dev}
      POSTGRES_DB: ${POSTGRES_DB:-stravel}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-stravel}"]
      interval: 10s
      timeout: 5s
      retries: 5

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:11434/api/tags"]
      interval: 30s
      timeout: 10s
      retries: 3

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"   # REST API
      - "6334:6334"   # gRPC
    volumes:
      - qdrant_data:/qdrant/storage
    environment:
      QDRANT__SERVICE__GRPC_PORT: 6334
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/healthz"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER:-stravel}:${POSTGRES_PASSWORD:-stravel_dev}@db:5432/${POSTGRES_DB:-stravel}
      OLLAMA_BASE_URL: http://ollama:11434
      QDRANT_HOST: qdrant
      QDRANT_PORT: 6333
      QDRANT_COLLECTION_NAME: stravel_entities
      REDIS_URL: redis://redis:6379/0
      EMBEDDING_MODEL: all-MiniLM-L6-v2
      ENVIRONMENT: development
    depends_on:
      db:
        condition: service_healthy
      ollama:
        condition: service_healthy
      qdrant:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./backend:/app
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

volumes:
  postgres_data:
  ollama_data:
  qdrant_data:
  redis_data:
```

### Environment Variables to Add (.env.example)

```bash
# Qdrant (Phase 2)
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION_NAME=stravel_entities

# Redis (Phase 2)
REDIS_URL=redis://localhost:6379/0

# Embeddings
EMBEDDING_MODEL=all-MiniLM-L6-v2
EMBEDDING_DIMENSIONS=384
```

### Config Settings to Add (core/config.py)

```python
# Add these fields to the existing Settings class:
qdrant_host: str = "localhost"
qdrant_port: int = 6333
qdrant_collection_name: str = "stravel_entities"
redis_url: str = "redis://localhost:6379/0"
embedding_model: str = "all-MiniLM-L6-v2"
embedding_dimensions: int = 384
```

### MockVectorStore for Testing

```python
from app.models.entity import Entity


class MockVectorStore:
    """In-memory mock implementing VectorStoreProtocol for unit tests."""

    def __init__(self) -> None:
        self._entities: dict[str, Entity] = {}
        self._embeddings: dict[str, list[float]] = {}

    async def search(
        self,
        query: str,
        filters: dict,
        limit: int = 10,
        tenant_id: str = "",
    ) -> list[Entity]:
        results = []
        for entity in self._entities.values():
            if tenant_id and entity.tenant_id != tenant_id:
                continue
            match = True
            for key, value in filters.items():
                if getattr(entity, key, None) != value:
                    match = False
                    break
            if match:
                results.append(entity)
        return results[:limit]

    async def get_by_id(
        self, entity_id: str, tenant_id: str = ""
    ) -> Entity | None:
        entity = self._entities.get(entity_id)
        if entity and tenant_id and entity.tenant_id != tenant_id:
            return None
        return entity

    async def upsert(
        self, entity: Entity, embedding: list[float]
    ) -> None:
        self._entities[entity.id] = entity
        self._embeddings[entity.id] = embedding

    async def delete(
        self, entity_id: str, tenant_id: str = ""
    ) -> bool:
        if entity_id in self._entities:
            del self._entities[entity_id]
            self._embeddings.pop(entity_id, None)
            return True
        return False
```

### File Locations

| File | Purpose |
|---|---|
| `docker-compose.full.yml` | Phase 2 services: Qdrant + Redis + Phase 1 |
| `backend/app/models/entity.py` | Entity SQLModel table model + EntityType enum |
| `backend/app/rag/vector_store.py` | QdrantVectorStore implementing VectorStoreProtocol |
| `backend/app/rag/embeddings.py` | EmbeddingService wrapping sentence-transformers |
| `backend/app/rag/tests/test_vector_store.py` | Unit tests with MockVectorStore |
| `backend/app/agents/protocols.py` | Updated VectorStoreProtocol with typed Entity returns |
| `backend/app/core/config.py` | Extended Settings with Qdrant/embedding config |
| `backend/app/core/dependencies.py` | DI providers for vector store and embedding service |
| `.env.example` | Updated with Qdrant, Redis, embedding env vars |
| `backend/pyproject.toml` | New dependencies: qdrant-client, sentence-transformers |

### Anti-Patterns -- DO NOT

- **DO NOT** add Qdrant or Redis to the base `docker-compose.yml` -- those stay Phase 1 only
- **DO NOT** import `QdrantVectorStore` directly in agent code -- agents receive `VectorStoreProtocol` via DI
- **DO NOT** use the sync `QdrantClient` -- use `AsyncQdrantClient` for async compatibility
- **DO NOT** use `session.exec()` -- use `session.execute()` with AsyncSession
- **DO NOT** use `from __future__ import annotations` in `models/entity.py`
- **DO NOT** use `datetime.now(timezone.utc)` for timestamp fields -- use `datetime.utcnow()`
- **DO NOT** store embeddings in PostgreSQL -- embeddings live in Qdrant only; PostgreSQL stores metadata
- **DO NOT** skip `tenant_id` filtering in search operations
- **DO NOT** create a `utils.py` catch-all file

### Deferred Item Resolution

This story resolves the following deferred item from Story 1.1 code review:

> VectorStoreProtocol.search returns list[dict] -- should return typed Entity when Epic 2 defines it [backend/app/agents/protocols.py]

### References

- [Source: _bmad-output/planning-artifacts/architecture.md -- Confirmed Tech Stack: Qdrant]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Progressive Infrastructure Plan: Phase 2]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Data Architecture: Vector data]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Protocol Interface Convention: VectorStoreProtocol]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Architectural Boundaries: agents/ -> rag/ via VectorStoreProtocol]
- [Source: _bmad-output/planning-artifacts/epics.md -- Epic 2, Story 2.1]
- [Source: _bmad-output/project-context.md -- Critical Implementation Rules]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md -- VectorStoreProtocol typed Entity]
- [Dependency: qdrant-client -- https://github.com/qdrant/qdrant-client]
- [Dependency: sentence-transformers -- https://www.sbert.net/]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
