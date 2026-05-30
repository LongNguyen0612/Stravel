import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

# NO `from __future__ import annotations` — crashes SQLModel table creation


class SessionEvent(SQLModel, table=True):
    __tablename__ = "session_events"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    session_id: uuid.UUID = Field(index=True, foreign_key="advisory_sessions.id")
    sse_id: int = Field(index=True)
    event_type: str = Field(max_length=64)
    event_data: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
