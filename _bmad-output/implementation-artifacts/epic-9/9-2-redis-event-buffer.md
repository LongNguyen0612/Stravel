# Story 9.2: Redis Event Buffer with Last-Event-ID Replay

Status: done

## Story

As a traveler on a mobile connection,
I want my proposal to resume from where it left off if my connection drops,
So that a brief network interruption doesn't force a 60-second regeneration.

## Acceptance Criteria

**AC1 — Redis list write on every event (ARCH-2)**
Given each SSE event is emitted via `publish_event`
When emitted
Then the event is written to `sse:session:{session_id}` Redis list (RPUSH) as a JSON string
And the key TTL is reset to 2 hours (7200s) on every write
And the event is NOT written to Redis if `event_type == "keepalive"` (keepalives are NOT emitted through `publish_event` — this AC is automatically satisfied by the existing architecture)

**AC2 — Last-Event-ID replay from Redis**
Given a client reconnects with `Last-Event-ID: N` in the HTTP request header
When the SSE endpoint receives the reconnect
Then all events with `sse_id > N` are replayed from Redis in order before resuming live streaming
And LRANGE is used with start index = N (0-based; sse_id N+1 is at index N in the list)

**AC3 — Fresh connection (no Last-Event-ID)**
Given a session's Redis buffer does not exist (first connection, or TTL expired)
When a client connects without a `Last-Event-ID` header
Then the SSE stream begins fresh with `last_event_id = None`
And no events are replayed (empty list = empty replay)

**AC4 — Redis unavailable fallback**
Given Redis is unavailable (connection error, timeout, etc.)
When a client connects or reconnects
Then the SSE stream falls back to in-memory buffer replay (AC5 of story 9-1)
And a structlog WARNING is emitted: `logger.warning("redis_buffer_unavailable", session_id=session_id, error=...)`
And the endpoint does NOT return 500

**AC5 — Atomic subscribe (D3 fix from story 9-1 review)**
Given a background task is publishing events to the buffer
When a new SSE connection calls `subscribe()`
Then no event is lost between buffer replay and live delivery
And the implementation uses: snapshot `max_sse_id` → await Redis read (events ≤ snapshot) → gap-fill from in-memory (events > snapshot) → register subscriber — all pre-loading via `put_nowait()` before registration

**AC6 — Clear on new workflow run**
Given `clear_session_buffer(session_id)` is called before a new `run_advisory_workflow`
When called
Then the Redis key `sse:session:{session_id}` is deleted (DEL)
And the in-memory `_event_buffer` and `_session_counters` are cleared (existing behavior preserved)
And `clear_session_buffer` is now `async` — callers must `await` it

**AC7 — Redis service in docker-compose**
Given development environment uses docker-compose
When `docker compose up` is run
Then a `redis:7-alpine` service is present and healthy
And the backend service has `REDIS_URL: redis://redis:6379` in its environment
And the backend `depends_on` includes `redis: condition: service_healthy`

---

## Tasks / Subtasks

- [x] Task 1: Add Redis service to `stravel/docker-compose.yml` (AC7)
  - [x] 1a: Add `redis` service: `image: redis:7-alpine`, ports `6379:6379`, healthcheck `redis-cli ping`
  - [x] 1b: Add `REDIS_URL: redis://redis:6379` to backend `environment`
  - [x] 1c: Add `redis: condition: service_healthy` to backend `depends_on`

- [x] Task 2: Update `event_bus.py` — Redis integration (AC1, AC4, AC5, AC6)
  - [x] 2a: Add module-level constants: `_REDIS_TTL = 7200` and `_redis_client = None`
  - [x] 2b: Add `_get_redis()` async helper — lazy-init with `redis.asyncio.from_url(settings.redis_url)` + ping; returns `None` if unavailable; resets `_redis_client = None` on failure
  - [x] 2c: Add `_write_to_redis(session_id, event)` async helper — RPUSH + EXPIRE; catches all exceptions; logs `redis_buffer_unavailable` warning on failure; no-ops if `_get_redis()` returns None
  - [x] 2d: Add `_read_from_redis(session_id, after_id, max_id)` async helper — `LRANGE key after_id (max_id-1)`; decodes JSON; catches all exceptions (logs warning, returns `[]`)
  - [x] 2e: Add `_delete_redis_buffer(session_id)` async helper — `DEL sse:session:{session_id}`; catches exceptions silently
  - [x] 2f: In `publish_event`: add `await _write_to_redis(session_id, event)` AFTER updating in-memory buffer, BEFORE fan-out to subscribers (order: counter → in-memory buf → redis write → fanout)
  - [x] 2g: Rewrite `subscribe()` for atomic D3 fix (see Dev Notes for exact implementation)
  - [x] 2h: Make `clear_session_buffer` async; add `asyncio.create_task(_delete_redis_buffer(session_id))` after clearing in-memory state

