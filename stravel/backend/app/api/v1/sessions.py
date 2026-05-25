import uuid
from datetime import datetime

import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.database import get_session
from app.core.dependencies import get_current_tenant_id
from app.core.exceptions import NotFoundError, ValidationError
from app.models.advisory_session import AdvisorySession, SessionStatus
from app.models.traveler_profile import TravelerProfile
from app.schemas.session import SessionCreateRequest, SessionListResponse, SessionResponse, SessionUpdateRequest

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

    valid_transitions = {
        SessionStatus.IN_PROGRESS: [SessionStatus.COMPLETED, SessionStatus.ARCHIVED],
        SessionStatus.COMPLETED: [SessionStatus.ARCHIVED],
        SessionStatus.ARCHIVED: [],
    }
    if body.status not in valid_transitions.get(advisory_session.status, []):
        raise ValidationError(f"Cannot transition from {advisory_session.status.value} to {body.status.value}")

    advisory_session.status = body.status
    advisory_session.updated_at = datetime.utcnow()
    session.add(advisory_session)
    await session.commit()
    await session.refresh(advisory_session, attribute_names=["traveler_profile"])

    structlog.contextvars.bind_contextvars(session_id=str(session_id), tenant_id=tenant_id)
    logger.info("session.updated", new_status=body.status.value)
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
