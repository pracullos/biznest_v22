"""
Seed Project NOAH hazard maps directly from HuggingFace.

Downloads ZIP files, converts shapefiles to GeoJSON in a temp directory,
generates PMTiles, and stores geometry to the database — no permanent
local files required for NOAH data.

Dataset : bettergovph/project-noah-hazard-maps (private — needs HUGGING_FACE_TOKEN in .env)

Requires:
  pip install fiona geopandas httpx

Usage:
  python scripts/seed_noah_hazards.py                                   # all hazards
  python scripts/seed_noah_hazards.py --hazards flood                   # flood only
  python scripts/seed_noah_hazards.py --hazards flood --scenarios 100yr # one scenario
  python scripts/seed_noah_hazards.py --skip-pmtiles                    # geometry only
  python scripts/seed_noah_hazards.py --province Bukidnon               # filter by province file stem
  python scripts/seed_noah_hazards.py --workers 4                       # default: cpu_count
  python scripts/seed_noah_hazards.py --list-files                      # inspect HF repo
  python scripts/seed_noah_hazards.py --force                           # re-download existing
"""

from __future__ import annotations

import argparse
import asyncio
import os
import subprocess
import sys
import tempfile
import zipfile
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from urllib.parse import quote

os.environ["OGR_GEOJSON_MAX_OBJ_SIZE"] = "0"

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv()

import httpx
import sqlalchemy as sa
from geoalchemy2.shape import from_shape
from sqlalchemy.orm import Session

from core.db import SessionLocal
from core.minio_client import minio_client, BUCKET_NAME
import models  # noqa: F401
from models.city import City
from models.hazard_area import HazardArea

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BACKEND_DIR    = Path(__file__).resolve().parent.parent
GEO_HAZARD_DIR = BACKEND_DIR / "geo_hazard"
HF_BASE        = "https://huggingface.co"
HF_REPO_ID     = "bettergovph/project-noah-hazard-maps"

_DOWNLOAD_MAX_ATTEMPTS = 5
_DOWNLOAD_CHUNK_SIZE   = 1 << 20  # 1 MiB
_DL_CONCURRENCY        = 4        # concurrent ZIP downloads

# HF directory prefix → (hazard_type, scenario, is_national_file, local_subdir)
HF_SOURCE_MAP: dict[str, tuple[str, Optional[str], bool, str]] = {
    "Flood/5yr":                       ("flood",       "5yr",  False, "flood/5yr"),
    "Flood/25yr":                      ("flood",       "25yr", False, "flood/25yr"),
    "Flood/100yr":                     ("flood",       "100yr",False, "flood/100yr"),
    "Landslide/LandslideHazards":      ("landslide",   None,   False, "landslide/landslide"),
    "Landslide/DebrisFlowAlluvialFan": ("debris_flow", None,   True,  "landslide/DebrisFlow"),
    "Storm Surge/StormSurgeAdvisory1": ("storm_surge", "ssa1", False, "storm_surge/storm_surge_advisory_1"),
    "Storm Surge/StormSurgeAdvisory2": ("storm_surge", "ssa2", False, "storm_surge/storm_surge_advisory_2"),
    "Storm Surge/StormSurgeAdvisory3": ("storm_surge", "ssa3", False, "storm_surge/storm_surge_advisory_3"),
    "Storm Surge/StormSurgeAdvisory4": ("storm_surge", "ssa4", False, "storm_surge/storm_surge_advisory_4"),
}

HAZARD_FILTER_MAP: dict[str, list[str]] = {
    "flood":        ["Flood/5yr", "Flood/25yr", "Flood/100yr"],
    "landslide":    ["Landslide/LandslideHazards"],
    "debris_flow":  ["Landslide/DebrisFlowAlluvialFan"],
    "storm_surge":  [
        "Storm Surge/StormSurgeAdvisory1",
        "Storm Surge/StormSurgeAdvisory2",
        "Storm Surge/StormSurgeAdvisory3",
        "Storm Surge/StormSurgeAdvisory4",
    ],
}