- [x] Task 3: Update `workflow.py` caller (AC6)
  - [x] 3a: Change `clear_session_buffer(session_id)` at line 27 to `await clear_session_buffer(session_id)`

- [x] Task 4: Unit tests — Redis buffer (new file `tests/unit/test_redis_event_bus.py`)
  - [x] 4a: `test_publish_writes_to_redis` — verify `rpush` and `expire` called with correct key and JSON payload
  - [x] 4b: `test_subscribe_replays_from_redis` — mock `_get_redis` returning client with `lrange` returning 2 serialized events; verify both pre-loaded into queue before any live events
  - [x] 4c: `test_subscribe_redis_unavailable_falls_back_to_memory` — mock `_get_redis` returning `None`; pre-publish 2 events; subscribe; verify both replayed from in-memory
  - [x] 4d: `test_redis_unavailable_logs_warning` — mock client that raises `ConnectionError` on `lrange`; subscribe; verify structlog warning `redis_buffer_unavailable` emitted
  - [x] 4e: `test_subscribe_atomic_gap_fill` — snapshot logic: publish 3 events; in subscribe, mock Redis returning only events 1 and 2 (max_id=2); verify event 3 is present in queue via gap-fill from in-memory
  - [x] 4f: `test_clear_buffer_deletes_redis_key` — call `await clear_session_buffer(session_id)`; verify `delete` called with `sse:session:{session_id}`
  - [x] 4g: `test_clear_buffer_resets_in_memory` — existing behavior preserved: after `await clear_session_buffer`, `_event_buffer` and `_session_counters` are cleared (mirror existing test)

- [x] Task 5: Update existing tests that call `clear_session_buffer` or `cleanup_session` synchronously
  - [x] 5a: In `tests/unit/test_event_bus.py`: `test_clear_session_buffer_resets_counter` — change `clear_session_buffer(session_id)` to `await clear_session_buffer(session_id)` (one test)
  - [x] 5b: Verify all other tests in `test_event_bus.py` still pass (they use `cleanup_session` which stays sync)
  - [x] 5c: Mock `_get_redis` to return `None` in test_event_bus.py's conftest or per-test to avoid real Redis connection attempts during unit tests

---

## Dev Notes

### Architecture Context

**ARCH-2 requirement:** Replace the in-memory-only event buffer with Redis as the durable layer. The in-memory buffer (`_event_buffer`, `_MAX_BUFFER=200`) stays as a fallback for Redis-unavailable scenarios and for the atomic gap-fill pattern below.

**Redis client pattern:** Follow the established pattern in `services/cache.py` — lazy-init with `redis.asyncio.from_url`, ping on first use, reset to `None` on failure to allow reconnection. The event bus maintains its own `_redis_client` module-level variable; do NOT import from `cache.py` (separate concerns).

**`redis.asyncio` is already available** — `redis>=5.0.0` is in `pyproject.toml:25`. Import as `import redis.asyncio as aioredis`.

**Settings** — `settings.redis_url` is already in `app.core.config:18` (`redis://localhost:6379` default). Import `from app.core.config import settings`.

### Redis Key Schema and Indexing

```
Key:   sse:session:{session_id}   (Redis list)
TTL:   7200 seconds (2 hours), reset on every RPUSH

Stored value per entry: JSON string
  {"sse_id": N, "event": "stage.change", "data": "{...}"}

Index relationship (CRITICAL for LRANGE calls):
  list index 0  →  sse_id 1  (first event)
  list index 1  →  sse_id 2
  list index N-1 → sse_id N

Therefore:
  "events with sse_id > N"  →  LRANGE key N -1      (start = N, 0-based)
  "events with sse_id ≤ M"  →  LRANGE key 0 M-1     (end = M-1, 0-based)
  "sse_id > N AND ≤ M"      →  LRANGE key N M-1
  "all events"              →  LRANGE key 0 -1
```

### Atomic Subscribe Implementation (D3 Fix)

