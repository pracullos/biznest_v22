from uuid import UUID

from pydantic import BaseModel, ConfigDict

from schema.RoleDto import RoleResponse


class UserRoleAssign(BaseModel):
    user_id: UUID
    role_id: UUID


class UserRoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    role_id: UUID
    role: RoleResponse