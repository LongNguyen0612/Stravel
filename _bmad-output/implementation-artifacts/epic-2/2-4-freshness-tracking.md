# Story 2.4: Freshness Tracking & Staleness Warnings

Status: draft

## Story

As a system,
I want to track how fresh each entity's data is and flag stale entries,
so that proposals never present outdated prices or closed venues without warning.

## Acceptance Criteria

1. **Freshness checking module** -- `rag/freshness.py` implements freshness evaluation logic that determines whether an entity is fresh, stale, or expired based on its `ingested_at` timestamp and the configured staleness threshold for its data category
2. **Category-based thresholds** -- Price-sensitive fields (pricing, availability) use a 7-day staleness threshold; descriptive fields (descriptions, amenities, ratings) use a 30-day staleness threshold. Thresholds are defined as constants: `PRICE_FRESHNESS_DAYS = 7` and `DESCRIPTION_FRESHNESS_DAYS = 30`
3. **Staleness classification** -- Each entity is classified into one of three states: `FRESH` (within threshold), `STALE` (beyond threshold but within 2x threshold), or `EXPIRED` (beyond 2x threshold)
4. **Stale entity exclusion** -- Stale entities are excluded from Proposal generation by default. The freshness checker provides a `filter_fresh()` method that removes stale/expired entities from search results
5. **Staleness warning attachment** -- When stale entities are included as a fallback (e.g., insufficient fresh alternatives), a `StalenessWarning` is attached to the entity with the staleness reason, days since last update, and recommendation to verify
6. **Redis cache service** -- `services/cache.py` implements `CacheProtocol` backed by Redis with TTL values aligned to freshness thresholds (7 days for price queries, 30 days for description queries)
7. **Search query caching** -- Popular search queries are cached in Redis to reduce Qdrant load. Cache keys are derived from the normalized query + filters hash. Cache hits bypass Qdrant entirely
8. **Cache invalidation** -- Cache entries are invalidated when entities are re-ingested via the ETL pipeline. TTL-based expiration serves as the fallback invalidation strategy
9. **CacheProtocol abstraction** -- `CacheProtocol` is defined with `get()`, `set()`, `delete()`, and `invalidate_pattern()` methods, enabling swap from Redis to any other cache backend
10. **Freshness metadata in search results** -- All entity search results include freshness metadata: `freshness_status` (fresh/stale/expired), `ingested_at`, `expires_at`, and `days_until_stale`
11. **Graceful degradation** -- If Redis is unavailable, the system falls back to uncached Qdrant queries with a structured log warning. No request fails due to cache unavailability
12. **Docker Compose update** -- `docker-compose.full.yml` includes a Redis service (if not already present from Story 2.1)

## Tasks

