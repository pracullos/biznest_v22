from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)


class AnalyzeResponse(BaseModel):
    answer: str
    city_name: str


# ── Location analysis ─────────────────────────────────────────────────────────

class LocationAnalyzeRequest(BaseModel):
    geometry: dict[str, Any]  # GeoJSON Point, Polygon, or MultiPolygon
    question: str | None = Field(None, max_length=1000)
    buffer_meters: int = Field(500, ge=50, le=5000)


class ZoneHit(BaseModel):
    zone_type: str | None
    count: int
    avg_severity: float | None


class HazardHit(BaseModel):
    hazard_type: str
    scenarios: list[str]
    avg_severity: float | None


class NearbyEstablishment(BaseModel):
    category: str | None
    count: int


class PsaEntry(BaseModel):
    code: str
    title: str
    description: str = ""


class LocationContext(BaseModel):
    geometry_type: str
    buffer_meters: int | None  # None for polygon/multipolygon
    zoning: list[ZoneHit]
    hazards: list[HazardHit]
    nearby_establishments: list[NearbyEstablishment]
    psa_classifications: dict[str, list[PsaEntry]]  # system slug → top-level entries


class LocationAnalyzeResponse(BaseModel):
    answer: str
    city_name: str
    context: LocationContext