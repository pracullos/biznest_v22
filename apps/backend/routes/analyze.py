import redis as redis_lib
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.db import get_db
from core.redis import get_redis
from core.security import get_authenticated_user
from models.user import User
from repository.analyze_repository import AnalyzeRepository
from services.analyze_service import AnalyzeService
from schema.AnalyzeDto import (
    AnalyzeRequest,
    AnalyzeResponse,
    LocationAnalyzeRequest,
    LocationAnalyzeResponse,
)

router = APIRouter(tags=["analyze"])


@router.post("/cities/{city_id}/analyze", response_model=AnalyzeResponse)
def analyze_city(
    city_id: str,
    payload: AnalyzeRequest,
    _: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
    rc: redis_lib.Redis = Depends(get_redis),
):
    service = AnalyzeService(AnalyzeRepository(db), rc)
    return service.analyze(city_id, payload)


@router.post("/cities/{city_id}/analyze/location", response_model=LocationAnalyzeResponse)
def analyze_location(
    city_id: str,
    payload: LocationAnalyzeRequest,
    _: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
    rc: redis_lib.Redis = Depends(get_redis),
):
    """
    Spatial business analysis for a clicked point or drawn polygon.

    Accepts a GeoJSON geometry (Point or Polygon) and optional question.
    Aggregates zoning, hazard, and establishment data for the area, fetches
    Philippine Standard classifications (PSIC, PSOC, PCOICOP, etc.) from the
    PSA API, then returns an AI-generated business suitability analysis.
    """
    service = AnalyzeService(AnalyzeRepository(db), rc)
    return service.analyze_location(city_id, payload)