import pytest
import httpx
from unittest.mock import AsyncMock, patch
from services.psa_service import PsaService, PSOCResponse


@pytest.mark.asyncio
async def test_get_psoc_mocked():
    """Test with mock data (faster, no network)"""
    mock_data = [
        {
            "id": 1,
            "majorcode": 1,
            "title": "Agriculture",
            "description": "Agriculture and related services",
            "version": 1
        }
    ]

    service = PsaService()

    with patch('httpx.AsyncClient') as mock_client:
        mock_response = AsyncMock()
        mock_response.json.return_value = mock_data
        mock_client.return_value.__aenter__.return_value.get.return_value = mock_response

        url = "https://classification.psa.gov.ph/psoc/2021/all?format=json&token=2894b4c0-e641-4087-b5f3-3ad93d1bddab"
        result = await service.get_psoc(url)

        assert len(result) == 1
        assert result[0].title == "Agriculture"