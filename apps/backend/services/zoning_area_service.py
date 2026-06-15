import json
from uuid import UUID

from fastapi import HTTPException
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import mapping, shape
from sqlalchemy import func
from sqlalchemy.orm import Session

from schema.ZoningAreaDto import (
    ZoningAreaCreate,
    ZoningAreaResponse,
    ZoningAreaUpdate,
    ZoningImageProcessRequest,
    ZoningPmtilesResponse,
    ZoningProcessResponse,
)
from models.city import City
from models.document import Document
from models.zoning_area import ZoningArea
from services import geo_processing_service as gps
from services.coordinate_service import clip_to_city_boundary

# Canonical fill colors per zone_type — kept in sync with frontend ZONE_TYPE_COLORS.
ZONE_TYPE_COLORS: dict[str, str] = {
    "residential": "#fbbf24",  # amber  — standard yellow for residential
    "commercial":  "#f87171",  # rose   — standard red for commercial
    "industrial":  "#818cf8",  # indigo — standard purple-blue for industrial
    "agriculture": "#4ade80",  # green  — standard green for agriculture
}


def get_by_city(
    city_id: UUID,
    db: Session,
    scenario: str | None = None,
    scenario_type: str | None = None,
) -> list[ZoningArea]:
    q = db.query(ZoningArea).filter(ZoningArea.city_id == city_id)
    if scenario is not None:
        q = q.filter(ZoningArea.scenario == scenario)
    if scenario_type is not None:
        q = q.filter(ZoningArea.scenario_type == scenario_type)
    return q.all()


def get_geometry_by_city(city_id: UUID, db: Session) -> list[ZoningArea]:
    return (
        db.query(ZoningArea)
        .filter(ZoningArea.city_id == city_id, ZoningArea.geometry.isnot(None))
        .all()
    )


