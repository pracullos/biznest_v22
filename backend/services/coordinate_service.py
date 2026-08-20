# NOTE: Service not yet implemented — no route associated.
# Intended use: clip hazard geometries to city boundary before persistence/display.

from uuid import UUID

from fastapi import HTTPException
from geoalchemy2.shape import to_shape
from shapely.errors import ShapelyError
from shapely.geometry import mapping, shape
from sqlalchemy.orm import Session

from models.city import City


def clip_to_city_boundary(
    geometry: dict,
    city_id: UUID,
    db: Session,
) -> dict:
    """
    Intersect a GeoJSON geometry with the city boundary.

    Returns the clipped GeoJSON geometry dict. If the geometry is fully
    inside the boundary it is returned unchanged. If fully outside, raises
    422. Raises 404 when city not found or has no boundary.

    Args:
        geometry: GeoJSON geometry dict (any type — Point, Polygon, etc.)
        city_id:  City whose boundary is used as the clip mask
        db:       SQLAlchemy session

    Returns:
        Clipped GeoJSON geometry dict
    """
    city = db.query(City).filter(City.id == city_id).first()
    if not city:
        raise HTTPException(status_code=404, detail="City not found")
    if city.boundary is None:
        raise HTTPException(status_code=404, detail="City has no boundary geometry")

    city_shape = to_shape(city.boundary)

    try:
        input_shape = shape(geometry)
    except (ShapelyError, ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid geometry: {exc}") from exc

    if not input_shape.is_valid:
        input_shape = input_shape.buffer(0)

    if city_shape.contains(input_shape):
        return geometry

    clipped = input_shape.intersection(city_shape)

    if clipped.is_empty:
        raise HTTPException(
            status_code=422,
            detail="Geometry is entirely outside the city boundary",
        )

    return dict(mapping(clipped))


def is_within_city_boundary(
    geometry: dict,
    city_id: UUID,
    db: Session,
) -> bool:
    """
    Return True when geometry is fully contained by city boundary.

    Does not clip — use clip_to_city_boundary for that.
    Returns False (not True) when city has no boundary, to fail safe.
    """
    city = db.query(City).filter(City.id == city_id).first()
    if not city or city.boundary is None:
        return False

    city_shape = to_shape(city.boundary)

    try:
        input_shape = shape(geometry)
    except (ShapelyError, ValueError, TypeError):
        return False

    if not input_shape.is_valid:
        input_shape = input_shape.buffer(0)

    return bool(city_shape.contains(input_shape))