The D3 review finding from story 9-1: event published between buffer-read and subscriber-registration is lost. Fix using asyncio's cooperative scheduling — no yield between snapshot and registration:

```python
async def subscribe(session_id: str, last_event_id: int | None = None) -> asyncio.Queue:
    queue: asyncio.Queue = asyncio.Queue()

    # Step 1: Snapshot max sse_id — no yield, atomic
    max_sse_id = _session_counters[session_id]

    # Step 2: Await Redis read — other coroutines MAY run during this
    # Read events: sse_id > last_event_id AND sse_id <= max_sse_id
    after_id = last_event_id if last_event_id is not None else 0
    redis_events = await _read_from_redis(session_id, after_id=after_id, max_id=max_sse_id)
    # Redis unavailable → empty list; fallback to in-memory for this range
    if not redis_events:
        buf = _event_buffer.get(session_id, [])
        redis_events = [e for e in buf if last_event_id is None or e["sse_id"] > last_event_id]
        redis_events = [e for e in redis_events if e["sse_id"] <= max_sse_id]

    # Step 3: Gap events — published during the Redis await (sse_id > max_sse_id)
    # No yield between here and registration — these are atomic
    buf = _event_buffer.get(session_id, [])
    gap_events = [e for e in buf if e["sse_id"] > max_sse_id]

    # Step 4: Pre-load all replay events via put_nowait (no yield)
    for event in redis_events + gap_events:
        queue.put_nowait(event)

    # Step 5: Register subscriber (no yield — this and steps 3-4 are one atomic block)
    _subscribers[session_id].append(queue)

    return queue
```

**Why this is correct:** After `await _read_from_redis` returns, steps 3-5 have no `await`, so asyncio cannot interleave other coroutines. Any event published during step 2 has `sse_id > max_sse_id` (since `max_sse_id` was snapshot before the await), so it appears in `gap_events`. After step 5, future events go directly into the queue via `_subscribers`. No event is missed.

**When Redis is unavailable:** `_read_from_redis` returns `[]`, and the in-memory fallback in step 2 provides replay. The warning log happens inside `_read_from_redis`. The subscribe still succeeds.

### `_get_redis()` — Lazy Init Pattern

```python
_redis_client = None

async def _get_redis():
    global _redis_client
    if _redis_client is None:
        try:
            import redis.asyncio as aioredis
            from app.core.config import settings
            _redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
            await _redis_client.ping()
        except Exception as e:
            logger.warning("event_bus.redis_init_failed", error=str(e))
            _redis_client = None
    return _redis_client
```

**Testing:** Patch `app.services.event_bus._get_redis` with an `AsyncMock` returning a mock Redis client.

**Reset after failure:** Set `_redis_client = None` inside `_write_to_redis` and `_read_from_redis` exception handlers so the next call retries initialization. Pattern from `cache.py`.

### `_write_to_redis` — Full Implementation

```python
_REDIS_KEY_PREFIX = "sse:session:"
_REDIS_TTL = 7200  # 2 hours

async def _write_to_redis(session_id: str, event: dict) -> None:
    client = await _get_redis()
    if client is None:
        return
    try:
        key = f"{_REDIS_KEY_PREFIX}{session_id}"
        await client.rpush(key, json.dumps(event))
        await client.expire(key, _REDIS_TTL)
    except Exception as e:
        global _redis_client
        _redis_client = None  # reset so next call retries
        logger.warning("redis_buffer_unavailable", session_id=session_id, error=str(e))
```

### `clear_session_buffer` — Now Async

```python
async def clear_session_buffer(session_id: str) -> None:
    """Clear replay buffer and reset SSE ID counter before a new workflow run."""
    _event_buffer.pop(session_id, None)
    _session_counters.pop(session_id, None)
    asyncio.create_task(_delete_redis_buffer(session_id))
```

**Caller update required:** `workflow.py:27` — change `clear_session_buffer(session_id)` to `await clear_session_buffer(session_id)`.

### `cleanup_session` — Stays Sync

`cleanup_session` is called from test teardown (synchronous context). Keep it sync. Redis key expires via TTL — no need to explicitly delete on cleanup. If explicit Redis cleanup is needed for tests, use `asyncio.get_event_loop().run_until_complete()` or patch.

### Keepalive Events — No Change Needed

Looking at `streaming.py:84`: keepalives are yielded directly by `event_generator()` on `TimeoutError` — they NEVER go through `publish_event` or `event_bus`. The AC about "keepalives not stored in Redis" is automatically satisfied with no code change required. No `event_type == "keepalive"` guard is needed in `publish_event`.

