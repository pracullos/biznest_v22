import secrets
from datetime import datetime, timedelta, timezone

import redis as redis_lib
from fastapi import HTTPException, Response, status
from sqlalchemy.orm import Session

from core.db import ACCESS_TOKEN_EXPIRE_SECONDS, REFRESH_TOKEN_EXPIRE_SECONDS
from schema.UserDto import AuthResponse, LoginRequest, RegisterRequest, UserResponse
from models.investor_subscription import InvestorSubscription
from models.refresh_token import RefreshToken
from models.role import Role
from models.subscription_plan import SubscriptionPlan
from models.user import User
from models.user_role import UserRole
from core.security import (
    USER_CACHE_KEY,
    USER_CACHE_TTL,
    _pack_user,
    clear_auth_cookie,
    clear_refresh_cookie,
    set_refresh_cookie,
    user_to_cache_dict,
)
from core.security import hash_password, hash_token, verify_password


def _warm_user_cache(user: User, rc: redis_lib.Redis | None) -> None:
    """Write user to Redis after login or register. Skips silently on any error."""
    if rc is None:
        return
    try:
        rc.setex(USER_CACHE_KEY.format(user.id), USER_CACHE_TTL, _pack_user(user_to_cache_dict(user)))
    except Exception:
        pass


def _invalidate_user_cache(user_id, rc: redis_lib.Redis | None) -> None:
    if rc:
        try:
            rc.delete(USER_CACHE_KEY.format(user_id))
        except Exception:
            pass


def register(payload: RegisterRequest, response: Response, db: Session, rc: redis_lib.Redis | None = None) -> AuthResponse:
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with given email already exists")

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        is_active=True,
        is_superuser=False,
    )
    db.add(user)
    db.flush()

    role = db.query(Role).filter(Role.name == payload.role_name).first()
    if role:
        db.add(UserRole(user_id=user.id, role_id=role.id))

    if payload.role_name == 'investor':
        free_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.name == "free").first()
        if free_plan:
            db.add(InvestorSubscription(user_id=user.id, plan_id=free_plan.id))

    db.commit()
    db.refresh(user)

    access_token, _ = create_auth_session(user, response, db)
    _warm_user_cache(user, rc)
    return _auth_response(user, access_token)


def login(payload: LoginRequest, response: Response, db: Session, rc: redis_lib.Redis | None = None) -> AuthResponse:
    # Password verification always hits DB — never use cached user for auth checks
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive")

    access_token, _ = create_auth_session(user, response, db)
    _warm_user_cache(user, rc)   # prime cache so first /me after login is cache hit
    return _auth_response(user, access_token)


def logout(response: Response, raw_refresh_token: str | None, db: Session, rc: redis_lib.Redis | None = None) -> None:
    if raw_refresh_token:
        rt = db.query(RefreshToken).filter(
            RefreshToken.token_hash == hash_token(raw_refresh_token)
        ).first()
        if rt and rt.revoked_at is None:
            rt.revoked_at = datetime.now(timezone.utc)
            _invalidate_user_cache(rt.user_id, rc)
            db.commit()
    clear_auth_cookie(response)
    clear_refresh_cookie(response)


def logout_all(user: User, response: Response, db: Session, rc: redis_lib.Redis | None = None) -> None:
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.revoked_at.is_(None),
    ).update({"revoked_at": datetime.now(timezone.utc)})
    db.commit()
    _invalidate_user_cache(user.id, rc)
    clear_auth_cookie(response)
    clear_refresh_cookie(response)


def refresh_tokens(raw_refresh_token: str, response: Response, db: Session) -> AuthResponse:
    rt = db.query(RefreshToken).filter(
        RefreshToken.token_hash == hash_token(raw_refresh_token)
    ).first()

    if not rt:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    if rt.revoked_at is not None:
        # Reuse of a revoked token — possible theft, invalidate all sessions
        db.query(RefreshToken).filter(RefreshToken.user_id == rt.user_id).update(
            {"revoked_at": datetime.now(timezone.utc)}
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token reuse detected — all sessions revoked",
        )

    expires = rt.expires_at if rt.expires_at.tzinfo else rt.expires_at.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    user = db.query(User).filter(User.id == rt.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User inactive")

    # Rotate: revoke old, issue new
    rt.revoked_at = datetime.now(timezone.utc)
    db.flush()

    access_token, _ = create_auth_session(user, response, db)
    return _auth_response(user, access_token)


def get_all_users(db: Session) -> list[UserResponse]:
    return db.query(User).all()


def create_auth_session(user: User, response: Response, db: Session) -> tuple[str, str]:
    """Mint access + refresh tokens, persist refresh hash, set both cookies."""
    from utils.jwtUtils import mint_access_token

    user_role = db.query(UserRole).filter(UserRole.user_id == user.id).first()
    role_name = user_role.role.name if user_role else None
    role_id   = str(user_role.role_id) if user_role else None

    access_token = mint_access_token(user, role_name=role_name, role_id=role_id)

    raw_refresh = secrets.token_urlsafe(32)
    db.add(RefreshToken(
        user_id=user.id,
        token_hash=hash_token(raw_refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(seconds=int(REFRESH_TOKEN_EXPIRE_SECONDS)),
    ))
    db.commit()

    set_refresh_cookie(response, raw_refresh)
    return access_token, raw_refresh


def _auth_response(user: User, access_token: str) -> AuthResponse:
    return AuthResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        access_token=access_token,
        token_type="bearer",
        expires_in=int(ACCESS_TOKEN_EXPIRE_SECONDS),
    )