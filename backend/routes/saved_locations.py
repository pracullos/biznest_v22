from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from schema.SavedLocationDto import SavedLocationCreate, SavedLocationResponse
from models.user import User
from services import saved_location_service
from services.auth_service import get_authenticated_user
from core.db import get_db

router = APIRouter()


@router.get("/", response_model=list[SavedLocationResponse])
def list_saved_locations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return saved_location_service.get_by_user(current_user.id, db)


@router.post("/", response_model=SavedLocationResponse, status_code=status.HTTP_201_CREATED)
def save_location(
    payload: SavedLocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return saved_location_service.create(current_user.id, payload, db)


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_location(
    location_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    saved_location_service.delete(location_id, current_user.id, db)