SCENARIO_FILTER_MAP: dict[str, list[str]] = {
    "5yr":  ["Flood/5yr"],
    "25yr": ["Flood/25yr"],
    "100yr":["Flood/100yr"],
    "ssa1": ["Storm Surge/StormSurgeAdvisory1"],
    "ssa2": ["Storm Surge/StormSurgeAdvisory2"],
    "ssa3": ["Storm Surge/StormSurgeAdvisory3"],
    "ssa4": ["Storm Surge/StormSurgeAdvisory4"],
}


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

def get_hf_token() -> str:
    token = os.environ.get("HUGGING_FACE_TOKEN", "").strip()
    if not token:
        print("ERROR: HUGGING_FACE_TOKEN not set in .env")
        sys.exit(1)
    return token


# ---------------------------------------------------------------------------
# HuggingFace API (async)
# ---------------------------------------------------------------------------

def _parse_next_url(link_header: str) -> Optional[str]:
    for part in link_header.split(","):
        url_part, *rels = part.strip().split(";")
        if any('rel="next"' in r for r in rels):
            return url_part.strip().strip("<>")
    return None


async def _list_zips_for_prefix(client: httpx.AsyncClient, hf_prefix: str) -> list[str]:
    """List all .zip paths under hf_prefix via the HF datasets tree API."""
    encoded = quote(hf_prefix, safe="/")
    url: Optional[str] = f"{HF_BASE}/api/datasets/{HF_REPO_ID}/tree/main/{encoded}"
    result: list[str] = []
    while url:
        resp = await client.get(url, timeout=30)
        if resp.status_code == 404:
            break
        resp.raise_for_status()
        for item in resp.json():
            if item.get("type") == "file" and item["path"].endswith(".zip"):
                result.append(item["path"])
        url = _parse_next_url(resp.headers.get("link", ""))
    return result


# ---------------------------------------------------------------------------
# Download + convert (async)
# ---------------------------------------------------------------------------

async def _download_file_async(client: httpx.AsyncClient, hf_path: str, dest: Path) -> None:
    """Stream-download with retry; writes to .part then renames on success."""
    url = f"{HF_BASE}/datasets/{HF_REPO_ID}/resolve/main/{quote(hf_path, safe='/')}"
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(".part")

    for attempt in range(1, _DOWNLOAD_MAX_ATTEMPTS + 1):
        try:
            async with client.stream("GET", url, timeout=300) as resp:
                resp.raise_for_status()
                total = int(resp.headers.get("content-length", 0))
                downloaded = 0
                with open(tmp, "wb") as fh:
                    async for chunk in resp.aiter_bytes(_DOWNLOAD_CHUNK_SIZE):
                        fh.write(chunk)
                        downloaded += len(chunk)
            if total and downloaded < total:
                raise IOError(f"incomplete: got {downloaded}/{total} bytes")
            tmp.rename(dest)
            return
        except Exception as exc:
            tmp.unlink(missing_ok=True)
            if attempt == _DOWNLOAD_MAX_ATTEMPTS:
                raise RuntimeError(
                    f"download failed after {_DOWNLOAD_MAX_ATTEMPTS} attempts: {exc}"
                ) from exc
            wait = 2 ** attempt
            print(f"    attempt {attempt} failed ({exc}), retrying in {wait}s…", flush=True)
            await asyncio.sleep(wait)


def _zip_to_geojson(zip_path: Path, out_path: Path) -> bool:
    """Extract shapefile from ZIP and write as GeoJSON (EPSG:4326)."""
    import geopandas as gpd

    with tempfile.TemporaryDirectory() as tmp:
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(tmp)

        shp_files = list(Path(tmp).rglob("*.shp"))
        if not shp_files:
            print(f"    no .shp in {zip_path.name}", flush=True)
            return False

        try:
            gdf = gpd.read_file(str(shp_files[0]))
        except Exception as exc:
            print(f"    read failed: {exc}", flush=True)
            return False

        if gdf.empty:
            return False

        if gdf.crs is None:
            gdf = gdf.set_crs("EPSG:4326")
        elif gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs("EPSG:4326")

        out_path.parent.mkdir(parents=True, exist_ok=True)
        gdf.to_file(str(out_path), driver="GeoJSON")
        return True


