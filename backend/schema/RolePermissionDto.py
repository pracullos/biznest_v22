from uuid import UUID

from pydantic import BaseModel


class RolePermissionCreate(BaseModel):
    role_id: UUID
    permission_id: UUID


class RolePermissionRemove(BaseModel):
    role_id: UUID
    permission_id: UUID