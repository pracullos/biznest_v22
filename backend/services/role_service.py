from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from schema.PermissionDto import PermissionResponse
from schema.RoleDto import RoleCreate, RoleWithPermissionsResponse
from models.permission import Permission
from models.role import Role
from models.role_permission import RolePermission


def get_all(db: Session) -> list[Role]:
    return db.query(Role).all()


def get_or_404(role_id: UUID, db: Session) -> Role:
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


def get_with_permissions(role_id: UUID, db: Session) -> RoleWithPermissionsResponse:
    role = get_or_404(role_id, db)
    permissions = [rp.permission for rp in role.role_permissions]
    return RoleWithPermissionsResponse(
        id=role.id,
        name=role.name,
        created_at=role.created_at,
        permissions=[PermissionResponse.model_validate(p) for p in permissions],
    )


def create(payload: RoleCreate, db: Session) -> Role:
    role = Role(**payload.model_dump())
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


def assign_permission(role_id: UUID, permission_id: UUID, db: Session) -> None:
    get_or_404(role_id, db)
    if not db.query(Permission).filter(Permission.id == permission_id).first():
        raise HTTPException(status_code=404, detail="Permission not found")
    existing = db.query(RolePermission).filter(
        RolePermission.role_id == role_id,
        RolePermission.permission_id == permission_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Permission already assigned to role")
    db.add(RolePermission(role_id=role_id, permission_id=permission_id))
    db.commit()


def remove_permission(role_id: UUID, permission_id: UUID, db: Session) -> None:
    rp = db.query(RolePermission).filter(
        RolePermission.role_id == role_id,
        RolePermission.permission_id == permission_id,
    ).first()
    if not rp:
        raise HTTPException(status_code=404, detail="Role-permission link not found")
    db.delete(rp)
    db.commit()