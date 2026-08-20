from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from schema.RoleDto import RoleCreate, RoleResponse, RoleWithPermissionsResponse
from schema.RolePermissionDto import RolePermissionCreate
from models.user import User
from services import role_service
from services.auth_service import get_authenticated_user
from core.db import get_db

router = APIRouter()


@router.get("/", response_model=list[RoleResponse])
def list_roles(db: Session = Depends(get_db)):
    return role_service.get_all(db)


@router.post("/", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(
    payload: RoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return role_service.create(payload, db)


@router.get("/{role_id}", response_model=RoleWithPermissionsResponse)
def get_role(role_id: UUID, db: Session = Depends(get_db)):
    return role_service.get_with_permissions(role_id, db)


@router.post("/{role_id}/permissions", status_code=status.HTTP_201_CREATED)
def assign_permission(
    role_id: UUID,
    payload: RolePermissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    role_service.assign_permission(role_id, payload.permission_id, db)
    return {"message": "Permission assigned"}


@router.delete("/{role_id}/permissions/{permission_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_permission(
    role_id: UUID,
    permission_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    role_service.remove_permission(role_id, permission_id, db)