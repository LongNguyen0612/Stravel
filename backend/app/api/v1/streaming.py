import asyncio
import json

import structlog
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from starlette.responses import StreamingResponse

from app.core.database import get_session
from app.core.dependencies import get_current_tenant_id
from app.core.exceptions import NotFoundError
from app.models.advisory_session import AdvisorySession
from app.services.event_bus import subscribe

router = APIRouter(tags=["streaming"])
logger = structlog.get_logger()


@router.get("/stream/{session_id}")
async def stream_events(
    session_id: str,
    request: Request,
    tenant_id: str = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    """SSE endpoint for real-time copilot sidebar updates. Requires auth + session ownership."""
    # Verify session belongs to this tenant
    stmt = select(AdvisorySession).where(
        AdvisorySession.id == session_id,
        AdvisorySession.tenant_id == tenant_id,
    )
    result = await db.execute(stmt)
    if not result.scalars().first():
        raise NotFoundError("AdvisorySession", session_id)

    async def event_generator():
        queue = await subscribe(session_id)
        logger.info("sse.connected", session_id=session_id, tenant_id=tenant_id)

        try:
            while True:
                if await request.is_disconnected():
                    break

                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"event: {event['event']}\ndata: {event['data']}\n\n"
                except TimeoutError:
                    yield f"event: heartbeat\ndata: {json.dumps({'status': 'alive'})}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            logger.info("sse.disconnected", session_id=session_id)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
