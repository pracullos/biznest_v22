from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, defer

from core.db import get_db
from models.region import Region
from models.province import Province
from models.city import City
from schema.RegionDto import RegionResponse, ProvinceResponse, CitySimpleResponse

router = APIRouter()


@router.get("/regions/", response_model=list[RegionResponse])
def list_regions(db: Session = Depends(get_db)):
    regions = (
        db.query(Region)
        .options(defer(Region.boundary))
        .order_by(Region.name)
        .all()
    )
    return regions


@router.get("/regions/{region_id}/provinces", response_model=list[ProvinceResponse])
def list_provinces_by_region(region_id: UUID, db: Session = Depends(get_db)):
    provinces = (
        db.query(Province)
        .options(defer(Province.boundary))
        .filter(Province.region_id == region_id)
        .order_by(Province.name)
        .all()
    )
    return provinces


@router.get("/provinces/{province_id}/cities", response_model=list[CitySimpleResponse])
def list_cities_by_province(province_id: UUID, db: Session = Depends(get_db)):
    cities = (
        db.query(City)
        .options(defer(City.boundary))
        .filter(City.province_id == province_id)
        .order_by(City.name)
        .all()
    )
    return cities