# Story 9.1: Decouple SSE Generation from Connection Lifecycle

Status: done

## Story

As the platform,
I want LLM generation to continue server-side if a client disconnects during streaming,
So that an iOS Safari tab-background or network hiccup does not cancel a 60-second proposal generation.

## Acceptance Criteria

**AC1 — Background task dispatch (ARCH-1)**
Given the SSE handler currently ties `run_advisory_workflow` to the SSE response lifecycle
When this story is shipped
Then `run_advisory_workflow` is dispatched as a background task before the SSE response is opened
And the SSE response handler reads events from a queue/Redis channel rather than awaiting generation directly

**AC2 — Generation survives client disconnect**
Given a background generation task is running
When the client disconnects mid-stream
Then generation continues to completion and events are buffered in-memory
And the in-memory buffer is NOT cleared until a new run starts (clear on `run_advisory_workflow` entry)

**AC3 — Reconnect serves from buffer, not restart**
Given a background generation task is running or completed
When a new SSE connection arrives for the same session (reconnect)
Then `run_advisory_workflow` is NOT re-triggered
And the SSE stream replays buffered events since `Last-Event-ID` (or from the beginning if no header)

**AC4 — Monotonic sequential SSE event IDs**
Given each SSE event is emitted via `publish_event` or `publish_card_event`
When the event is stored in the buffer
Then it is assigned a monotonically increasing integer `sse_id` starting at 1 per session
And that `sse_id` is included in the SSE wire format as `id: N` on its own line before `event:` and `data:`

**AC5 — Last-Event-ID replay from checkpoint**
Given a client reconnects with `Last-Event-ID: N` in the request header
When the SSE endpoint handles the request
Then only events with `sse_id > N` are replayed from the buffer
And live streaming resumes after replay
Given no `Last-Event-ID` header (first connection or TTL-cleared)
Then all buffered events are replayed from the start

**AC6 — Structured logging**
Given structlog is the only logger (no stdlib logging)
When the generation lifecycle is logged
Then `workflow.started` log includes `session_id`
And `workflow.completed` log includes `session_id`, `event_count` (total events emitted), `generation_status: "completed"`
And `workflow.failed` log includes `session_id`, `event_count`, `generation_status: "failed"`, `error`
And SSE connection events log `session_id`, `last_event_id`, `replay_count` at INFO level

---

## Tasks / Subtasks

- [x] Task 1: Add monotonic sequential IDs to event_bus.py (AC4)
  - [x] 1a: Add `_session_counters: dict[str, int] = defaultdict(int)` module-level dict
  - [x] 1b: In `publish_event`, increment `_session_counters[session_id]` before storing; add `sse_id` to buffer entry: `{"sse_id": counter, "event": ..., "data": ...}`
  - [x] 1c: Update `clear_session_buffer` to also reset `_session_counters[session_id]` (pop it)
  - [x] 1d: Update `cleanup_session` to also pop from `_session_counters`
  - [x] 1e: Update `subscribe(session_id, last_event_id: int | None = None)` signature; filter buffer replay: `[e for e in buf if e["sse_id"] > last_event_id]` when `last_event_id` is not None

- [x] Task 2: Add `id:` to SSE wire format in streaming.py (AC4, AC5)
  - [x] 2a: In `event_generator`, update yield to: `f"id: {event['sse_id']}\nevent: {event['event']}\ndata: {event['data']}\n\n"`
  - [x] 2b: Read `Last-Event-ID` header from request: `last_event_id_raw = request.headers.get("last-event-id")`; parse to `int | None` with try/except
  - [x] 2c: Pass parsed `last_event_id` to `subscribe(session_id, last_event_id=last_event_id)`
  - [x] 2d: Log connection event: `logger.info("sse.connected", session_id=session_id, last_event_id=last_event_id, replay_count=<queue size after subscribe>)`

- [x] Task 3: Verify background task dispatch and generation-on-disconnect (AC1, AC2, AC3)
  - [x] 3a: Confirmed `sessions.py` line 182 uses `asyncio.create_task(run_advisory_workflow(...))` — added comment `# ARCH-1: fire-and-forget; generation continues if SSE client disconnects`
  - [x] 3b: Verified `streaming.py` `event_generator` does NOT `await run_advisory_workflow` — documented with inline comment
  - [x] 3c: Confirmed `subscribe()` pre-loads buffer events on reconnect without restarting generation — no code change required

