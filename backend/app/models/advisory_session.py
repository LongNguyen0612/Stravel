import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, Relationship, SQLModel


class SessionStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class AdvisorySession(SQLModel, table=True):
    __tablename__ = "advisory_sessions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    tenant_id: str = Field(index=True, max_length=64)
    status: SessionStatus = Field(default=SessionStatus.IN_PROGRESS)
    created_at: datetime = Field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = Field(default_factory=lambda: datetime.utcnow())

    traveler_profile: Optional["TravelerProfile"] = Relationship(  # noqa: F821
        back_populates="advisory_session",
        sa_relationship_kwargs={"uselist": False, "cascade": "all, delete-orphan"},
    )
