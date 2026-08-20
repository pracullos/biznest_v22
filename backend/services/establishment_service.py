from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from schema.EstablishmentDto import EstablishmentCreate, EstablishmentUpdate
from models.city import City
from models.establishment import Establishment


def get_by_city(city_id: UUID, db: Session) -> list[Establishment]:
    return db.query(Establishment).filter(Establishment.city_id == city_id).all()


def get_or_404(est_id: UUID, city_id: UUID, db: Session) -> Establishment:
    est = db.query(Establishment).filter(Establishment.id == est_id, Establishment.city_id == city_id).first()
    if not est:
        raise HTTPException(status_code=404, detail="Establishment not found")
    return est


def create(city_id: UUID, payload: EstablishmentCreate, db: Session) -> Establishment:
    if not db.query(City).filter(City.id == city_id).first():
        raise HTTPException(status_code=404, detail="City not found")
    est = Establishment(**payload.model_dump())
    db.add(est)
    db.commit()
    db.refresh(est)
    return est


def update(est_id: UUID, city_id: UUID, payload: EstablishmentUpdate, db: Session) -> Establishment:
    est = get_or_404(est_id, city_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(est, field, value)
    db.commit()
    db.refresh(est)
    return est


def delete(est_id: UUID, city_id: UUID, db: Session) -> None:
    est = get_or_404(est_id, city_id, db)
    db.delete(est)
    db.commit()