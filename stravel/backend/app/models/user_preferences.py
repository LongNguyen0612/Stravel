import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import JSON
from sqlmodel import Field, SQLModel


class UserPreferences(SQLModel, table=True):
    __tablename__ = "user_preferences"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="tenant_users.id", index=True, unique=True)
    trip_name: Optional[str] = Field(default=None, max_length=255)
    past_destinations: Optional[List[str]] = Field(default=None, sa_type=JSON)
    travel_style: Optional[str] = Field(default=None, max_length=64)
    dietary_restrictions: Optional[List[str]] = Field(default=None, sa_type=JSON)
    created_at: datetime = Field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = Field(default_factory=lambda: datetime.utcnow())
