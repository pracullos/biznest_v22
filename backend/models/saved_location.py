import uuid
from sqlalchemy import Column, DateTime, ForeignKey, String, func, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from models.base import Base


class SavedLocation(Base):
    __tablename__ = "saved_locations"
    __table_args__ = (
        Index("idx_saved_locations_user_id", "user_id"),
        Index("idx_saved_locations_city_id", "city_id"),
        Index("idx_name", "name")
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    city_id = Column(UUID(as_uuid=True), ForeignKey("cities.id"), nullable=True)

    name = Column(String(255))
    location = Column(Geometry("POINT", srid=4326, spatial_index=True), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user = relationship("User", backref="saved_locations")
    city = relationship("City", backref="saved_locations")

    def __repr__(self) -> str:
        return f"SavedLocation(id={self.id!r}, name={self.name!r})"