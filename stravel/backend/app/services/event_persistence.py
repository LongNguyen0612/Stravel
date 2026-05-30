import uuid
from typing import Any

import structlog
from sqlmodel import delete, select

from app.core.database import async_session_factory
from app.models.session_event import SessionEvent

logger = structlog.get_logger()


async def persist_event(session_id: str, sse_id: int, event_type: str, event_data: dict[str, Any]) -> None:
    try:
        sid = uuid.UUID(session_id)
        event = SessionEvent(
            session_id=sid,
            sse_id=sse_id,
            event_type=event_type,
            event_data=event_data,
        )
        async with async_session_factory() as db:
            db.add(event)
            await db.commit()
    except Exception as e:
        logger.warning("event_persistence.failed", session_id=session_id, sse_id=sse_id, error=str(e))


async def delete_session_events(session_id: str) -> None:
    try:
        sid = uuid.UUID(session_id)
        async with async_session_factory() as db:
            await db.execute(delete(SessionEvent).where(SessionEvent.session_id == sid))
            await db.commit()
    except Exception as e:
        logger.warning("event_persistence.delete_failed", session_id=session_id, error=str(e))


async def get_session_events(session_id: str) -> list[SessionEvent]:
    try:
        sid = uuid.UUID(session_id)
        async with async_session_factory() as db:
            result = await db.execute(
                select(SessionEvent)
                .where(SessionEvent.session_id == sid)
                .order_by(SessionEvent.sse_id)
            )
            return list(result.scalars().all())
    except Exception as e:
        logger.warning("event_persistence.get_failed", session_id=session_id, error=str(e))
        return []
