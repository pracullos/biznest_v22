import logging
import httpx
logger = logging.getLogger(__name__)

class PsaClient:
    def __init__(
            self,
            http_client = httpx.AsyncClient,
    ):
        self.http_client = http_client

    async def get(self, endpoint: str) -> list[dict]:
        try:
            response = await self.http_client.get(endpoint)

            response.raise_for_status()

            return response.json()
        except httpx.TimeoutException:
            logger.exception(
                "Timeout while calling PSA endpoint %s",
                endpoint
            )
            raise
        except httpx.HTTPStatusError:
            logger.exception(
                "PSA API returned error for endpoint %s",
                endpoint
            )
            raise
