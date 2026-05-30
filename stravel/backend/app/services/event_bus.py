import asyncio
import json
import uuid as uuid_lib
from collections import defaultdict
from collections.abc import Awaitable, Callable
from typing import Any

import structlog

from app.core.config import settings

logger = structlog.get_logger()

# session_id → list of per-subscriber queues (fanout: each subscriber gets every event)
_subscribers: dict[str, list[asyncio.Queue]] = defaultdict(list)

# In-memory replay buffer: fallback when Redis is unavailable; last MAX_BUFFER events per session
_event_buffer: dict[str, list[dict]] = defaultdict(list)
_MAX_BUFFER = 200

# Monotonic SSE event IDs per session — reset on new workflow run
_session_counters: dict[str, int] = defaultdict(int)

# Clear-epoch per session — incremented each time clear_session_buffer() is called;
# captured at publish_event time so in-flight persist tasks can detect stale inserts
_session_epochs: dict[str, int] = defaultdict(int)

# Redis buffer config (ARCH-2)
_REDIS_KEY_PREFIX = "sse:session:"
_REDIS_TTL = 7200  # 2 hours
_redis_client = None  # lazy-initialized on first use
_redis_lock: asyncio.Lock | None = None  # guards concurrent lazy init (P4)

# Prevents GC from collecting fire-and-forget tasks before they complete (P1)
_pending_tasks: set[asyncio.Task] = set()

# ARCH-3 persistence hooks — registered at startup from main.py; kept None to avoid DB import here
_persist_hook: Callable[[str, int, str, dict[str, Any]], Awaitable[None]] | None = None
_clear_hook: Callable[[str], Awaitable[None]] | None = None


def register_hooks(
    persist: Callable[[str, int, str, dict[str, Any]], Awaitable[None]],
    clear: Callable[[str], Awaitable[None]],
) -> None:
    """Register DB persistence hooks; called once at application startup."""
    global _persist_hook, _clear_hook
    _persist_hook = persist
    _clear_hook = clear


async def _get_redis():
    """Lazy-init Redis client; returns None if Redis is unavailable."""
    global _redis_client, _redis_lock
    if _redis_client is not None:
        return _redis_client
    # Lock creation is synchronous — atomic in asyncio's single-threaded scheduler
    if _redis_lock is None:
        _redis_lock = asyncio.Lock()
    async with _redis_lock:
        if _redis_client is not None:  # double-check after acquiring lock
            return _redis_client
        try:
            import redis.asyncio as aioredis
            _redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
            await _redis_client.ping()
            logger.info("event_bus.redis_connected", url=settings.redis_url)
        except Exception as e:
            logger.warning("event_bus.redis_init_failed", error=str(e))
            _redis_client = None
    return _redis_client


async def _write_to_redis(session_id: str, event: dict) -> None:
    """Write a single event to the Redis list buffer; reset TTL on each write."""
    global _redis_client
    client = await _get_redis()
    if client is None:
        return
    try:
        key = f"{_REDIS_KEY_PREFIX}{session_id}"
        await client.rpush(key, json.dumps(event))
        await client.expire(key, _REDIS_TTL)
    except Exception as e:
        _redis_client = None  # reset so next call retries init
        logger.warning("redis_buffer_unavailable", session_id=session_id, error=str(e))


async def _read_from_redis(session_id: str, after_id: int, max_id: int) -> list[dict]:
    """
    Read events from Redis with sse_id in range (after_id, max_id] inclusive.
    Uses 0-based LRANGE indices: sse_id N is at list index N-1.
      events with sse_id > after_id AND sse_id <= max_id
      → LRANGE key after_id (max_id-1)
    Returns [] if Redis is unavailable or key doesn't exist.
    """
    global _redis_client
    if max_id == 0:  # no events published yet — avoid LRANGE key 0 -1 full scan (P3)
        return []
    client = await _get_redis()
    if client is None:
        logger.warning("redis_buffer_unavailable", session_id=session_id, error="Redis unavailable")
        return []
    try:
        key = f"{_REDIS_KEY_PREFIX}{session_id}"
        # after_id is 0-based start: events at indices after_id..(max_id-1) have sse_id (after_id+1)..max_id
        end = max_id - 1
        raw = await client.lrange(key, after_id, end)
        return [json.loads(e) for e in raw]
    except Exception as e:
        _redis_client = None
        logger.warning("redis_buffer_unavailable", session_id=session_id, error=str(e))
        return []


async def _delete_redis_buffer(session_id: str) -> None:
    """Delete the Redis buffer key for a session (called on new workflow run)."""
    global _redis_client
    client = await _get_redis()
    if client is None:
        return
    try:
        key = f"{_REDIS_KEY_PREFIX}{session_id}"
        await client.delete(key)
    except Exception as e:
        _redis_client = None
        logger.warning("event_bus.redis_delete_failed", session_id=session_id, error=str(e))


