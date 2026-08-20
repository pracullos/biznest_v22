from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from schema.LguAssignmentDto import LguAssignmentCreate
from models.city import City
from models.lgu_assignment import LguAssignment


def get_all(db: Session) -> list[LguAssignment]:
    return db.query(LguAssignment).all()


def get_or_404(assignment_id: UUID, db: Session) -> LguAssignment:
    assignment = db.query(LguAssignment).filter(LguAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return assignment


def get_city_by_user(user_id: UUID, db: Session) -> City:
    assignment = db.query(LguAssignment).filter(LguAssignment.user_id == user_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="No assignment found for user")
    return assignment.city


def create(payload: LguAssignmentCreate, db: Session) -> LguAssignment:
    if db.query(LguAssignment).filter(LguAssignment.user_id == payload.user_id).first():
        raise HTTPException(status_code=409, detail="User already assigned to a city")
    assignment = LguAssignment(**payload.model_dump())
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


def delete(assignment_id: UUID, db: Session) -> None:
    assignment = get_or_404(assignment_id, db)
    db.delete(assignment)
    db.commit()