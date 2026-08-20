from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator


class CitySelectResponse(BaseModel):
    access_token: str
    city_id: UUID


class CityGeometryResponse(BaseModel):
    """Standalone geometry-only response — fetched separately and cached independently."""
    id: UUID
    boundary: dict[str, Any] | None

    @field_validator("boundary", mode="before")
    @classmethod
    def _wkb_to_geojson(cls, v: Any) -> dict[str, Any] | None:
        if v is None:
            return None
        if isinstance(v, dict):
            return v
        try:
            from geoalchemy2.shape import to_shape
            from shapely.geometry import mapping
            return dict(mapping(to_shape(v)))
        except Exception:
            return None


class CityCreate(BaseModel):
    name: str
    province: str | None = None
    region: str | None = None


class CityUpdate(BaseModel):
    name: str | None = None
    province: str | None = None
    region: str | None = None


class CityResponse(BaseModel):
    """City metadata — never includes geometry. Fetch geometry via /geometry endpoint."""
    model_config = ConfigDict(from_attributes=True)

    id:          UUID
    name:        str
    province:    str | None
    region:      str | None
    province_id: UUID | None
    pmtile_url:  str | None
    created_at:  datetime


class CityStatsResponse(BaseModel):
    city_id: UUID
    hazard_count: int
    zoning_count: int
    establishment_count: int
    alert_count: int