async def _download_and_convert_async(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    hf_path: str,
    out_path: Path,
    force: bool = False,
) -> Optional[Path]:
    """Download HF ZIP and convert to GeoJSON. Skips if already exists unless force=True."""
    if out_path.exists() and not force:
        return out_path
    async with sem:
        with tempfile.TemporaryDirectory() as tmp:
            zip_dest = Path(tmp) / Path(hf_path).name
            try:
                await _download_file_async(client, hf_path, zip_dest)
            except Exception as exc:
                print(f"    download failed: {exc}", flush=True)
                return None
            success = await asyncio.to_thread(_zip_to_geojson, zip_dest, out_path)
            return out_path if success else None


# ---------------------------------------------------------------------------
# City index
# ---------------------------------------------------------------------------

@dataclass
class CityInfo:
    id:   str
    name: str
    code: Optional[str]


def build_cities_gdf(db: Session) -> tuple:
    import geopandas as gpd
    from geoalchemy2.shape import to_shape

    ids, geoms, infos = [], [], {}
    for c in db.query(City).filter(City.boundary.isnot(None)).all():
        try:
            info = CityInfo(id=str(c.id), name=str(c.name), code=str(c.code) if c.code else None)
            ids.append(str(c.id))
            geoms.append(to_shape(c.boundary))
            infos[str(c.id)] = info
        except Exception:
            pass

    gdf = gpd.GeoDataFrame({"city_id_ref": ids}, geometry=geoms, crs="EPSG:4326")
    return gdf.reset_index(drop=True), infos


# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------

def _geom_to_wkb(geom):
    """Strip Z coordinates and return a geoalchemy2 WKBElement."""
    if geom is None or geom.is_empty:
        return None
    try:
        import shapely
        return from_shape(shapely.force_2d(geom), srid=4326)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# PMTile generation
# ---------------------------------------------------------------------------

def check_tippecanoe() -> bool:
    try:
        return subprocess.run(["tippecanoe", "--version"], capture_output=True).returncode == 0
    except FileNotFoundError:
        return False


