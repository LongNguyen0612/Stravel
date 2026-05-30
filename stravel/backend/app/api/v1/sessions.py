import asyncio
import uuid
from datetime import datetime
from typing import Any

import structlog
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.database import get_session
from app.core.dependencies import get_current_tenant_id
from app.core.exceptions import NotFoundError, ValidationError
from app.models.advisory_session import AdvisorySession, SessionStatus
from app.models.traveler_profile import TravelerProfile
from app.schemas.profile import TravelerProfileResponse, TravelerProfileUpdateRequest
from app.schemas.session import (
    SessionCreateRequest,
    SessionListResponse,
    SessionResponse,
    SessionStatusUpdateRequest,
    SessionUpdateRequest,
)
from app.services.event_persistence import get_session_events
from app.services.propose_first import build_profile_with_defaults, compose_commitment_message, detect_intent


class SessionEventResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    sse_id: int
    event_type: str
    event_data: dict[str, Any]
    created_at: datetime


class ProposeFirstRequest(BaseModel):
    message: str


class ProposeFirstResponse(BaseModel):
    bot_message: str
    extracted_slots: dict[str, Any]
    assumed_slots: list[str]
    is_surprise_me: bool

router = APIRouter(prefix="/advisory_sessions", tags=["advisory_sessions"])
logger = structlog.get_logger()


