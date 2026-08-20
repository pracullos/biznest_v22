from fastapi import HTTPException
from sqlalchemy.orm import Session

from schema.PermissionDto import PermissionCreate
from models.permission import Permission


def get_all(db: Session) -> list[Permission]:
    return db.query(Permission).all()


def create(payload: PermissionCreate, db: Session) -> Permission:
    if db.query(Permission).filter(Permission.name == payload.name).first():
        raise HTTPException(status_code=409, detail="Permission already exists")
    perm = Permission(**payload.model_dump())
    db.add(perm)
    db.commit()
    db.refresh(perm)
    return perm