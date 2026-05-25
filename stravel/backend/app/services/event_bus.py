import asyncio
import json
from collections import defaultdict

import structlog

logger = structlog.get_logger()

_queues: dict[str, asyncio.Queue] = defaultdict(asyncio.Queue)


async def publish_event(session_id: str, event_type: str, data: dict) -> None:
    """Publish an SSE event to the session's queue."""
    queue = _queues[session_id]
    event = {"event": event_type, "data": json.dumps(data)}
    await queue.put(event)
    logger.debug("event_bus.published", session_id=session_id, event_type=event_type)


async def subscribe(session_id: str) -> asyncio.Queue:
    """Get the event queue for a session. Creates one if it doesn't exist."""
    return _queues[session_id]


def cleanup_session(session_id: str) -> None:
    """Remove the event queue for a session."""
    _queues.pop(session_id, None)
