import uuid
from sqlalchemy import Column, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from models.base import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    city_id = Column(UUID(as_uuid=True), ForeignKey("cities.id"), nullable=True)

    type = Column(String(100))
    message = Column(Text)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    city = relationship("City", backref="alerts")

    def __repr__(self) -> str:
        return f"Alert(id={self.id!r}, type={self.type!r})"