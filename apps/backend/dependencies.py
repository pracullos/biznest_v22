
import httpx
from clients.psa_client import PsaClient
from services.psa_service import PsaService


BASE_URL = "https://classification.psa.gov.ph"

http_client = httpx.AsyncClient(
    base_url=BASE_URL,
    timeout=httpx.Timeout(connect=5,timeout=10),
)

psa_client = PsaClient(http_client)

def get_psa_service():
    return PsaService(
        psa_client=psa_client,
        redis_client=None
    )
