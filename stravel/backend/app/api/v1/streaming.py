import asyncio

import structlog
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from starlette.responses import StreamingResponse

from app.core.auth import decode_access_token
from app.core.database import get_session
from app.core.exceptions import AppError, NotFoundError
from app.core.tenant import set_tenant_id
from app.models.advisory_session import AdvisorySession
from app.services.event_bus import subscribe, unsubscribe

router = APIRouter(tags=["streaming"])
logger = structlog.get_logger()


async def get_tenant_id_for_stream(
    request: Request,
    token: str | None = Query(default=None),
) -> str:
    """Accept JWT from Authorization header OR ?token= query param (needed for EventSource)."""
    raw = token
    if not raw:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            raw = auth[7:]
    if not raw:
        raise AppError(code="NOT_AUTHENTICATED", message="Not authenticated", status_code=401)
    try:
        payload = decode_access_token(raw)
    except Exception:
        raise AppError(code="INVALID_TOKEN", message="Invalid or expired token", status_code=401)
    if not isinstance(payload, dict):
        raise AppError(code="INVALID_TOKEN", message="Invalid token payload", status_code=401)
    tenant_id = payload.get("tenant_id", "")
    if not tenant_id:
        raise AppError(code="MISSING_TENANT", message="Token missing tenant_id", status_code=401)
    set_tenant_id(tenant_id)
    return tenant_id


@router.get("/stream/{session_id}")
async def stream_events(
    session_id: str,
    request: Request,
    tenant_id: str = Depends(get_tenant_id_for_stream),
    db: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    """SSE endpoint for real-time copilot sidebar updates. Requires auth + session ownership."""
    stmt = select(AdvisorySession).where(
        AdvisorySession.id == session_id,
        AdvisorySession.tenant_id == tenant_id,
    )
    result = await db.execute(stmt)
    if not result.scalars().first():
        raise NotFoundError("AdvisorySession", session_id)

    async def event_generator():
        last_event_id_raw = request.headers.get("last-event-id")
        try:
            last_event_id = int(last_event_id_raw) if last_event_id_raw else None
        except (ValueError, TypeError):
            last_event_id = None

        queue = await subscribe(session_id, last_event_id=last_event_id)
        logger.info("sse.connected", session_id=session_id, tenant_id=tenant_id,
                    last_event_id=last_event_id, replay_count=queue.qsize())

        try:
            while True:
                if await request.is_disconnected():
                    break

                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15.0)
                    logger.info("sse.event_sent", session_id=session_id, event_type=event["event"])
                    # ARCH-1: event_generator never awaits run_advisory_workflow; reads from queue only
                    yield f"id: {event['sse_id']}\nevent: {event['event']}\ndata: {event['data']}\n\n"
                except TimeoutError:
                    # Keepalive has NO id: prefix — must not advance the client's Last-Event-ID counter
                    yield "event: keepalive\ndata: {}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            unsubscribe(session_id, queue)
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
