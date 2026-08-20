import uuid
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from models.base import Base


class ZoningArea(Base):
    __tablename__ = "zoning_areas"
    __table_args__ = (
        Index("idx_zoning_areas_city_id", "city_id"),
        Index("idx_zoning_areas_zone_type", "zone_type"),
        Index("idx_zoning_areas_city_scenario", "city_id", "scenario"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    city_id = Column(UUID(as_uuid=True), ForeignKey("cities.id", ondelete="CASCADE"), nullable=False)

    zone_type     = Column(String(100))
    color_hex     = Column(String(7), nullable=True)   # "#RRGGBB" from K-means cluster centre
    severity      = Column(Integer, nullable=True)     # 1–5 classification for UI color/weight
    scenario      = Column(String(50), nullable=True)  # e.g. "2024", "2025-06" — label for toggle
    scenario_type = Column(String(20), nullable=True)  # "year" | "month" | null
    geometry      = Column(Geometry("GEOMETRY", srid=4326, spatial_index=True), nullable=True)
    pmtile_url    = Column(String(500), nullable=True)  # MinIO object key for city-level zoning PMTile

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    city = relationship("City", backref="zoning_areas")
    creator = relationship("User", backref="zoning_areas")

    def __repr__(self) -> str:
        return f"ZoningArea(id={self.id!r}, zone_type={self.zone_type!r})"