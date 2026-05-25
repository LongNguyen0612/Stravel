import uuid
from datetime import date, datetime

from pydantic import BaseModel


class TravelerProfileResponse(BaseModel):
    id: uuid.UUID
    advisory_session_id: uuid.UUID
    traveler_count: int | None = None
    traveler_ages: list[int] | None = None
    nationalities: list[str] | None = None
    travel_start_date: date | None = None
    travel_end_date: date | None = None
    date_flexibility: str | None = None
    budget_total: float | None = None
    budget_currency: str | None = None
    destination_preferences: list[str] | None = None
    accommodation_style: str | None = None
    dietary_requirements: list[str] | None = None
    accessibility_needs: list[str] | None = None
    activity_preferences: list[str] | None = None
    special_interests: list[str] | None = None
    passport_expiry_date: date | None = None
    is_confirmed: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TravelerProfileUpdateRequest(BaseModel):
    traveler_count: int | None = None
    traveler_ages: list[int] | None = None
    nationalities: list[str] | None = None
    travel_start_date: date | None = None
    travel_end_date: date | None = None
    date_flexibility: str | None = None
    budget_total: float | None = None
    budget_currency: str | None = None
    destination_preferences: list[str] | None = None
    accommodation_style: str | None = None
    dietary_requirements: list[str] | None = None
    accessibility_needs: list[str] | None = None
    activity_preferences: list[str] | None = None
    special_interests: list[str] | None = None
    passport_expiry_date: date | None = None
