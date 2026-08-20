from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from schema.EstablishmentDto import EstablishmentCreate, EstablishmentResponse, EstablishmentUpdate
from models.user import User
from services import establishment_service
from services.auth_service import get_authenticated_user
from core.db import get_db

router = APIRouter()


@router.get("/{city_id}/establishments", response_model=list[EstablishmentResponse])
def list_establishments(city_id: UUID, db: Session = Depends(get_db)):
    return establishment_service.get_by_city(city_id, db)


@router.post("/{city_id}/establishments", response_model=EstablishmentResponse, status_code=status.HTTP_201_CREATED)
def create_establishment(
    city_id: UUID,
    payload: EstablishmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return establishment_service.create(city_id, payload, db)


@router.get("/{city_id}/establishments/{est_id}", response_model=EstablishmentResponse)
def get_establishment(city_id: UUID, est_id: UUID, db: Session = Depends(get_db)):
    return establishment_service.get_or_404(est_id, city_id, db)


@router.patch("/{city_id}/establishments/{est_id}", response_model=EstablishmentResponse)
def update_establishment(
    city_id: UUID,
    est_id: UUID,
    payload: EstablishmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return establishment_service.update(est_id, city_id, payload, db)


@router.delete("/{city_id}/establishments/{est_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_establishment(
    city_id: UUID,
    est_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    establishment_service.delete(est_id, city_id, db)