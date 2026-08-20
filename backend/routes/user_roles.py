from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from schema.UserRoleDto import UserRoleAssign, UserRoleResponse
from models.user import User
from services import user_role_service
from services.auth_service import get_authenticated_user
from core.db import get_db

router = APIRouter()


@router.get("/{user_id}", response_model=list[UserRoleResponse])
def get_user_roles(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return user_role_service.get_by_user(user_id, db)


@router.post("/", response_model=UserRoleResponse, status_code=status.HTTP_201_CREATED)
def assign_role(
    payload: UserRoleAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return user_role_service.assign(payload, db)


@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
def remove_role(
    payload: UserRoleAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    user_role_service.remove(payload, db)