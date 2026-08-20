import json
from datetime import timedelta
from uuid import UUID

from fastapi import HTTPException
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import mapping, shape
from sqlalchemy import func
from sqlalchemy.orm import Session

from core.minio_client import BUCKET_NAME, minio_client
from schema.HazardAreaDto import HazardAreaCreate, HazardAreaUpdate, HazardPmtileResponse
from models.hazard_area import HazardArea
from services.coordinate_service import clip_to_city_boundary
from services import geo_processing_service as gps

_PMTILE_URL_TTL = timedelta(hours=5)


def get_pmtiles_by_city(
    city_id: UUID,
    db: Session,
    hazard_type: str | None = None,
    scenario: str | None = None,
) -> list[HazardPmtileResponse]:
    q = (
        db.query(HazardArea.hazard_type, HazardArea.scenario, HazardArea.pmtile_url)
        .filter(HazardArea.city_id == city_id, HazardArea.pmtile_url.isnot(None))
    )
    if hazard_type:
        q = q.filter(HazardArea.hazard_type == hazard_type)
    if scenario:
        q = q.filter(HazardArea.scenario == scenario)
    rows = q.distinct().all()
    return [
        HazardPmtileResponse(
            hazard_type=r[0],
            scenario=r[1],
            pmtile_url=minio_client.presigned_get_object(BUCKET_NAME, r[2], expires=_PMTILE_URL_TTL),
        )
        for r in rows
    ]


def get_by_city(city_id: UUID, db: Session) -> list[HazardArea]:
    return db.query(HazardArea).filter(HazardArea.city_id == city_id).all()


def get_geometry_by_city(
    city_id: UUID,
    db: Session,
    hazard_type: str | None = None,
    scenario: str | None = None,
) -> list[HazardArea]:
    q = db.query(HazardArea).filter(HazardArea.city_id == city_id, HazardArea.geometry.isnot(None))
    if hazard_type:
        q = q.filter(HazardArea.hazard_type == hazard_type)
    if scenario:
        q = q.filter(HazardArea.scenario == scenario)
    return q.all()


def get_or_404(hazard_id: UUID, city_id: UUID, db: Session) -> HazardArea:
    hazard = (
        db.query(HazardArea)
        .filter(HazardArea.id == hazard_id, HazardArea.city_id == city_id)
        .first()
    )
    if not hazard:
        raise HTTPException(status_code=404, detail="Hazard area not found")
    return hazard


def create(city_id: UUID, payload: HazardAreaCreate, created_by: UUID, db: Session) -> HazardArea:
    data = payload.model_dump()
    if data.get("geometry"):
        clipped = clip_to_city_boundary(data["geometry"], city_id, db)
        data["geometry"] = from_shape(shape(clipped), srid=4326)
    hazard = HazardArea(
        city_id=city_id,
        created_by=created_by,
        **data,
    )
    db.add(hazard)
    db.commit()
    db.refresh(hazard)
    return hazard


def update(hazard_id: UUID, city_id: UUID, payload: HazardAreaUpdate, db: Session) -> HazardArea:
    hazard = get_or_404(hazard_id, city_id, db)
    data = payload.model_dump(exclude_unset=True)
    if "geometry" in data and data["geometry"] is not None:
        clipped = clip_to_city_boundary(data["geometry"], city_id, db)
        data["geometry"] = from_shape(shape(clipped), srid=4326)
    for field, value in data.items():
        setattr(hazard, field, value)
    db.commit()
    db.refresh(hazard)
    return hazard


def delete(hazard_id: UUID, city_id: UUID, db: Session) -> None:
    hazard = get_or_404(hazard_id, city_id, db)
    db.delete(hazard)
    db.commit()


def regenerate_city_hazard_pmtile(
    city_id: UUID,
    hazard_type: str,
    scenario: str | None,
    db: Session,
) -> HazardPmtileResponse:
    """
    Rebuild the PMTile for a specific city/hazard_type/scenario from current DB geometries.
    Designed for manually drawn hazard areas — seeded province-level tiles are not affected.
    Raises 404 when no geometry exists for that combination.
    """
    areas = (
        db.query(HazardArea)
        .filter(
            HazardArea.city_id == city_id,
            HazardArea.hazard_type == hazard_type,
            HazardArea.scenario == scenario,
            HazardArea.geometry.isnot(None),
        )
        .all()
    )
    if not areas:
        raise HTTPException(
            status_code=404,
            detail=f"No {hazard_type} ({scenario or 'all'}) geometry found for this city.",
        )

    features = []
    for area in areas:
        try:
            features.append({
                "type": "Feature",
                "properties": {
                    "id":          str(area.id),
                    "hazard_type": area.hazard_type,
                    "scenario":    area.scenario,
                    "severity":    area.severity,
                },
                "geometry": mapping(to_shape(area.geometry)),
            })
        except Exception:
            continue

    if not features:
        raise HTTPException(status_code=422, detail="No valid geometries to tile.")

    object_key = gps.generate_hazard_pmtiles(
        {"type": "FeatureCollection", "features": features},
        city_id,
        hazard_type,
        scenario,
    )
    if not object_key:
        raise HTTPException(
            status_code=422,
            detail="PMTile generation failed — tippecanoe not available on this host.",
        )

    # Persist the new object key on all matching hazard areas for this city/type/scenario
    db.query(HazardArea).filter(
        HazardArea.city_id == city_id,
        HazardArea.hazard_type == hazard_type,
        HazardArea.scenario == scenario,
    ).update({"pmtile_url": object_key}, synchronize_session="fetch")
    db.commit()

    return HazardPmtileResponse(
        hazard_type=hazard_type,
        scenario=scenario,
        pmtile_url=gps.presign_pmtile(object_key),
    )


def get_geojson(
    city_id: UUID,
    db: Session,
    bbox: str | None = None,
    hazard_type: str | None = None,
    scenario: str | None = None,
) -> dict:
    """
    Return a GeoJSON FeatureCollection of hazard areas for a city.
    Filters: bbox='minLng,minLat,maxLng,maxLat', hazard_type, scenario.
    Geometry serialized by PostGIS (ST_AsGeoJSON) — no Shapely roundtrip.
    """
    q = db.query(
        HazardArea.id,
        HazardArea.hazard_type,
        HazardArea.scenario,
        func.ST_AsGeoJSON(HazardArea.geometry).label("geojson"),
    ).filter(HazardArea.city_id == city_id, HazardArea.geometry.isnot(None))

    if hazard_type:
        q = q.filter(HazardArea.hazard_type == hazard_type)
    if scenario:
        q = q.filter(HazardArea.scenario == scenario)
    if bbox:
        try:
            min_lng, min_lat, max_lng, max_lat = (float(v.strip()) for v in bbox.split(","))
        except ValueError:
            raise HTTPException(status_code=422, detail="bbox must be 'minLng,minLat,maxLng,maxLat'")
        envelope = func.ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
        q = q.filter(func.ST_Intersects(HazardArea.geometry, envelope))

    features = [
        {
            "type": "Feature",
            "id": str(row.id),
            "geometry": json.loads(row.geojson),
            "properties": {
                "id": str(row.id),
                "hazard_type": row.hazard_type,
                "scenario": row.scenario,
            },
        }
        for row in q.all()
    ]
    return {"type": "FeatureCollection", "features": features}