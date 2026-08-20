import uuid
from sqlalchemy import Column, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from models.base import Base


class Establishment(Base):
    __tablename__ = "establishments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    city_id = Column(UUID(as_uuid=True), ForeignKey("cities.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(255))
    category = Column(String(100))  # restaurant, mall, etc.

    location = Column(Geometry("POINT", srid=4326, spatial_index=True), nullable=True)

    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    city = relationship("City", backref="establishments")
    owner = relationship("User", backref="establishments")

    def __repr__(self) -> str:
        return f"Establishment(id={self.id!r}, name={self.name!r})"