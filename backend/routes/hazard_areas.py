from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from schema.HazardAreaDto import HazardAreaCreate, HazardAreaResponse, HazardAreaSummary, HazardAreaUpdate, HazardPmtileResponse
from models.user import User
from services import hazard_area_service
from services.auth_service import get_authenticated_user
from core.db import get_db

router = APIRouter()


@router.get("/{city_id}/hazards/pmtiles", response_model=list[HazardPmtileResponse])
def list_hazard_pmtiles(
    city_id: UUID,
    hazard_type: str | None = Query(default=None),
    scenario: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return hazard_area_service.get_pmtiles_by_city(city_id, db, hazard_type, scenario)


@router.get("/{city_id}/hazards", response_model=list[HazardAreaSummary])
def list_hazard_areas(city_id: UUID, db: Session = Depends(get_db)):
    return hazard_area_service.get_by_city(city_id, db)


@router.post("/{city_id}/hazards", response_model=HazardAreaSummary, status_code=status.HTTP_201_CREATED)
def create_hazard_area(
    city_id: UUID,
    payload: HazardAreaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return hazard_area_service.create(city_id, payload, current_user.id, db)


@router.post("/{city_id}/hazards/regenerate-pmtiles", response_model=HazardPmtileResponse)
def regenerate_hazard_pmtiles(
    city_id: UUID,
    hazard_type: str = Query(..., description="flood | landslide | storm_surge | debris_flow | faultline"),
    scenario: str | None = Query(default=None, description="5yr | 25yr | 100yr | ssa1-ssa4 | null for faultlines"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    """
    Rebuild the PMTile for a specific city/hazard_type/scenario from current DB geometries
    and return a fresh 5-hour presigned URL.  Use after POST /{city_id}/hazards to make
    manually drawn hazard areas visible on the map.
    """
    return hazard_area_service.regenerate_city_hazard_pmtile(city_id, hazard_type, scenario, db)


@router.get("/{city_id}/hazards/geojson", summary="GeoJSON FeatureCollection for Turf.js")
def get_hazard_geojson(
    city_id: UUID,
    bbox: str | None = Query(None, description="minLng,minLat,maxLng,maxLat — spatial filter"),
    hazard_type: str | None = Query(default=None, description="flood | landslide | storm_surge | debris_flow | faultline"),
    scenario: str | None = Query(default=None, description="5yr | 25yr | 100yr | ssa1-ssa4"),
    db: Session = Depends(get_db),
):
    return JSONResponse(
        content=hazard_area_service.get_geojson(city_id, db, bbox, hazard_type, scenario),
        media_type="application/geo+json",
    )


@router.get("/{city_id}/hazards/geometry", response_model=list[HazardAreaResponse])
def get_hazard_geometry(
    city_id: UUID,
    hazard_type: str | None = Query(default=None, description="flood | landslide | storm_surge | debris_flow | faultline"),
    scenario: str | None = Query(default=None, description="5yr | 25yr | 100yr | ssa1-ssa4"),
    db: Session = Depends(get_db),
):
    """Returns only geometry records — cache separately from metadata."""
    return hazard_area_service.get_geometry_by_city(city_id, db, hazard_type, scenario)


@router.get("/{city_id}/hazards/{hazard_id}", response_model=HazardAreaSummary)
def get_hazard_area(city_id: UUID, hazard_id: UUID, db: Session = Depends(get_db)):
    return hazard_area_service.get_or_404(hazard_id, city_id, db)


@router.patch("/{city_id}/hazards/{hazard_id}", response_model=HazardAreaSummary)
def update_hazard_area(
    city_id: UUID,
    hazard_id: UUID,
    payload: HazardAreaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return hazard_area_service.update(hazard_id, city_id, payload, db)


@router.delete("/{city_id}/hazards/{hazard_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hazard_area(
    city_id: UUID,
    hazard_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    hazard_area_service.delete(hazard_id, city_id, db)