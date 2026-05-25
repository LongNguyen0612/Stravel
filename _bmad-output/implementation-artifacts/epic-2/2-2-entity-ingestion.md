# Story 2.2: Entity Ingestion Pipeline

Status: done

## Story

As a system operator,
I want automated ETL pipelines that ingest hotel, attraction, and restaurant data into the Vector Store,
so that the system has verified, deduplicated travel entities to recommend.

**Depends on:** Story 2.1 (Qdrant Vector Store Setup & Entity Model) -- requires `VectorStoreProtocol`, `Entity` model, `rag/vector_store.py`, and `rag/embeddings.py` to be implemented.

## Acceptance Criteria

1. `etl/pipeline.py` defines an abstract base pipeline class with `extract()`, `transform()`, and `load()` methods that all entity pipelines inherit from
2. `etl/hotels.py` ingests hotel entities from a JSON data source with fields: name, type="hotel", location (lat/long + region), description, pricing, rating, source_url, ingested_at, expires_at
3. `etl/attractions.py` ingests attraction entities following the same pipeline pattern with type="attraction"
4. `etl/restaurants.py` ingests restaurant entities following the same pipeline pattern with type="restaurant"
5. `etl/deduplication.py` prevents the same real-world entity from being indexed twice by matching on normalized name + location (lat/long within threshold)
6. Each ingested entity has an `ingested_at` timestamp set to the time of ingestion and an `expires_at` timestamp (default: 7 days for pricing data, 30 days for description data)
7. Every pipeline run produces an ingestion log recording: pipeline name, run timestamp, source, total extracted, duplicates skipped, successfully loaded, failed, and error details for failures
8. Pipeline runs are idempotent -- running the same source data twice does not create duplicate entities in the Vector Store
9. All pipelines write to the Vector Store via `VectorStoreProtocol` -- never direct Qdrant client access
10. Unit tests pass without Qdrant -- using a mock `VectorStoreProtocol` implementation

## Tasks / Subtasks

