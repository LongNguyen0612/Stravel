import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Column
from sqlalchemy import Enum as SAEnum
from sqlmodel import Field, Relationship, SQLModel


class SessionStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    MODIFIED = "modified"
    FLAGGED = "flagged"


class AdvisorySession(SQLModel, table=True):
    __tablename__ = "advisory_sessions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    tenant_id: str = Field(index=True, max_length=64)
    # native_enum=False → stored as VARCHAR(20) with CHECK constraint, not a PG ENUM type
    status: SessionStatus = Field(
        default=SessionStatus.PENDING,
        sa_column=Column(
            SAEnum(SessionStatus, native_enum=False, length=20, values_callable=lambda obj: [e.value for e in obj]),
            nullable=False,
            default="pending",
        ),
    )
    flag_reason: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = Field(default_factory=lambda: datetime.utcnow())

    traveler_profile: Optional["TravelerProfile"] = Relationship(  # noqa: F821
        back_populates="advisory_session",
        sa_relationship_kwargs={"uselist": False, "cascade": "all, delete-orphan"},
    )
