from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from schema.AlertDto import AlertCreate, AlertResponse, AlertUpdate
from models.user import User
from services import alert_service
from services.auth_service import get_authenticated_user
from core.db import get_db

router = APIRouter()


@router.get("/{city_id}/alerts", response_model=list[AlertResponse])
def list_alerts(city_id: UUID, db: Session = Depends(get_db)):
    return alert_service.get_by_city(city_id, db)


@router.post("/{city_id}/alerts", response_model=AlertResponse, status_code=status.HTTP_201_CREATED)
def create_alert(
    city_id: UUID,
    payload: AlertCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return alert_service.create(city_id, payload, db)


@router.patch("/{city_id}/alerts/{alert_id}", response_model=AlertResponse)
def update_alert(
    city_id: UUID,
    alert_id: UUID,
    payload: AlertUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return alert_service.update(alert_id, city_id, payload, db)


@router.delete("/{city_id}/alerts/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_alert(
    city_id: UUID,
    alert_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    alert_service.delete(alert_id, city_id, db)