from __future__ import annotations

import json
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

import anthropic
import groq as groq_lib
from fastapi import HTTPException, status

from repository.analyze_repository import AnalyzeRepository
from schema.AnalyzeDto import (
    AnalyzeRequest,
    AnalyzeResponse,
    HazardHit,
    LocationAnalyzeRequest,
    LocationAnalyzeResponse,
    LocationContext,
    NearbyEstablishment,
    PsaEntry,
    ZoneHit,
)
from services.psa_service import PsaService, SYSTEMS

_ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
_GROQ_API_KEY = os.environ.get("GROQ_API_TOKEN", "")

# City chat: Claude Haiku (fast, low cost)
_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"
# Location analysis: Llama via Groq (higher reasoning capacity)
_GROQ_MODEL = "llama-3.3-70b-versatile"

_SYSTEM_TEMPLATE = """\
You are BizNest AI, an investment intelligence assistant for Philippine cities.
You help investors identify the best locations for their businesses based on \
real zoning classifications and hazard risk data.

City context
------------
City       : {city_name}{province_line}
Zone types : {zone_types}
Hazards    : {hazards}

Rules
-----
- Be specific and cite the zone types or hazard types that are relevant.
- Recommend zones with lower hazard exposure for business.
- If data is missing (e.g. no zoning recorded yet) say so honestly.
- Keep responses concise: 2-4 short paragraphs, no bullet-point walls.
- Never fabricate data that is not in the context above.
"""


