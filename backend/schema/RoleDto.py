from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from schema.PermissionDto import PermissionResponse


class RoleCreate(BaseModel):
    name: str


class RoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    created_at: datetime


class RoleWithPermissionsResponse(RoleResponse):
    permissions: list[PermissionResponse] = []