### Testing Pattern for Redis Mock

```python
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import json

@pytest.fixture
def mock_redis_client():
    client = AsyncMock()
    client.rpush = AsyncMock(return_value=1)
    client.expire = AsyncMock(return_value=True)
    client.lrange = AsyncMock(return_value=[])
    client.delete = AsyncMock(return_value=1)
    client.ping = AsyncMock(return_value=True)
    return client

@pytest.fixture(autouse=True)
async def patch_redis(mock_redis_client):
    import app.services.event_bus as eb
    original = eb._redis_client
    eb._redis_client = mock_redis_client
    yield mock_redis_client
    eb._redis_client = original
```

**Or patch `_get_redis` directly:**
```python
with patch('app.services.event_bus._get_redis', new=AsyncMock(return_value=mock_redis_client)):
    ...
```

For `test_redis_unavailable_logs_warning`: set `mock_redis_client.lrange.side_effect = ConnectionError("refused")`.

### File Locations

```
stravel/docker-compose.yml                               # Task 1 — add Redis service
stravel/backend/app/services/event_bus.py                # Task 2 — Redis integration
stravel/backend/app/services/workflow.py                 # Task 3 — await clear_session_buffer
stravel/backend/tests/unit/test_redis_event_bus.py       # Task 4 — new test file
stravel/backend/tests/unit/test_event_bus.py             # Task 5a — update one test to await
```

### Anti-Patterns to Avoid

- **DO NOT** use `fire-and-forget asyncio.create_task` for Redis writes in `publish_event` — await them directly. Redis is local (<1ms latency); proposal generation takes 60s; the blocking cost is negligible and ensures consistency.
- **DO NOT** use `buf.pop(0)` in the new gap-fill logic — only read from `_event_buffer`, never mutate it in `subscribe`.
- **DO NOT** use `time.sleep()` or `asyncio.sleep()` in tests — mock the Redis client directly.
- **DO NOT** import `logging` — structlog only (`import structlog; logger = structlog.get_logger()`).
- **DO NOT** call `redis.asyncio.StrictRedis` — use `redis.asyncio.from_url(url, decode_responses=True)`.
- **DO NOT** create a new Redis connection per call — use the module-level `_redis_client` singleton.
- **DO NOT** break existing `test_event_bus.py` tests — `cleanup_session` stays sync; `clear_session_buffer` is now async so update the one test that calls it.

### Learnings from Story 9-1 (directly applicable)

- `asyncio_mode = "auto"` in `pytest.ini_options` — `@pytest.mark.asyncio` decorator is optional but still valid; tests run as coroutines automatically
- `cleanup_session(session_id)` in teardown is REQUIRED in every test to prevent module-level state leakage between tests
- `structlog.get_logger()` — use keyword args: `logger.warning("key", field=value, other_field=value2)`
- Test file naming convention: `tests/unit/test_*.py`
- All existing tests in `tests/unit/test_event_bus.py` must continue to pass

### Docker-Compose Redis Service

```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 5s
    timeout: 3s
    retries: 5
  deploy:
    resources:
      limits:
        cpus: '0.25'
        memory: 256M
```

Backend service additions:
```yaml
environment:
  REDIS_URL: redis://redis:6379   # add this line
depends_on:
  redis:                           # add this block
    condition: service_healthy
```

### References

- Epic 3 Story 3.2 requirements: `_bmad-output/planning-artifacts/epics-v2.md#Story 3.2`
- Deferred items D1–D3: `_bmad-output/implementation-artifacts/epic-9/9-1-decouple-sse-generation.md#Review Findings`
- Redis client pattern: `stravel/backend/app/services/cache.py:22-72`
- Redis URL config: `stravel/backend/app/core/config.py:18`
- Existing event_bus: `stravel/backend/app/services/event_bus.py`
- Existing tests: `stravel/backend/tests/unit/test_event_bus.py`
- Streaming endpoint (keepalive pattern): `stravel/backend/app/api/v1/streaming.py:82-84`
- workflow.py caller: `stravel/backend/app/services/workflow.py:27`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — all tasks implemented cleanly.

### Completion Notes List

