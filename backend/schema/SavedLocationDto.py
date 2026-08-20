from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SavedLocationCreate(BaseModel):
    city_id: UUID | None = None
    name: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None


class SavedLocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    city_id: UUID | None
    name: str | None
    latitude: Decimal | None
    longitude: Decimal | None
    created_at: datetime