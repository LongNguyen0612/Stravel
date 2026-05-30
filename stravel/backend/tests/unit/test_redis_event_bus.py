"""
Unit tests for story 9-2: Redis Event Buffer with Last-Event-ID Replay (ARCH-2).

All tests mock the Redis client — no real Redis required.
"""
import asyncio
import json

import pytest

import app.services.event_bus as eb
from app.services.event_bus import (
    cleanup_session,
    clear_session_buffer,
    publish_event,
    subscribe,
)

# ── Fixtures ──────────────────────────────────────────────────────────────────

class MockRedisClient:
    """Minimal async mock for redis.asyncio client."""

    def __init__(self):
        self._lists: dict[str, list[str]] = {}
        self.rpush_calls: list = []
        self.expire_calls: list = []
        self.delete_calls: list = []
        self.lrange_calls: list = []

    async def rpush(self, key: str, value: str) -> int:
        self.rpush_calls.append((key, value))
        self._lists.setdefault(key, []).append(value)
        return len(self._lists[key])

    async def expire(self, key: str, ttl: int) -> bool:
        self.expire_calls.append((key, ttl))
        return True

    async def lrange(self, key: str, start: int, end: int) -> list[str]:
        self.lrange_calls.append((key, start, end))
        items = self._lists.get(key, [])
        if end == -1:
            return items[start:]
        return items[start:end + 1]

    async def delete(self, key: str) -> int:
        self.delete_calls.append(key)
        self._lists.pop(key, None)
        return 1

    async def ping(self) -> bool:
        return True


@pytest.fixture(autouse=True)
def redis_mock(monkeypatch):
    """Replace _redis_client with a MockRedisClient for every test in this module."""
    mock = MockRedisClient()
    monkeypatch.setattr(eb, "_redis_client", mock)
    yield mock
    # monkeypatch automatically restores _redis_client at fixture teardown


# ── AC1: Redis write on publish ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_publish_writes_to_redis(redis_mock):
    session_id = "redis-ac1-1"
    await publish_event(session_id, "stage.change", {"stage": "profiling"})

    key = f"sse:session:{session_id}"
    assert len(redis_mock.rpush_calls) == 1
    assert redis_mock.rpush_calls[0][0] == key
    stored = json.loads(redis_mock.rpush_calls[0][1])
    assert stored["event"] == "stage.change"
    assert stored["sse_id"] == 1

    # TTL must be reset on every write
    assert len(redis_mock.expire_calls) == 1
    assert redis_mock.expire_calls[0] == (key, 7200)
    cleanup_session(session_id)


@pytest.mark.asyncio
async def test_publish_multiple_events_all_written_to_redis(redis_mock):
    session_id = "redis-ac1-2"
    for i in range(3):
        await publish_event(session_id, "stage.change", {"n": i})

    assert len(redis_mock.rpush_calls) == 3
    assert len(redis_mock.expire_calls) == 3
    sse_ids = [json.loads(c[1])["sse_id"] for c in redis_mock.rpush_calls]
    assert sse_ids == [1, 2, 3]
    cleanup_session(session_id)


# ── AC2: Last-Event-ID replay from Redis ──────────────────────────────────────

@pytest.mark.asyncio
async def test_subscribe_replays_from_redis(redis_mock):
    """subscribe() pre-loads events from Redis when Redis returns stored events."""
    session_id = "redis-ac2-1"

    # Manually populate the mock Redis list (simulates events from a previous connection)
    key = f"sse:session:{session_id}"
    events = [
        {"sse_id": 1, "event": "stage.change", "data": '{"stage": "profiling"}'},
        {"sse_id": 2, "event": "stage.change", "data": '{"stage": "calculating"}'},
        {"sse_id": 3, "event": "stage.change", "data": '{"stage": "proposing"}'},
    ]
    for e in events:
        redis_mock._lists.setdefault(key, []).append(json.dumps(e))
    # Also set _session_counters so max_sse_id snapshot is correct
    eb._session_counters[session_id] = 3

    queue = await subscribe(session_id, last_event_id=None)
    replayed = [queue.get_nowait()["sse_id"] for _ in range(3)]
    assert replayed == [1, 2, 3]
    cleanup_session(session_id)


