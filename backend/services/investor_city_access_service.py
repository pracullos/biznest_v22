import json
from uuid import UUID

import redis as redis_lib
from fastapi import HTTPException
from sqlalchemy.orm import Session

from schema.InvestorCityAccessDto import InvestorCityAccessCreate
from models.city import City
from models.investor_city_access import InvestorCityAccess
from models.user import User

CITY_GEOMETRY_CACHE_KEY = "city:geometry:{}"
CITY_GEOMETRY_CACHE_TTL = 3600  # 1 hour — geometry rarely changes


def get_all(db: Session) -> list[InvestorCityAccess]:
    return db.query(InvestorCityAccess).all()


def get_by_user(user_id: UUID, db: Session) -> list[InvestorCityAccess]:
    return db.query(InvestorCityAccess).filter(InvestorCityAccess.user_id == user_id).all()


def grant(payload: InvestorCityAccessCreate, db: Session) -> InvestorCityAccess:
    existing = db.query(InvestorCityAccess).filter(
        InvestorCityAccess.user_id == payload.user_id,
        InvestorCityAccess.city_id == payload.city_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Access already granted")
    access = InvestorCityAccess(**payload.model_dump())
    db.add(access)
    db.commit()
    db.refresh(access)
    return access


def revoke(access_id: UUID, db: Session) -> None:
    access = db.query(InvestorCityAccess).filter(InvestorCityAccess.id == access_id).first()
    if not access:
        raise HTTPException(status_code=404, detail="Access record not found")
    db.delete(access)
    db.commit()


def select_city(user: User, city_id: UUID, db: Session) -> str:
    """Verify investor has access to city_id, then mint a new access token with city_id claim."""
    from utils.jwtUtils import mint_access_token
    from models.user_role import UserRole

    access = db.query(InvestorCityAccess).filter(
        InvestorCityAccess.user_id == user.id,
        InvestorCityAccess.city_id == city_id,
    ).first()
    if not access:
        raise HTTPException(status_code=403, detail="No access to this city")

    user_role = db.query(UserRole).filter(UserRole.user_id == user.id).first()
    role_name = user_role.role.name if user_role else None
    role_id   = str(user_role.role_id) if user_role else None

    return mint_access_token(
        user,
        role_name=role_name,
        role_id=role_id,
        extra_claims={"city_id": str(city_id)},
    )


def get_city_geometry(
    user_id: UUID,
    city_id: UUID,
    db: Session,
    rc: redis_lib.Redis | None = None,
) -> dict | None:
    """Return only the boundary GeoJSON for a city the investor has access to.

    Geometry is cached in Redis under city:geometry:{city_id} for 1 hour so
    city metadata responses can omit the heavy geometry field.
    """
    access = db.query(InvestorCityAccess).filter(
        InvestorCityAccess.user_id == user_id,
        InvestorCityAccess.city_id == city_id,
    ).first()
    if not access:
        raise HTTPException(status_code=403, detail="No access to this city")

    cache_key = CITY_GEOMETRY_CACHE_KEY.format(city_id)
    if rc:
        try:
            cached = rc.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    city = db.query(City).filter(City.id == city_id).first()
    if not city:
        raise HTTPException(status_code=404, detail="City not found")

    geometry: dict | None = None
    if city.boundary is not None:
        from geoalchemy2.shape import to_shape
        from shapely.geometry import mapping
        geometry = dict(mapping(to_shape(city.boundary)))

    if rc and geometry:
        try:
            rc.setex(cache_key, CITY_GEOMETRY_CACHE_TTL, json.dumps(geometry))
        except Exception:
            pass

    return geometry