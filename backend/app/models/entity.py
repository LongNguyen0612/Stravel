import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import JSON
from sqlmodel import Field, SQLModel


class EntityType(str, Enum):
    HOTEL = "hotel"
    ATTRACTION = "attraction"
    RESTAURANT = "restaurant"
    VISA_RULE = "visa_rule"
    HEALTH_ADVISORY = "health_advisory"
    TRAVEL_WARNING = "travel_warning"


class Entity(SQLModel, table=True):
    __tablename__ = "entities"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    tenant_id: str = Field(default="global", index=True, max_length=64)
    entity_type: EntityType = Field(index=True)
    name: str = Field(max_length=500)
    region: str = Field(index=True, max_length=100)
    description: str = ""
    location_lat: float | None = None
    location_lng: float | None = None
    pricing: float | None = None
    pricing_currency: str = Field(default="USD", max_length=3)
    rating: float | None = None
    source_url: str = ""
    metadata_extra: dict | None = Field(default=None, sa_type=JSON)
    ingested_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