- [ ] Task 1: Create base pipeline class (AC: #1)
  - [ ] Create `backend/app/etl/__init__.py`
  - [ ] Create `backend/app/etl/pipeline.py` with abstract `BasePipeline` class
  - [ ] Define abstract methods: `extract()`, `transform()`, `load()`
  - [ ] Implement `run()` orchestration method that calls extract -> transform -> deduplicate -> load
  - [ ] Define `IngestionResult` dataclass for run statistics (see Dev Notes)
  - [ ] Add structlog logging with `pipeline_name` context in all lifecycle methods

- [ ] Task 2: Create deduplication module (AC: #5, #8)
  - [ ] Create `backend/app/etl/deduplication.py`
  - [ ] Implement `EntityDeduplicator` class that accepts a `VectorStoreProtocol` instance
  - [ ] Implement `is_duplicate()` method matching on normalized name + location proximity
  - [ ] Name normalization: lowercase, strip whitespace, remove diacritics, collapse multiple spaces
  - [ ] Location proximity: entities within 100m (0.001 degrees lat/long) of each other are considered the same location
  - [ ] Add `find_existing()` method that returns the existing entity if a duplicate is found (for update scenarios)

- [ ] Task 3: Create ingestion logging (AC: #7)
  - [ ] Create `backend/app/etl/logging.py` with `IngestionLogger` class
  - [ ] Log each pipeline run with: pipeline_name, started_at, completed_at, source_identifier, counts (extracted, duplicates_skipped, loaded, failed), error_details list
  - [ ] Use structlog for all log output with consistent context fields
  - [ ] Optionally persist ingestion logs to PostgreSQL via an `IngestionLog` SQLModel (stretch -- structlog output is the minimum)

- [ ] Task 4: Create hotel ingestion pipeline (AC: #2, #6, #9)
  - [ ] Create `backend/app/etl/hotels.py` with `HotelPipeline(BasePipeline)`
  - [ ] Implement `extract()` to read from JSON file path (configurable source)
  - [ ] Implement `transform()` to map raw JSON to `Entity` schema with type="hotel", computed `ingested_at` and `expires_at`
  - [ ] Implement `load()` to write entities to Vector Store via `VectorStoreProtocol`
  - [ ] Set `expires_at` = ingested_at + 7 days for pricing fields, ingested_at + 30 days for description fields (use the shorter -- 7 days -- as the entity-level expiry)
  - [ ] Handle missing/malformed fields gracefully with per-record error logging

- [ ] Task 5: Create attraction ingestion pipeline (AC: #3, #6, #9)
  - [ ] Create `backend/app/etl/attractions.py` with `AttractionPipeline(BasePipeline)`
  - [ ] Implement `extract()`, `transform()`, `load()` following hotel pipeline pattern
  - [ ] Set type="attraction", `expires_at` = ingested_at + 30 days (descriptions change less frequently)

- [ ] Task 6: Create restaurant ingestion pipeline (AC: #4, #6, #9)
  - [ ] Create `backend/app/etl/restaurants.py` with `RestaurantPipeline(BasePipeline)`
  - [ ] Implement `extract()`, `transform()`, `load()` following hotel pipeline pattern
  - [ ] Set type="restaurant", `expires_at` = ingested_at + 7 days (pricing/menu changes frequently)

- [ ] Task 7: Write tests (AC: #1-#10)
  - [ ] Create `backend/app/etl/tests/__init__.py`
  - [ ] Create `backend/app/etl/tests/test_pipeline.py`:
    - [ ] `test_base_pipeline_abstract` -- cannot instantiate BasePipeline directly
    - [ ] `test_pipeline_run_orchestration` -- run() calls extract, transform, load in order
    - [ ] `test_pipeline_returns_ingestion_result` -- run() returns correct counts
  - [ ] Create `backend/app/etl/tests/test_deduplication.py`:
    - [ ] `test_exact_name_location_match` -- identical name+location detected as duplicate
    - [ ] `test_name_normalization` -- "Rex Hotel " vs "rex hotel" detected as same
    - [ ] `test_location_proximity` -- entities within 100m matched, beyond 100m not matched
    - [ ] `test_different_name_same_location` -- not a duplicate
    - [ ] `test_same_name_different_location` -- not a duplicate
  - [ ] Create `backend/app/etl/tests/test_hotels.py`:
    - [ ] `test_hotel_extract_from_json` -- reads and parses JSON source
    - [ ] `test_hotel_transform_sets_fields` -- all Entity fields populated correctly
    - [ ] `test_hotel_transform_sets_timestamps` -- ingested_at and expires_at set correctly
    - [ ] `test_hotel_load_calls_vector_store` -- entities written via VectorStoreProtocol
    - [ ] `test_hotel_pipeline_skips_duplicates` -- deduplication prevents double ingestion
    - [ ] `test_hotel_pipeline_handles_malformed_record` -- bad records logged, others still ingested
  - [ ] Create `backend/app/etl/tests/test_attractions.py` -- same pattern as hotels
  - [ ] Create `backend/app/etl/tests/test_restaurants.py` -- same pattern as hotels
  - [ ] Create `backend/app/etl/tests/conftest.py` with `MockVectorStore` fixture and sample JSON data fixtures
  - [ ] All tests use mock VectorStoreProtocol -- no Qdrant dependency

## Dev Notes

### Architecture Constraints

- **Python 3.12+** with modern syntax (`X | Y` union types, etc.)
- **Async all the way** -- pipelines should be async since VectorStoreProtocol methods are async
- **structlog** for all logging -- never use stdlib `logging`
- **VectorStoreProtocol** is the only interface to Qdrant -- never import qdrant_client directly in etl/
- **snake_case** for module names, **PascalCase** for classes
- **No generic `utils.py`** -- deduplication logic lives in its own module
- **Tests pass with PostgreSQL only** -- no Qdrant required (mock VectorStoreProtocol)
- **Follow Entity model from Story 2.1** -- do not redefine entity schema

### Base Pipeline Class

```python
# backend/app/etl/pipeline.py
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime

import structlog

from app.agents.protocols import VectorStoreProtocol
from app.etl.deduplication import EntityDeduplicator

logger = structlog.get_logger()


@dataclass
class IngestionResult:
    """Statistics from a single pipeline run."""

    pipeline_name: str
    source: str
    started_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: datetime | None = None
    total_extracted: int = 0
    duplicates_skipped: int = 0
    successfully_loaded: int = 0
    failed: int = 0
    errors: list[str] = field(default_factory=list)

    @property
    def is_success(self) -> bool:
        return self.failed == 0


class BasePipeline(ABC):
    """Abstract base class for all entity ingestion pipelines.

    Subclasses implement extract(), transform(), and load().
    The run() method orchestrates the full ETL + deduplication flow.
    """

    def __init__(
        self,
        vector_store: VectorStoreProtocol,
        deduplicator: EntityDeduplicator,
    ) -> None:
        self.vector_store = vector_store
        self.deduplicator = deduplicator
        self.logger = logger.bind(pipeline_name=self.pipeline_name)

    @property
    @abstractmethod
    def pipeline_name(self) -> str:
        """Unique identifier for this pipeline (e.g., 'hotels', 'attractions')."""
        ...

    @abstractmethod
    async def extract(self, source: str) -> list[dict]:
        """Extract raw records from a data source (JSON file, API, etc.).

        Args:
            source: Path to JSON file or API URL.

        Returns:
            List of raw record dicts.
        """
        ...

    @abstractmethod
    async def transform(self, raw_records: list[dict]) -> list["Entity"]:
        """Transform raw records into Entity objects.

        Args:
            raw_records: Raw dicts from extract().

        Returns:
            List of validated Entity objects.
        """
        ...

    async def load(self, entities: list["Entity"]) -> tuple[int, int, list[str]]:
        """Load entities into Vector Store, skipping duplicates.

        Returns:
            Tuple of (loaded_count, skipped_count, error_messages).
        """
        loaded = 0
        skipped = 0
        errors = []

        for entity in entities:
            try:
                if await self.deduplicator.is_duplicate(entity):
                    self.logger.debug(
                        "entity.duplicate_skipped",
                        entity_name=entity.name,
                        entity_type=entity.type,
                    )
                    skipped += 1
                    continue

                await self.vector_store.upsert(entity)
                loaded += 1
                self.logger.debug(
                    "entity.loaded",
                    entity_name=entity.name,
                    entity_type=entity.type,
                )
            except Exception as e:
                errors.append(f"Failed to load '{entity.name}': {e}")
                self.logger.error(
                    "entity.load_failed",
                    entity_name=entity.name,
                    error=str(e),
                )

        return loaded, skipped, errors

    async def run(self, source: str) -> IngestionResult:
        """Orchestrate the full ETL pipeline: extract -> transform -> load.

        Args:
            source: Data source identifier (file path or URL).

        Returns:
            IngestionResult with run statistics.
        """
        result = IngestionResult(
            pipeline_name=self.pipeline_name,
            source=source,
        )

        self.logger.info("pipeline.started", source=source)

        try:
            # Extract
            raw_records = await self.extract(source)
            result.total_extracted = len(raw_records)
            self.logger.info(
                "pipeline.extracted",
                total_extracted=result.total_extracted,
            )

            # Transform
            entities = await self.transform(raw_records)

            # Load (includes deduplication)
            loaded, skipped, errors = await self.load(entities)
            result.successfully_loaded = loaded
            result.duplicates_skipped = skipped
            result.failed = len(errors)
            result.errors = errors

        except Exception as e:
            result.errors.append(f"Pipeline failed: {e}")
            self.logger.exception("pipeline.failed", error=str(e))

        result.completed_at = datetime.utcnow()
        self.logger.info(
            "pipeline.completed",
            total_extracted=result.total_extracted,
            duplicates_skipped=result.duplicates_skipped,
            successfully_loaded=result.successfully_loaded,
            failed=result.failed,
            duration_ms=int(
                (result.completed_at - result.started_at).total_seconds() * 1000
            ),
        )

        return result
```

### Deduplication Logic

```python
# backend/app/etl/deduplication.py
import math
import unicodedata
import re

import structlog

from app.agents.protocols import VectorStoreProtocol

logger = structlog.get_logger()

# Entities within ~100 meters are considered the same location
LOCATION_THRESHOLD_DEGREES = 0.001  # ~111 meters at equator


def normalize_name(name: str) -> str:
    """Normalize entity name for deduplication matching.

    - Lowercase
    - Strip leading/trailing whitespace
    - Remove diacritics (e.g., Vietnamese accents)
    - Collapse multiple spaces to single space
    """
    name = name.strip().lower()
    # Remove diacritics: NFD decomposition, strip combining characters
    name = unicodedata.normalize("NFD", name)
    name = "".join(c for c in name if unicodedata.category(c) != "Mn")
    # Collapse multiple whitespace
    name = re.sub(r"\s+", " ", name)
    return name


def locations_match(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> bool:
    """Check if two locations are within the proximity threshold (~100m)."""
    return (
        abs(lat1 - lat2) < LOCATION_THRESHOLD_DEGREES
        and abs(lon1 - lon2) < LOCATION_THRESHOLD_DEGREES
    )


class EntityDeduplicator:
    """Deduplication engine that checks if an entity already exists
    in the Vector Store by matching on normalized name + location proximity.
    """

    def __init__(self, vector_store: VectorStoreProtocol) -> None:
        self.vector_store = vector_store
        self.logger = logger.bind(component="deduplicator")

    async def is_duplicate(self, entity: "Entity") -> bool:
        """Check if entity is a duplicate of an existing record.

        Matches on:
        - Normalized name equality (case-insensitive, accent-stripped)
        - Location within ~100m (lat/long threshold)

        Returns:
            True if a duplicate exists in the Vector Store.
        """
        existing = await self.find_existing(entity)
        return existing is not None

    async def find_existing(self, entity: "Entity") -> "Entity | None":
        """Find an existing entity that matches the given entity.

        Searches the Vector Store by name and filters by location proximity.

        Returns:
            The existing Entity if found, None otherwise.
        """
        # Search Vector Store for entities with similar names
        candidates = await self.vector_store.search(
            query=entity.name,
            filters={"type": entity.type},
            limit=10,
        )

        normalized_new = normalize_name(entity.name)

        for candidate in candidates:
            normalized_existing = normalize_name(candidate.name)

            if normalized_new != normalized_existing:
                continue

            # Name matches -- check location proximity
            if (
                entity.latitude is not None
                and entity.longitude is not None
                and candidate.latitude is not None
                and candidate.longitude is not None
            ):
                if locations_match(
                    entity.latitude,
                    entity.longitude,
                    candidate.latitude,
                    candidate.longitude,
                ):
                    self.logger.debug(
                        "deduplication.match_found",
                        entity_name=entity.name,
                        existing_id=str(candidate.id),
                    )
                    return candidate
            else:
                # If either entity lacks location data, name match alone
                # is sufficient for deduplication
                self.logger.debug(
                    "deduplication.match_found_name_only",
                    entity_name=entity.name,
                    existing_id=str(candidate.id),
                )
                return candidate

        return None
```

### Hotel Pipeline Example

```python
# backend/app/etl/hotels.py
import json
from datetime import datetime, timedelta
from pathlib import Path

import structlog

from app.etl.pipeline import BasePipeline
from app.models.entity import Entity

logger = structlog.get_logger()

# Freshness defaults
PRICE_FRESHNESS_DAYS = 7
DESCRIPTION_FRESHNESS_DAYS = 30


class HotelPipeline(BasePipeline):
    """ETL pipeline for hotel entities."""

    @property
    def pipeline_name(self) -> str:
        return "hotels"

    async def extract(self, source: str) -> list[dict]:
        """Extract hotel records from a JSON file."""
        path = Path(source)
        if not path.exists():
            raise FileNotFoundError(f"Hotel data source not found: {source}")

        with open(path) as f:
            data = json.load(f)

        # Support both {"hotels": [...]} and bare list formats
        if isinstance(data, dict) and "hotels" in data:
            return data["hotels"]
        if isinstance(data, list):
            return data

        raise ValueError(f"Unexpected JSON structure in {source}")

    async def transform(self, raw_records: list[dict]) -> list[Entity]:
        """Transform raw hotel JSON records into Entity objects."""
        entities = []
        now = datetime.utcnow()

        for i, record in enumerate(raw_records):
            try:
                entity = Entity(
                    name=record["name"],
                    type="hotel",
                    region=record.get("region", ""),
                    description=record.get("description", ""),
                    latitude=record.get("latitude"),
                    longitude=record.get("longitude"),
                    pricing=record.get("pricing"),
                    rating=record.get("rating"),
                    source_url=record.get("source_url", ""),
                    metadata=record.get("metadata", {}),
                    ingested_at=now,
                    # Hotels expire at the shorter interval (pricing changes)
                    expires_at=now + timedelta(days=PRICE_FRESHNESS_DAYS),
                )
                entities.append(entity)
            except (KeyError, ValueError) as e:
                self.logger.warning(
                    "transform.record_skipped",
                    record_index=i,
                    error=str(e),
                    record_name=record.get("name", "UNKNOWN"),
                )

        return entities
```

### Attraction and Restaurant Pipelines

These follow the same structure as `HotelPipeline`. Key differences:

```python
# backend/app/etl/attractions.py -- key differences from hotels
class AttractionPipeline(BasePipeline):
    @property
    def pipeline_name(self) -> str:
        return "attractions"

    async def extract(self, source: str) -> list[dict]:
        # Same pattern, look for "attractions" key in JSON
        ...

    async def transform(self, raw_records: list[dict]) -> list[Entity]:
        # type="attraction"
        # expires_at = now + timedelta(days=30)  -- descriptions change less
        ...
```

```python
# backend/app/etl/restaurants.py -- key differences from hotels
class RestaurantPipeline(BasePipeline):
    @property
    def pipeline_name(self) -> str:
        return "restaurants"

    async def extract(self, source: str) -> list[dict]:
        # Same pattern, look for "restaurants" key in JSON
        ...

    async def transform(self, raw_records: list[dict]) -> list[Entity]:
        # type="restaurant"
        # expires_at = now + timedelta(days=7)  -- menu/pricing changes frequently
        ...
```

### Freshness Expiry Strategy

| Entity Type | `expires_at` Default | Rationale |
|---|---|---|
| hotel | ingested_at + 7 days | Room pricing fluctuates frequently |
| attraction | ingested_at + 30 days | Descriptions, hours, and ticket prices change slowly |
| restaurant | ingested_at + 7 days | Menu items and pricing change frequently |

The `expires_at` timestamp on the Entity is the entity-level expiry. Story 2.4 (Freshness Tracking) will use this value to determine staleness. For this story, simply set it correctly during ingestion.

### VectorStoreProtocol Dependency

The pipeline depends on `VectorStoreProtocol` from Story 2.1. The protocol must include an `upsert()` method for loading entities. If Story 2.1 only defines `search()` and `get_by_id()`, this story must extend the protocol:

```python
# Extend agents/protocols.py (if not already present from 2.1)
class VectorStoreProtocol(Protocol):
    async def search(self, query: str, filters: dict, limit: int = 10) -> list[Entity]: ...
    async def get_by_id(self, entity_id: str) -> Entity | None: ...
    async def upsert(self, entity: Entity) -> None: ...
```

Confirm this with Story 2.1 implementation before starting. If `upsert()` is missing, add it as part of this story.

### Mock VectorStore for Tests

```python
# backend/app/etl/tests/conftest.py
import pytest
from app.models.entity import Entity


class MockVectorStore:
    """In-memory mock for VectorStoreProtocol used in ETL tests."""

    def __init__(self) -> None:
        self.entities: list[Entity] = []

    async def search(
        self, query: str, filters: dict | None = None, limit: int = 10
    ) -> list[Entity]:
        results = []
        for entity in self.entities:
            if filters and filters.get("type") and entity.type != filters["type"]:
                continue
            if query.lower() in entity.name.lower():
                results.append(entity)
        return results[:limit]

    async def get_by_id(self, entity_id: str) -> Entity | None:
        for entity in self.entities:
            if str(entity.id) == entity_id:
                return entity
        return None

    async def upsert(self, entity: Entity) -> None:
        # Replace if exists, otherwise append
        self.entities = [e for e in self.entities if e.id != entity.id]
        self.entities.append(entity)


@pytest.fixture
def mock_vector_store() -> MockVectorStore:
    return MockVectorStore()


@pytest.fixture
def sample_hotel_json(tmp_path) -> str:
    """Create a temporary JSON file with sample hotel data."""
    import json

    hotels = [
        {
            "name": "Rex Hotel Saigon",
            "region": "Ho Chi Minh City",
            "description": "Historic luxury hotel on Nguyen Hue Walking Street",
            "latitude": 10.7769,
            "longitude": 106.7009,
            "pricing": {"min_per_night": 120, "max_per_night": 350, "currency": "USD"},
            "rating": 4.5,
            "source_url": "https://example.com/rex-hotel",
            "metadata": {"stars": 5, "amenities": ["pool", "spa", "restaurant"]},
        },
        {
            "name": "Muong Thanh Sapa Hotel",
            "region": "Sapa",
            "description": "Mountain view hotel in Sapa town center",
            "latitude": 22.3363,
            "longitude": 103.8438,
            "pricing": {"min_per_night": 45, "max_per_night": 120, "currency": "USD"},
            "rating": 4.0,
            "source_url": "https://example.com/muong-thanh-sapa",
            "metadata": {"stars": 4, "amenities": ["restaurant", "parking"]},
        },
    ]

    file_path = tmp_path / "hotels.json"
    file_path.write_text(json.dumps({"hotels": hotels}))
    return str(file_path)
```

### Ingestion Log Output Format

Pipeline runs emit structured logs via structlog. Example output:

```json
{
  "event": "pipeline.completed",
  "pipeline_name": "hotels",
  "source": "data/seed/hotels.json",
  "total_extracted": 50,
  "duplicates_skipped": 3,
  "successfully_loaded": 45,
  "failed": 2,
  "duration_ms": 1234,
  "timestamp": "2026-05-24T10:30:00Z"
}
```

### Anti-Patterns -- DO NOT

- **DO NOT** import `qdrant_client` in any etl/ module -- use `VectorStoreProtocol` only
- **DO NOT** use stdlib `logging` -- use `structlog` only
- **DO NOT** create a monolithic pipeline file -- one module per entity type
- **DO NOT** skip deduplication -- even if data source is "trusted"
- **DO NOT** silently swallow errors -- log every failed record with details
- **DO NOT** use `datetime.now(timezone.utc)` for timestamps -- use `datetime.utcnow()` (see project-context.md, asyncpg compatibility)
- **DO NOT** hardcode file paths -- source is always a parameter to `extract()`
- **DO NOT** write tests that require Qdrant -- mock VectorStoreProtocol
- **DO NOT** redefine the Entity model -- import from `app/models/entity.py` (Story 2.1)

### File Paths Summary

New files to create:
- `backend/app/etl/__init__.py`
- `backend/app/etl/pipeline.py`
- `backend/app/etl/deduplication.py`
- `backend/app/etl/logging.py`
- `backend/app/etl/hotels.py`
- `backend/app/etl/attractions.py`
- `backend/app/etl/restaurants.py`
- `backend/app/etl/tests/__init__.py`
- `backend/app/etl/tests/conftest.py`
- `backend/app/etl/tests/test_pipeline.py`
- `backend/app/etl/tests/test_deduplication.py`
- `backend/app/etl/tests/test_hotels.py`
- `backend/app/etl/tests/test_attractions.py`
- `backend/app/etl/tests/test_restaurants.py`

Files to modify (potentially):
- `backend/app/agents/protocols.py` -- add `upsert()` to `VectorStoreProtocol` if not present from Story 2.1

### References

- [Source: _bmad-output/planning-artifacts/epics.md -- Epic 2, Story 2.2]
- [Source: _bmad-output/planning-artifacts/architecture.md -- ETL Flow]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Architectural Boundaries: etl/ -> rag/]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Data Architecture: Cache invalidation TTLs]
- [Source: _bmad-output/planning-artifacts/architecture.md -- Implementation Patterns]
- [Source: _bmad-output/project-context.md -- Datetime anti-pattern, structlog rules, async rules]
- [Source: _bmad-output/planning-artifacts/epics.md -- Story 2.1 (dependency)]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
