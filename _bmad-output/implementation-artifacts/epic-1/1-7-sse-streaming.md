# Story 1.7: SSE Streaming Endpoint

Status: done

## Story

As a travel agent,
I want to see AI agent outputs appear in real time as the advisory session progresses,
so that I can follow along without waiting for the entire process to finish.

## Acceptance Criteria

1. **SSE endpoint exists** — `api/v1/streaming.py` implements an SSE endpoint at `GET /api/v1/stream/{session_id}`
2. **Agent output events** — When the Profiling Agent generates a question or output, an SSE event is emitted with format:
   ```
   event: agent.profiling.question
   data: {"type": "question", "content": "How old are the children?", "context": "family_detected"}
   ```
3. **Stage change events** — When the workflow stage changes, an SSE event is emitted:
   ```
   event: stage.change
   data: {"stage": "profiling"}
   ```
4. **Error events** — When an agent encounters an error, an SSE event is emitted:
   ```
   event: agent.error
   data: {"agent": "profiling", "message": "LLM request timed out"}
   ```
5. **Latency requirement** — Events arrive at the frontend within 5 seconds of agent completion (NFR-4)
6. **Client reconnection** — The SSE connection handles client reconnection gracefully (Last-Event-ID header support)
7. **Dev verification page** — A simple test HTML page can connect to the SSE endpoint and display events for developer verification
8. **Pydantic schemas** — `schemas/streaming.py` defines typed Pydantic models for all SSE event payloads
9. **Heartbeat** — The SSE connection sends periodic keep-alive comments to prevent proxy/load-balancer timeouts
10. **Session validation** — Connecting to a non-existent `session_id` returns an appropriate error event then closes the stream

## Tasks