def get_or_404(zone_id: UUID, city_id: UUID, db: Session) -> ZoningArea:
    zone = db.query(ZoningArea).filter(ZoningArea.id == zone_id, ZoningArea.city_id == city_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zoning area not found")
    return zone


def create(city_id: UUID, payload: ZoningAreaCreate, created_by: UUID, db: Session) -> ZoningArea:
    if not db.query(City).filter(City.id == city_id).first():
        raise HTTPException(status_code=404, detail="City not found")
    data = payload.model_dump()
    if data.get("geometry"):
        clipped = clip_to_city_boundary(data["geometry"], city_id, db)
        data["geometry"] = from_shape(shape(clipped), srid=4326)
    if not data.get("color_hex") and data.get("zone_type"):
        data["color_hex"] = ZONE_TYPE_COLORS.get(data["zone_type"])
    zone = ZoningArea(**data, created_by=created_by)
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


def update(zone_id: UUID, city_id: UUID, payload: ZoningAreaUpdate, db: Session) -> ZoningArea:
    zone = get_or_404(zone_id, city_id, db)
    data = payload.model_dump(exclude_unset=True)
    if "geometry" in data and data["geometry"] is not None:
        clipped = clip_to_city_boundary(data["geometry"], city_id, db)
        data["geometry"] = from_shape(shape(clipped), srid=4326)
    # If zone_type changes without an explicit color_hex override, re-assign the canonical color.
    if "zone_type" in data and "color_hex" not in data and data.get("zone_type") in ZONE_TYPE_COLORS:
        data["color_hex"] = ZONE_TYPE_COLORS[data["zone_type"]]
    for field, value in data.items():
        setattr(zone, field, value)
    db.commit()
    db.refresh(zone)
    return zone


def delete(zone_id: UUID, city_id: UUID, db: Session) -> None:
    zone = get_or_404(zone_id, city_id, db)
    db.delete(zone)
    db.commit()


def process_zoning_image(
    city_id: UUID,
    payload: ZoningImageProcessRequest,
    user_id: UUID,
    db: Session,
) -> ZoningProcessResponse:
    """
    Full pipeline:
      image → K-means segmentation → contour detection → OCR label assignment
      → homography transform (pixel→geo) → ZoningArea records → PMTiles
    """
    if not db.query(City).filter(City.id == city_id).first():
        raise HTTPException(status_code=404, detail="City not found")

    if len(payload.gcps) < 4:
        raise HTTPException(status_code=422, detail="At least 4 ground control points required")

    # Resolve Document UUID → MinIO object key, then load image
    document = db.query(Document).filter(Document.id == payload.file_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Uploaded file not found")
    try:
        image_bytes, image_bgr = gps.load_image_from_minio(document.file_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    # Compute pixel→geo homography
    try:
        H = gps.compute_homography(payload.gcps)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Detect legend boxes, title bars, scale inserts — build exclusion mask
    exclude_mask = gps.detect_map_furniture(image_bgr)

    # K-means color segmentation (legend regions white-filled before clustering)
    label_map, centers_rgb = gps.segment_by_color(image_bgr, payload.n_colors, exclude_mask)

    # Extract contours per color cluster (excluded regions zeroed, skip white/black)
    contours_with_colors = gps.get_zone_contours(
        label_map, payload.n_colors, payload.min_area_px, centers_rgb, exclude_mask
    )

    if not contours_with_colors:
        raise HTTPException(
            status_code=422,
            detail="No colored zones detected. Try increasing n_colors or decreasing min_area_px.",
        )

    # OCR — assign zone labels; legend/title text filtered by exclude_mask
    ocr_results = gps.run_ocr(image_bytes)
    labels = gps.assign_labels(contours_with_colors, ocr_results, exclude_mask)

    # Fallback zone_type: when OCR returns nothing (not configured / no text on zone),
    # use the detected color as a human-readable name so zone_type is never null.
    color_counts: dict[str, int] = {}
    resolved_labels: list[str | None] = []
    for (_, color_rgb), label in zip(contours_with_colors, labels):
        if label:
            resolved_labels.append(label)
        else:
            hex_c = gps.color_to_hex(color_rgb)
            n = color_counts.get(hex_c, 0) + 1
            color_counts[hex_c] = n
            resolved_labels.append(hex_c if n == 1 else f"{hex_c} ({n})")
    labels = resolved_labels

    # Vectorize contours → geo polygons → clip to city boundary → ZoningArea records
    created_zones: list[tuple[ZoningArea, object, str | None]] = []  # (zone, clipped_poly, color_hex)
    skipped = 0

    for (contour, color_rgb), zone_type in zip(contours_with_colors, labels):
        poly = gps.contour_to_geo_polygon(contour, H)
        if poly is None:
            skipped += 1
            continue

        # Clip to city boundary — skip zones that are entirely outside
        try:
            clipped_geom = clip_to_city_boundary(dict(mapping(poly)), city_id, db)
            clipped_poly = shape(clipped_geom)
            if clipped_poly.is_empty or not clipped_poly.is_valid:
                skipped += 1
                continue
        except HTTPException as exc:
            if exc.status_code == 422:
                # Entirely outside boundary — skip silently
                skipped += 1
                continue
            if exc.status_code == 404 and "boundary" in str(exc.detail):
                # City has no boundary — persist unclipped
                clipped_poly = poly
            else:
                raise

        color_hex = gps.color_to_hex(color_rgb)
        zone = ZoningArea(
            city_id=city_id,
            zone_type=zone_type,
            color_hex=color_hex,
            geometry=from_shape(clipped_poly, srid=4326),
            created_by=user_id,
        )
        db.add(zone)
        created_zones.append((zone, clipped_poly, color_hex))

    if not created_zones:
        raise HTTPException(
            status_code=422,
            detail="All detected zones failed geometry validation. Check GCP accuracy.",
        )

    db.commit()
    for zone, _, _c in created_zones:
        db.refresh(zone)

    # Build GeoJSON from ALL city zones (newly created + existing) for PMTile
    all_city_zones = (
        db.query(ZoningArea)
        .filter(ZoningArea.city_id == city_id, ZoningArea.geometry.isnot(None))
        .all()
    )
    features = []
    for z in all_city_zones:
        try:
            features.append({
                "type": "Feature",
                "properties": {
                    "id": str(z.id),
                    "zone_type": z.zone_type or "",
                    "color": z.color_hex or "#888888",
                    "scenario": z.scenario,
                    "scenario_type": z.scenario_type,
                },
                "geometry": mapping(to_shape(z.geometry)),
            })
        except Exception:
            continue

    object_key = gps.generate_pmtiles(
        {"type": "FeatureCollection", "features": features},
        city_id,
    )

    # Persist the object key on ALL zones in the city so any zone query
    # can surface the current PMTile without a separate lookup table.
    if object_key:
        db.query(ZoningArea).filter(ZoningArea.city_id == city_id).update(
            {"pmtile_url": object_key},
            synchronize_session="fetch",
        )
        db.commit()

    presigned_url = gps.presign_pmtile(object_key) if object_key else None

    # Build response using Shapely polygons we already have (avoids WKB round-trip)
    zone_responses = [
        ZoningAreaResponse(
            id=zone.id,
            city_id=zone.city_id,
            zone_type=zone.zone_type,
            color_hex=color_hex,
            severity=zone.severity,
            scenario=zone.scenario,
            scenario_type=zone.scenario_type,
            geometry=dict(mapping(poly)),
            pmtile_url=object_key,
            created_by=zone.created_by,
            created_at=zone.created_at,
        )
        for zone, poly, color_hex in created_zones
    ]

    return ZoningProcessResponse(
        zones_created=len(created_zones),
        skipped_zones=skipped,
        pmtile_url=presigned_url,
        zones=zone_responses,
    )


def regenerate_pmtile(city_id: UUID, db: Session) -> ZoningPmtilesResponse:
    """
    Rebuild the city's zoning PMTile from current DB records (zone_type + color_hex)
    without reprocessing the source image. Use after patching zone_type labels.
    Raises 404 if the city has no zoning geometry yet.
    """
    if not db.query(City).filter(City.id == city_id).first():
        raise HTTPException(status_code=404, detail="City not found")

    zones = (
        db.query(ZoningArea)
        .filter(ZoningArea.city_id == city_id, ZoningArea.geometry.isnot(None))
        .all()
    )
    if not zones:
        raise HTTPException(
            status_code=404,
            detail="No zoning geometry found for this city. Run process-image first.",
        )

    features = []
    for z in zones:
        try:
            features.append({
                "type": "Feature",
                "properties": {
                    "id": str(z.id),
                    "zone_type": z.zone_type or "",
                    "color": z.color_hex or "#888888",
                    "scenario": z.scenario,
                    "scenario_type": z.scenario_type,
                },
                "geometry": mapping(to_shape(z.geometry)),
            })
        except Exception:
            continue

    if not features:
        raise HTTPException(status_code=422, detail="No valid geometries to tile.")

    object_key = gps.generate_pmtiles(
        {"type": "FeatureCollection", "features": features},
        city_id,
    )
    if not object_key:
        raise HTTPException(
            status_code=422,
            detail="PMTile generation failed — tippecanoe not available.",
        )

    db.query(ZoningArea).filter(ZoningArea.city_id == city_id).update(
        {"pmtile_url": object_key},
        synchronize_session="fetch",
    )
    db.commit()

    return ZoningPmtilesResponse(
        pmtile_url=gps.presign_pmtile(object_key),
        object_key=object_key,
    )


def get_geojson(
    city_id: UUID,
    db: Session,
    bbox: str | None = None,
    scenario: str | None = None,
    scenario_type: str | None = None,
) -> dict:
    """
    Return a GeoJSON FeatureCollection of all zoning areas for a city.
    Optional bbox='minLng,minLat,maxLng,maxLat' spatially filters via PostGIS ST_Intersects.
    Geometry is serialized by PostGIS (ST_AsGeoJSON) — no Shapely roundtrip.
    """
    q = db.query(
        ZoningArea.id,
        ZoningArea.zone_type,
        ZoningArea.color_hex,
        ZoningArea.scenario,
        ZoningArea.scenario_type,
        func.ST_AsGeoJSON(ZoningArea.geometry).label("geojson"),
    ).filter(ZoningArea.city_id == city_id, ZoningArea.geometry.isnot(None))

    if scenario is not None:
        q = q.filter(ZoningArea.scenario == scenario)
    if scenario_type is not None:
        q = q.filter(ZoningArea.scenario_type == scenario_type)
    if bbox:
        try:
            min_lng, min_lat, max_lng, max_lat = (float(v.strip()) for v in bbox.split(","))
        except ValueError:
            raise HTTPException(status_code=422, detail="bbox must be 'minLng,minLat,maxLng,maxLat'")
        envelope = func.ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
        q = q.filter(func.ST_Intersects(ZoningArea.geometry, envelope))

    features = [
        {
            "type": "Feature",
            "id": str(row.id),
            "geometry": json.loads(row.geojson),
            "properties": {
                "id": str(row.id),
                "zone_type": row.zone_type,
                "color_hex": row.color_hex,
                "scenario": row.scenario,
                "scenario_type": row.scenario_type,
            },
        }
        for row in q.all()
    ]
    return {"type": "FeatureCollection", "features": features}


def get_city_pmtile_url(city_id: UUID, db: Session) -> ZoningPmtilesResponse | None:
    """
    Return a fresh presigned URL (5 h TTL) for the city's zoning PMTile.
    Returns None if no PMTile has been generated for this city yet.
    """
    zone = (
        db.query(ZoningArea)
        .filter(ZoningArea.city_id == city_id, ZoningArea.pmtile_url.isnot(None))
        .first()
    )
    if not zone:
        return None
    presigned = gps.presign_pmtile(zone.pmtile_url)
    return ZoningPmtilesResponse(pmtile_url=presigned, object_key=zone.pmtile_url)