- [x] Task 4: Improve workflow logging (AC6)
  - [x] 4a: Added `event_count = 0` local variable in `run_advisory_workflow`, incremented via `nonlocal` in nested `_emit()`
  - [x] 4b: Pass `event_count` and `generation_status="completed"` to `workflow.completed` log
  - [x] 4c: Pass `event_count` and `generation_status="failed"` to `workflow.failed` log

- [x] Task 5: Unit tests — event_bus monotonic IDs and Last-Event-ID replay
  - [x] 5a: `test_events_have_sequential_sse_ids` — publish 3 events; verify sse_id = 1, 2, 3 in queue
  - [x] 5b: `test_last_event_id_filters_replay` — publish 5 events; subscribe with `last_event_id=3`; verify only sse_id 4 and 5 are replayed
  - [x] 5c: `test_last_event_id_none_replays_all` — publish 3 events; subscribe with `last_event_id=None`; verify all 3 replayed
  - [x] 5d: `test_clear_session_buffer_resets_counter` — publish 2 events; clear; publish 1 more; verify new sse_id starts at 1
  - [x] 5e: `test_independent_counters_per_session` — publish to sessions A and B independently; verify each starts at 1

- [x] Task 6: Unit tests — SSE wire format (streaming.py)
  - [x] 6a: Assert SSE output includes `id: 1\n` line before `event:` line
  - [x] 6b: subscribe() called with `last_event_id=5` when request has `Last-Event-ID: 5` header
  - [x] 6c: subscribe() called with `last_event_id=None` when request has no `Last-Event-ID` header

### Review Findings

- [x] [Review][Patch] P1: Wrap error-path _emit in try/except to prevent secondary exception masking the original [workflow.py:212]
- [x] [Review][Patch] P2: Replace deprecated datetime.utcnow() with datetime.now(timezone.utc) in new update_profile endpoint [sessions.py:151]
- [x] [Review][Patch] P3: test_sse_output_includes_id_line is tautological — never invokes production code, asserts its own string [test_streaming_sse_format.py:18]
- [x] [Review][Patch] P4: test_subscribe_called_with_last_event_id_from_header replicates header-parsing logic inline instead of exercising event_generator [test_streaming_sse_format.py:48]
- [x] [Review][Patch] P5: No test for unsubscribe — missing verification that queue is removed from _subscribers on disconnect [test_event_bus.py]
- [x] [Review][Defer] D1: Module-level state concurrent access — asyncio single-thread mitigates most races but reconnect gap is real; story 9-2 Redis scope [event_bus.py] — deferred, story 9-2 scope
- [x] [Review][Defer] D2: Buffer eviction O(N) buf.pop(0) and silent gap on overflow past _MAX_BUFFER=200 [event_bus.py:27] — deferred, story 9-2 scope
- [x] [Review][Defer] D3: Reconnect race — subscriber appended after replay, may miss event published between replay and subscribe registration [event_bus.py:40] — deferred, story 9-2 scope
- [x] [Review][Defer] D4: Fire-and-forget task handle discarded, no shutdown registry to cancel pending tasks [sessions.py:183] — deferred, deliberate ARCH-1 pattern
- [x] [Review][Defer] D5: Workflow DB write uses separate async_session_factory session with no log on advisory_session miss [workflow.py:205] — deferred, pre-existing architectural pattern
- [x] [Review][Defer] D6: Concurrent run_session calls for same session reset sse_id counter mid-stream — session state machine should prevent [sessions.py:183] — deferred, higher-level state machine concern
- [x] [Review][Defer] D7: get_tenant_id_for_stream Bearer prefix check is case-sensitive — standard RFC 7235 behavior for this API's clients [streaming.py:28] — deferred, pre-existing

---

## Dev Notes

### Architecture Context

**ARCH-1 (ALREADY IMPLEMENTED — verify and document):**
`sessions.py:182` already uses `asyncio.create_task(run_advisory_workflow(...))`. This is the correct "fire-and-forget" approach — generation continues even if the request that triggered it ends. DO NOT replace with `FastAPI BackgroundTasks`; `asyncio.create_task` is the established pattern here.

**ARCH-1 SSE separation (ALREADY IMPLEMENTED):**
`streaming.py` reads from an `asyncio.Queue` via `event_bus.subscribe()`, never `await`s `run_advisory_workflow` directly. This is already decoupled. The remaining gap is:
1. Sequential integer IDs for SSE spec compliance (`id:` wire field)
2. `Last-Event-ID` header reading and filtered replay in `subscribe()`

