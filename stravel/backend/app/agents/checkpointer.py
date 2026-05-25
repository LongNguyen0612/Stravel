from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from app.core.config import settings


async def get_checkpointer() -> AsyncPostgresSaver:
    """Create a PostgreSQL-backed checkpointer for LangGraph state persistence."""
    checkpointer = AsyncPostgresSaver.from_conn_string(settings.database_url)
    await checkpointer.setup()
    return checkpointer
