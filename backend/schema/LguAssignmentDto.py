from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class LguAssignmentCreate(BaseModel):
    user_id: UUID
    city_id: UUID


class LguAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    city_id: UUID
    created_at: datetime