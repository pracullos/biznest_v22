from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from schema.AuditLogDto import AuditLogResponse
from models.user import User
from services import audit_log_service
from services.auth_service import get_authenticated_user
from core.db import get_db

router = APIRouter()


@router.get("/", response_model=list[AuditLogResponse])
def list_audit_logs(
    city_id: UUID | None = None,
    user_id: UUID | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_authenticated_user),
):
    return audit_log_service.get_all(city_id, user_id, db)