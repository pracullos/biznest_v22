from uuid import UUID

import redis as redis_lib
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from core.redis import get_redis
from core.security import get_authenticated_user
from schema.CityDto import CityCreate, CityGeometryResponse, CityResponse, CityStatsResponse, CityUpdate
from models.user import User
from services import city_service
from core.db import get_db

router = APIRouter()


@router.get("/", response_model=list[CityResponse])
def list_cities(
    q: str | None = Query(None, description="Search by city name or province"),
    db: Session = Depends(get_db),
    rc: redis_lib.Redis = Depends(get_redis),
):
    if q:
        return city_service.search(q, db)
    return city_service.get_all(db, rc)


@router.post("/", response_model=CityResponse, status_code=status.HTTP_201_CREATED)
def create_city(
    payload: CityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return city_service.create(payload, db)


@router.get("/{city_id}", response_model=CityResponse)
def get_city(
    city_id: UUID,
    db: Session = Depends(get_db),
    rc: redis_lib.Redis = Depends(get_redis),
):
    return city_service.get_or_404(city_id, db, rc)


@router.get("/{city_id}/geometry", response_model=CityGeometryResponse)
def get_city_geometry(
    city_id: UUID,
    db: Session = Depends(get_db),
    rc: redis_lib.Redis = Depends(get_redis),
    _: User = Depends(get_authenticated_user),
):
    """Return only boundary GeoJSON. Cached in Redis for 1 hour."""
    geometry = city_service.get_city_geometry(city_id, db, rc)
    return CityGeometryResponse(id=city_id, boundary=geometry)

@router.get("/{city_id}/stats", response_model=CityStatsResponse)
def get_city_stats(
    city_id: UUID,
    db: Session = Depends(get_db),
    rc: redis_lib.Redis = Depends(get_redis),
    _: User = Depends(get_authenticated_user),
):
    return city_service.get_city_stats(city_id, db, rc)


@router.patch("/{city_id}", response_model=CityResponse)
def update_city(
    city_id: UUID,
    payload: CityUpdate,
    db: Session = Depends(get_db),
    rc: redis_lib.Redis = Depends(get_redis),
    current_user: User = Depends(get_authenticated_user),
):
    return city_service.update(city_id, payload, db, rc)


@router.delete("/{city_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_city(
    city_id: UUID,
    db: Session = Depends(get_db),
    rc: redis_lib.Redis = Depends(get_redis),
    current_user: User = Depends(get_authenticated_user),
):
    city_service.delete(city_id, db, rc)