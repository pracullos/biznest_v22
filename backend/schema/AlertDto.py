from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AlertCreate(BaseModel):
    city_id: UUID | None = None
    type: str | None = None
    message: str | None = None


class AlertUpdate(BaseModel):
    type: str | None = None
    message: str | None = None


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    city_id: UUID | None
    type: str | None
    message: str | None
    created_at: datetime