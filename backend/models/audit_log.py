import uuid
from sqlalchemy import Column, DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from models.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=True)  # no FK — preserved after user deletion
    city_id = Column(UUID(as_uuid=True), nullable=True)

    action = Column(String(255))
    meta = Column("metadata", JSONB)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    def __repr__(self) -> str:
        return f"AuditLog(id={self.id!r}, action={self.action!r})"