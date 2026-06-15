"""
PSA Classifications API client.

Each system lives at classification.psa.gov.ph/<system>/<version>/<level>.
Auth is a token query parameter — NOT a Bearer header.
Responses are plain JSON arrays (no pagination envelope at the top level).

Cache key prefix is "psa:v2:" to bust any stale v1 Redis entries.
"""
from __future__ import annotations

import json
import logging
import os
from pydantic import BaseModel, conint, constr, Field
from typing import  TypeVar, Type

from clients.psa_client import PsaClient
from enums.psa_classification import PSAClassification
from schema.psoc import PSOCResponse

logger = logging.getLogger(__name__)

_TOKEN    = os.environ.get("PSGC_API_TOKEN", "")
_CACHE_TTL = 86400  # 24 h — classifications rarely change

SYSTEMS = ["psic", "pcoicop", "psoc", "ptsc"]

T = TypeVar("T", bound=BaseModel)

# ── Service ───────────────────────────────────────────────────────────────────

class PsaService:

    ENDPOINTS = {
        PSAClassification.PSOC: "/psoc/major-groups",
    }

    def __init__(
            self,
            psa_client: PsaClient,
            redis_client = None
    ):
        self.psa_client = psa_client
        self.redis = redis_client


    async def _fetch_model(
            self,
            cache_key: str,
            endpoint: str,
            model: Type[T],
    ) -> list[T]:

        if self.redis:
            cache = await self.redis.get(cache_key)

            if cache:
                logger.info(
                    "PSA cache hit: %s",
                    cache_key
                )

                data = json.load(cache)
                return [
                    model.model_validate(item)
                    for item in data
                ]
        logger.info(
            "PSA cache miss: %s",
            cache_key
        )

        data = await self.psa_client.get(endpoint)

        result = [
            model.model_validate(item)
            for item in data
        ]

        if self.redis:
            await self.redis.set(cache_key, json.dumps([item.model_dump for item in result]), ex=_CACHE_TTL)

        return result

    async def get_psoc(self) -> list[PSOCResponse]:
        return await self._fetch_model(
            cache_key="psa:psoc",
            endpoint=self.ENDPOINTS[
                PSAClassification.PSOC
            ],
            model=PSOCResponse
        )

