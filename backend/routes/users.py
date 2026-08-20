from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from core.security import get_authenticated_user
from schema.UserDto import AuthResponse, LguInviteRequest, LguInviteResponse, LguRegisterRequest, TokenVerifyResponse, UserResponse
from models.user import User
from services import lgu_invitation_service, user_service
from core.db import get_db

router = APIRouter(tags=["users"])


@router.get("/", response_model=list[UserResponse])
def all_users(db: Session = Depends(get_db)):
    return user_service.get_all_users(db)


# LGU admin magic-link invitation flow
@router.post(
    "/lgu/invite",
    response_model=LguInviteResponse,
    status_code=201,
    summary="Send LGU admin registration invite (admin only)",
)
def invite_lgu_admin(
    payload: LguInviteRequest,
    auth_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
):
    return lgu_invitation_service.create_invitation(payload, auth_user, db)


@router.get(
    "/lgu/verify-invitation",
    response_model=TokenVerifyResponse,
    summary="Verify an LGU invitation token before showing the registration form",
)
def verify_lgu_invitation(token: str, email: str, db: Session = Depends(get_db)):
    return lgu_invitation_service.verify_invitation(token, email, db)


@router.post(
    "/lgu/register",
    response_model=AuthResponse,
    status_code=201,
    summary="Complete LGU admin registration using a magic-link token",
)
def register_lgu_admin(
    payload: LguRegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    return lgu_invitation_service.register_from_token(payload, response, db)