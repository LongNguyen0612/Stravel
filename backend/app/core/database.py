import re
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import create_engine

from app.core.config import settings

# Sync engine for Alembic migrations
engine = create_engine(settings.database_url, echo=settings.environment == "development")

# Async engine for FastAPI endpoints — safely convert any postgresql variant to asyncpg
_async_url = re.sub(r"^postgres(?:ql)?(?:\+\w+)?://", "postgresql+asyncpg://", settings.database_url)
async_engine = create_async_engine(_async_url, echo=settings.environment == "development")

async_session_factory = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session
