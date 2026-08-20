import uuid
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from models.base import Base


class HazardArea(Base):
    __tablename__ = "hazard_areas"
    __table_args__ = (
        Index("idx_hazard_areas_city_id", "city_id"),
        Index("idx_hazard_areas_hazard_type", "hazard_type"),
        Index("idx_hazard_areas_hazard_type_scenario", "hazard_type", "scenario"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    city_id = Column(UUID(as_uuid=True), ForeignKey("cities.id", ondelete="CASCADE"), nullable=False)

    hazard_type = Column(String(100))             # flood, landslide, storm_surge, debris_flow, faultline
    scenario    = Column(String(50), nullable=True)  # 5yr, 25yr, 100yr, ssa1-ssa4; null for faultlines
    severity    = Column(Integer, nullable=True)  # 1–5 classification for UI color/weight
    pmtile_url  = Column(String(500), nullable=True)
    geometry    = Column(Geometry("GEOMETRY", srid=4326, spatial_index=True), nullable=True)

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    city    = relationship("City", backref="hazard_areas")
    creator = relationship("User", backref="hazard_areas")

    def __repr__(self) -> str:
        return f"HazardArea(id={self.id!r}, hazard_type={self.hazard_type!r}, scenario={self.scenario!r})"