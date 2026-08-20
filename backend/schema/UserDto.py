from datetime import datetime
from typing import Optional, Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints


class RegisterRequest(BaseModel):
    email: EmailStr = Field(..., max_length=254)
    full_name: Annotated[
        str,
        StringConstraints(min_length=2, max_length=100, strip_whitespace=True)
    ]
    password: Annotated[
        str,
        StringConstraints(
            min_length=8,
            max_length=128,
        )
    ]
    role_name: Literal['investor', 'lgu_admin'] = 'investor'


class LoginRequest(BaseModel):
    email: EmailStr
    password: Annotated[
        str,
        StringConstraints(
            min_length=8,
            max_length=128,
        )
    ]


class RefreshRequest(BaseModel):
    refresh_token: Optional[str] = None


class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None


class AuthResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    full_name: str
    is_active: bool
    is_superuser: bool
    created_at: datetime
    updated_at: datetime


class LguInviteRequest(BaseModel):
    email: EmailStr
    city_id: UUID


class LguInviteResponse(BaseModel):
    message: str
    magic_link: str
    city_id: UUID
    expires_at: datetime


class LguRegisterRequest(BaseModel):
    token: str
    email: EmailStr
    full_name: Annotated[
        str,
        StringConstraints(min_length=2, max_length=100, strip_whitespace=True)
    ]
    password: Annotated[
        str,
        StringConstraints(
            min_length=8,
            max_length=128,
        )
    ]


class TokenVerifyResponse(BaseModel):
    valid: bool
    email: EmailStr
    city_id: UUID