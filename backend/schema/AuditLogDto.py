from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AuditLogCreate(BaseModel):
    user_id: UUID | None = None
    city_id: UUID | None = None
    action: str | None = None
    meta: dict[str, Any] | None = None


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID | None
    city_id: UUID | None
    action: str | None
    meta: dict[str, Any] | None
    created_at: datetime