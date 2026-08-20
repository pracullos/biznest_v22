from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class InvestorCityAccessCreate(BaseModel):
    user_id: UUID
    city_id: UUID


class InvestorCityAccessResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    city_id: UUID
    granted_at: datetime