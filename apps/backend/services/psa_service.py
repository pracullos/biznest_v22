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
from dataclasses import dataclass, field

import requests

logger = logging.getLogger(__name__)

_TOKEN    = os.environ.get("PSGC_API_TOKEN", "")
_BASE     = "https://classification.psa.gov.ph"
_CACHE_TTL = 86400  # 24 h — classifications rarely change


@dataclass
class _Spec:
    """Describes how to query one PSA classification system."""
    slug:         str               # cache key / response dict key
    version:      str | None        # URL segment, None → omitted (e.g. ptscs)
    level:        str               # top-level endpoint segment
    code_fields:  list[str]         # candidate response fields for the code
    title_fields: list[str]         # candidate response fields for the title
    description_fields: list[str] = field(default_factory=list)  # optional description


# ── System registry ───────────────────────────────────────────────────────────
#
# Each entry targets the most useful top-level grouping for business analysis:
#   PSIC   – sections (A–U)
#   PSOC   – major occupational groups (1–9)
#   PCOICOP – divisions (01–14)
#   PCPC   – sections (0–9)
#   PSCC   – sections (I–XXI)
#   PSCED  – levels (0–9 education levels)
#   PSCCS  – sections (01–09)
#   PTSCS  – industry categories (no version segment)

SYSTEM_SPECS: list[_Spec] = [
    _Spec(
        slug="psic", version="2019", level="sections",
        code_fields=["section"],
        title_fields=["title"],
        description_fields=["secdesc"],
    ),
    _Spec(
        slug="psoc", version="2012", level="major",
        code_fields=["majorcode"],
        title_fields=["title"],
        description_fields=["description"],
    ),
    _Spec(
        slug="pcoicop", version="2020", level="divisions",
        code_fields=["division"],
        title_fields=["title"],
        description_fields=["description"],
    ),
    _Spec(
        slug="pcpc", version="2002", level="sections",
        code_fields=["section"],
        title_fields=["title"],
        description_fields=[],
    ),
    _Spec(
        slug="pscc", version="2022", level="sections",
        code_fields=["sectionnum", "section"],
        title_fields=["sectiondesc"],
        description_fields=[],
    ),
    _Spec(
        slug="psced", version="2008", level="levels",
        code_fields=["level"],
        title_fields=["title", "course_title"],
        description_fields=[],
    ),
    _Spec(
        slug="psccs", version="2018", level="sections",
        code_fields=["sectioncode"],
        title_fields=["section_title"],
        description_fields=["sectiondesc"],
    ),
    _Spec(
        slug="ptscs", version=None, level="industry",
        code_fields=["categoryid"],
        title_fields=["categorydesc"],
        description_fields=["keywords"],
    ),
]

SYSTEMS: dict[str, _Spec] = {s.slug: s for s in SYSTEM_SPECS}


# ── Service ───────────────────────────────────────────────────────────────────

class PsaService:

    def __init__(self, redis_client=None):
        self.redis = redis_client

    def get_all_systems(self) -> dict[str, list[dict]]:
        """Fetch top-level entries for all registered classification systems."""
        return {spec.slug: self.get_system(spec.slug) for spec in SYSTEM_SPECS}

    def get_system(self, slug: str) -> list[dict]:
        """Return normalised top-level entries for one system. Redis-cached 24 h."""
        spec = SYSTEMS.get(slug)
        if not spec:
            return []

        cache_key = f"psa:v2:{slug}"

        if self.redis:
            try:
                cached = self.redis.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception:
                pass

        data = self._fetch(spec)

        if self.redis and data:
            try:
                self.redis.setex(cache_key, _CACHE_TTL, json.dumps(data))
            except Exception:
                pass

        return data

    # ── internals ─────────────────────────────────────────────────────────────

    def _build_url(self, spec: _Spec) -> str:
        if spec.version:
            return f"{_BASE}/{spec.slug}/{spec.version}/{spec.level}"
        return f"{_BASE}/{spec.slug}/{spec.level}"

    def _fetch(self, spec: _Spec) -> list[dict]:
        if not _TOKEN:
            print("[PSA] PSGC_API_TOKEN not set — PSA API calls disabled", flush=True)
            return []

        url = self._build_url(spec)
        params: dict = {"token": _TOKEN, "page_size": 200}

        print(f"[PSA] {spec.slug}: GET {url}", flush=True)

        try:
            r = requests.get(
                url,
                params=params,
                timeout=10,
                allow_redirects=True,
                headers={"Accept": "application/json"},
            )
        except Exception as exc:
            print(f"[PSA] {spec.slug}: request failed — {type(exc).__name__}: {exc}", flush=True)
            return []

        print(f"[PSA] {spec.slug}: HTTP {r.status_code}  ({len(r.content)} bytes)", flush=True)

        if r.status_code != 200:
            print(f"[PSA] {spec.slug}: non-200 body preview → {r.text[:400]}", flush=True)
            return []

        try:
            body = r.json()
        except Exception as exc:
            print(f"[PSA] {spec.slug}: JSON parse error — {exc}  body={r.text[:200]}", flush=True)
            return []

        # Responses are plain arrays; some APIs wrap in {results:[...]} or {data:[...]}
        if isinstance(body, list):
            items = body
        elif isinstance(body, dict):
            items = body.get("results") or body.get("data") or []
        else:
            items = []

        result = [n for item in items if item for n in [self._normalize(item, spec)] if n["code"]]
        print(f"[PSA] {spec.slug}: {len(result)} top-level entries", flush=True)
        return result

    def _normalize(self, item: dict, spec: _Spec) -> dict:
        code = ""
        for f in spec.code_fields:
            val = item.get(f)
            if val is not None:
                code = str(val).strip()
                break

        title = ""
        for f in spec.title_fields:
            val = item.get(f)
            if val:
                title = str(val).strip()
                break

        description = ""
        for f in spec.description_fields:
            val = item.get(f)
            if val:
                description = str(val).strip()
                break

        return {"code": code, "title": title, "description": description}