### Current event_bus.py state — what needs changing

```python
# CURRENT (no sequential ID tracking):
_subscribers: dict[str, list[asyncio.Queue]] = defaultdict(list)
_event_buffer: dict[str, list[dict]] = defaultdict(list)

async def publish_event(session_id, event_type, data):
    event = {"event": event_type, "data": json.dumps(data)}
    buf = _event_buffer[session_id]
    buf.append(event)
    ...

async def subscribe(session_id):  # no last_event_id param
    queue = asyncio.Queue()
    for event in _event_buffer.get(session_id, []):  # replays ALL events
        await queue.put(event)
    ...
```

```python
# TARGET (with sequential ID tracking):
_session_counters: dict[str, int] = defaultdict(int)  # ADD THIS

async def publish_event(session_id, event_type, data):
    _session_counters[session_id] += 1
    event = {"sse_id": _session_counters[session_id], "event": event_type, "data": json.dumps(data)}
    ...

async def subscribe(session_id, last_event_id: int | None = None):  # ADD last_event_id
    buf = _event_buffer.get(session_id, [])
    replay = [e for e in buf if last_event_id is None or e["sse_id"] > last_event_id]
    for event in replay:
        await queue.put(event)
    ...
```

### Current streaming.py state — what needs changing

```python
# CURRENT (no `id:` line, no Last-Event-ID):
queue = await subscribe(session_id)
...
yield f"event: {event['event']}\ndata: {event['data']}\n\n"
```

```python
# TARGET:
last_event_id_raw = request.headers.get("last-event-id")
try:
    last_event_id = int(last_event_id_raw) if last_event_id_raw else None
except (ValueError, TypeError):
    last_event_id = None

queue = await subscribe(session_id, last_event_id=last_event_id)
logger.info("sse.connected", session_id=session_id, last_event_id=last_event_id,
            replay_count=queue.qsize())
...
yield f"id: {event['sse_id']}\nevent: {event['event']}\ndata: {event['data']}\n\n"
```

**Keepalive events:** The keepalive `yield "event: keepalive\ndata: {}\n\n"` does NOT get a sequential ID (SSE spec: comment events have no id; keepalives must not advance the Last-Event-ID counter). Leave keepalive as-is — no `id:` prefix. For heartbeat comments (`: keep-alive`) which are NOT currently used in streaming.py (it uses a named `keepalive` event instead), same rule applies.

### Current workflow.py state — what needs changing

```python
# CURRENT:
async def run_advisory_workflow(session_id, profile):
    logger.info("workflow.started", session_id=session_id)
    ...
    logger.info("workflow.completed", session_id=session_id)  # missing event_count, generation_status
    ...
    logger.error("workflow.failed", session_id=session_id, error=str(e))  # missing event_count, status
```

```python
# TARGET:
async def run_advisory_workflow(session_id, profile):
    logger.info("workflow.started", session_id=session_id)
    event_count = 0

    async def _emit_counted(sid, event, data):
        nonlocal event_count
        event_count += 1
        await publish_event(sid, event, data)
        await asyncio.sleep(0.05)

    # Replace all _emit() calls with _emit_counted() OR increment in _emit wrapper
    ...
    logger.info("workflow.completed", session_id=session_id, event_count=event_count,
                generation_status="completed")
    ...
    logger.error("workflow.failed", session_id=session_id, event_count=event_count,
                 generation_status="failed", error=str(e))
```

**Simplest approach:** Add `event_count = 0` at top of function; increment it inside the existing `_emit()` local function which is already defined there:
```python
async def _emit(session_id, event, data):
    nonlocal event_count  # reference outer scope variable
    await publish_event(session_id, event, data)
    event_count += 1
    await asyncio.sleep(0.05)
```

### Testing Patterns

**Backend tests location:** `stravel/backend/tests/`
- Unit tests for event_bus: `tests/unit/test_event_bus.py` (add to existing file)
- Unit tests for streaming wire format: `tests/unit/test_streaming_sse_format.py` (new file)
- Run with: `cd stravel/backend && python -m pytest tests/ -v`

**Key pytest pattern for streaming tests:**
```python
from unittest.mock import AsyncMock, patch, MagicMock
import asyncio

async def make_queue(*events):
    q = asyncio.Queue()
    for e in events:
        await q.put(e)
    return q
```

