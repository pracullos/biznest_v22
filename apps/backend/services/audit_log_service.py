from uuid import UUID

from sqlalchemy.orm import Session

from models import AuditLog
from models.audit_log import AuditLog


def get_all(city_id: UUID | None, user_id: UUID | None, db: Session) -> list[type[AuditLog]]:
    query = db.query(AuditLog)
    if city_id:
        query = query.filter(AuditLog.city_id == city_id)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    return query.order_by(AuditLog.created_at.desc()).all()


def log(user_id: UUID | None, city_id: UUID | None, action: str, meta: dict | None, db: Session) -> AuditLog:
    entry = AuditLog(user_id=user_id, city_id=city_id, action=action, meta=meta)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry