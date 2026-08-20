from fastapi import APIRouter
from fastapi.params import Depends

from dependencies import get_psa_service
from services.psa_service import PsaService, PSOCResponse

test_route = APIRouter()

@test_route.get("/test-psoc", response_model=list[PSOCResponse])
async def test_psoc_endpoint(
        service: PsaService = Depends(
            get_psa_service
        )
):
    return await service.get_psoc()