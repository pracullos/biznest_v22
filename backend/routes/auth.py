import redis as redis_lib
from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from core.redis import get_redis
from core.security import get_authenticated_user, get_refresh_token
from schema.UserDto import AuthResponse, LoginRequest, LogoutRequest, RefreshRequest, RegisterRequest, UserResponse
from models.user import User
from services import user_service
from core.db import get_db

router = APIRouter(tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
    rc: redis_lib.Redis = Depends(get_redis),
):
    return user_service.register(payload, response, db, rc)


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
    rc: redis_lib.Redis = Depends(get_redis),
):
    return user_service.login(payload, response, db, rc)


@router.post("/refresh", response_model=AuthResponse)
def refresh(
    request: Request,
    response: Response,
    payload: RefreshRequest = Body(default_factory=RefreshRequest),
    db: Session = Depends(get_db),
):
    raw = get_refresh_token(request, payload.refresh_token)
    if not raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token required")
    return user_service.refresh_tokens(raw, response, db)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    payload: LogoutRequest = Body(default_factory=LogoutRequest),
    db: Session = Depends(get_db),
    rc: redis_lib.Redis = Depends(get_redis),
):
    raw = get_refresh_token(request, payload.refresh_token)
    user_service.logout(response, raw, db, rc)


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
def logout_all(
    response: Response,
    auth_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
    rc: redis_lib.Redis = Depends(get_redis),
):
    user_service.logout_all(auth_user, response, db, rc)


@router.get("/me", response_model=UserResponse)
def current_user(auth_user: User = Depends(get_authenticated_user)):
    return auth_user