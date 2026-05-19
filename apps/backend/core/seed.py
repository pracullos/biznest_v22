"""
Seeds roles, permissions, and subscription plans on first startup. Idempotent.
"""
from sqlalchemy.orm import Session

from models.permission import Permission
from models.role import Role
from models.role_permission import RolePermission
from models.subscription_plan import SubscriptionPlan


DEFAULT_PLANS = [
    ("free",       1),
    ("premium",    10),
    ("pro",        40),
    ("enterprise", None),  # unlimited
]

DEFAULT_PERMISSIONS = [
    ("manage:city",          "Can manage city data"),
    ("zoning:read",          "View zoning areas"),
    ("zoning:write",         "Create and edit zoning areas"),
    ("hazard:read",          "View hazard areas"),
    ("hazard:write",         "Create and edit hazard areas"),
    ("establishment:read",   "View establishments"),
    ("establishment:write",  "Create and edit establishments"),
    ("alert:read",           "View alerts"),
    ("alert:write",          "Create and manage alerts"),
    ("analytics:view",       "View investment analytics"),
    ("location:save",        "Save personal locations"),
    ("manage:user",          "Manage user and role"),
    ("manage:role",          "Manage role and permissions"),
    ("view:map",             "Access the interactive map"),
    ("manage:subscription",  "View and manage subscription plan"),
    ("manage:logs",          "View audit logs"),
]

ROLES = {
    "investor": [
        "zoning:read",
        "hazard:read",
        "establishment:read",
        "analytics:view",
        "location:save",
        "view:map",
        "manage:subscription",
    ],
    "lgu_admin": [
        "zoning:read",
        "zoning:write",
        "hazard:read",
        "hazard:write",
        "establishment:read",
        "establishment:write",
        "alert:read",
        "alert:write",
        "analytics:view",
        "location:save",
        "view:map"
    ],
    "admin": [
        "manage:city",
        "zoning:read",
        "zoning:write",
        "hazard:read",
        "hazard:write",
        "establishment:read",
        "establishment:write",
        "alert:read",
        "alert:write",
        "analytics:view",
        "manage:user",
        "manage:role",
        "manage:logs",
    ],
}


def seed(db: Session) -> None:
    _seed_subscription_plans(db)
    _seed_permissions(db)
    _seed_roles(db)


def _seed_subscription_plans(db: Session) -> None:
    for name, max_cities in DEFAULT_PLANS:
        if not db.query(SubscriptionPlan).filter_by(name=name).first():
            db.add(SubscriptionPlan(name=name, max_cities=max_cities))
    db.commit()


def _seed_permissions(db: Session) -> None:
    for name, description in DEFAULT_PERMISSIONS:
        if not db.query(Permission).filter_by(name=name).first():
            db.add(Permission(name=name, description=description))
    db.commit()


def _seed_roles(db: Session) -> None:
    for role_name, perm_names in ROLES.items():
        role = db.query(Role).filter_by(name=role_name).first()
        if not role:
            role = Role(name=role_name)
            db.add(role)
            db.flush()

        existing_perm_ids = {rp.permission_id for rp in role.role_permissions}
        for perm_name in perm_names:
            perm = db.query(Permission).filter_by(name=perm_name).first()
            if perm and perm.id not in existing_perm_ids:
                db.add(RolePermission(role_id=role.id, permission_id=perm.id))

    db.commit()