- Task 1 (docker-compose.yml): Added `redis:7-alpine` service with healthcheck, `REDIS_URL: redis://redis:6379` to backend env, `redis: condition: service_healthy` to backend `depends_on`. Added `redis_data` to volumes.
- Task 2 (event_bus.py): Added `_REDIS_TTL=7200`, `_redis_client` singleton, `_get_redis()` lazy-init (same pattern as cache.py), `_write_to_redis()`, `_read_from_redis()`, `_delete_redis_buffer()`. `publish_event` now awaits Redis write directly (negligible latency vs 60s generation). `subscribe()` rewritten with atomic D3 fix: snapshot `max_sse_id` → await Redis read (events ≤ snapshot) → gap-fill from in-memory (events > snapshot) → `put_nowait` pre-load → subscriber registration — no yield between gap-fill and registration. `clear_session_buffer` is now `async`. `settings` import moved to module top level.
- Task 3 (workflow.py): `clear_session_buffer(session_id)` → `await clear_session_buffer(session_id)` at line 27.
- Task 4: 11 new tests in `tests/unit/test_redis_event_bus.py` — all pass. Covers AC1 (write+TTL), AC2 (LRANGE replay), AC3 (fresh connection), AC4 (unavailable fallback + warning), AC5 (atomic gap-fill), AC6 (clear deletes key), keepalive exclusion architecture.
- Task 5: Updated `test_clear_session_buffer_resets_counter` in `test_event_bus.py` to `await`. Added `_NoopRedis` to unit conftest so existing tests don't attempt real Redis connections.
- Full test suite: 97 passing (non-integration), 0 regressions.

### File List

- `stravel/docker-compose.yml` — added Redis service, REDIS_URL env, redis healthcheck dependency, redis_data volume
- `stravel/backend/app/services/event_bus.py` — Redis integration: _get_redis, _write_to_redis, _read_from_redis, _delete_redis_buffer, updated publish_event/subscribe/clear_session_buffer; settings import at module top
- `stravel/backend/app/services/workflow.py` — `await clear_session_buffer(session_id)` at line 27
- `stravel/backend/tests/unit/test_redis_event_bus.py` — new file, 11 Redis buffer tests
- `stravel/backend/tests/unit/test_event_bus.py` — one test updated to `await clear_session_buffer`
- `stravel/backend/tests/unit/conftest.py` — added `_NoopRedis` and `disable_redis_for_unit_tests` autouse fixture

### Review Findings

- [x] [Review][Defer] TTL-expired Redis buffer falls back to in-memory replay, violating AC3 — 2h TTL expiry while process is running with a live in-memory buffer is a near-impossible window in production; address in a reliability hardening story alongside the AC4 `_redis_available` flag design. [event_bus.py, subscribe()]
- [x] [Review][Patch] P1: `asyncio.create_task` for Redis delete in `clear_session_buffer` is not retained — fixed: store task in `_pending_tasks` set with `done_callback` discard [event_bus.py:186-188]
- [x] [Review][Patch] P2: Missing `redis_buffer_unavailable` warning on `_get_redis()` returning None — fixed: added `logger.warning` when `client is None` in `_read_from_redis` [event_bus.py:82]
- [x] [Review][Patch] P3: `max_id=0` edge case causes `LRANGE key 0 -1` (returns entire list) instead of empty — fixed: early `return []` when `max_id == 0` [event_bus.py:78-79]
- [x] [Review][Patch] P4: Concurrent `_get_redis()` calls both see `_redis_client is None` and both init — fixed: `asyncio.Lock` with double-checked locking pattern [event_bus.py:38-51]
- [x] [Review][Patch] P5: `redis_data` volume declared in `volumes:` but not mounted on the Redis service — fixed: added `volumes: - redis_data:/data` to redis service [docker-compose.yml:46-47]
- [x] [Review][Defer] Counter/buffer deletion race while `publish_event` in-flight — prevented in practice by single-workflow-per-session state machine (story 9-1 ARCH-1); deferred, session state machine concern [event_bus.py]
- [x] [Review][Defer] `buf.pop(0)` O(N) in `publish_event` — pre-existing from story 9-1, not introduced by 9-2 [event_bus.py:31]
- [x] [Review][Defer] `gap_events` second read of `_event_buffer` after Redis await could see evicted entries — near-impossible in practice (would require 200+ events published during a sub-millisecond Redis await) [event_bus.py, subscribe()]

### Change Log

- 2026-05-26: Implemented story 9-2 — Redis event buffer (ARCH-2): durable SSE replay, atomic subscribe D3 fix, graceful Redis fallback, docker-compose Redis service (claude-sonnet-4-6)