@pytest.mark.asyncio
async def test_subscribe_replays_after_last_event_id(redis_mock):
    """Last-Event-ID: 2 → only events with sse_id > 2 are replayed."""
    session_id = "redis-ac2-2"
    key = f"sse:session:{session_id}"
    events = [{"sse_id": i, "event": "e", "data": "{}"} for i in range(1, 6)]
    for e in events:
        redis_mock._lists.setdefault(key, []).append(json.dumps(e))
    eb._session_counters[session_id] = 5

    queue = await subscribe(session_id, last_event_id=2)
    replayed = []
    while not queue.empty():
        replayed.append(queue.get_nowait()["sse_id"])
    assert replayed == [3, 4, 5]
    cleanup_session(session_id)


# ── AC3: Fresh connection / TTL-expired buffer ────────────────────────────────

@pytest.mark.asyncio
async def test_subscribe_fresh_connection_empty_redis(redis_mock):
    """No Last-Event-ID, empty Redis → no replay, queue starts empty."""
    session_id = "redis-ac3-1"
    # Redis has no data for this session
    queue = await subscribe(session_id, last_event_id=None)
    assert queue.empty()
    cleanup_session(session_id)


# ── AC4: Redis unavailable fallback ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_subscribe_redis_unavailable_falls_back_to_memory(monkeypatch):
    """When Redis is unavailable (_get_redis returns None), fall back to in-memory buffer."""
    session_id = "redis-ac4-1"

    # Make Redis unavailable
    async def _no_redis():
        return None

    monkeypatch.setattr(eb, "_get_redis", _no_redis)

    # Pre-populate in-memory buffer
    for i in range(3):
        eb._session_counters[session_id] += 1
        event = {"sse_id": eb._session_counters[session_id], "event": "e", "data": "{}"}
        eb._event_buffer[session_id].append(event)

    queue = await subscribe(session_id, last_event_id=None)
    replayed = [queue.get_nowait()["sse_id"] for _ in range(3)]
    assert replayed == [1, 2, 3]
    cleanup_session(session_id)


@pytest.mark.asyncio
async def test_redis_lrange_failure_logs_warning_and_falls_back(redis_mock):
    """Redis lrange failure → warning logged, falls back to in-memory."""
    import structlog.testing

    session_id = "redis-ac4-2"

    async def _fail(*args, **kwargs):
        raise ConnectionError("Redis refused")
    redis_mock.lrange = _fail

    for i in range(2):
        eb._session_counters[session_id] += 1
        event = {"sse_id": eb._session_counters[session_id], "event": "e", "data": "{}"}
        eb._event_buffer[session_id].append(event)

    with structlog.testing.capture_logs() as cap_logs:
        queue = await subscribe(session_id, last_event_id=None)

    warning_events = [entry for entry in cap_logs if entry.get("log_level") == "warning"]
    assert any("redis_buffer_unavailable" in str(entry) for entry in warning_events), \
        f"Expected redis_buffer_unavailable warning, got: {cap_logs}"

    assert not queue.empty()
    cleanup_session(session_id)


# ── AC5: Atomic subscribe — no event lost (D3 fix) ────────────────────────────

