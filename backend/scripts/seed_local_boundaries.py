"""
Seed Philippine city/municipality boundaries from ArcGIS FeatureServer.

Creates Region + Province stubs (no boundary, no pmtile_url).
Seeds City records with boundary geometry + per-city PMTiles.
Barangay table is not touched.

Usage:
  python scripts/seed_local_boundaries.py
  python scripts/seed_local_boundaries.py --skip-pmtiles
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv()

from geoalchemy2.shape import from_shape
from shapely.geometry import shape, MultiPolygon
from sqlalchemy.orm import Session

from core.db import SessionLocal
from core.minio_client import minio_client, BUCKET_NAME
import models  # noqa: F401
from models.region import Region
from models.province import Province
from models.city import City

ARCGIS_CITY_URL = (
    "https://services.arcgis.com/yP8JAHhUybB6y4EL/arcgis/rest/services"
    "/Philippines_City_Municipality_Administrative_Boundary/FeatureServer/0/query"
)

# PSGC adm1 code → display name
REGION_NAMES: dict[str, str] = {
    "100000000":  "Region I – Ilocos Region",
    "200000000":  "Region II – Cagayan Valley",
    "300000000":  "Region III – Central Luzon",
    "400000000":  "Region IV-A – CALABARZON",
    "500000000":  "Region V – Bicol Region",
    "600000000":  "Region VI – Western Visayas",
    "700000000":  "Region VII – Central Visayas",
    "800000000":  "Region VIII – Eastern Visayas",
    "900000000":  "Region IX – Zamboanga Peninsula",
    "1000000000": "Region X – Northern Mindanao",
    "1100000000": "Region XI – Davao Region",
    "1200000000": "Region XII – SOCCSKSARGEN",
    "1300000000": "NCR – National Capital Region",
    "1400000000": "CAR – Cordillera Administrative Region",
    "1600000000": "Region XIII – Caraga",
    "1700000000": "MIMAROPA Region",
    "1900000000": "BARMM – Bangsamoro Autonomous Region",
}

_REGION_NORM: dict[str, str] = {}  # populated lazily


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalize_name(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return " ".join(s.lower().split())


def _region_code_from_arcgis_name(arcgis_region: str) -> str | None:
    global _REGION_NORM
    if not _REGION_NORM:
        _REGION_NORM = {_normalize_name(v): k for k, v in REGION_NAMES.items()}
    norm = _normalize_name(arcgis_region)
    if norm in _REGION_NORM:
        return _REGION_NORM[norm]
    for known, code in _REGION_NORM.items():
        if norm in known or known in norm:
            return code
    return None


def force_multipolygon(geom):
    if geom is None:
        return None
    if geom.geom_type == "Polygon":
        return MultiPolygon([geom])
    return geom


def to_wkb(geom):
    if geom is None:
        return None
    try:
        return from_shape(force_multipolygon(geom), srid=4326)
    except Exception as exc:
        print(f"    geometry error: {exc}")
        return None


# ---------------------------------------------------------------------------
# tippecanoe
# ---------------------------------------------------------------------------

def check_tippecanoe() -> bool:
    try:
        return subprocess.run(["tippecanoe", "--version"], capture_output=True).returncode == 0
    except FileNotFoundError:
        return False


def _run_tippecanoe(geojson_path: str, out_path: str, min_zoom: int, max_zoom: int) -> bool:
    cmd = [
        "tippecanoe",
        "-o", out_path,
        f"-z{max_zoom}",
        f"-Z{min_zoom}",
        "--drop-densest-as-needed",
        "--extend-zooms-if-still-dropping",
        "--force",
        geojson_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"    tippecanoe error:\n{result.stderr}")
        return False
    return True


# ---------------------------------------------------------------------------
# MinIO
# ---------------------------------------------------------------------------

def upload_pmtiles(local_path: str, minio_key: str) -> str:
    minio_client.fput_object(
        BUCKET_NAME,
        minio_key,
        local_path,
        content_type="application/vnd.pmtiles",
    )
    return minio_key


def make_pmtile(
    feature: dict,
    minio_key: str,
    min_zoom: int,
    max_zoom: int,
    skip_pmtiles: bool,
) -> str | None:
    if skip_pmtiles:
        return None
    geojson = {"type": "FeatureCollection", "features": [feature]}
    with tempfile.TemporaryDirectory() as tmp:
        gj_path = os.path.join(tmp, "unit.geojson")
        pm_path = os.path.join(tmp, "unit.pmtiles")
        with open(gj_path, "w", encoding="utf-8") as fh:
            json.dump(geojson, fh)
        if not _run_tippecanoe(gj_path, pm_path, min_zoom, max_zoom):
            return None
        return upload_pmtiles(pm_path, minio_key)


# ---------------------------------------------------------------------------
# ArcGIS fetch  (two-step: fast metadata first, then concurrent geometry)
# ---------------------------------------------------------------------------

_CONCURRENCY = 20
_OUTFIELDS = "GEOCODE,GEOCODE10,GEOCODE_PROV,CITYMUN,PROVINCE,REGION"


def _sql_escape(s: str) -> str:
    return s.replace("'", "''")


async def _fetch_city_list(client: httpx.AsyncClient) -> list[dict]:
    """One request — all cities, no geometry. ArcGIS f=json returns attributes dicts."""
    params = {
        "where": "1=1",
        "outFields": _OUTFIELDS,
        "returnGeometry": "false",
        "f": "json",
        "resultRecordCount": "10000",
    }
    resp = await client.get(ARCGIS_CITY_URL, params=params, timeout=120)
    resp.raise_for_status()
    return [f["attributes"] for f in resp.json().get("features", []) if f.get("attributes")]


async def _fetch_city_geometry(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    city_name: str,
    province: str,
) -> dict | None:
    """Fetch GeoJSON feature for one city via CITYMUN+PROVINCE WHERE clause."""
    where = f"CITYMUN='{_sql_escape(city_name)}' AND PROVINCE='{_sql_escape(province)}'"
    params = {
        "where": where,
        "outFields": _OUTFIELDS,
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "geojson",
    }
    async with sem:
        for attempt in range(3):
            try:
                resp = await client.get(ARCGIS_CITY_URL, params=params, timeout=60)
                resp.raise_for_status()
                features = resp.json().get("features", [])
                return features[0] if features else None
            except Exception as exc:
                if attempt == 2:
                    print(f"\n    [{city_name}] fetch failed: {exc}", flush=True)
                    return None
                await asyncio.sleep(2 ** attempt)
    return None


async def _fetch_all_async() -> list[dict]:
    limits = httpx.Limits(
        max_connections=_CONCURRENCY + 5,
        max_keepalive_connections=_CONCURRENCY,
    )
    transport = httpx.AsyncHTTPTransport(retries=3)

    async with httpx.AsyncClient(limits=limits, transport=transport) as client:
        print("  Step 1: fetching city list (no geometry)...")
        city_attrs = await _fetch_city_list(client)
        print(f"  {len(city_attrs)} cities found")

        sem = asyncio.Semaphore(_CONCURRENCY)
        pairs: list[dict] = []
        tasks = []
        for attrs in city_attrs:
            name = (attrs.get("CITYMUN") or "").strip()
            prov = (attrs.get("PROVINCE") or "").strip()
            if name and prov:
                pairs.append(attrs)
                tasks.append(_fetch_city_geometry(client, sem, name, prov))

        total = len(tasks)
        completed = 0
        print(f"  Step 2: fetching {total} geometries (concurrency={_CONCURRENCY})...", flush=True)

        async def _tracked(coro):
            nonlocal completed
            result = await coro
            completed += 1
            if completed % 50 == 0 or completed == total:
                print(f"    [{completed}/{total}] done", end="\r", flush=True)
            return result

        geo_features = await asyncio.gather(*[_tracked(t) for t in tasks])

    print()
    result = []
    for attrs, geo_feat in zip(pairs, geo_features):
        if geo_feat:
            result.append(geo_feat)
        else:
            result.append({
                "type": "Feature",
                "geometry": None,
                "properties": {k: attrs.get(k) for k in _OUTFIELDS.split(",")},
            })
    return result


def fetch_arcgis_city_features() -> list[dict]:
    return asyncio.run(_fetch_all_async())


# ---------------------------------------------------------------------------
# Seeder
# ---------------------------------------------------------------------------

def seed_all(skip_pmtiles: bool, db: Session) -> None:
    """
    1. Fetch all city polygons from ArcGIS FeatureServer.
    2. Upsert Region + Province stubs (no boundary, no pmtile_url).
    3. Upsert City rows with boundary geometry + per-city PMTile.
    """
    print("Fetching city boundaries from ArcGIS FeatureServer...")
    features = fetch_arcgis_city_features()
    print(f"\n{len(features)} features fetched")

    # --- Region + Province stubs from ArcGIS feature fields ---
    print("\nSeeding region/province stubs...")
    region_cache: dict[str, Region] = {}    # keyed by code or fallback name
    province_cache: dict[str, Province] = {}  # keyed by GEOCODE_PROV

    for f in features:
        props = f.get("properties") or {}
        prov_code = (props.get("GEOCODE_PROV") or "").strip()
        prov_name = (props.get("PROVINCE") or "").strip()
        region_name = (props.get("REGION") or "").strip()

        if not prov_code or prov_code in province_cache:
            continue

        # Region stub
        region_key = _region_code_from_arcgis_name(region_name) or _normalize_name(region_name)
        if region_key not in region_cache:
            region_rec = db.query(Region).filter_by(code=region_key).first()
            if not region_rec:
                display = REGION_NAMES.get(region_key, region_name)
                region_rec = Region(name=display, code=region_key, boundary=None, pmtile_url=None)
                db.add(region_rec)
                db.flush()
            region_cache[region_key] = region_rec

        region_rec = region_cache[region_key]

        # Province stub
        prov_rec = db.query(Province).filter_by(code=prov_code).first()
        if not prov_rec:
            prov_rec = Province(
                name=prov_name,
                code=prov_code,
                region_id=region_rec.id,
                boundary=None,
                pmtile_url=None,
            )
            db.add(prov_rec)
            db.flush()
        province_cache[prov_code] = prov_rec

    db.commit()
    print(f"  {len(region_cache)} regions, {len(province_cache)} provinces upserted")

    # Rebuild province lookup by normalized name for fallback matching
    all_provinces = db.query(Province).all()
    prov_by_code: dict[str, Province] = {p.code: p for p in all_provinces}
    prov_by_name: dict[str, Province] = {_normalize_name(p.name): p for p in all_provinces}

    # --- Cities ---
    print("\nSeeding cities...")
    created = updated = skipped = 0

    for idx, f in enumerate(features, 1):
        props = f.get("properties") or {}

        city_name = (props.get("CITYMUN") or "").strip()
        if not city_name:
            skipped += 1
            continue

        code = (props.get("GEOCODE") or props.get("GEOCODE10") or "").strip()
        if not code:
            skipped += 1
            continue

        prov_code_raw = (props.get("GEOCODE_PROV") or "").strip()
        prov_name_raw = (props.get("PROVINCE") or "").strip()
        region_name   = (props.get("REGION") or "").strip()

        province_rec: Province | None = (
            prov_by_code.get(prov_code_raw)
            or prov_by_name.get(_normalize_name(prov_name_raw))
        )

        geom = None
        if f.get("geometry"):
            try:
                geom = to_wkb(shape(f["geometry"]))
            except Exception:
                pass

        pmtile_url = make_pmtile(
            f,
            f"pmtiles/cities/city-{code}.pmtiles",
            min_zoom=8, max_zoom=14,
            skip_pmtiles=skip_pmtiles,
        )

        existing = db.query(City).filter_by(code=code).first()
        if existing:
            existing.boundary = geom
            if pmtile_url:
                existing.pmtile_url = pmtile_url
            if province_rec and not existing.province_id:
                existing.province_id = province_rec.id
                existing.province    = province_rec.name
                existing.region      = (
                    province_rec.region.name if province_rec.region else region_name
                )
            updated += 1
        else:
            db.add(City(
                name=city_name,
                code=code,
                province=province_rec.name if province_rec else prov_name_raw,
                region=(
                    province_rec.region.name
                    if (province_rec and province_rec.region)
                    else region_name
                ),
                province_id=province_rec.id if province_rec else None,
                boundary=geom,
                pmtile_url=pmtile_url,
            ))
            created += 1

        if idx % 200 == 0:
            db.commit()
            print(
                f"  [{idx}/{len(features)}] created={created} updated={updated} skipped={skipped}",
                end="\r",
            )

    db.commit()
    print(
        f"\n  done: {len(features)} features → "
        f"{created} created, {updated} updated, {skipped} skipped"
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run(skip_pmtiles: bool = False) -> None:
    if not skip_pmtiles and not check_tippecanoe():
        print(
            "ERROR: tippecanoe not found.\n"
            "  tippecanoe runs on Linux/Mac only. Use --skip-pmtiles to seed DB without tiles.\n"
            "  In WSL: pip install tippecanoe OR https://github.com/felt/tippecanoe\n"
            "\n"
            "  To seed DB only:\n"
            "    python scripts/seed_local_boundaries.py --skip-pmtiles"
        )
        sys.exit(1)

    with SessionLocal() as db:
        seed_all(skip_pmtiles=skip_pmtiles, db=db)

    print("\nAll done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Seed PH city boundaries from ArcGIS FeatureServer"
    )
    parser.add_argument(
        "--skip-pmtiles",
        action="store_true",
        help="Skip tippecanoe + MinIO — seed geometry into DB only",
    )
    args = parser.parse_args()
    run(skip_pmtiles=args.skip_pmtiles)