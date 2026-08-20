"""
Inspect NOAH hazard source shapefile properties.

Downloads ONE sample ZIP from HuggingFace for the given hazard/scenario,
reads the embedded shapefile, and prints a compact summary:
  - CRS, geometry type, feature count, bounding box
  - Column names + dtypes
  - First N sample rows (cell values truncated to 100 chars)

Does NOT write to the database or generate PMTiles.

Optionally inspect a PMTile already stored in MinIO (size + header info only).

Requires:
  pip install fiona geopandas httpx

Usage:
  python scripts/inspect_noah.py --list
  python scripts/inspect_noah.py --hazard flood --scenario 5yr
  python scripts/inspect_noah.py --hazard landslide
  python scripts/inspect_noah.py --hazard flood --scenario 5yr --pick Cebu
  python scripts/inspect_noah.py --pmtile pmtiles/hazards/flood/5yr/city-063302000.pmtiles
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Optional
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv()

import httpx

# ---------------------------------------------------------------------------
# Source map (mirrors seed_noah_hazards.py)
# ---------------------------------------------------------------------------

HF_BASE    = "https://huggingface.co"
HF_REPO_ID = "bettergovph/project-noah-hazard-maps"

HF_SOURCE_MAP: dict[str, tuple[str, Optional[str]]] = {
    "Flood/5yr":                       ("flood",        "5yr"),
    "Flood/25yr":                      ("flood",        "25yr"),
    "Flood/100yr":                     ("flood",        "100yr"),
    "Landslide/LandslideHazards":      ("landslide",    None),
    "Landslide/DebrisFlowAlluvialFan": ("debris_flow",  None),
    "Storm Surge/StormSurgeAdvisory1": ("storm_surge",  "ssa1"),
    "Storm Surge/StormSurgeAdvisory2": ("storm_surge",  "ssa2"),
    "Storm Surge/StormSurgeAdvisory3": ("storm_surge",  "ssa3"),
    "Storm Surge/StormSurgeAdvisory4": ("storm_surge",  "ssa4"),
}

_TRUNC = 100   # max chars per cell value
_ROWS  = 8     # sample rows to show

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_hf_token() -> str:
    token = os.environ.get("HUGGING_FACE_TOKEN", "").strip()
    if not token:
        print("ERROR: HUGGING_FACE_TOKEN not set in .env")
        sys.exit(1)
    return token


def _parse_next_url(link_header: str) -> Optional[str]:
    for part in link_header.split(","):
        url_part, *rels = part.strip().split(";")
        if any('rel="next"' in r for r in rels):
            return url_part.strip().strip("<>")
    return None


async def _list_zips(client: httpx.AsyncClient, hf_prefix: str) -> list[str]:
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


async def _download(client: httpx.AsyncClient, hf_path: str, dest: Path) -> None:
    url = f"{HF_BASE}/datasets/{HF_REPO_ID}/resolve/main/{quote(hf_path, safe='/')}"
    dest.parent.mkdir(parents=True, exist_ok=True)
    async with client.stream("GET", url, timeout=300) as resp:
        resp.raise_for_status()
        with open(dest, "wb") as fh:
            async for chunk in resp.aiter_bytes(1 << 20):
                fh.write(chunk)


def _trunc(val) -> str:
    s = str(val)
    return s[:_TRUNC] + "…" if len(s) > _TRUNC else s


def _inspect_shapefile(shp_path: Path, n_rows: int = _ROWS) -> None:
    import geopandas as gpd

    print(f"\n  Reading {shp_path.name} …", flush=True)
    try:
        gdf = gpd.read_file(str(shp_path))
    except Exception as exc:
        print(f"  ERROR: {exc}")
        return

    if gdf.empty:
        print("  (empty file)")
        return

    # Normalize CRS
    if gdf.crs is None:
        gdf = gdf.set_crs("EPSG:4326")
    elif gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs("EPSG:4326")

    bbox = gdf.total_bounds  # [minx, miny, maxx, maxy]
    geom_types = gdf.geom_type.value_counts().to_dict()

    print(f"\n{'─' * 60}")
    print(f"  Features  : {len(gdf):,}")
    print(f"  CRS       : {gdf.crs}")
    print(f"  Geom types: {geom_types}")
    print(f"  Bbox      : W={bbox[0]:.4f} S={bbox[1]:.4f} E={bbox[2]:.4f} N={bbox[3]:.4f}")

    # Columns
    non_geom = [c for c in gdf.columns if c != "geometry"]
    print(f"\n  Columns ({len(non_geom)}):")
    for col in non_geom:
        dtype = str(gdf[col].dtype)
        n_unique = gdf[col].nunique()
        sample = _trunc(gdf[col].dropna().iloc[0]) if gdf[col].notna().any() else "—"
        print(f"    {col:<30} {dtype:<12} unique={n_unique:<6} e.g. {sample}")

    # Sample rows
    sample_df = gdf[non_geom].head(n_rows)
    print(f"\n  First {n_rows} rows (values truncated to {_TRUNC} chars):")
    print(f"  {'─' * 58}")
    header = "  | " + " | ".join(f"{c[:18]:<18}" for c in non_geom) + " |"
    print(header)
    print(f"  {'─' * 58}")
    for _, row in sample_df.iterrows():
        line = "  | " + " | ".join(f"{_trunc(row[c]):<18}" for c in non_geom) + " |"
        print(line)
    print(f"  {'─' * 58}")


def _inspect_pmtile(minio_key: str) -> None:
    from core.minio_client import minio_client, BUCKET_NAME

    print(f"\n  MinIO key : {minio_key}")
    try:
        stat = minio_client.stat_object(BUCKET_NAME, minio_key)
        print(f"  Size      : {stat.size / 1024 / 1024:.2f} MB")
        print(f"  Modified  : {stat.last_modified}")
        print(f"  ETag      : {stat.etag}")
    except Exception as exc:
        print(f"  ERROR: {exc}")
        return

    # Try pmtiles library for TileJSON
    try:
        import pmtiles.reader as pmr  # type: ignore
        with tempfile.NamedTemporaryFile(suffix=".pmtiles", delete=False) as f:
            tmp = f.name
        minio_client.fget_object(BUCKET_NAME, minio_key, tmp)
        with open(tmp, "rb") as fh:
            reader = pmr.MmapSource(fh)
            header = pmr.read_header(reader)
            metadata = pmr.read_metadata(reader)
        os.unlink(tmp)

        print(f"\n  PMTile header:")
        print(f"    spec version : {header.get('spec_version', '?')}")
        print(f"    min zoom     : {header.get('min_zoom', '?')}")
        print(f"    max zoom     : {header.get('max_zoom', '?')}")
        print(f"    tile type    : {header.get('tile_type', '?')}")
        if metadata:
            print(f"\n  TileJSON metadata (truncated):")
            for k, v in metadata.items():
                print(f"    {k:<20}: {_trunc(str(v))}")
    except ImportError:
        print("  (install 'pmtiles' package for header/metadata inspection)")
    except Exception as exc:
        print(f"  TileJSON read error: {exc}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def _run(
    hazard:   Optional[str],
    scenario: Optional[str],
    pick:     Optional[str],
    pmtile:   Optional[str],
    list_all: bool,
) -> None:

    if list_all:
        print("\nAvailable hazard sources:\n")
        print(f"  {'HF prefix':<45} {'hazard_type':<15} {'scenario'}")
        print(f"  {'─' * 70}")
        for prefix, (ht, sc) in HF_SOURCE_MAP.items():
            print(f"  {prefix:<45} {ht:<15} {sc or '—'}")
        print()
        return

    if pmtile:
        _inspect_pmtile(pmtile)
        return

    if not hazard:
        print("ERROR: --hazard required (or use --list / --pmtile)")
        sys.exit(1)

    # Find matching prefix
    matching = [
        (prefix, ht, sc)
        for prefix, (ht, sc) in HF_SOURCE_MAP.items()
        if ht == hazard and (scenario is None or sc == scenario)
    ]
    if not matching:
        print(f"ERROR: no source matches hazard='{hazard}' scenario='{scenario}'")
        print("Run --list to see available options.")
        sys.exit(1)

    token = _get_hf_token()
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(
        headers=headers,
        follow_redirects=True,
        timeout=60,
    ) as client:
        for prefix, ht, sc in matching:
            print(f"\n{'═' * 60}")
            print(f"  Source  : {prefix}")
            print(f"  Hazard  : {ht}   Scenario: {sc or '—'}")
            print(f"{'═' * 60}")

            zips = await _list_zips(client, prefix)
            if not zips:
                print("  No ZIPs found.")
                continue

            zips = sorted(zips)
            if pick:
                filtered = [z for z in zips if pick.lower() in Path(z).stem.lower()]
                if not filtered:
                    print(f"  No ZIPs match --pick '{pick}'. Available stems:")
                    for z in zips[:20]:
                        print(f"    {Path(z).stem}")
                    continue
                zips = filtered[:1]
            else:
                zips = zips[:1]   # first alphabetically

            hf_path = zips[0]
            stem    = Path(hf_path).stem
            print(f"  ZIP     : {hf_path}")
            print(f"  (showing 1 of {len(sorted(await _list_zips(client, prefix)))} ZIPs — use --pick NAME to choose)", flush=True)

            with tempfile.TemporaryDirectory() as tmp_dir:
                zip_dest = Path(tmp_dir) / f"{stem}.zip"
                print(f"\n  Downloading {stem}.zip …", flush=True)
                await _download(client, hf_path, zip_dest)

                extract_dir = Path(tmp_dir) / "extracted"
                extract_dir.mkdir()
                with zipfile.ZipFile(zip_dest, "r") as zf:
                    zf.extractall(extract_dir)

                shp_files = list(extract_dir.rglob("*.shp"))
                if not shp_files:
                    print("  No .shp found in ZIP.")
                    continue

                _inspect_shapefile(shp_files[0])


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Inspect NOAH hazard source shapefile properties (read-only)"
    )
    parser.add_argument("--list",     action="store_true",
                        help="List all available hazard sources and exit")
    parser.add_argument("--hazard",   default=None,
                        choices=["flood", "landslide", "debris_flow", "storm_surge"],
                        help="Hazard type to inspect")
    parser.add_argument("--scenario", default=None, metavar="SCN",
                        help="Scenario (5yr 25yr 100yr ssa1–ssa4); omit for all matching")
    parser.add_argument("--pick",     default=None, metavar="NAME",
                        help="Substring to select a specific ZIP stem (e.g. 'Cebu')")
    parser.add_argument("--pmtile",   default=None, metavar="KEY",
                        help="MinIO object key of a PMTile to inspect instead")
    args = parser.parse_args()

    asyncio.run(_run(
        hazard   = args.hazard,
        scenario = args.scenario,
        pick     = args.pick,
        pmtile   = args.pmtile,
        list_all = args.list,
    ))


if __name__ == "__main__":
    main()
