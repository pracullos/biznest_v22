from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from schema.SavedLocationDto import SavedLocationCreate
from models.saved_location import SavedLocation


def get_by_user(user_id: UUID, db: Session) -> list[SavedLocation]:
    return db.query(SavedLocation).filter(SavedLocation.user_id == user_id).all()


def create(user_id: UUID, payload: SavedLocationCreate, db: Session) -> SavedLocation:
    location = SavedLocation(user_id=user_id, **payload.model_dump())
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


def delete(location_id: UUID, user_id: UUID, db: Session) -> None:
    location = db.query(SavedLocation).filter(
        SavedLocation.id == location_id,
        SavedLocation.user_id == user_id,
    ).first()
    if not location:
        raise HTTPException(status_code=404, detail="Saved location not found")
    db.delete(location)
    db.commit()