def generate_pmtiles(geojson_path: Path, minio_key: str) -> Optional[str]:
    with tempfile.NamedTemporaryFile(suffix=".pmtiles", delete=False) as f:
        pm_path = f.name
    try:
        result = subprocess.run(
            [
                "tippecanoe",
                "-o", pm_path,
                "-Z10", "-z14",
                "--drop-densest-as-needed",
                "--extend-zooms-if-still-dropping",
                "--force",
                str(geojson_path),
            ],
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            print(f"      tippecanoe error: {result.stderr[:300]}", flush=True)
            return None
        minio_client.fput_object(
            BUCKET_NAME, minio_key, pm_path,
            content_type="application/vnd.pmtiles",
        )
        return minio_key
    finally:
        if os.path.exists(pm_path):
            os.unlink(pm_path)


# ---------------------------------------------------------------------------
# DB write
# ---------------------------------------------------------------------------

def _replace_features(
    city_id:     str,
    hazard_type: str,
    scenario:    Optional[str],
    pmtile_url:  Optional[str],
    wkbs:        list,
) -> int:
    """Delete existing rows for (city, hazard_type, scenario) then bulk insert."""
    if not wkbs:
        return 0
    from uuid import uuid4
    scenario_clause = (
        HazardArea.scenario.is_(None) if scenario is None else HazardArea.scenario == scenario
    )
    with SessionLocal() as db:
        db.execute(
            sa.delete(HazardArea).where(
                sa.and_(
                    HazardArea.city_id == city_id,
                    HazardArea.hazard_type == hazard_type,
                    scenario_clause,
                )
            )
        )
        db.execute(
            sa.insert(HazardArea),
            [
                {
                    "id":          str(uuid4()),
                    "city_id":     city_id,
                    "hazard_type": hazard_type,
                    "scenario":    scenario,
                    "pmtile_url":  pmtile_url,
                    "geometry":    wkb,
                }
                for wkb in wkbs
            ],
        )
        db.commit()
    return len(wkbs)


# ---------------------------------------------------------------------------
# Per-file worker — top-level for ProcessPoolExecutor pickling
# ---------------------------------------------------------------------------

def _serialize_city_rows(cities_gdf, city_infos: dict[str, "CityInfo"]) -> list[dict]:
    """
    Convert city GDF + infos into a picklable list of plain-Python dicts.
    City boundaries are serialized as WKB bytes so workers never hit the DB.
    """
    import shapely.wkb
    geom_map: dict[str, object] = dict(zip(cities_gdf["city_id_ref"], cities_gdf.geometry))
    rows: list[dict] = []
    for city_id, info in city_infos.items():
        geom = geom_map.get(city_id)
        if geom is None:
            continue
        try:
            rows.append({
                "id":   info.id,
                "name": info.name,
                "code": info.code,
                "wkb":  shapely.wkb.dumps(geom),
            })
        except Exception:
            pass
    return rows


def _clean_geodataframe(gdf):
    """Strip M/Z coords and fix invalid geometries to avoid GEOS errors."""
    import shapely
    gdf = gdf.copy()
    gdf["geometry"] = gdf["geometry"].apply(
        lambda g: shapely.make_valid(shapely.force_2d(g))
        if g is not None and not g.is_empty else g
    )
    return gdf[gdf["geometry"].notna() & ~gdf.geometry.is_empty].reset_index(drop=True)


def _worker(task: dict) -> tuple[str, int]:
    """
    Read one provincial hazard GeoJSON, spatial-join with city boundaries,
    generate per-city PMTiles, and insert HazardArea rows.

    City data is passed pre-serialized as WKB bytes — no DB calls in workers
    (forked processes must not reuse the parent's SQLAlchemy connection pool).
    """
    import geopandas as gpd
    import shapely.wkb as _wkb

    os.environ["OGR_GEOJSON_MAX_OBJ_SIZE"] = "0"

    geojson_path: Path          = task["path"]
    hazard_type:  str           = task["hazard_type"]
    scenario:     Optional[str] = task["scenario"]
    skip_pmtiles: bool          = task["skip_pmtiles"]
    city_rows:    list[dict]    = task["city_rows"]

    stem = geojson_path.stem

    if not city_rows:
        return stem, 0

    # Reconstruct city data from pre-serialized WKB — no DB needed
    city_infos:   dict[str, CityInfo] = {}
    city_id_refs: list[str]           = []
    geoms:        list                = []

    for row in city_rows:
        try:
            geom = _wkb.loads(row["wkb"])
            city_infos[row["id"]] = CityInfo(id=row["id"], name=row["name"], code=row["code"])
            city_id_refs.append(row["id"])
            geoms.append(geom)
        except Exception:
            pass

    if not city_id_refs:
        return stem, 0

    cities_gdf = gpd.GeoDataFrame(
        {"city_id_ref": city_id_refs}, geometry=geoms, crs="EPSG:4326"
    )

    try:
        gdf = gpd.read_file(str(geojson_path))
    except Exception as exc:
        print(f"    [{stem}] read failed: {exc}", flush=True)
        return stem, 0

    if gdf.empty:
        return stem, 0

    if gdf.crs is None:
        gdf = gdf.set_crs("EPSG:4326")
    elif gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs("EPSG:4326")

    gdf = _clean_geodataframe(gdf)
    if gdf.empty:
        return stem, 0

    try:
        joined = gpd.sjoin(
            gdf[["geometry"]], cities_gdf[["city_id_ref", "geometry"]],
            how="inner", predicate="intersects",
        )
    except Exception as exc:
        print(f"    [{stem}] sjoin failed: {exc}", flush=True)
        return stem, 0

    joined = joined[joined["city_id_ref"].notna()]

    if joined.empty:
        return stem, 0

    scenario_slug = scenario or "all"
    total = 0

    for city_id_str, group in joined.groupby("city_id_ref"):
        city = city_infos.get(str(city_id_str))
        if not city or not city.code:
            continue

        boundary_series = cities_gdf.loc[cities_gdf["city_id_ref"] == city_id_str, "geometry"]
        if boundary_series.empty:
            continue
        city_boundary = boundary_series.iloc[0]

        clipped_geoms = []
        for geom in group["geometry"]:
            try:
                clipped = geom.intersection(city_boundary)
                if clipped is not None and not clipped.is_empty:
                    clipped_geoms.append(clipped)
            except Exception:
                pass

        if not clipped_geoms:
            continue

        features = gpd.GeoDataFrame(geometry=clipped_geoms, crs="EPSG:4326")
        if features.empty:
            continue

        pmtile_url = None
        if not skip_pmtiles:
            minio_key = f"pmtiles/hazards/{hazard_type}/{scenario_slug}/city-{city.code}.pmtiles"
            with tempfile.TemporaryDirectory() as tmp:
                slice_path = Path(tmp) / "slice.geojson"
                features[["geometry"]].to_file(str(slice_path), driver="GeoJSON")
                pmtile_url = generate_pmtiles(slice_path, minio_key)

        wkbs = [w for g in features.geometry if (w := _geom_to_wkb(g)) is not None]
        count = _replace_features(city.id, hazard_type, scenario, pmtile_url, wkbs)
        total += count

    n_cities = joined["city_id_ref"].nunique()
    print(f"    [{stem}] {total} rows across {n_cities} cities", flush=True)
    return stem, total


# ---------------------------------------------------------------------------
# National file handler (spatial-join → per-city bulk insert)
# ---------------------------------------------------------------------------

def _process_national(
    geojson_path:  Path,
    hazard_type:   str,
    scenario:      Optional[str],
    cities_gdf,
    city_infos:    dict[str, CityInfo],
    skip_pmtiles:  bool,
) -> None:
    import geopandas as gpd

    print(f"  National: {geojson_path.stem} — spatial-joining to cities…", flush=True)
    os.environ["OGR_GEOJSON_MAX_OBJ_SIZE"] = "0"

    try:
        gdf = gpd.read_file(str(geojson_path))
    except Exception as exc:
        print(f"    error: {exc}", flush=True)
        return

    if gdf.empty:
        return
    if gdf.crs is None:
        gdf = gdf.set_crs("EPSG:4326")
    elif gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs("EPSG:4326")

    # Strip M/Z coords and fix invalid geometries before any GEOS operation
    gdf = _clean_geodataframe(gdf)
    if gdf.empty:
        return

    try:
        joined = gpd.sjoin(
            gdf, cities_gdf[["city_id_ref", "geometry"]],
            how="left", predicate="intersects",
        )
    except Exception as exc:
        print(f"    sjoin failed: {exc}", flush=True)
        return
    joined = joined[joined["city_id_ref"].notna()]
    if joined.empty:
        print("    no features intersect any city", flush=True)
        return

    stem = geojson_path.stem
    scenario_slug = scenario or "all"

    for city_id_str, group in joined.groupby("city_id_ref"):
        city = city_infos.get(str(city_id_str))
        if not city or not city.code:
            continue

        boundary_series = cities_gdf.loc[cities_gdf["city_id_ref"] == city_id_str, "geometry"]
        if boundary_series.empty:
            continue
        city_boundary = boundary_series.iloc[0]

        clipped_geoms = []
        for geom in group["geometry"]:
            try:
                clipped = geom.intersection(city_boundary)
                if clipped is not None and not clipped.is_empty:
                    clipped_geoms.append(clipped)
            except Exception:
                pass

        if not clipped_geoms:
            continue

        features = gpd.GeoDataFrame(geometry=clipped_geoms, crs="EPSG:4326")
        if features.empty:
            continue

        pmtile_url = None
        if not skip_pmtiles:
            minio_key = f"pmtiles/hazards/{hazard_type}/{scenario_slug}/city-{city.code}.pmtiles"
            with tempfile.TemporaryDirectory() as tmp:
                slice_path = Path(tmp) / "slice.geojson"
                features[["geometry"]].to_file(str(slice_path), driver="GeoJSON")
                pmtile_url = generate_pmtiles(slice_path, minio_key)

        wkbs = [w for g in features.geometry if (w := _geom_to_wkb(g)) is not None]
        count = _replace_features(city.id, hazard_type, scenario, pmtile_url, wkbs)
        print(f"    [{city.name}] {count} rows", flush=True)


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def _build_allowed_prefixes(
    hazard_filter:   Optional[list[str]],
    scenario_filter: Optional[list[str]],
) -> set[str]:
    if not hazard_filter and not scenario_filter:
        return set(HF_SOURCE_MAP.keys())

    if hazard_filter and scenario_filter:
        hazard_set:   set[str] = set()
        scenario_set: set[str] = set()
        for h in hazard_filter:
            hazard_set.update(HAZARD_FILTER_MAP.get(h, []))
        for s in scenario_filter:
            scenario_set.update(SCENARIO_FILTER_MAP.get(s, []))
        return hazard_set & scenario_set

    result: set[str] = set()
    for h in (hazard_filter or []):
        result.update(HAZARD_FILTER_MAP.get(h, []))
    for s in (scenario_filter or []):
        result.update(SCENARIO_FILTER_MAP.get(s, []))
    return result


def seed_hazard_source(
    hazard_type:     str,
    scenario:        Optional[str],
    geojsons:        list[Path],
    is_national:     bool,
    cities_gdf,
    city_infos:      dict[str, CityInfo],
    skip_pmtiles:    bool,
    workers:         int,
    province_filter: Optional[str] = None,
) -> None:
    if province_filter:
        geojsons = [g for g in geojsons if province_filter.lower() in g.stem.lower()]
        print(f"  filtered to {len(geojsons)} file(s) matching '{province_filter}'", flush=True)

    if not geojsons:
        print("  no files to process", flush=True)
        return

    print(f"  {len(geojsons)} file(s) to seed", flush=True)

    if is_national:
        for gj in geojsons:
            _process_national(gj, hazard_type, scenario, cities_gdf, city_infos, skip_pmtiles)
        return

    # Serialize city data once — passed to every worker to avoid DB calls in
    # forked processes (SQLAlchemy connection pool is not fork-safe)
    city_rows = _serialize_city_rows(cities_gdf, city_infos)
    if not city_rows:
        print("  no cities with serializable geometry — skipping", flush=True)
        return

    tasks = [
        {
            "path":         gj,
            "hazard_type":  hazard_type,
            "scenario":     scenario,
            "skip_pmtiles": skip_pmtiles,
            "city_rows":    city_rows,
        }
        for gj in geojsons
    ]

    total = len(tasks)
    done  = 0
    with ProcessPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(_worker, t): t for t in tasks}
        for fut in as_completed(futures):
            done += 1
            try:
                stem, count = fut.result()
                print(f"  [{done}/{total}] {stem}  ({count} rows)", flush=True)
            except Exception as exc:
                t = futures[fut]
                print(f"  [{done}/{total}] {t['path'].stem}  error: {exc}", flush=True)