@pytest.mark.asyncio
async def test_subscribe_atomic_gap_fill(redis_mock):
    """
    Events published after the max_sse_id snapshot (during Redis await) must be
    captured via gap-fill from in-memory buffer, not lost.

    Simulates: snapshot at max_sse_id=2, Redis returns only events 1+2,
    event 3 is in-memory only (published during the Redis await).
    """
    session_id = "redis-ac5-1"
    key = f"sse:session:{session_id}"

    # Simulate: events 1 and 2 are in Redis (published before connect)
    for i in [1, 2]:
        event = {"sse_id": i, "event": "e", "data": "{}"}
        redis_mock._lists.setdefault(key, []).append(json.dumps(event))
        eb._event_buffer[session_id].append(event)
        eb._session_counters[session_id] = i

    # Snapshot will be max_sse_id=2
    # Simulate event 3 published DURING Redis await → in-memory only, sse_id > snapshot
    event3 = {"sse_id": 3, "event": "e", "data": "{}"}
    eb._event_buffer[session_id].append(event3)
    eb._session_counters[session_id] = 3
    # Redis does NOT have event 3 (fire-and-forget write hasn't run yet in this simulation)

    # Override lrange to only return items up to index 1 (events 1 and 2, matching max_sse_id=2)
    original_lrange = redis_mock.lrange
    async def _lrange_snapshot(key, start, end):
        # end = max_sse_id - 1 = 1 for the snapshot read
        return await original_lrange(key, start, end)
    redis_mock.lrange = _lrange_snapshot

    # Subscribe with snapshot max_sse_id=2 (manually set counter back)
    # We need to force max_sse_id=2 for the snapshot; current counter is 3
    # Temporarily reduce counter to 2 to simulate the snapshot moment
    eb._session_counters[session_id] = 2

    # But gap_events requires sse_id > 2 in _event_buffer, so event3 is the gap
    queue = await subscribe(session_id, last_event_id=None)

    # Restore counter
    eb._session_counters[session_id] = 3

    all_ids = []
    while not queue.empty():
        all_ids.append(queue.get_nowait()["sse_id"])

    # Must have all 3 events: 1+2 from Redis, 3 from gap-fill
    assert 3 in all_ids, f"Event 3 (gap) must be in queue, got: {all_ids}"
    assert sorted(all_ids) == [1, 2, 3]
    cleanup_session(session_id)


# ── AC6: clear_session_buffer deletes Redis key ───────────────────────────────

@pytest.mark.asyncio
async def test_clear_buffer_deletes_redis_key(redis_mock):
    session_id = "redis-ac6-1"
    key = f"sse:session:{session_id}"
    redis_mock._lists[key] = ['{"sse_id": 1, "event": "e", "data": "{}"}']
    eb._event_buffer[session_id] = [{"sse_id": 1}]
    eb._session_counters[session_id] = 1

    await clear_session_buffer(session_id)
    # Allow the create_task to run
    await asyncio.sleep(0)

    assert key in redis_mock.delete_calls or key not in redis_mock._lists
    assert eb._event_buffer.get(session_id) is None
    assert eb._session_counters.get(session_id) is None
    cleanup_session(session_id)


@pytest.mark.asyncio
async def test_clear_buffer_resets_in_memory(redis_mock):
    """clear_session_buffer clears both _event_buffer and _session_counters (existing behavior)."""
    session_id = "redis-ac6-2"
    await publish_event(session_id, "stage.change", {"stage": "a"})
    await publish_event(session_id, "stage.change", {"stage": "b"})
    assert eb._session_counters[session_id] == 2

    await clear_session_buffer(session_id)

    assert eb._event_buffer.get(session_id) is None
    assert eb._session_counters.get(session_id) is None

    # After clear, new events restart counter at 1
    await publish_event(session_id, "stage.change", {"stage": "c"})
    assert eb._session_counters[session_id] == 1
    cleanup_session(session_id)


# ── Keepalive events — naturally excluded (architecture test) ─────────────────

@pytest.mark.asyncio
async def test_keepalives_not_emitted_through_publish_event(redis_mock):
    """
    Keepalives are yielded directly by streaming.py on timeout — they never call
    publish_event. This test confirms publish_event has no keepalive filtering logic
    by verifying ordinary events are stored (i.e., the path exists) while a keepalive
    event name would only appear if explicitly passed.
    """
    session_id = "redis-kl-1"
    await publish_event(session_id, "stage.change", {"stage": "profiling"})
    assert len(redis_mock.rpush_calls) == 1
    # keepalive is NOT in any rpush call
    assert not any("keepalive" in c[1] for c in redis_mock.rpush_calls)
    cleanup_session(session_id)


