import uuid
from sqlalchemy import Column, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from models.base import Base


class Province(Base):
    __tablename__ = "provinces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=True)

    region_id = Column(UUID(as_uuid=True), ForeignKey("regions.id", ondelete="SET NULL"), nullable=True)

    boundary = Column(Geometry("MULTIPOLYGON", srid=4326, spatial_index=True), nullable=True)
    pmtile_url = Column(String(500), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    region = relationship("Region", backref="provinces")

    def __repr__(self) -> str:
        return f"Province(id={self.id!r}, name={self.name!r})"