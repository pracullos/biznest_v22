from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from schema.PermissionDto import PermissionCreate, PermissionResponse
from models.user import User
from services import permission_service
from services.auth_service import get_authenticated_user
from core.db import get_db

router = APIRouter()


@router.get("/", response_model=list[PermissionResponse])
def list_permissions(db: Session = Depends(get_db)):
    return permission_service.get_all(db)


@router.post("/", response_model=PermissionResponse, status_code=status.HTTP_201_CREATED)
def create_permission(
    payload: PermissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return permission_service.create(payload, db)