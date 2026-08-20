import uuid
from sqlalchemy import Column, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from models.base import Base


class LguAssignment(Base):
    __tablename__ = "lgu_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    city_id = Column(UUID(as_uuid=True), ForeignKey("cities.id", ondelete="CASCADE"), unique=True, nullable=False)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user = relationship("User", backref="lgu_assignment")
    city = relationship("City", backref="lgu_assignment")

    def __repr__(self) -> str:
        return f"LguAssignment(user_id={self.user_id!r}, city_id={self.city_id!r})"