class AnalyzeService:

    def __init__(self, repo: AnalyzeRepository, redis_client=None):
        self.repo = repo
        self.redis_client = redis_client

    def analyze(self, city_id: str, payload: AnalyzeRequest) -> AnalyzeResponse:
        if not _ANTHROPIC_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI service not configured (ANTHROPIC_API_KEY missing)",
            )

        city = self.repo.get_city(city_id)
        if not city:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="City not found")

        zone_types = self.repo.get_zone_types(city_id)
        hazard_rows = self.repo.get_hazard_summary(city_id)

        province_line = f", {city.province}" if getattr(city, "province", None) else ""
        zone_str = ", ".join(zone_types) if zone_types else "No zoning data recorded yet"
        hazard_str = (
            "; ".join(
                f"{h['hazard_type']} ({', '.join(h['scenarios'])})" if h["scenarios"]
                else h["hazard_type"]
                for h in hazard_rows
            )
            if hazard_rows
            else "No hazard data recorded yet"
        )

        system_prompt = _SYSTEM_TEMPLATE.format(
            city_name=city.name,
            province_line=province_line,
            zone_types=zone_str,
            hazards=hazard_str,
        )

        client = anthropic.Anthropic(api_key=_ANTHROPIC_API_KEY)
        message = client.messages.create(
            model=_ANTHROPIC_MODEL,
            max_tokens=512,
            system=system_prompt,
            messages=[{"role": "user", "content": payload.question}],
        )

        answer = message.content[0].text if message.content else "No response generated."
        return AnalyzeResponse(answer=answer, city_name=city.name)

    # ── Location analysis ─────────────────────────────────────────────────────

    def analyze_location(
        self, city_id: str, payload: LocationAnalyzeRequest
    ) -> LocationAnalyzeResponse:
        if not _GROQ_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI service not configured (GROQ_API_TOKEN missing)",
            )

        geo_type = payload.geometry.get("type", "")
        if geo_type not in ("Point", "Polygon", "MultiPolygon"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"geometry.type must be Point, Polygon, or MultiPolygon; got '{geo_type}'",
            )

        city = self.repo.get_city(city_id)
        if not city:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="City not found")

        geojson_str = json.dumps(payload.geometry)
        is_point = geo_type == "Point"
        buf = payload.buffer_meters

        # ── Spatial queries ───────────────────────────────────────────────────
        zone_rows  = self.repo.get_zones_at_geometry(city_id, geojson_str, geo_type, buf)
        hazard_rows = self.repo.get_hazards_at_geometry(city_id, geojson_str, geo_type, buf)
        estab_rows  = self.repo.get_establishments_at_geometry(city_id, geojson_str, geo_type, buf)

        # ── PSA classifications (all 8 systems, parallel, Redis-cached) ────────
        psa = PsaService(self.redis_client)
        psa_data: dict[str, list[dict]] = {}
        with ThreadPoolExecutor(max_workers=len(SYSTEMS)) as pool:
            futures = {pool.submit(psa.get_system, slug): slug for slug in SYSTEMS}
            for future in as_completed(futures, timeout=30):
                slug = futures[future]
                try:
                    psa_data[slug] = future.result()
                except Exception:
                    psa_data[slug] = []
        # Ensure all systems present even if future timed out
        for slug in SYSTEMS:
            psa_data.setdefault(slug, [])

        # ── Assemble response context ─────────────────────────────────────────
        zoning_ctx = [ZoneHit(**r) for r in zone_rows]
        hazard_ctx = [HazardHit(**r) for r in hazard_rows]
        estab_ctx  = [NearbyEstablishment(**r) for r in estab_rows]
        psa_ctx    = {
            sys: [PsaEntry(**e) for e in entries]
            for sys, entries in psa_data.items()
        }

        ctx = LocationContext(
            geometry_type=geo_type,
            buffer_meters=buf if is_point else None,
            zoning=zoning_ctx,
            hazards=hazard_ctx,
            nearby_establishments=estab_ctx,
            psa_classifications=psa_ctx,
        )

        # ── Build AI prompt ───────────────────────────────────────────────────
        radius_note = f"{buf}m radius" if is_point else "drawn polygon"
        province_line = f", {city.province}" if getattr(city, "province", None) else ""

        def _fmt_zones() -> str:
            if not zoning_ctx:
                return "  No zoning data at this location"
            return "\n".join(
                f"  - {z.zone_type or '(unlabelled)'}: {z.count} zone(s)"
                + (f", avg severity {z.avg_severity:.1f}/5" if z.avg_severity else "")
                for z in zoning_ctx
            )

        def _fmt_hazards() -> str:
            if not hazard_ctx:
                return "  No hazard exposure detected at this location"
            return "\n".join(
                f"  - {h.hazard_type}"
                + (f" ({', '.join(h.scenarios)})" if h.scenarios else "")
                + (f", avg severity {h.avg_severity:.1f}/5" if h.avg_severity else "")
                for h in hazard_ctx
            )

        def _fmt_estabs() -> str:
            if not estab_ctx:
                return "  No recorded establishments nearby"
            return "\n".join(
                f"  - {e.category or 'uncategorized'}: {e.count}"
                for e in estab_ctx
            )

        def _fmt_psa(sys: str, label: str) -> str:
            entries = psa_ctx.get(sys, [])
            if not entries:
                return f"  {label}: data not available"
            return "\n".join(f"  [{e.code}] {e.title}" for e in entries)

        system_prompt = f"""\
You are BizNest AI, a Philippine investment intelligence assistant.
Analyze the selected location ({radius_note}) and recommend suitable businesses.

City: {city.name}{province_line}
Geometry: {geo_type}{(' — ' + str(buf) + 'm buffer') if is_point else ''}

=== ZONING AT THIS LOCATION ===
{_fmt_zones()}

=== HAZARD EXPOSURE ===
{_fmt_hazards()}

=== NEARBY ESTABLISHMENTS ===
{_fmt_estabs()}

=== PSA INDUSTRIAL CLASSIFICATION (PSIC) ===
{_fmt_psa('psic', 'PSIC')}

=== PSA CONSUMPTION CLASSIFICATION (PCOICOP) ===
{_fmt_psa('pcoicop', 'PCOICOP')}

=== PSA OCCUPATIONAL CLASSIFICATION (PSOC) ===
{_fmt_psa('psoc', 'PSOC')}

=== PSA TOURISM CLASSIFICATION (PTSC) ===
{_fmt_psa('ptsc', 'PTSC')}

ANALYSIS INSTRUCTIONS
- Match zoning to relevant PSIC sections and recommend specific business types
- Quote PSIC section codes (e.g., [G] Wholesale and Retail Trade) in your recommendations
- Assess hazard risk impact on operations, insurance costs, and viability
- Identify supply gaps from the establishment mix (nearby categories already served vs. absent)
- Reference PCOICOP to describe consumer demand patterns that could be captured
- Flag any combinations (hazard + zone type) that make certain businesses unviable
- Format: 4–6 concise paragraphs; no bullet-point walls
- Never fabricate data not present in the context above
"""

        user_question = payload.question or (
            "What types of businesses are most suitable for this location? "
            "What are the key opportunities and risks?"
        )

        client = groq_lib.Groq(api_key=_GROQ_API_KEY)
        completion = client.chat.completions.create(
            model=_GROQ_MODEL,
            max_tokens=1024,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_question},
            ],
        )

        answer = completion.choices[0].message.content or "No response generated."
        return LocationAnalyzeResponse(answer=answer, city_name=city.name, context=ctx)