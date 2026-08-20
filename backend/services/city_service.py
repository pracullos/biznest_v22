import base64
import gzip
import json
from datetime import datetime
from uuid import UUID

import redis as redis_lib
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, defer

from schema.CityDto import CityCreate, CityUpdate
from models.city import City

_TTL_CITY      = 3600   # 1 h
_TTL_CITY_LIST = 300    # 5 min
_TTL_GEOMETRY  = 3600   # 1 h — geometry rarely changes
_TTL_STATS     = 300    # 5 min

_KEY_ALL      = "cities:all:v3"
_KEY_ONE      = "city:{}:v3"
_KEY_GEOMETRY = "city:geometry:{}"  # shared with investor_city_access_service
_KEY_STATS    = "city:stats:{}"


def _pack(data) -> str:
    return base64.b64encode(gzip.compress(json.dumps(data).encode(), compresslevel=6)).decode()


def _unpack(s: str):
    return json.loads(gzip.decompress(base64.b64decode(s)))


def _serialize(city: City) -> dict:
    return {
        "id":          str(city.id),
        "name":        city.name,
        "code":        city.code,
        "province":    city.province,
        "region":      city.region,
        "province_id": str(city.province_id) if city.province_id else None,
        "pmtile_url":  city.pmtile_url,
        "created_at":  city.created_at.isoformat() if city.created_at else None,
    }


def _deserialize(data: dict) -> City:
    return City(
        id          = data["id"],
        name        = data["name"],
        code        = data.get("code"),
        province    = data.get("province"),
        region      = data.get("region"),
        province_id = data.get("province_id"),
        pmtile_url  = data.get("pmtile_url"),
        created_at  = datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None,
    )


def _invalidate(city_id: UUID | str, rc: redis_lib.Redis) -> None:
    rc.delete(_KEY_ONE.format(city_id), _KEY_ALL, _KEY_GEOMETRY.format(city_id))


def get_all(db: Session, rc: redis_lib.Redis | None = None) -> list[City]:
    if rc:
        cached = rc.get(_KEY_ALL)
        if cached:
            try:
                return [_deserialize(d) for d in _unpack(cached)]
            except Exception:
                rc.delete(_KEY_ALL)

    cities = db.query(City).options(defer(City.boundary)).all()

    if rc and cities:
        rc.setex(_KEY_ALL, _TTL_CITY_LIST, _pack([_serialize(c) for c in cities]))

    return cities


def search(q: str, db: Session, limit: int = 50) -> list[City]:
    pattern = f"%{q}%"
    return (
        db.query(City)
        .options(defer(City.boundary))
        .filter(City.name.ilike(pattern) | City.province.ilike(pattern))
        .order_by(City.name)
        .limit(limit)
        .all()
    )


def get_or_404(city_id: UUID, db: Session, rc: redis_lib.Redis | None = None) -> City:
    key = _KEY_ONE.format(city_id)

    if rc:
        cached = rc.get(key)
        if cached:
            try:
                return _deserialize(_unpack(cached))
            except Exception:
                rc.delete(key)

    city = db.query(City).filter(City.id == city_id).options(defer(City.boundary)).first()
    if not city:
        raise HTTPException(status_code=404, detail="City not found")

    if rc:
        rc.setex(key, _TTL_CITY, _pack(_serialize(city)))

    return city


def get_city_geometry(
    city_id: UUID,
    db: Session,
    rc: redis_lib.Redis | None = None,
) -> dict | None:
    """Return only boundary GeoJSON, cached independently from city metadata."""
    cache_key = _KEY_GEOMETRY.format(city_id)

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
            rc.setex(cache_key, _TTL_GEOMETRY, json.dumps(geometry))
        except Exception:
            pass

    return geometry


def get_city_stats(city_id: UUID, db: Session, rc: redis_lib.Redis | None = None) -> dict:
    key = _KEY_STATS.format(city_id)

    if rc:
        cached = rc.get(key)
        if cached:
            try:
                return _unpack(cached)
            except Exception:
                rc.delete(key)

    from models.hazard_area import HazardArea
    from models.zoning_area import ZoningArea
    from models.establishment import Establishment
    from models.alert import Alert

    hazard_count = db.query(func.count(HazardArea.id)).filter(HazardArea.city_id == city_id).scalar() or 0
    zoning_count = db.query(func.count(ZoningArea.id)).filter(ZoningArea.city_id == city_id).scalar() or 0
    est_count    = db.query(func.count(Establishment.id)).filter(Establishment.city_id == city_id).scalar() or 0
    alert_count  = db.query(func.count(Alert.id)).filter(Alert.city_id == city_id).scalar() or 0

    stats = {
        "city_id":            str(city_id),
        "hazard_count":       hazard_count,
        "zoning_count":       zoning_count,
        "establishment_count": est_count,
        "alert_count":        alert_count,
    }

    if rc:
        rc.setex(key, _TTL_STATS, _pack(stats))

    return stats


def invalidate_city_stats(city_id: UUID | str, rc: redis_lib.Redis) -> None:
    rc.delete(_KEY_STATS.format(city_id))


def create(payload: CityCreate, db: Session) -> City:
    city = City(**payload.model_dump())
    db.add(city)
    db.commit()
    db.refresh(city)
    return city


def update(city_id: UUID, payload: CityUpdate, db: Session, rc: redis_lib.Redis | None = None) -> City:
    city = db.query(City).filter(City.id == city_id).first()
    if not city:
        raise HTTPException(status_code=404, detail="City not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(city, field, value)
    db.commit()
    db.refresh(city)
    if rc:
        _invalidate(city_id, rc)
    return city


def delete(city_id: UUID, db: Session, rc: redis_lib.Redis | None = None) -> None:
    city = db.query(City).filter(City.id == city_id).first()
    if not city:
        raise HTTPException(status_code=404, detail="City not found")
    db.delete(city)
    db.commit()
    if rc:
        _invalidate(city_id, rc)