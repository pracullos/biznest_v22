from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from schema.AlertDto import AlertCreate, AlertUpdate
from models.alert import Alert
from models.city import City


def get_by_city(city_id: UUID, db: Session) -> list[Alert]:
    return db.query(Alert).filter(Alert.city_id == city_id).all()


def get_or_404(alert_id: UUID, city_id: UUID, db: Session) -> Alert:
    alert = db.query(Alert).filter(Alert.id == alert_id, Alert.city_id == city_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


def create(city_id: UUID, payload: AlertCreate, db: Session) -> Alert:
    if not db.query(City).filter(City.id == city_id).first():
        raise HTTPException(status_code=404, detail="City not found")
    alert = Alert(city_id=city_id, type=payload.type, message=payload.message)
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def update(alert_id: UUID, city_id: UUID, payload: AlertUpdate, db: Session) -> Alert:
    alert = get_or_404(alert_id, city_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(alert, field, value)
    db.commit()
    db.refresh(alert)
    return alert


def delete(alert_id: UUID, city_id: UUID, db: Session) -> None:
    alert = get_or_404(alert_id, city_id, db)
    db.delete(alert)
    db.commit()