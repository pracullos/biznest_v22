from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class EstablishmentCreate(BaseModel):
    city_id: UUID
    name: str | None = None
    category: str | None = None  # restaurant, mall, etc.
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    owner_id: UUID | None = None


class EstablishmentUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None


class EstablishmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    city_id: UUID
    name: str | None
    category: str | None
    latitude: Decimal | None
    longitude: Decimal | None
    owner_id: UUID | None
    created_at: datetime