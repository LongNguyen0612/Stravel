import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import JSON
from sqlmodel import Field, Relationship, SQLModel

from app.models.advisory_session import AdvisorySession


class TravelerProfile(SQLModel, table=True):
    __tablename__ = "traveler_profiles"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    advisory_session_id: uuid.UUID = Field(foreign_key="advisory_sessions.id", unique=True, index=True)
    tenant_id: str = Field(index=True, max_length=64)

    # Demographics
    traveler_count: int | None = None
    traveler_ages: list[int] | None = Field(default=None, sa_type=JSON)
    nationalities: list[str] | None = Field(default=None, sa_type=JSON)

    # Dates
    travel_start_date: date | None = None
    travel_end_date: date | None = None
    date_flexibility: str | None = None

    # Budget
    budget_total: float | None = None
    budget_currency: str | None = Field(default="USD", max_length=3)

    # Preferences
    destination_preferences: list[str] | None = Field(default=None, sa_type=JSON)
    accommodation_style: str | None = None
    dietary_requirements: list[str] | None = Field(default=None, sa_type=JSON)
    accessibility_needs: list[str] | None = Field(default=None, sa_type=JSON)
    activity_preferences: list[str] | None = Field(default=None, sa_type=JSON)
    special_interests: list[str] | None = Field(default=None, sa_type=JSON)

    # Compliance
    passport_expiry_date: date | None = None

    # Metadata
    is_confirmed: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = Field(default_factory=lambda: datetime.utcnow())

    advisory_session: Optional[AdvisorySession] = Relationship(back_populates="traveler_profile")