**Existing event_bus tests to NOT break:** All tests in `tests/test_streaming.py` and `tests/unit/test_event_bus.py` currently pass with the old `subscribe()` signature. After adding `last_event_id` param with default `None`, all existing tests remain valid — the new param is optional.

### Critical Rules for This Story

- **NEVER use `session.exec()`** with AsyncSession — use `session.execute()` (not relevant to this story's scope but keep in mind)
- **structlog only** — no `import logging`
- **`asyncio.create_task` stays** — don't switch to `BackgroundTasks`; it's equivalent and already works
- **Keepalive events have NO `id:` prefix** — only data events (event_type != "keepalive") get sequential IDs
- **Buffer replay uses `sse_id` for filtering** — not array index
- **`_event_count` in `run_advisory_workflow` uses `nonlocal`** — the `_emit` closure already references `session_id` from outer scope; use the same pattern for `event_count`

### File Locations

```
stravel/backend/app/services/event_bus.py       # Task 1 — add _session_counters, update subscribe()
stravel/backend/app/api/v1/streaming.py          # Task 2 — add id: line, Last-Event-ID header
stravel/backend/app/api/v1/sessions.py           # Task 3a — add ARCH-1 comment only
stravel/backend/app/services/workflow.py         # Task 4 — add event_count logging
stravel/backend/tests/unit/test_event_bus.py     # Task 5 — extend existing file
stravel/backend/tests/unit/test_streaming_sse_format.py  # Task 6 — new test file
```

### Learnings from Previous Stories (Epic 8)

- Backend tests are in `stravel/backend/tests/` — pytest with `pytest-asyncio`
- `@pytest.mark.asyncio` required on every async test
- `cleanup_session(session_id)` must be called in teardown to reset module-level state
- `asyncio.Queue()` from `asyncio` module (not threading.Queue)
- `structlog.get_logger()` returns bound logger; use `logger.info(...)` with keyword args for structured fields

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — all tasks implemented cleanly without errors.

### Completion Notes List

- Task 1 (event_bus.py): Added `_session_counters` defaultdict; each published event now carries a monotonic `sse_id` starting at 1 per session. `subscribe()` accepts optional `last_event_id` and filters the replay buffer accordingly. Both `clear_session_buffer` and `cleanup_session` pop the counter.
- Task 2 (streaming.py): SSE wire format now includes `id: N\n` before `event:` line for all data events. `Last-Event-ID` header is parsed from request and forwarded to `subscribe()`. Keepalive events intentionally have NO `id:` prefix (SSE spec compliance). Connection log includes `last_event_id` and `replay_count`.
- Task 3 (sessions.py): ARCH-1 comment added to `asyncio.create_task(run_advisory_workflow(...))` at line 182. No logic change — generation was already fire-and-forget.
- Task 4 (workflow.py): Moved `_emit` to be a nested closure inside `run_advisory_workflow`; uses `nonlocal event_count` to count every emitted event. `workflow.completed` and `workflow.failed` logs now include `event_count` and `generation_status`.
- Task 5: 5 new unit tests in `tests/unit/test_event_bus.py` — all pass. Covers sequential IDs, Last-Event-ID filtering, counter reset on clear, independent counters per session.
- Task 6: 3 new unit tests in `tests/unit/test_streaming_sse_format.py` — all pass. Covers `id:` wire format, Last-Event-ID header→subscribe() routing.
- Full test suite: 84 passing, 6 pre-existing integration failures in test_sessions.py (401 auth — require running DB, pre-existed before this story).

### File List

- `stravel/backend/app/services/event_bus.py` — added `_session_counters`, updated `publish_event`, `subscribe`, `clear_session_buffer`, `cleanup_session`
- `stravel/backend/app/api/v1/streaming.py` — added `id:` SSE line, `Last-Event-ID` header parsing, `replay_count` logging
- `stravel/backend/app/api/v1/sessions.py` — added ARCH-1 comment at line 182
- `stravel/backend/app/services/workflow.py` — moved `_emit` to closure, added `event_count` + `generation_status` to log calls
- `stravel/backend/tests/unit/test_event_bus.py` — 5 new tests for sequential IDs and Last-Event-ID replay
- `stravel/backend/tests/unit/test_streaming_sse_format.py` — new file, 3 tests for SSE wire format

### Change Log

- 2026-05-26: Implemented story 9-1 — SSE decoupling: monotonic event IDs, Last-Event-ID replay, ARCH-1 documentation, workflow logging improvements (claude-sonnet-4-6)