async def publish_event(session_id: str, event_type: str, data: dict) -> None:
    """Publish an SSE event: write to in-memory buffer, persist to Redis, fanout to subscribers."""
    _session_counters[session_id] += 1
    if "id" not in data:
        data = {"id": str(uuid_lib.uuid4()), **data}
    event = {"sse_id": _session_counters[session_id], "event": event_type, "data": json.dumps(data)}

    # In-memory buffer (fallback for Redis-unavailable or gap-fill)
    buf = _event_buffer[session_id]
    buf.append(event)
    if len(buf) > _MAX_BUFFER:
        buf.pop(0)

    # Redis buffer (primary durable store — await directly, latency is negligible vs 60s generation)
    await _write_to_redis(session_id, event)

    # DB persistence — fire-and-forget; epoch guard drops inserts that race past clear_session_buffer
    if _persist_hook is not None:
        _epoch = _session_epochs[session_id]
        _sse_id = event["sse_id"]
        _hook = _persist_hook  # snapshot to avoid potential reassignment between publish and task run

        async def _guarded_persist() -> None:
            if _session_epochs[session_id] == _epoch:
                await _hook(session_id, _sse_id, event_type, data)

        task = asyncio.create_task(_guarded_persist())
        _pending_tasks.add(task)
        task.add_done_callback(_pending_tasks.discard)

    # Fanout to live subscribers
    for queue in list(_subscribers[session_id]):
        await queue.put(event)

    logger.debug("event_bus.published", session_id=session_id, event_type=event_type,
                 sse_id=event["sse_id"], subscribers=len(_subscribers[session_id]))


async def subscribe(session_id: str, last_event_id: int | None = None) -> asyncio.Queue:
    """
    Create a subscriber queue pre-loaded with buffered events, then register for live events.

    Atomic D3 fix: snapshot max_sse_id before the Redis await, gap-fill from in-memory
    for events published during the await, then register — no yield between gap-fill and
    registration so no event can be missed.
    """
    queue: asyncio.Queue = asyncio.Queue()

    # Snapshot current max sse_id — no yield, atomic
    max_sse_id = _session_counters[session_id]
    after_id = last_event_id if last_event_id is not None else 0

    # Await Redis for events in range (after_id, max_sse_id] — other coroutines MAY run here
    redis_events = await _read_from_redis(session_id, after_id=after_id, max_id=max_sse_id)

    # If Redis returned nothing (unavailable or empty), fall back to in-memory for the same range
    if not redis_events:
        buf = _event_buffer.get(session_id, [])
        redis_events = [
            e for e in buf
            if (last_event_id is None or e["sse_id"] > last_event_id) and e["sse_id"] <= max_sse_id
        ]

    # Gap events: published during the Redis await (sse_id > max_sse_id), in-memory only
    # No yield from here until _subscribers.append — this block is atomic
    buf = _event_buffer.get(session_id, [])
    gap_events = [e for e in buf if e["sse_id"] > max_sse_id]

    # Pre-load all replay events via put_nowait (no yield)
    for event in redis_events + gap_events:
        queue.put_nowait(event)

    # Register for live events (no yield — atomic with gap-fill above)
    _subscribers[session_id].append(queue)

    return queue


def unsubscribe(session_id: str, queue: asyncio.Queue) -> None:
    """Remove a subscriber queue when the SSE connection closes."""
    try:
        _subscribers[session_id].remove(queue)
    except (KeyError, ValueError):
        pass


async def clear_session_buffer(session_id: str) -> None:
    """Clear replay buffer, reset SSE ID counter, and delete Redis key before a new workflow run."""
    _event_buffer.pop(session_id, None)
    _session_counters.pop(session_id, None)
    _session_epochs[session_id] += 1  # invalidate any in-flight persist tasks from prior run
    task = asyncio.create_task(_delete_redis_buffer(session_id))
    _pending_tasks.add(task)
    task.add_done_callback(_pending_tasks.discard)
    if _clear_hook is not None:
        ct = asyncio.create_task(_clear_hook(session_id))
        _pending_tasks.add(ct)
        ct.add_done_callback(_pending_tasks.discard)


def cleanup_session(session_id: str) -> None:
    """Remove all in-memory state for a session (test teardown; Redis expires via TTL)."""
    _subscribers.pop(session_id, None)
    _event_buffer.pop(session_id, None)
    _session_counters.pop(session_id, None)
    _session_epochs.pop(session_id, None)


async def publish_card_event(
    session_id: str,
    card_id: str,
    card_type: str,
    completeness_score: float,
    delta: dict,
    is_final: bool,
) -> None:
    """Publish a card.update SSE event with the required card envelope schema."""
    await publish_event(session_id, "card.update", {
        "card_id": card_id,
        "type": card_type,
        "completeness_score": completeness_score,
        "delta": delta,
        "is_final": is_final,
    })
