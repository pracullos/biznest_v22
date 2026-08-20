from datetime import datetime
from typing import Any
from uuid import UUID

from geoalchemy2.shape import to_shape
from pydantic import BaseModel, ConfigDict, field_validator
from shapely.geometry import mapping


class HazardAreaCreate(BaseModel):
    hazard_type: str | None = None
    scenario:    str | None = None
    severity:    int | None = None   # 1–5
    geometry:    dict[str, Any] | None = None  # GeoJSON


class HazardAreaUpdate(BaseModel):
    hazard_type: str | None = None
    severity:    int | None = None   # 1–5
    geometry:    dict[str, Any] | None = None


class HazardAreaSummary(BaseModel):
    """List/get response — geometry excluded (use pmtile_url for rendering)."""
    model_config = ConfigDict(from_attributes=True)

    id:          UUID
    city_id:     UUID
    hazard_type: str | None
    scenario:    str | None
    severity:    int | None
    pmtile_url:  str | None
    created_by:  UUID | None
    created_at:  datetime


class HazardAreaResponse(BaseModel):
    """Hazard area with geometry — for the /geometry endpoint."""
    model_config = ConfigDict(from_attributes=True)

    id:          UUID
    city_id:     UUID
    hazard_type: str | None
    scenario:    str | None
    severity:    int | None
    pmtile_url:  str | None
    geometry:    dict[str, Any] | None
    created_by:  UUID | None
    created_at:  datetime

    @field_validator("geometry", mode="before")
    @classmethod
    def parse_geometry(cls, v: Any) -> dict[str, Any] | None:
        if v is None:
            return None
        if isinstance(v, dict):
            return v
        try:
            return dict(mapping(to_shape(v)))
        except Exception:
            return None


class HazardPmtileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    hazard_type: str
    scenario:    str | None
    pmtile_url:  str