- [x] Task 1: Create SSE event Pydantic schemas (AC: #8)
  - [x] Create `backend/app/schemas/streaming.py`
  - [x] Define `SSEEventBase` with `type: str` and `timestamp: datetime` fields
  - [x] Define `AgentOutputEvent` with `type`, `content`, `context`, and `agent` fields
  - [x] Define `StageChangeEvent` with `stage: Literal["profiling", "calculating", "proposing", "validating"]`
  - [x] Define `AgentErrorEvent` with `agent: str`, `message: str`, `code: str | None`
  - [x] Define `HeartbeatEvent` as a minimal keep-alive schema
  - [x] Define `SSEEventType` as a discriminated union of all event types
  - [x] Add unit tests in `backend/app/schemas/tests/test_streaming.py` validating serialization

- [x] Task 2: Create the SSE event bus / publishing mechanism (AC: #1, #5)
  - [x] Create `backend/app/services/event_bus.py`
  - [x] Implement `SessionEventBus` class using `asyncio.Queue` per session for Phase 1 (Redis pub/sub deferred to Phase 2)
  - [x] Implement `publish(session_id: str, event: SSEEventBase)` method
  - [x] Implement `subscribe(session_id: str) -> AsyncIterator[SSEEventBase]` method
  - [x] Implement `unsubscribe(session_id: str)` for cleanup on client disconnect
  - [x] Add a `SessionEventBusProtocol` to `agents/protocols.py` or `services/event_bus.py`
  - [x] Add unit tests verifying publish/subscribe flow and cleanup

- [x] Task 3: Implement SSE streaming endpoint (AC: #1, #2, #3, #4, #5, #6, #9, #10)
  - [x] Create `backend/app/api/v1/streaming.py`
  - [x] Implement `GET /api/v1/stream/{session_id}` using `sse-starlette` or `StreamingResponse`
  - [x] Set correct response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`
  - [x] Validate `session_id` exists — return error event + close stream if invalid
  - [x] Format events with SSE wire protocol: `event:`, `data:`, `id:`, blank line delimiter
  - [x] Include monotonically increasing `id` field for Last-Event-ID reconnection support
  - [x] Implement heartbeat: send SSE comment (`: heartbeat`) every 15 seconds
  - [x] Handle client disconnect: detect via `Request.is_disconnected()`, clean up subscriptions
  - [x] Register router in `api/v1/router.py`

- [x] Task 4: Wire event publishing into agent orchestrator (AC: #2, #3, #4, #5)
  - [x] Add `event_bus` dependency to `agents/orchestrator.py` or create a callback mechanism
  - [x] Emit `stage.change` event when the orchestrator transitions between graph nodes
  - [x] Emit `agent.{agent_name}.{output_type}` events when an agent produces output
  - [x] Emit `agent.error` events when an agent appends to `AdvisoryState.errors`
  - [x] Ensure events are published immediately (not batched) for <5s latency
  - [x] Verify with unit test that a graph run emits the expected sequence of events

- [x] Task 5: Create dev verification HTML page (AC: #7)
  - [x] Create `backend/app/static/sse_test.html` (or serve inline from a dev-only endpoint)
  - [x] Page connects to `GET /api/v1/stream/{session_id}` using `EventSource` API
  - [x] Page displays events in a scrollable log with event type, timestamp, and JSON data
  - [x] Page has an input field for `session_id` and a connect/disconnect button
  - [x] Page shows connection status indicator (connected / disconnected / reconnecting)
  - [x] Mount static files or add dev-only HTML endpoint in FastAPI (only if `ENVIRONMENT=development`)

- [x] Task 6: Add `sse-starlette` dependency (AC: #1)
  - [x] Add `sse-starlette>=2.1.0` to `pyproject.toml` dependencies
  - [x] Verify `pip install -e ".[dev]"` succeeds with new dependency

- [x] Task 7: Integration test (AC: #1, #2, #3, #5, #6, #9, #10)
  - [x] Write integration test connecting to SSE endpoint with `httpx` streaming
  - [x] Verify events arrive in correct SSE wire format
  - [x] Verify heartbeat comments arrive within expected interval
  - [x] Verify invalid `session_id` returns error event
  - [x] Verify client disconnect triggers cleanup
  - [x] Mark with `@pytest.mark.integration`

## Dev Notes

### Critical Architecture Constraints

- **SSE, not WebSocket** — Architecture decision: SSE for server-to-client push. REST for client-to-server actions. WebSocket is deferred (post-MVP) unless SSE proves insufficient.
- **No Redis yet** — Phase 1 uses in-memory `asyncio.Queue` per session for event distribution. Redis pub/sub comes in Phase 2 (Story 2.4). The `SessionEventBusProtocol` abstraction ensures a clean swap.
- **No auth enforcement yet if Story 1.6 is incomplete** — If Story 1.6 (Auth, Tenant & Multi-tenancy) is not yet implemented, the SSE endpoint should work without JWT. Add a `# TODO: enforce auth after Story 1.6` comment. If Story 1.6 IS complete, the SSE endpoint must extract `tenant_id` from the JWT and validate the session belongs to the tenant.
- **structlog for all logging** — Use `structlog` with `session_id` and `agent_name` context. Never use stdlib `logging`.
- **Pydantic BaseModel for schemas** — All event payloads are Pydantic models serialized to JSON via `.model_dump_json()`.

### SSE Wire Protocol Reference

SSE events follow this wire format (each event ends with a blank line):

```
event: agent.profiling.question
id: 42
data: {"type": "question", "content": "How old are the children?", "context": "family_detected", "timestamp": "2026-05-24T10:30:00Z"}

event: stage.change
id: 43
data: {"stage": "calculating", "timestamp": "2026-05-24T10:30:05Z"}

event: agent.error
id: 44
data: {"agent": "profiling", "message": "LLM request timed out", "timestamp": "2026-05-24T10:30:10Z"}

: heartbeat

```

The `: heartbeat` line is an SSE comment — browsers ignore it but it keeps the connection alive through proxies.

### SSE Event Name Convention

Event names follow the architecture naming pattern (`dot-separated, lowercase`):

| Event Name Pattern | When Emitted | Example |
|---|---|---|
| `agent.{agent}.question` | Profiling agent asks a question | `agent.profiling.question` |
| `agent.{agent}.result` | Agent produces a result/output | `agent.calculation.result` |
| `agent.{agent}.progress` | Agent reports incremental progress | `agent.proposal.progress` |
| `agent.error` | Any agent encounters an error | `agent.error` |
| `stage.change` | Orchestrator transitions workflow stage | `stage.change` |
| `session.complete` | All stages finished | `session.complete` |

### Implementation Pattern: sse-starlette

Preferred approach using `sse-starlette` (cleaner than raw `StreamingResponse`):

```python
# api/v1/streaming.py
import asyncio
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from app.schemas.streaming import AgentOutputEvent, StageChangeEvent, AgentErrorEvent
from app.services.event_bus import get_event_bus

logger = structlog.get_logger()
router = APIRouter()


@router.get("/stream/{session_id}")
async def stream_session(session_id: str, request: Request):
    """SSE endpoint for real-time agent output streaming."""
    log = logger.bind(session_id=session_id)
    log.info("sse.connection.opened")

    event_bus = get_event_bus()

    # Validate session exists (integrate with session service when available)
    # TODO: validate session_id against database

    async def event_generator():
        event_id = 0
        try:
            async for event in event_bus.subscribe(session_id):
                if await request.is_disconnected():
                    log.info("sse.client.disconnected")
                    break

                event_id += 1
                yield {
                    "event": event.event_name,
                    "id": str(event_id),
                    "data": event.model_dump_json(),
                }
        finally:
            event_bus.unsubscribe(session_id)
            log.info("sse.connection.closed")

    return EventSourceResponse(
        event_generator(),
        ping=15,  # heartbeat every 15 seconds
        ping_message_factory=lambda: "heartbeat",
    )
```

### Implementation Pattern: Pydantic SSE Schemas

```python
# schemas/streaming.py
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field


class SSEEventBase(BaseModel):
    """Base class for all SSE event payloads."""
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def event_name(self) -> str:
        """Override in subclasses to provide SSE event name."""
        raise NotImplementedError


class AgentOutputEvent(SSEEventBase):
    """Emitted when an agent produces output (question, result, progress)."""
    type: Literal["question", "result", "progress"]
    agent: Literal["profiling", "calculation", "proposal", "compliance"]
    content: str
    context: str | None = None

    @property
    def event_name(self) -> str:
        return f"agent.{self.agent}.{self.type}"


class StageChangeEvent(SSEEventBase):
    """Emitted when the orchestrator transitions to a new workflow stage."""
    stage: Literal["profiling", "calculating", "proposing", "validating"]

    @property
    def event_name(self) -> str:
        return "stage.change"


class AgentErrorEvent(SSEEventBase):
    """Emitted when an agent encounters an error."""
    agent: str
    message: str
    code: str | None = None

    @property
    def event_name(self) -> str:
        return "agent.error"


class SessionCompleteEvent(SSEEventBase):
    """Emitted when all workflow stages have completed."""
    session_id: str

    @property
    def event_name(self) -> str:
        return "session.complete"
```

### Implementation Pattern: In-Memory Event Bus (Phase 1)

```python
# services/event_bus.py
import asyncio
from collections import defaultdict

import structlog

from app.schemas.streaming import SSEEventBase

logger = structlog.get_logger()

class SessionEventBus:
    """In-memory event bus using asyncio.Queue per session.

    Phase 1 implementation. Swap to Redis pub/sub in Phase 2 via Protocol.
    """

    def __init__(self):
        self._queues: dict[str, list[asyncio.Queue]] = defaultdict(list)

    async def publish(self, session_id: str, event: SSEEventBase) -> None:
        """Publish an event to all subscribers of a session."""
        log = logger.bind(session_id=session_id, event_name=event.event_name)
        queues = self._queues.get(session_id, [])
        log.debug("sse.event.published", subscriber_count=len(queues))
        for queue in queues:
            await queue.put(event)

    async def subscribe(self, session_id: str):
        """Subscribe to events for a session. Yields events as they arrive."""
        queue: asyncio.Queue[SSEEventBase] = asyncio.Queue()
        self._queues[session_id].append(queue)
        logger.debug("sse.subscriber.added", session_id=session_id)
        try:
            while True:
                event = await queue.get()
                yield event
        except asyncio.CancelledError:
            pass
        finally:
            self._queues[session_id].remove(queue)
            if not self._queues[session_id]:
                del self._queues[session_id]
            logger.debug("sse.subscriber.removed", session_id=session_id)

    def unsubscribe(self, session_id: str) -> None:
        """Clean up all subscriptions for a session."""
        if session_id in self._queues:
            del self._queues[session_id]


# Module-level singleton for Phase 1
_event_bus = SessionEventBus()


def get_event_bus() -> SessionEventBus:
    return _event_bus
```

### Implementation Pattern: Dev Verification HTML Page

```html
<!-- static/sse_test.html — served only when ENVIRONMENT=development -->
<!DOCTYPE html>
<html>
<head>
  <title>STravel SSE Test</title>
  <style>
    body { font-family: monospace; margin: 20px; background: #1e1e1e; color: #d4d4d4; }
    #log { height: 500px; overflow-y: auto; border: 1px solid #444; padding: 10px; }
    .event { margin: 4px 0; }
    .event-type { color: #569cd6; }
    .event-data { color: #ce9178; }
    .status { padding: 4px 8px; border-radius: 4px; }
    .connected { background: #2d5a2d; }
    .disconnected { background: #5a2d2d; }
    input, button { padding: 8px; margin: 4px; font-family: monospace; }
  </style>
</head>
<body>
  <h2>STravel SSE Stream Tester</h2>
  <div>
    <input id="sessionId" placeholder="session_id" value="">
    <button onclick="connect()">Connect</button>
    <button onclick="disconnect()">Disconnect</button>
    <span id="status" class="status disconnected">Disconnected</span>
  </div>
  <div id="log"></div>
  <script>
    let eventSource = null;

    function connect() {
      const sessionId = document.getElementById('sessionId').value;
      if (!sessionId) { alert('Enter a session_id'); return; }
      disconnect();
      eventSource = new EventSource(`/api/v1/stream/${sessionId}`);
      const status = document.getElementById('status');

      eventSource.onopen = () => {
        status.textContent = 'Connected';
        status.className = 'status connected';
        appendLog('system', 'Connection opened');
      };

      eventSource.onerror = () => {
        status.textContent = 'Disconnected';
        status.className = 'status disconnected';
        appendLog('system', 'Connection error / closed');
      };

      // Listen for all custom event types
      ['agent.profiling.question', 'agent.calculation.result',
       'agent.proposal.progress', 'agent.error', 'stage.change',
       'session.complete'].forEach(eventType => {
        eventSource.addEventListener(eventType, (e) => {
          appendLog(eventType, e.data);
        });
      });
    }

    function disconnect() {
      if (eventSource) { eventSource.close(); eventSource = null; }
      document.getElementById('status').textContent = 'Disconnected';
      document.getElementById('status').className = 'status disconnected';
    }

    function appendLog(type, data) {
      const log = document.getElementById('log');
      const time = new Date().toISOString().split('T')[1].split('.')[0];
      log.innerHTML += `<div class="event">[${time}] <span class="event-type">${type}</span>: <span class="event-data">${data}</span></div>`;
      log.scrollTop = log.scrollHeight;
    }
  </script>
</body>
</html>
```

### Dependency Addition

Add to `pyproject.toml` dependencies:

```toml
"sse-starlette>=2.1.0",
```

### Router Registration

```python
# api/v1/router.py — add streaming router
from app.api.v1 import health, streaming

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(streaming.router, prefix="/stream", tags=["streaming"])
```

### File Structure

```
backend/app/
├── api/v1/
│   ├── streaming.py              # NEW — SSE endpoint
│   └── router.py                 # MODIFIED — register streaming router
├── schemas/
│   ├── streaming.py              # NEW — SSE event Pydantic schemas
│   └── tests/
│       └── test_streaming.py     # NEW — schema serialization tests
├── services/
│   └── event_bus.py              # NEW — in-memory event bus (Phase 1)
├── static/
│   └── sse_test.html             # NEW — dev verification page
└── agents/
    └── orchestrator.py           # MODIFIED — emit SSE events on state transitions
```

### Anti-Patterns -- DO NOT

- **DO NOT use WebSocket** — architecture mandates SSE for server-to-client push
- **DO NOT use Redis** in this story — Phase 1 uses `asyncio.Queue`. Redis pub/sub is Phase 2
- **DO NOT batch events** — publish immediately on agent output for <5s latency
- **DO NOT use `StreamingResponse` directly** if `sse-starlette` is available — it handles the SSE wire protocol correctly (event/data/id fields, reconnection, heartbeat)
- **DO NOT use stdlib `logging`** — use `structlog` only
- **DO NOT block the event loop** — all publishing and subscribing must be async
- **DO NOT serve the test HTML page in production** — gate behind `ENVIRONMENT=development` check
- **DO NOT create frontend React components** — that is Story 1.8

### Testing Requirements

- **Unit tests** for `schemas/streaming.py`: verify all event types serialize/deserialize correctly, `event_name` property returns expected SSE event type
- **Unit tests** for `services/event_bus.py`: verify publish/subscribe, multiple subscribers, cleanup on unsubscribe, no memory leak when sessions end
- **Integration test** for `api/v1/streaming.py`: connect with `httpx` async streaming client, verify SSE wire format, verify heartbeat, verify error on invalid session
- All tests must pass with `pytest` from the backend directory — no external services required (no Redis, no Qdrant)

### References

- [Source: architecture.md -- API & Communication Patterns: SSE for real-time streaming]
- [Source: architecture.md -- Format Patterns: SSE Event Format]
- [Source: architecture.md -- Naming Patterns: SSE event names — dot-separated, lowercase]
- [Source: architecture.md -- Frontend Architecture: EventSource API for SSE client]
- [Source: architecture.md -- Data Store Ownership: Redis for pub/sub for SSE (Phase 2)]
- [Source: epics.md -- Story 1.7 Acceptance Criteria]
- [Source: epics.md -- FR-24: Real-Time Sidebar, NFR-4: <5s latency]
- [Source: sse-starlette docs -- https://github.com/sysid/sse-starlette]

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