# ---------------------------------------------------------------------------
# Async entry point
# ---------------------------------------------------------------------------

async def _async_run(
    hazard_filter:   Optional[list[str]],
    scenario_filter: Optional[list[str]],
    skip_pmtiles:    bool,
    workers:         int,
    list_files_only: bool,
    force:           bool,
    province_filter: Optional[str] = None,
) -> None:
    token = get_hf_token()
    limits = httpx.Limits(
        max_connections=_DL_CONCURRENCY + 4,
        max_keepalive_connections=_DL_CONCURRENCY,
    )
    transport = httpx.AsyncHTTPTransport(retries=3)
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(
        limits=limits,
        transport=transport,
        headers=headers,
        follow_redirects=True,
    ) as client:
        if list_files_only:
            print(f"Listing files in {HF_REPO_ID}…", flush=True)
            prefixes = list(HF_SOURCE_MAP.keys())
            all_zips = await asyncio.gather(*[_list_zips_for_prefix(client, p) for p in prefixes])
            for prefix, zips in zip(prefixes, all_zips):
                print(f"\n[{prefix}] {len(zips)} ZIP(s)")
                for z in sorted(zips):
                    print(f"  {z}")
            return

        allowed = _build_allowed_prefixes(hazard_filter, scenario_filter)
        if not allowed:
            print("No matching sources for the given filters.")
            return

        print("\n" + "=" * 55)
        print("  Building city boundary index from DB…")
        print("=" * 55)
        with SessionLocal() as db:
            cities_gdf, city_infos = build_cities_gdf(db)
        print(f"  {len(cities_gdf)} cities with boundary geometry")

        allowed_prefixes = [p for p in HF_SOURCE_MAP if p in allowed]

        # List all allowed prefixes concurrently (fast metadata calls)
        print(f"\n  Listing {len(allowed_prefixes)} source(s) concurrently…", flush=True)
        all_zips_lists = await asyncio.gather(*[
            _list_zips_for_prefix(client, p) for p in allowed_prefixes
        ])

        sem = asyncio.Semaphore(_DL_CONCURRENCY)

        for hf_prefix, zips in zip(allowed_prefixes, all_zips_lists):
            hazard_type, scenario, is_national, local_subdir = HF_SOURCE_MAP[hf_prefix]

            print(f"\n{'=' * 55}")
            print(f"  {hazard_type.upper()} / {scenario or 'all'}")
            print(f"{'=' * 55}")

            if not zips:
                print("  no ZIPs found (run --list-files to inspect repo structure)", flush=True)
                continue
            print(f"  {len(zips)} ZIP(s) found", flush=True)

            prefix_dir = GEO_HAZARD_DIR / local_subdir
            prefix_dir.mkdir(parents=True, exist_ok=True)

            sorted_zips = sorted(zips)
            if province_filter:
                sorted_zips = [z for z in sorted_zips if province_filter.lower() in Path(z).stem.lower()]
                print(f"  filtered to {len(sorted_zips)} ZIP(s) matching '{province_filter}'", flush=True)
            total = len(sorted_zips)

            async def _dl(hf_path: str) -> tuple[str, Optional[Path]]:
                stem = Path(hf_path).stem
                out = prefix_dir / f"{stem}.geojson"
                result = await _download_and_convert_async(client, sem, hf_path, out, force)
                return stem, result

            geojsons: list[Path] = []
            done = 0
            for coro in asyncio.as_completed([_dl(z) for z in sorted_zips]):
                stem, result = await coro
                done += 1
                print(f"  [{done}/{total}] {stem}  {'✓' if result else '✗'}", flush=True)
                if result:
                    geojsons.append(result)

            # seed_hazard_source is blocking (ProcessPoolExecutor) — run in thread
            await asyncio.to_thread(
                seed_hazard_source,
                hazard_type, scenario, geojsons, is_national,
                cities_gdf, city_infos,
                skip_pmtiles, workers, province_filter,
            )

    print("\nAll done.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def run(
    hazard_filter:   Optional[list[str]],
    scenario_filter: Optional[list[str]],
    skip_pmtiles:    bool,
    workers:         int,
    list_files_only: bool,
    force:           bool,
    province_filter: Optional[str] = None,
) -> None:
    if not skip_pmtiles and not list_files_only and not check_tippecanoe():
        print(
            "ERROR: tippecanoe not found.\n"
            "  Use --skip-pmtiles to seed geometry without generating tiles.\n"
            "  Install tippecanoe on Linux/Mac/WSL: https://github.com/felt/tippecanoe"
        )
        sys.exit(1)

    asyncio.run(_async_run(
        hazard_filter, scenario_filter, skip_pmtiles,
        workers, list_files_only, force, province_filter,
    ))


