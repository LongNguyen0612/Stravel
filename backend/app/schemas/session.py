import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.advisory_session import SessionStatus
from app.schemas.profile import TravelerProfileResponse


class SessionCreateRequest(BaseModel):
    pass


class SessionUpdateRequest(BaseModel):
    status: SessionStatus


class SessionResponse(BaseModel):
    id: uuid.UUID
    tenant_id: str
    status: SessionStatus
    created_at: datetime
    updated_at: datetime
    traveler_profile: TravelerProfileResponse | None = None

    model_config = {"from_attributes": True}


class SessionListResponse(BaseModel):
    items: list[SessionResponse]
    total: int
    limit: int
    offset: int
