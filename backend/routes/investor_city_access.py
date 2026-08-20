from uuid import UUID

import redis as redis_lib
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.redis import get_redis
from core.security import get_authenticated_user
from schema.CityDto import CityGeometryResponse, CitySelectResponse
from schema.InvestorCityAccessDto import InvestorCityAccessCreate, InvestorCityAccessResponse
from models.user import User
from services import investor_city_access_service
from core.db import get_db

router = APIRouter()


@router.get("/", response_model=list[InvestorCityAccessResponse])
def list_access(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return investor_city_access_service.get_all(db)


@router.get("/me", response_model=list[InvestorCityAccessResponse])
def my_access(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return investor_city_access_service.get_by_user(current_user.id, db)


@router.post("/select/{city_id}", response_model=CitySelectResponse)
def select_city(
    city_id: UUID,
    current_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
):
    """Mint a new access token with city_id embedded. Frontend decodes JWT to read selected city."""
    access_token = investor_city_access_service.select_city(current_user, city_id, db)
    return CitySelectResponse(access_token=access_token, city_id=city_id)


@router.get("/{city_id}/geometry", response_model=CityGeometryResponse)
def city_geometry(
    city_id: UUID,
    current_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
    rc: redis_lib.Redis = Depends(get_redis),
):
    """Return only the boundary GeoJSON for a city. Cached in Redis for 1 hour."""
    geometry = investor_city_access_service.get_city_geometry(current_user.id, city_id, db, rc)
    return CityGeometryResponse(id=city_id, boundary=geometry)


@router.post("/", response_model=InvestorCityAccessResponse, status_code=status.HTTP_201_CREATED)
def grant_access(
    payload: InvestorCityAccessCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return investor_city_access_service.grant(payload, db)


@router.delete("/{access_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_access(
    access_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    investor_city_access_service.revoke(access_id, db)