if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()  # Windows spawn safety

    ALL_HAZARDS = ["flood", "landslide", "debris_flow", "storm_surge"]

    parser = argparse.ArgumentParser(
        description="Seed NOAH hazard maps — downloads from HuggingFace, no local cache"
    )
    parser.add_argument("--hazards",      nargs="+", choices=ALL_HAZARDS, default=ALL_HAZARDS)
    parser.add_argument("--scenarios",    nargs="+", default=None, metavar="SCENARIO",
                        help="5yr 25yr 100yr ssa1 ssa2 ssa3 ssa4")
    parser.add_argument("--skip-pmtiles", action="store_true")
    parser.add_argument("--province",     default=None, metavar="NAME",
                        help="Filter by file stem (NOAH files are named after provinces)")
    parser.add_argument("--list-files",   action="store_true",
                        help="Print all ZIP paths in the HF repo and exit")
    parser.add_argument("--force",        action="store_true",
                        help="Re-download and re-convert already cached GeoJSON files")
    parser.add_argument(
        "--workers", type=int,
        default=os.cpu_count() or 4, metavar="N",
        help=f"Parallel workers for DB insert (default: cpu_count = {os.cpu_count()})",
    )
    args = parser.parse_args()

    run(
        hazard_filter   = args.hazards,
        scenario_filter = args.scenarios,
        skip_pmtiles    = args.skip_pmtiles,
        workers         = args.workers,
        list_files_only = args.list_files,
        force           = args.force,
        province_filter = args.province,
    )