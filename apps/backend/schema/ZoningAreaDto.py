from datetime import datetime
from enum import Enum
from typing import Any, Annotated
from uuid import UUID

from geoalchemy2.shape import to_shape
from pydantic import BaseModel, ConfigDict, StringConstraints, Field, field_validator
from shapely.geometry import mapping


class ZoneType(str, Enum):
    residential = "residential"
    commercial = "commercial"
    industrial = "industrial"
    agriculture = "agriculture"

class ZoningAreaCreate(BaseModel):
    city_id: Annotated[UUID, Field(description="City Id")]
    zone_type: Annotated[
        ZoneType | None,
        Field(
            default=None,
            description="Zone type for this zone",
            examples=["residential", "commercial", "industrial", "agriculture"],
        )
    ]
    severity: Annotated[
        int | None,
        Field(default=None, description="Severity classification 1–5", ge=1, le=5)
    ]
    geometry: Annotated[
        dict[str,Any] | None,
        Field(
            default=None,
            description="Zone geometry for this zone",
            examples=[{"type": "Polygon", "coordinates": [[[120.98, 14.6], [120.99, 14.6], [120.99, 14.61], [120.98, 14.61], [120.98, 14.6]]]}]
        )
    ]


class ZoningAreaUpdate(BaseModel):
    zone_type: Annotated[
        ZoneType | None,
        Field(
            default=None,
            description="Zone type for this zone",
            examples=["residential", "commercial", "industrial", "agriculture"],
        )
    ]
    severity: Annotated[
        int | None,
        Field(default=None, description="Severity classification 1–5", ge=1, le=5)
    ]
    geometry: Annotated[
        dict[str, Any] | None,
        Field(
            default=None,
            description="Zone geometry for this zone",
            examples=[{"type": "Polygon", "coordinates": [
                [[120.98, 14.6], [120.99, 14.6], [120.99, 14.61], [120.98, 14.61], [120.98, 14.6]]]}]
        )
    ]


class ZoningAreaSummary(BaseModel):
    """List/get response — geometry excluded (use pmtile_url for rendering)."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    city_id: UUID
    zone_type: str | None = None  # str, not ZoneType — OCR zones may have hex-color labels
    color_hex: str | None = None
    severity: int | None = None
    pmtile_url: str | None = None
    created_by: UUID
    created_at: datetime


class ZoningAreaGeometryResponse(BaseModel):
    """Geometry-only response — id, city_id, geometry. Enables separate caching from metadata."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    city_id: UUID
    geometry: dict[str, Any] | None = None

    @field_validator("geometry", mode="before")
    @classmethod
    def parse_geometry_geo(cls, v: Any) -> dict[str, Any] | None:
        if v is None:
            return None
        if isinstance(v, dict):
            return v
        try:
            return dict(mapping(to_shape(v)))
        except Exception:
            return None


class ZoningAreaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Annotated[UUID, Field(description="Zoning Area Id")]
    city_id: Annotated[UUID, Field(description="City Id")]
    zone_type: Annotated[
        str | None,  # str, not ZoneType — OCR zones may have hex-color labels
        Field(default=None, description="Zone type for this zone")
    ]
    color_hex: Annotated[str | None, Field(description="Hex color code for this zone, e.g. #RRGGBB")]
    severity: Annotated[int | None, Field(default=None, description="Severity classification 1–5")]
    geometry: Annotated[
        dict[str, Any] | None,
        Field(
            default=None,
            description="Zone geometry for this zone",
            examples=[{"type": "Polygon", "coordinates": [
                [[120.98, 14.6], [120.99, 14.6], [120.99, 14.61], [120.98, 14.61], [120.98, 14.6]]]}]
        )
    ]
    pmtile_url: Annotated[str | None, Field(description="Presigned MinIO URL for city-level zoning PMTile, if available")]
    created_by: Annotated[UUID, Field(description="Created by user for this zone")]
    created_at: datetime

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


class ZoningPmtilesResponse(BaseModel):
    pmtile_url: Annotated[str, Field(description="Presigned MinIO URL for city-level zoning PMTile")]
    object_key: Annotated[str, Field(description="MinIO object key for city-level zoning PMTile")]


# --- Process-image DTOs ---

class GroundControlPoint(BaseModel):
    pixel_x: Annotated[float, Field(description="Pixel X coordinate in the image")]
    pixel_y: Annotated[float, Field(description="Pixel Y coordinate in the image")]
    longitude: Annotated[float, Field(description="Longitude of the GCP in WGS84 coordinate system")]
    latitude: Annotated[float, Field(description="Latitude of the GCP in WGS84 coordinate system")]


class ZoningImageProcessRequest(BaseModel):
    file_id: Annotated[UUID, Field(description="Image File ID")]
    gcps: list[GroundControlPoint]
    n_colors: int = 8
    min_area_px: int = 500


class ZoningProcessResponse(BaseModel):
    zones_created: int
    skipped_zones: int
    pmtile_url: str | None
    zones: list[ZoningAreaResponse]