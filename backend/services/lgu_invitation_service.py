import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Response, status
from sqlalchemy.orm import Session

from core.db import ACCESS_TOKEN_EXPIRE_SECONDS
from schema.UserDto import AuthResponse, LguInviteRequest, LguInviteResponse, LguRegisterRequest
from models.city import City
from models.lgu_assignment import LguAssignment
from models.lgu_invitation import LguInvitation
from models.role import Role
from models.user import User
from models.user_role import UserRole
from utils.email_utils import send_lgu_invite_email
from core.security import hash_password

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3001")
LGU_INVITE_EXPIRE_HOURS = int(os.environ.get("LGU_INVITE_EXPIRE_HOURS", "24"))


def _require_admin(user: User, db: Session) -> None:
    from models.role import Role
    has_admin = (
        db.query(UserRole)
        .join(Role, Role.id == UserRole.role_id)
        .filter(UserRole.user_id == user.id, Role.name == "admin")
        .first()
    ) is not None
    if not has_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


def create_invitation(payload: LguInviteRequest, created_by: User, db: Session) -> LguInviteResponse:
    _require_admin(created_by, db)

    city = db.query(City).filter(City.id == payload.city_id).first()
    if not city:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="City not found")

    if db.query(LguAssignment).filter(LguAssignment.city_id == city.id).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="City already has an assigned LGU admin",
        )

    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists",
        )

    existing = (
        db.query(LguInvitation)
        .filter(
            LguInvitation.email == payload.email,
            LguInvitation.used_at.is_(None),
            LguInvitation.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Active invitation already exists for this email",
        )

    # Also block pending invite for same city
    existing_city_invite = (
        db.query(LguInvitation)
        .filter(
            LguInvitation.city_id == city.id,
            LguInvitation.used_at.is_(None),
            LguInvitation.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )
    if existing_city_invite:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Active invitation already exists for this city",
        )

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=LGU_INVITE_EXPIRE_HOURS)

    invitation = LguInvitation(
        email=payload.email,
        token=token,
        city_id=city.id,
        expires_at=expires_at,
        created_by_id=created_by.id,
    )
    db.add(invitation)
    db.commit()

    magic_link = f"{FRONTEND_URL}/lgu/register?token={token}&email={payload.email}"

    try:
        send_lgu_invite_email(payload.email, magic_link, LGU_INVITE_EXPIRE_HOURS)
    except Exception:
        pass

    return LguInviteResponse(
        message="Invitation sent",
        magic_link=magic_link,
        city_id=city.id,
        expires_at=expires_at,
    )


def verify_invitation(token: str, email: str, db: Session) -> dict:
    invitation = _get_valid_invitation(token, email, db)
    return {"valid": True, "email": invitation.email, "city_id": invitation.city_id}


def register_from_token(payload: LguRegisterRequest, response: Response, db: Session) -> AuthResponse:
    invitation = _get_valid_invitation(payload.token, payload.email, db)

    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with given email already exists",
        )

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        is_active=True,
        is_superuser=False,
    )
    db.add(user)
    db.flush()

    lgu_role = db.query(Role).filter(Role.name == "lgu_admin").first()
    if lgu_role:
        db.add(UserRole(user_id=user.id, role_id=lgu_role.id))

    db.add(LguAssignment(user_id=user.id, city_id=invitation.city_id))

    invitation.used_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    from services.user_service import create_auth_session, _auth_response
    access_token, _ = create_auth_session(user, response, db)
    return _auth_response(user, access_token)


def _get_valid_invitation(token: str, email: str, db: Session) -> LguInvitation:
    invitation = db.query(LguInvitation).filter(LguInvitation.token == token).first()
    if not invitation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    if invitation.email != email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token does not match email")
    if invitation.used_at is not None:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Invitation already used")
    exp = invitation.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Invitation expired")
    return invitation