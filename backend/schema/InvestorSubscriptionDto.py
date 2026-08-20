from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SubscriptionPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:         UUID
    name:       str
    max_cities: int | None
    created_at: datetime


class InvestorSubscriptionCreate(BaseModel):
    user_id:    UUID
    plan_id:    UUID
    expires_at: datetime | None = None


class InvestorSubscriptionUpdate(BaseModel):
    plan_id:    UUID | None = None
    expires_at: datetime | None = None


class InvestorSubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:         UUID
    user_id:    UUID
    plan_id:    UUID
    plan:       SubscriptionPlanResponse
    created_at: datetime
    expires_at: datetime | None