- [ ] Task 1: Define freshness constants and schemas (AC: #2, #3, #10)
  - [ ] Create `backend/app/rag/freshness.py`
  - [ ] Define `PRICE_FRESHNESS_DAYS = 7` and `DESCRIPTION_FRESHNESS_DAYS = 30` constants
  - [ ] Define `FreshnessStatus` enum with values `FRESH`, `STALE`, `EXPIRED`
  - [ ] Define `FreshnessInfo` Pydantic model with fields: `status: FreshnessStatus`, `ingested_at: datetime`, `expires_at: datetime`, `days_until_stale: int`, `days_overdue: int | None`
  - [ ] Define `StalenessWarning` Pydantic model with fields: `entity_id: str`, `entity_name: str`, `reason: str`, `days_since_update: int`, `recommendation: str`
  - [ ] Define `FreshnessCategory` enum: `PRICE` (7-day threshold) and `DESCRIPTION` (30-day threshold)

- [ ] Task 2: Implement freshness evaluation logic (AC: #1, #3)
  - [ ] Implement `evaluate_freshness(entity: Entity, category: FreshnessCategory) -> FreshnessInfo` that computes freshness status based on `ingested_at` and the category threshold
  - [ ] FRESH: `now - ingested_at <= threshold`
  - [ ] STALE: `threshold < now - ingested_at <= 2 * threshold`
  - [ ] EXPIRED: `now - ingested_at > 2 * threshold`
  - [ ] Compute `days_until_stale` (negative if already stale) and `days_overdue` (None if fresh, positive integer if stale/expired)
  - [ ] Write unit tests covering all three freshness states for both PRICE and DESCRIPTION categories
  - [ ] Write unit tests for edge cases: entity ingested exactly at threshold boundary, entity with no `ingested_at` (treat as expired)

- [ ] Task 3: Implement freshness filtering (AC: #4, #5)
  - [ ] Implement `FreshnessChecker` class in `rag/freshness.py`
  - [ ] Implement `filter_fresh(entities: list[Entity], category: FreshnessCategory) -> list[Entity]` method that returns only FRESH entities
  - [ ] Implement `filter_with_warnings(entities: list[Entity], category: FreshnessCategory, min_results: int = 3) -> tuple[list[Entity], list[StalenessWarning]]` method that includes stale entities as fallback when fewer than `min_results` fresh entities exist, attaching `StalenessWarning` to each stale inclusion
  - [ ] Warning `reason` format: `"Price data is {days} days old (threshold: {threshold} days)"`
  - [ ] Warning `recommendation`: `"Verify current pricing before including in proposal"`
  - [ ] Write unit tests: all fresh (no warnings), mixed fresh/stale (stale excluded), insufficient fresh (stale included with warnings), all expired (all included with warnings, log emitted)

- [ ] Task 4: Define CacheProtocol and Redis implementation (AC: #6, #9)
  - [ ] Add `CacheProtocol` to `backend/app/agents/protocols.py` (or create `backend/app/services/protocols.py` if agent protocols should not contain service protocols)
  - [ ] Define protocol methods:
    - `async def get(self, key: str) -> str | None`
    - `async def set(self, key: str, value: str, ttl_seconds: int | None = None) -> None`
    - `async def delete(self, key: str) -> None`
    - `async def invalidate_pattern(self, pattern: str) -> int` (returns count of deleted keys)
    - `async def health_check(self) -> bool`
  - [ ] Create `backend/app/services/cache.py`
  - [ ] Implement `RedisCache` class implementing `CacheProtocol`
  - [ ] Use `redis.asyncio` (async Redis client) for all operations
  - [ ] Constructor accepts `redis_url: str` (from settings) and creates connection pool
  - [ ] `invalidate_pattern()` uses Redis SCAN + DELETE (not KEYS for production safety)
  - [ ] Add `redis>=5.0.0` to `pyproject.toml` dependencies

- [ ] Task 5: Implement TTL-aligned cache configuration (AC: #6, #7, #8)
  - [ ] Define cache TTL constants: `PRICE_CACHE_TTL = 7 * 24 * 3600` (7 days in seconds), `DESCRIPTION_CACHE_TTL = 30 * 24 * 3600` (30 days in seconds)
  - [ ] Implement `CacheKeyBuilder` utility in `services/cache.py`:
    - `build_search_key(query: str, filters: dict) -> str` -- normalizes query (lowercase, strip), sorts filter keys, produces deterministic hash
    - Key format: `stravel:search:{sha256_hex[:16]}`
  - [ ] Implement `get_ttl_for_category(category: FreshnessCategory) -> int` that maps freshness categories to cache TTL values
  - [ ] Implement cache-aside pattern in search: check cache first, on miss query Qdrant, store result in cache with category-appropriate TTL

- [ ] Task 6: Implement graceful degradation for Redis unavailability (AC: #11)
  - [ ] Wrap all Redis operations in try/except that catches `redis.ConnectionError`, `redis.TimeoutError`
  - [ ] On Redis failure: log warning via `structlog` with `cache.unavailable` event, return `None` for gets, silently skip for sets
  - [ ] `health_check()` returns `False` when Redis is unreachable
  - [ ] Implement `InMemoryCache` as a `CacheProtocol` fallback (optional, for unit tests and extreme degradation)
  - [ ] Write unit test verifying that `RedisCache` degrades gracefully when connection is refused

- [ ] Task 7: Integrate freshness into vector store search results (AC: #10)
  - [ ] Update `rag/vector_store.py` (or the VectorStoreProtocol search return type) to include `FreshnessInfo` on each returned entity
  - [ ] After Qdrant returns results, run `evaluate_freshness()` on each entity and attach the `FreshnessInfo`
  - [ ] Ensure `FreshnessInfo` is serializable and included in API responses where entity search results appear

- [ ] Task 8: Integrate cache into hybrid search (AC: #7, #8)
  - [ ] Update `rag/hybrid_search.py` to accept `CacheProtocol` dependency (via DI or constructor)
  - [ ] Before querying Qdrant, check cache with `CacheKeyBuilder.build_search_key(query, filters)`
  - [ ] On cache hit: deserialize and return cached results (log `cache.hit` event)
  - [ ] On cache miss: query Qdrant, serialize results, store in cache with appropriate TTL (log `cache.miss` event)
  - [ ] On entity re-ingestion (ETL pipeline), invalidate cache entries matching the entity's region/type pattern

- [ ] Task 9: Add Redis to Docker Compose (AC: #12)
  - [ ] Add Redis service to `docker-compose.full.yml` (if not already present):
    ```yaml
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
        retries: 3
    ```
  - [ ] Add `redis_data` to the `volumes` section
  - [ ] Add `REDIS_URL=redis://redis:6379/0` to `.env.example`
  - [ ] Add `redis_url: str = "redis://localhost:6379/0"` to `core/config.py` Settings

- [ ] Task 10: Write comprehensive tests (AC: #1-#11)
  - [ ] Create `backend/app/rag/tests/test_freshness.py`:
    - [ ] `test_evaluate_freshness_fresh` -- entity ingested 1 day ago with PRICE category is FRESH
    - [ ] `test_evaluate_freshness_stale` -- entity ingested 10 days ago with PRICE category is STALE
    - [ ] `test_evaluate_freshness_expired` -- entity ingested 20 days ago with PRICE category is EXPIRED
    - [ ] `test_evaluate_freshness_description_30day` -- entity ingested 25 days ago with DESCRIPTION category is FRESH
    - [ ] `test_evaluate_freshness_boundary` -- entity ingested exactly at threshold boundary
    - [ ] `test_evaluate_freshness_no_ingested_at` -- entity with None ingested_at treated as EXPIRED
    - [ ] `test_filter_fresh_removes_stale` -- only FRESH entities returned
    - [ ] `test_filter_with_warnings_fallback` -- stale entities included when insufficient fresh, with warnings
    - [ ] `test_filter_with_warnings_all_fresh` -- no warnings when all entities are fresh
    - [ ] `test_filter_with_warnings_all_expired` -- all entities included with warnings when all expired
  - [ ] Create `backend/app/services/tests/test_cache.py`:
    - [ ] `test_cache_set_and_get` -- value stored and retrieved
    - [ ] `test_cache_ttl_expiration` -- value expires after TTL (use short TTL in test)
    - [ ] `test_cache_delete` -- value removed
    - [ ] `test_cache_invalidate_pattern` -- matching keys deleted
    - [ ] `test_cache_key_builder_deterministic` -- same query+filters produce same key
    - [ ] `test_cache_key_builder_order_independent` -- different filter key order produces same key
    - [ ] `test_cache_graceful_degradation` -- operations succeed (return None/skip) when Redis unavailable
    - [ ] `test_cache_health_check` -- returns True when connected, False when not
  - [ ] Unit tests for freshness must pass without Redis (mock CacheProtocol)
  - [ ] Cache tests that need Redis should be marked `@pytest.mark.integration`

## Dev Notes

### Architecture Constraints

- **Phase 2 introduces Redis** -- This story is the first to use Redis. All previous stories used in-memory alternatives. The `CacheProtocol` abstraction ensures clean testing without Redis.
- **Python 3.12+** with modern syntax (`X | Y` union types, etc.)
- **Pydantic v2** for all schemas and data models
- **structlog** for all logging -- never use stdlib `logging`
- **Async all the way** -- use async Redis client (`redis.asyncio`), `async def` for all cache operations
- **snake_case** for module names and functions, **PascalCase** for classes
- **Protocol interfaces** at service boundaries -- `CacheProtocol` follows the same pattern as `LLMServiceProtocol` and `VectorStoreProtocol`
- **Unit tests pass without Redis** -- mock the `CacheProtocol` for freshness tests. Only cache integration tests need Redis.
- **No auth enforcement in this story** -- freshness and caching are internal infrastructure, not user-facing API changes

### Freshness Evaluation Logic

```python
# rag/freshness.py
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


PRICE_FRESHNESS_DAYS = 7
DESCRIPTION_FRESHNESS_DAYS = 30


class FreshnessCategory(str, Enum):
    PRICE = "price"
    DESCRIPTION = "description"


class FreshnessStatus(str, Enum):
    FRESH = "fresh"
    STALE = "stale"
    EXPIRED = "expired"


FRESHNESS_THRESHOLDS: dict[FreshnessCategory, int] = {
    FreshnessCategory.PRICE: PRICE_FRESHNESS_DAYS,
    FreshnessCategory.DESCRIPTION: DESCRIPTION_FRESHNESS_DAYS,
}


class FreshnessInfo(BaseModel):
    status: FreshnessStatus
    ingested_at: datetime
    expires_at: datetime
    days_until_stale: int  # negative if already stale
    days_overdue: int | None = None  # None if fresh

    model_config = {"from_attributes": True}


class StalenessWarning(BaseModel):
    entity_id: str
    entity_name: str
    reason: str
    days_since_update: int
    recommendation: str


def _get_threshold_days(category: FreshnessCategory) -> int:
    return FRESHNESS_THRESHOLDS[category]


def evaluate_freshness(
    ingested_at: datetime | None,
    category: FreshnessCategory,
    now: datetime | None = None,
) -> FreshnessInfo:
    """Evaluate freshness status of an entity based on ingestion time and category.

    Args:
        ingested_at: When the entity was last ingested/updated. None = treat as expired.
        category: PRICE (7-day) or DESCRIPTION (30-day) threshold.
        now: Override current time for testing. Defaults to datetime.utcnow().

    Returns:
        FreshnessInfo with status, timestamps, and staleness metrics.
    """
    if now is None:
        now = datetime.utcnow()

    threshold_days = _get_threshold_days(category)

    if ingested_at is None:
        # No ingestion timestamp = treat as expired
        return FreshnessInfo(
            status=FreshnessStatus.EXPIRED,
            ingested_at=datetime.min,
            expires_at=datetime.min,
            days_until_stale=-threshold_days * 2,
            days_overdue=threshold_days * 2,
        )

    from datetime import timedelta

    age_days = (now - ingested_at).days
    expires_at = ingested_at + timedelta(days=threshold_days)
    days_until_stale = threshold_days - age_days

    if age_days <= threshold_days:
        status = FreshnessStatus.FRESH
        days_overdue = None
    elif age_days <= threshold_days * 2:
        status = FreshnessStatus.STALE
        days_overdue = age_days - threshold_days
    else:
        status = FreshnessStatus.EXPIRED
        days_overdue = age_days - threshold_days

    return FreshnessInfo(
        status=status,
        ingested_at=ingested_at,
        expires_at=expires_at,
        days_until_stale=days_until_stale,
        days_overdue=days_overdue,
    )
```

### FreshnessChecker Class Pattern

```python
# rag/freshness.py (continued)
import structlog

logger = structlog.get_logger()


class FreshnessChecker:
    """Filters and annotates entities based on data freshness."""

    def filter_fresh(
        self,
        entities: list,  # list[Entity] — use actual Entity type
        category: FreshnessCategory,
        now: datetime | None = None,
    ) -> list:
        """Return only FRESH entities, excluding stale and expired."""
        return [
            e for e in entities
            if evaluate_freshness(e.ingested_at, category, now).status == FreshnessStatus.FRESH
        ]

    def filter_with_warnings(
        self,
        entities: list,
        category: FreshnessCategory,
        min_results: int = 3,
        now: datetime | None = None,
    ) -> tuple[list, list[StalenessWarning]]:
        """Return entities with staleness warnings for non-fresh inclusions.

        If fewer than min_results fresh entities exist, include stale entities
        as fallback with attached warnings. Expired entities are included only
        if the total is still below min_results after including stale ones.
        """
        fresh = []
        stale = []
        expired = []
        warnings: list[StalenessWarning] = []

        threshold_days = _get_threshold_days(category)

        for entity in entities:
            info = evaluate_freshness(entity.ingested_at, category, now)
            if info.status == FreshnessStatus.FRESH:
                fresh.append(entity)
            elif info.status == FreshnessStatus.STALE:
                stale.append(entity)
            else:
                expired.append(entity)

        result = list(fresh)

        # Include stale as fallback if insufficient fresh results
        if len(result) < min_results:
            for entity in stale:
                info = evaluate_freshness(entity.ingested_at, category, now)
                result.append(entity)
                warnings.append(StalenessWarning(
                    entity_id=str(entity.id),
                    entity_name=entity.name,
                    reason=f"Price data is {info.days_overdue + threshold_days} days old (threshold: {threshold_days} days)",
                    days_since_update=info.days_overdue + threshold_days if info.days_overdue else threshold_days,
                    recommendation="Verify current pricing before including in proposal",
                ))
                if len(result) >= min_results:
                    break

        # Include expired only if still insufficient
        if len(result) < min_results:
            for entity in expired:
                info = evaluate_freshness(entity.ingested_at, category, now)
                result.append(entity)
                warnings.append(StalenessWarning(
                    entity_id=str(entity.id),
                    entity_name=entity.name,
                    reason=f"Data is {info.days_overdue + threshold_days} days old (threshold: {threshold_days} days) - EXPIRED",
                    days_since_update=info.days_overdue + threshold_days if info.days_overdue else threshold_days * 2,
                    recommendation="Data is severely outdated. Verify all details before use.",
                ))
                if len(result) >= min_results:
                    break

        if warnings:
            logger.warning(
                "freshness.stale_entities_included",
                stale_count=len(warnings),
                total_returned=len(result),
                category=category.value,
            )

        return result, warnings
```

### CacheProtocol and Redis Implementation

```python
# agents/protocols.py (add to existing file)
# OR services/protocols.py if service protocols are separated

class CacheProtocol(Protocol):
    """Cache abstraction for Redis or any key-value store."""

    async def get(self, key: str) -> str | None: ...
    async def set(self, key: str, value: str, ttl_seconds: int | None = None) -> None: ...
    async def delete(self, key: str) -> None: ...
    async def invalidate_pattern(self, pattern: str) -> int: ...
    async def health_check(self) -> bool: ...
```

```python
# services/cache.py
import hashlib
import json
from typing import Any

import redis.asyncio as redis
import structlog

from app.rag.freshness import FreshnessCategory, PRICE_FRESHNESS_DAYS, DESCRIPTION_FRESHNESS_DAYS

logger = structlog.get_logger()

# Cache TTLs aligned to freshness thresholds
PRICE_CACHE_TTL = PRICE_FRESHNESS_DAYS * 24 * 3600       # 604800 seconds (7 days)
DESCRIPTION_CACHE_TTL = DESCRIPTION_FRESHNESS_DAYS * 24 * 3600  # 2592000 seconds (30 days)


class CacheKeyBuilder:
    """Builds deterministic, normalized cache keys from search parameters."""

    PREFIX = "stravel:search"

    @staticmethod
    def build_search_key(query: str, filters: dict[str, Any]) -> str:
        """Build a deterministic cache key from query and filters.

        Normalizes query (lowercase, strip) and sorts filter keys
        to produce the same key regardless of parameter ordering.
        """
        normalized_query = query.lower().strip()
        sorted_filters = json.dumps(filters, sort_keys=True, default=str)
        raw = f"{normalized_query}:{sorted_filters}"
        hash_hex = hashlib.sha256(raw.encode()).hexdigest()[:16]
        return f"{CacheKeyBuilder.PREFIX}:{hash_hex}"


def get_ttl_for_category(category: FreshnessCategory) -> int:
    """Map a freshness category to its cache TTL in seconds."""
    if category == FreshnessCategory.PRICE:
        return PRICE_CACHE_TTL
    return DESCRIPTION_CACHE_TTL


class RedisCache:
    """Redis-backed cache implementing CacheProtocol with graceful degradation."""

    def __init__(self, redis_url: str) -> None:
        self._redis = redis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
        )

    async def get(self, key: str) -> str | None:
        try:
            value = await self._redis.get(key)
            if value is not None:
                logger.debug("cache.hit", key=key)
            else:
                logger.debug("cache.miss", key=key)
            return value
        except (redis.ConnectionError, redis.TimeoutError) as exc:
            logger.warning("cache.unavailable", operation="get", error=str(exc))
            return None

    async def set(self, key: str, value: str, ttl_seconds: int | None = None) -> None:
        try:
            if ttl_seconds:
                await self._redis.setex(key, ttl_seconds, value)
            else:
                await self._redis.set(key, value)
            logger.debug("cache.set", key=key, ttl=ttl_seconds)
        except (redis.ConnectionError, redis.TimeoutError) as exc:
            logger.warning("cache.unavailable", operation="set", error=str(exc))

    async def delete(self, key: str) -> None:
        try:
            await self._redis.delete(key)
            logger.debug("cache.delete", key=key)
        except (redis.ConnectionError, redis.TimeoutError) as exc:
            logger.warning("cache.unavailable", operation="delete", error=str(exc))

    async def invalidate_pattern(self, pattern: str) -> int:
        """Delete all keys matching a pattern using SCAN (production-safe, not KEYS)."""
        deleted = 0
        try:
            async for key in self._redis.scan_iter(match=pattern, count=100):
                await self._redis.delete(key)
                deleted += 1
            logger.info("cache.invalidate_pattern", pattern=pattern, deleted=deleted)
        except (redis.ConnectionError, redis.TimeoutError) as exc:
            logger.warning("cache.unavailable", operation="invalidate_pattern", error=str(exc))
        return deleted

    async def health_check(self) -> bool:
        try:
            return await self._redis.ping()
        except (redis.ConnectionError, redis.TimeoutError):
            return False

    async def close(self) -> None:
        """Close the Redis connection pool."""
        await self._redis.close()
```

### Cache Integration with Hybrid Search

```python
# rag/hybrid_search.py (modification pattern)
import json

from app.rag.freshness import FreshnessCategory
from app.services.cache import CacheKeyBuilder, get_ttl_for_category

class HybridSearchService:
    def __init__(self, vector_store, cache=None):
        self._vector_store = vector_store
        self._cache = cache  # CacheProtocol | None

    async def search(
        self,
        query: str,
        filters: dict,
        category: FreshnessCategory = FreshnessCategory.PRICE,
        limit: int = 10,
    ) -> list:
        # Check cache first
        if self._cache:
            cache_key = CacheKeyBuilder.build_search_key(query, filters)
            cached = await self._cache.get(cache_key)
            if cached is not None:
                return json.loads(cached)

        # Cache miss — query Qdrant
        results = await self._vector_store.search(query, filters=filters, limit=limit)

        # Store in cache with category-appropriate TTL
        if self._cache and results:
            cache_key = CacheKeyBuilder.build_search_key(query, filters)
            ttl = get_ttl_for_category(category)
            await self._cache.set(cache_key, json.dumps([r.dict() for r in results]), ttl_seconds=ttl)

        return results
```

### Docker Compose Redis Service

```yaml
# docker-compose.full.yml (add to services)
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  command: redis-server --appendonly yes
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 3
  restart: unless-stopped

# Add to volumes section:
# redis_data:
```

### Configuration Addition

```python
# core/config.py (add to Settings class)
redis_url: str = Field(default="redis://localhost:6379/0", env="REDIS_URL")
price_freshness_days: int = Field(default=7, env="PRICE_FRESHNESS_DAYS")
description_freshness_days: int = Field(default=30, env="DESCRIPTION_FRESHNESS_DAYS")
```

### Dependency Injection Pattern

```python
# core/dependencies.py (add cache dependency)
from app.core.config import settings
from app.services.cache import RedisCache

_cache_instance: RedisCache | None = None


async def get_cache() -> RedisCache:
    """Provide a Redis cache instance. Reuses connection pool across requests."""
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = RedisCache(redis_url=settings.redis_url)
    return _cache_instance
```

### Entity Model Reference (from Story 2.1)

The `Entity` model in `models/entity.py` includes these freshness-relevant fields:

```python
class Entity(SQLModel, table=True):
    __tablename__ = "entities"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    type: str  # "hotel", "attraction", "restaurant"
    location: str
    region: str
    description: str | None = None
    pricing: dict | None = Field(default=None, sa_type=JSON)
    rating: float | None = None
    source_url: str | None = None
    ingested_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime | None = None  # Set by ETL based on category threshold
    tenant_id: str = Field(index=True, max_length=64)
```

The `ingested_at` and `expires_at` fields are the primary inputs to freshness evaluation. The `expires_at` field is set by the ETL pipeline at ingestion time (Story 2.2): `ingested_at + 7 days` for prices, `ingested_at + 30 days` for descriptions.

### Relationship to Other Stories

- **Story 2.1** (Qdrant Vector Store Setup) -- provides the `Entity` model and `VectorStoreProtocol`
- **Story 2.2** (Entity Ingestion Pipeline) -- sets `ingested_at` and `expires_at` on entities during ETL
- **Story 2.3** (Hybrid Search) -- this story adds caching to the hybrid search flow
- **Story 1.7** (SSE Streaming) -- Story 1.7 used `asyncio.Queue` for the event bus with a note that Phase 2 moves to Redis pub/sub. This story introduces Redis but focuses on caching, not pub/sub. Event bus migration to Redis is a separate concern.
- **Story 3.2** (Accommodation Matching) -- consumes freshness metadata to display freshness timestamps in results
- **Story 3.6** (Proposal) -- uses `filter_fresh()` / `filter_with_warnings()` to exclude or warn about stale data

### Logging Convention

```python
# Freshness events
logger.info("freshness.evaluated", entity_id=entity_id, status="stale", category="price", days_overdue=3)
logger.warning("freshness.stale_entities_included", stale_count=2, total_returned=5, category="price")

# Cache events
logger.debug("cache.hit", key=cache_key)
logger.debug("cache.miss", key=cache_key)
logger.debug("cache.set", key=cache_key, ttl=604800)
logger.info("cache.invalidate_pattern", pattern="stravel:search:*", deleted=15)
logger.warning("cache.unavailable", operation="get", error="Connection refused")
```

### File Structure

```
backend/app/
├── rag/
│   ├── freshness.py              # NEW -- freshness evaluation, FreshnessChecker, schemas
│   ├── hybrid_search.py          # MODIFIED -- integrate cache-aside pattern
│   ├── vector_store.py           # MODIFIED -- attach FreshnessInfo to search results
│   └── tests/
│       └── test_freshness.py     # NEW -- freshness unit tests
├── services/
│   ├── cache.py                  # NEW -- RedisCache, CacheKeyBuilder, CacheProtocol impl
│   └── tests/
│       └── test_cache.py         # NEW -- cache unit + integration tests
├── agents/
│   └── protocols.py              # MODIFIED -- add CacheProtocol
├── core/
│   ├── config.py                 # MODIFIED -- add redis_url, freshness settings
│   └── dependencies.py           # MODIFIED -- add get_cache dependency
├── docker-compose.full.yml       # MODIFIED -- add Redis service
├── .env.example                  # MODIFIED -- add REDIS_URL
└── pyproject.toml                # MODIFIED -- add redis dependency
```

### Anti-Patterns -- DO NOT

- **DO NOT use `KEYS` command in Redis** -- use `SCAN` for pattern-based operations (KEYS blocks the Redis event loop in production)
- **DO NOT cache stale/expired entities** -- only cache search results that pass freshness filtering
- **DO NOT fail requests when Redis is down** -- graceful degradation is mandatory. Cache is an optimization, not a requirement
- **DO NOT use synchronous Redis client** -- use `redis.asyncio` for all operations
- **DO NOT hardcode TTL values** -- derive from `PRICE_FRESHNESS_DAYS` and `DESCRIPTION_FRESHNESS_DAYS` constants
- **DO NOT use stdlib `logging`** -- use `structlog` only
- **DO NOT import Redis directly in agent code** -- use `CacheProtocol` via dependency injection
- **DO NOT mix freshness with ETL concerns** -- this story evaluates freshness, not re-ingestion. Re-ingestion triggers belong to the ETL pipeline (Story 2.2)
- **DO NOT store Python objects in Redis** -- serialize to JSON strings only
- **DO NOT skip tenant_id in cache keys for B2B mode** -- if multi-tenant caching is needed later, the key builder should accommodate `tenant_id`. For now, search caching is tenant-agnostic since entity data is shared

### References

- [Source: architecture.md -- Data Architecture: Redis with TTL, 7 days for prices, 30 days for descriptions]
- [Source: architecture.md -- Data Store Ownership: Redis owned by services/cache.py]
- [Source: architecture.md -- Cross-Cutting Concerns: Freshness Management]
- [Source: architecture.md -- Implementation Patterns: Naming Patterns, Constants as UPPER_SNAKE]
- [Source: architecture.md -- Progressive Infrastructure Plan: Phase 2 introduces Redis]
- [Source: architecture.md -- Confirmed Tech Stack: Redis for caching, real-time streaming, LangGraph checkpoints]
- [Source: epics.md -- Story 2.4 Acceptance Criteria]
- [Source: epics.md -- FR-31: Freshness Tracking, NFR-6: No expired entity without staleness warning]
- [Source: epics.md -- Story 2.2: expires_at defaults (7 days prices, 30 days descriptions)]
- [Source: project-context.md -- Phase 2 introduces Qdrant + Redis]
- [Source: project-context.md -- Protocol interfaces at all service boundaries]

## Dev Agent Record

### Agent Model Used

_(to be filled by implementing agent)_

### Debug Log References

_(to be filled during implementation)_

### Completion Notes List

_(to be filled on completion)_

### Change Log

_(to be filled during implementation)_

### File List

_(to be filled on completion)_
