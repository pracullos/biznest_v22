from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from schema.UserRoleDto import UserRoleAssign
from models.role import Role
from models.user import User
from models.user_role import UserRole


def get_by_user(user_id: UUID, db: Session) -> list[UserRole]:
    return db.query(UserRole).filter(UserRole.user_id == user_id).all()


def assign(payload: UserRoleAssign, db: Session) -> UserRole:
    if not db.query(User).filter(User.id == payload.user_id).first():
        raise HTTPException(status_code=404, detail="User not found")
    if not db.query(Role).filter(Role.id == payload.role_id).first():
        raise HTTPException(status_code=404, detail="Role not found")
    if db.query(UserRole).filter(UserRole.user_id == payload.user_id, UserRole.role_id == payload.role_id).first():
        raise HTTPException(status_code=409, detail="Role already assigned to user")
    user_role = UserRole(**payload.model_dump())
    db.add(user_role)
    db.commit()
    db.refresh(user_role)
    return user_role


def remove(payload: UserRoleAssign, db: Session) -> None:
    user_role = db.query(UserRole).filter(
        UserRole.user_id == payload.user_id,
        UserRole.role_id == payload.role_id,
    ).first()
    if not user_role:
        raise HTTPException(status_code=404, detail="Role not assigned to user")
    db.delete(user_role)
    db.commit()