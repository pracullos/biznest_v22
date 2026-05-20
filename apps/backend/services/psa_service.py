"""
PSA Classifications API client.

Fetches top-level entries from the Philippine Statistics Authority classification
systems (PSIC, PSOC, PCOICOP, PCPC, PSCC, PSCED, PSCCS, PTSC) and caches them
in Redis for 24 h. Falls back to [] on any API or network error.
"""

from __future__ import annotations

import json
import logging
import os

import requests

logger = logging.getLogger(__name__)

_PSA_TOKEN = os.environ.get("PSGC_API_TOKEN", "")
_BASE_URL = "https://psa.gov.ph/classifications-api"
_CACHE_TTL = 86400  # 24 h

# All 8 supported classification systems
SYSTEMS: dict[str, str] = {
    "psic":    "Philippine Standard Industrial Classification",
    "psoc":    "Philippine Standard Occupational Classification",
    "pcoicop": "Philippine Classification of Individual Consumption According to Purpose",
    "pcpc":    "Philippine Classification of Products by Activity",
    "pscc":    "Philippine Standard Commodity Classification",
    "psced":   "Philippine Standard Classification of Education",
    "psccs":   "Philippine Standard Classification of Crime Statistics",
    "ptsc":    "Philippine Tourism Satellite Account Classification",
}

# Max characters a "top-level" code can have per system
_TOP_LEVEL_MAX_CODE_LEN: dict[str, int] = {
    "psic":    1,   # sections A–U
    "psoc":    1,   # major groups 1–9
    "pcoicop": 2,   # divisions 01–14
    "pcpc":    2,
    "pscc":    2,
    "psced":   2,
    "psccs":   2,
    "ptsc":    2,
}


class PsaService:

    def __init__(self, redis_client=None):
        self.redis = redis_client

    def get_all_systems(self) -> dict[str, list[dict]]:
        """Fetch top-level entries for all 8 classification systems."""
        return {system: self.get_system(system) for system in SYSTEMS}

    def get_system(self, system: str) -> list[dict]:
        """Return top-level entries for one PSA classification system."""
        if system not in SYSTEMS:
            return []

        cache_key = f"psa:{system}"

        if self.redis:
            try:
                cached = self.redis.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception:
                pass

        data = self._fetch_top_level(system)

        if self.redis and data:
            try:
                self.redis.setex(cache_key, _CACHE_TTL, json.dumps(data))
            except Exception:
                pass

        return data

    # ── internals ────────────────────────────────────────────────────────────

    def _fetch_all_pages(self, system: str) -> list[dict]:
        """Fetch every page of results from the PSA API."""
        if not _PSA_TOKEN:
            logger.warning("PSGC_API_TOKEN not set — PSA API calls disabled")
            return []

        results: list[dict] = []
        url: str | None = f"{_BASE_URL}/{system}/"
        headers = {
            "Authorization": f"Bearer {_PSA_TOKEN}",
            "Accept": "application/json",
        }

        while url:
            try:
                r = requests.get(url, headers=headers, timeout=15)
            except Exception as exc:
                logger.warning("PSA API %s request failed: %s", system, exc)
                break

            if r.status_code != 200:
                logger.warning("PSA API %s returned HTTP %s", system, r.status_code)
                break

            try:
                body = r.json()
            except Exception:
                break

            if isinstance(body, list):
                results.extend(body)
                break
            elif isinstance(body, dict):
                results.extend(body.get("results", []))
                url = body.get("next")
            else:
                break

        return results

    def _fetch_top_level(self, system: str) -> list[dict]:
        """Fetch and filter to top-level codes only."""
        all_items = self._fetch_all_pages(system)
        max_len = _TOP_LEVEL_MAX_CODE_LEN.get(system, 2)

        top = [
            {
                "code": str(item.get("code", "")),
                "title": item.get("title") or item.get("name") or "",
            }
            for item in all_items
            if item.get("code") and len(str(item["code"])) <= max_len
        ]

        # If the filter produces nothing (API might use longer codes), fall back
        # to the first 20 raw entries so the context is never completely empty.
        if not top and all_items:
            top = [
                {
                    "code": str(item.get("code", "")),
                    "title": item.get("title") or item.get("name") or "",
                }
                for item in all_items[:20]
            ]

        return top
