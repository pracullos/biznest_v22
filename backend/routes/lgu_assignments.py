from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from schema.CityDto import CityResponse
from schema.LguAssignmentDto import LguAssignmentCreate, LguAssignmentResponse
from models.user import User
from services import lgu_assignment_service
from services.auth_service import get_authenticated_user
from core.db import get_db

router = APIRouter()


@router.get("/", response_model=list[LguAssignmentResponse])
def list_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return lgu_assignment_service.get_all(db)


@router.post("/", response_model=LguAssignmentResponse, status_code=status.HTTP_201_CREATED)
def create_assignment(
    payload: LguAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return lgu_assignment_service.create(payload, db)


@router.get("/{assignment_id}", response_model=LguAssignmentResponse)
def get_assignment(
    assignment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return lgu_assignment_service.get_or_404(assignment_id, db)


@router.get("/user/{user_id}/city", response_model=CityResponse)
def get_city_by_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return lgu_assignment_service.get_city_by_user(user_id, db)


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(
    assignment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    lgu_assignment_service.delete(assignment_id, db)