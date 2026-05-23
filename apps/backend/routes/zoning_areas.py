from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from schema.ZoningAreaDto import (
    ZoningAreaCreate,
    ZoningAreaGeometryResponse,
    ZoningAreaResponse,
    ZoningAreaSummary,
    ZoningAreaUpdate,
    ZoningImageProcessRequest,
    ZoningPmtilesResponse,
    ZoningProcessResponse,
)
from models.user import User
from services import zoning_area_service
from services.auth_service import get_authenticated_user
from core.db import get_db

router = APIRouter()


@router.get("/{city_id}/zoning", response_model=list[ZoningAreaSummary])
def list_zoning_areas(city_id: UUID, db: Session = Depends(get_db)):
    return zoning_area_service.get_by_city(city_id, db)


@router.post("/{city_id}/zoning", response_model=ZoningAreaResponse, status_code=status.HTTP_201_CREATED)
def create_zoning_area(
    city_id: UUID,
    payload: ZoningAreaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return zoning_area_service.create(city_id, payload, current_user.id, db)

@router.post(
    "/{city_id}/zoning/process-image",
    response_model=ZoningProcessResponse,
    status_code=status.HTTP_201_CREATED,
)
def process_zoning_image(
    city_id: UUID,
    payload: ZoningImageProcessRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    """
    Analyze an uploaded zoning map image and extract zone polygons.

    Pipeline:
    1. Load image from MinIO by file_id (upload via POST /files/upload first)
    2. Compute pixel→geo homography from 4+ ground control points
    3. K-means color segmentation to identify zone regions
    4. OpenCV contour detection + Douglas-Peucker approximation
    5. Google Vision OCR to extract zone labels
    6. Transform pixel contours to geographic polygons (GeoJSON)
    7. Persist ZoningArea records; regenerate city PMTile for MapLibre

    gcps: list of ≥4 objects mapping pixel corners to geographic coordinates.
    n_colors: number of K-means color clusters (default 8).
    min_area_px: minimum contour area in pixels to keep (default 500).
    """
    return zoning_area_service.process_zoning_image(city_id, payload, current_user.id, db)



@router.get("/{city_id}/zoning/pmtiles", response_model=ZoningPmtilesResponse | None)
def get_zoning_pmtiles(city_id: UUID, db: Session = Depends(get_db)):
    """Return a fresh presigned URL (5 h TTL) for the city's zoning PMTile.
    Returns null if no PMTile has been generated for this city yet."""
    return zoning_area_service.get_city_pmtile_url(city_id, db)


@router.post("/{city_id}/zoning/regenerate-pmtiles", response_model=ZoningPmtilesResponse)
def regenerate_zoning_pmtiles(
    city_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    """
    Rebuild the city's zoning PMTile from current DB records.
    Call after patching zone_type labels via PATCH /{city_id}/zoning/{zone_id}.
    Returns a fresh presigned URL (5 h TTL).
    """
    return zoning_area_service.regenerate_pmtile(city_id, db)


@router.get("/{city_id}/zoning/geojson", summary="GeoJSON FeatureCollection for Turf.js")
def get_zoning_geojson(
    city_id: UUID,
    bbox: str | None = Query(None, description="minLng,minLat,maxLng,maxLat — spatial filter"),
    db: Session = Depends(get_db),
):
    return JSONResponse(
        content=zoning_area_service.get_geojson(city_id, db, bbox),
        media_type="application/geo+json",
    )


@router.get("/{city_id}/zoning/geometry", response_model=list[ZoningAreaGeometryResponse])
def get_zoning_geometry(city_id: UUID, db: Session = Depends(get_db)):
    """Returns only id + city_id + geometry for all zones — cache separately from metadata."""
    return zoning_area_service.get_geometry_by_city(city_id, db)


@router.get("/{city_id}/zoning/{zone_id}", response_model=ZoningAreaSummary)
def get_zoning_area(city_id: UUID, zone_id: UUID, db: Session = Depends(get_db)):
    return zoning_area_service.get_or_404(zone_id, city_id, db)


@router.patch("/{city_id}/zoning/{zone_id}", response_model=ZoningAreaResponse)
def update_zoning_area(
    city_id: UUID,
    zone_id: UUID,
    payload: ZoningAreaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return zoning_area_service.update(zone_id, city_id, payload, db)


@router.delete("/{city_id}/zoning/{zone_id}", response_model=ZoningPmtilesResponse | None)
def delete_zoning_area(
    city_id: UUID,
    zone_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    """
    Delete a zone and regenerate the city's PMTile from remaining zones.
    Returns the new presigned PMTile URL, or null if no zones remain.
    """
    zoning_area_service.delete(zone_id, city_id, db)
    try:
        return zoning_area_service.regenerate_pmtile(city_id, db)
    except HTTPException as exc:
        if exc.status_code == 404:  # no zones left — nothing to tile
            return None
        raise