@router.post("", response_model=SessionResponse, status_code=201)
async def create_session(
    body: SessionCreateRequest,
    tenant_id: str = Depends(get_current_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> AdvisorySession:
    advisory_session = AdvisorySession(tenant_id=tenant_id)
    session.add(advisory_session)
    await session.flush()

    profile = TravelerProfile(advisory_session_id=advisory_session.id, tenant_id=tenant_id)
    session.add(profile)
    await session.commit()
    await session.refresh(advisory_session, attribute_names=["traveler_profile"])

    structlog.contextvars.bind_contextvars(session_id=str(advisory_session.id), tenant_id=tenant_id)
    logger.info("session.created", status=advisory_session.status.value)
    return advisory_session


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session_by_id(
    session_id: uuid.UUID,
    tenant_id: str = Depends(get_current_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> AdvisorySession:
    stmt = select(AdvisorySession).where(
        AdvisorySession.id == session_id,
        AdvisorySession.tenant_id == tenant_id,
    )
    result = await session.execute(stmt)
    advisory_session = result.scalars().first()
    if not advisory_session:
        raise NotFoundError("AdvisorySession", str(session_id))

    await session.refresh(advisory_session, attribute_names=["traveler_profile"])
    structlog.contextvars.bind_contextvars(session_id=str(session_id), tenant_id=tenant_id)
    logger.info("session.retrieved")
    return advisory_session


@router.patch("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: uuid.UUID,
    body: SessionUpdateRequest,
    tenant_id: str = Depends(get_current_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> AdvisorySession:
    stmt = select(AdvisorySession).where(
        AdvisorySession.id == session_id,
        AdvisorySession.tenant_id == tenant_id,
    )
    result = await session.execute(stmt)
    advisory_session = result.scalars().first()
    if not advisory_session:
        raise NotFoundError("AdvisorySession", str(session_id))

    if body.status == SessionStatus.FLAGGED:
        raise ValidationError("Use PATCH /{session_id}/status to flag a session (flag_reason required)")
    if body.status not in VALID_B2B_TRANSITIONS.get(advisory_session.status, []):
        raise ValidationError(f"Invalid status transition: {advisory_session.status.value} → {body.status.value}")

    advisory_session.status = body.status
    advisory_session.updated_at = datetime.utcnow()
    session.add(advisory_session)
    await session.commit()
    await session.refresh(advisory_session, attribute_names=["traveler_profile"])

    structlog.contextvars.bind_contextvars(session_id=str(session_id), tenant_id=tenant_id)
    logger.info("session.updated", new_status=body.status.value)
    return advisory_session


VALID_B2B_TRANSITIONS = {
    SessionStatus.PENDING: [SessionStatus.CONFIRMED, SessionStatus.FLAGGED],
    SessionStatus.CONFIRMED: [SessionStatus.MODIFIED, SessionStatus.FLAGGED],
    SessionStatus.MODIFIED: [SessionStatus.CONFIRMED, SessionStatus.FLAGGED],
    SessionStatus.FLAGGED: [SessionStatus.FLAGGED],
}


@router.patch("/{session_id}/status", response_model=SessionResponse)
async def update_session_b2b_status(
    session_id: uuid.UUID,
    body: SessionStatusUpdateRequest,
    tenant_id: str = Depends(get_current_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> AdvisorySession:
    stmt = select(AdvisorySession).where(
        AdvisorySession.id == session_id,
        AdvisorySession.tenant_id == tenant_id,
    )
    result = await session.execute(stmt)
    advisory_session = result.scalars().first()
    if not advisory_session:
        raise NotFoundError("AdvisorySession", str(session_id))

    if body.status == SessionStatus.FLAGGED and not body.flag_reason:
        raise ValidationError("flag_reason required when status is flagged")

    from_status = advisory_session.status
    if body.status not in VALID_B2B_TRANSITIONS.get(from_status, []):
        raise ValidationError(f"Invalid status transition: {from_status.value} → {body.status.value}")

    advisory_session.status = body.status
    advisory_session.flag_reason = body.flag_reason
    advisory_session.updated_at = datetime.utcnow()
    session.add(advisory_session)
    await session.commit()
    await session.refresh(advisory_session, attribute_names=["traveler_profile"])

    structlog.contextvars.bind_contextvars(session_id=str(session_id), tenant_id=tenant_id)
    logger.info("session.b2b_status_updated", from_status=from_status.value, to_status=body.status.value)
    return advisory_session


@router.get("", response_model=SessionListResponse)
async def list_sessions(
    tenant_id: str = Depends(get_current_tenant_id),
    session: AsyncSession = Depends(get_session),
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    count_stmt = select(func.count()).select_from(AdvisorySession).where(AdvisorySession.tenant_id == tenant_id)
    count_result = await session.execute(count_stmt)
    total = count_result.scalar_one()

    stmt = (
        select(AdvisorySession)
        .where(AdvisorySession.tenant_id == tenant_id)
        .offset(offset)
        .limit(limit)
        .order_by(AdvisorySession.created_at.desc())
    )
    result = await session.execute(stmt)
    items = result.scalars().all()

    for item in items:
        await session.refresh(item, attribute_names=["traveler_profile"])

    logger.info("session.listed", count=len(items), total=total, tenant_id=tenant_id)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.patch("/{session_id}/profile", response_model=TravelerProfileResponse)
async def update_profile(
    session_id: uuid.UUID,
    body: TravelerProfileUpdateRequest,
    tenant_id: str = Depends(get_current_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> TravelerProfile:
    stmt = select(AdvisorySession).where(
        AdvisorySession.id == session_id,
        AdvisorySession.tenant_id == tenant_id,
    )
    result = await session.execute(stmt)
    if not result.scalars().first():
        raise NotFoundError("AdvisorySession", str(session_id))

    stmt = select(TravelerProfile).where(TravelerProfile.advisory_session_id == session_id)
    result = await session.execute(stmt)
    profile = result.scalars().first()
    if not profile:
        raise NotFoundError("TravelerProfile", str(session_id))

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    profile.updated_at = datetime.utcnow()
    session.add(profile)
    await session.commit()
    await session.refresh(profile)
    logger.info("profile.updated", session_id=str(session_id))
    return profile


@router.get("/{session_id}/events", response_model=list[SessionEventResponse])
async def get_events(
    session_id: uuid.UUID,
    tenant_id: str = Depends(get_current_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> list[SessionEventResponse]:
    """Return all persisted SSE events for a session, ordered by sse_id (for tab-return hydration)."""
    stmt = select(AdvisorySession).where(
        AdvisorySession.id == session_id,
        AdvisorySession.tenant_id == tenant_id,
    )
    result = await session.execute(stmt)
    if not result.scalars().first():
        raise NotFoundError("AdvisorySession", str(session_id))

    events = await get_session_events(str(session_id))
    logger.info("session.events_fetched", session_id=str(session_id), count=len(events))
    return [
        SessionEventResponse(
            id=e.id,
            session_id=e.session_id,
            sse_id=e.sse_id,
            event_type=e.event_type,
            event_data=e.event_data,
            created_at=e.created_at,
        )
        for e in events
    ]


@router.post("/{session_id}/propose-first", response_model=ProposeFirstResponse)
async def propose_first_route(
    session_id: uuid.UUID,
    body: ProposeFirstRequest,
    tenant_id: str = Depends(get_current_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> ProposeFirstResponse:
    """Propose-first fast-path: detect intent, fill defaults, fire workflow, return commitment message."""
    stmt = select(AdvisorySession).where(
        AdvisorySession.id == session_id,
        AdvisorySession.tenant_id == tenant_id,
    )
    result = await session.execute(stmt)
    if not result.scalars().first():
        raise NotFoundError("AdvisorySession", str(session_id))

    extracted = detect_intent(body.message)
    profile_patch, assumed_slots = await build_profile_with_defaults(str(session_id), extracted, session)

    # Patch TravelerProfile with extracted + default values
    stmt = select(TravelerProfile).where(TravelerProfile.advisory_session_id == session_id)
    result = await session.execute(stmt)
    profile = result.scalars().first()
    if profile is None:
        raise NotFoundError("TravelerProfile", str(session_id))
    for field, value in profile_patch.items():
        setattr(profile, field, value)
    from datetime import datetime
    profile.updated_at = datetime.utcnow()
    session.add(profile)
    await session.commit()

    from app.services.workflow import run_advisory_workflow

    asyncio.create_task(run_advisory_workflow(str(session_id), profile_patch))
    bot_message = compose_commitment_message(profile_patch, extracted)

    logger.info("propose_first.triggered", session_id=str(session_id), assumed_slots=assumed_slots)
    return ProposeFirstResponse(
        bot_message=bot_message,
        extracted_slots=extracted,
        assumed_slots=assumed_slots,
        is_surprise_me=extracted["is_surprise_me"],
    )


@router.post("/{session_id}/run", status_code=202)
async def run_session(
    session_id: uuid.UUID,
    tenant_id: str = Depends(get_current_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Trigger the AI advisory workflow for a session. Returns immediately; streams events via SSE."""
    stmt = select(AdvisorySession).where(
        AdvisorySession.id == session_id,
        AdvisorySession.tenant_id == tenant_id,
    )
    result = await session.execute(stmt)
    advisory_session = result.scalars().first()
    if not advisory_session:
        raise NotFoundError("AdvisorySession", str(session_id))

    stmt = select(TravelerProfile).where(TravelerProfile.advisory_session_id == session_id)
    result = await session.execute(stmt)
    profile = result.scalars().first()
    profile_dict = profile.model_dump() if profile else {}

    from app.services.workflow import run_advisory_workflow

    # ARCH-1: fire-and-forget; generation continues if SSE client disconnects
    asyncio.create_task(run_advisory_workflow(str(session_id), profile_dict))
    logger.info("workflow.triggered", session_id=str(session_id))
    return {"status": "started", "session_id": str(session_id)}
