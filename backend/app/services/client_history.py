import structlog
from sqlalchemy import cast, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.types import String
from sqlmodel import select

from app.models.advisory_session import AdvisorySession
from app.models.traveler_profile import TravelerProfile

logger = structlog.get_logger()


async def search_sessions(
    session: AsyncSession,
    tenant_id: str,
    query: str | None = None,
    limit: int = 20,
) -> list[AdvisorySession]:
    """Search past advisory sessions by client name, destination, or general query."""
    stmt = select(AdvisorySession).where(AdvisorySession.tenant_id == tenant_id)

    if query:
        q = f"%{query.lower()}%"
        # Join with TravelerProfile to search destination preferences
        stmt = stmt.outerjoin(TravelerProfile).where(
            or_(
                cast(TravelerProfile.destination_preferences, String).ilike(q),
                cast(TravelerProfile.nationalities, String).ilike(q),
            )
        )

    stmt = stmt.order_by(AdvisorySession.created_at.desc()).limit(limit)

    result = await session.execute(stmt)
    sessions = result.scalars().all()

    for s in sessions:
        await session.refresh(s, attribute_names=["traveler_profile"])

    logger.info("client_history.search", tenant_id=tenant_id, query=query, results=len(sessions))
    return list(sessions)
