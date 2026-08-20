from uuid import UUID
from pydantic import BaseModel, ConfigDict


class RegionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str


class ProvinceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str


class CitySimpleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str