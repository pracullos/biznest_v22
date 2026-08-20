"""
Seed Philippine fault lines from local GeoJSON into the database.

Source : geo_hazard/faultline/faultline.geojson
         (PHIVOLCS/GEM Global Earthquake Model — not from Project NOAH)

Spatial-joins fault lines to city boundaries, clips each feature to the
city boundary, generates one PMTile per city, and stores clipped features
as HazardArea rows scoped to that city.

Usage:
  python scripts/seed_faultlines.py              # seed + generate PMTiles
  python scripts/seed_faultlines.py --skip-pmtiles
  python scripts/seed_faultlines.py --city Butuan  # one city only
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv()

import sqlalchemy as sa
from geoalchemy2.shape import from_shape

from core.db import SessionLocal
from core.minio_client import minio_client, BUCKET_NAME
import models  # noqa: F401
from models.city import City
from models.hazard_area import HazardArea

BACKEND_DIR       = Path(__file__).resolve().parent.parent
FAULTLINE_GEOJSON = BACKEND_DIR / "geo_hazard" / "faultline" / "faultline.geojson"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

@dataclass
class CityInfo:
    id:   str
    name: str
    code: Optional[str]


def _build_cities_gdf(db) -> tuple:
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


def _geom_to_wkb(geom):
    if geom is None or geom.is_empty:
        return None
    try:
        import shapely
        return from_shape(shapely.force_2d(geom), srid=4326)
    except Exception:
        return None


def _check_tippecanoe() -> bool:
    try:
        return subprocess.run(["tippecanoe", "--version"], capture_output=True).returncode == 0
    except FileNotFoundError:
        return False


def _generate_pmtiles(geojson_path: Path, minio_key: str) -> Optional[str]:
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


def _replace_features(
    city_id:    str,
    pmtile_url: Optional[str],
    wkbs:       list,
) -> int:
    if not wkbs:
        return 0
    with SessionLocal() as db:
        db.execute(
            sa.delete(HazardArea).where(
                sa.and_(
                    HazardArea.city_id == city_id,
                    HazardArea.hazard_type == "faultline",
                    HazardArea.scenario.is_(None),
                )
            )
        )
        db.execute(
            sa.insert(HazardArea),
            [
                {
                    "id":          str(uuid4()),
                    "city_id":     city_id,
                    "hazard_type": "faultline",
                    "scenario":    None,
                    "pmtile_url":  pmtile_url,
                    "geometry":    wkb,
                }
                for wkb in wkbs
            ],
        )
        db.commit()
    return len(wkbs)


# ---------------------------------------------------------------------------
# Seeder
# ---------------------------------------------------------------------------

def seed_faultlines(skip_pmtiles: bool, city_filter: Optional[str] = None) -> None:
    import geopandas as gpd
    import shapely

    if not FAULTLINE_GEOJSON.exists():
        print(f"ERROR: {FAULTLINE_GEOJSON} not found")
        sys.exit(1)

    print(f"  Reading {FAULTLINE_GEOJSON.relative_to(BACKEND_DIR)}…", flush=True)
    gdf = gpd.read_file(str(FAULTLINE_GEOJSON))
    gdf = gdf[gdf["catalog_name"] == "philippines"].copy().reset_index(drop=True)
    print(f"  {len(gdf)} Philippines faultline features")

    if gdf.empty:
        print("  Nothing to seed.")
        return

    if gdf.crs is None:
        gdf = gdf.set_crs("EPSG:4326")
    elif gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs("EPSG:4326")

    # Fix Z coords + invalid geometries
    gdf = gdf.copy()
    gdf["geometry"] = gdf["geometry"].apply(
        lambda g: shapely.make_valid(shapely.force_2d(g))
        if g is not None and not g.is_empty else g
    )
    gdf = gdf[gdf["geometry"].notna() & ~gdf.geometry.is_empty].reset_index(drop=True)

    print("  Building city boundary index…", flush=True)
    with SessionLocal() as db:
        cities_gdf, city_infos = _build_cities_gdf(db)
    print(f"  {len(cities_gdf)} cities with geometry")

    if city_filter:
        filtered_ids = [
            cid for cid, info in city_infos.items()
            if city_filter.lower() in info.name.lower()
        ]
        cities_gdf  = cities_gdf[cities_gdf["city_id_ref"].isin(filtered_ids)].reset_index(drop=True)
        city_infos  = {k: v for k, v in city_infos.items() if k in filtered_ids}
        print(f"  filtered to {len(cities_gdf)} city/cities matching '{city_filter}'", flush=True)

    if cities_gdf.empty:
        print("  No matching cities — nothing to seed.")
        return

    joined = gpd.sjoin(
        gdf[["geometry"]],
        cities_gdf[["city_id_ref", "geometry"]],
        how="inner", predicate="intersects",
    )
    if joined.empty:
        print("  No faultlines intersect any city boundary.")
        return

    total_rows = 0

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

        clipped_gdf = gpd.GeoDataFrame(geometry=clipped_geoms, crs="EPSG:4326")

        pmtile_url = None
        if not skip_pmtiles:
            minio_key = f"pmtiles/hazards/faultline/all/city-{city.code}.pmtiles"
            with tempfile.TemporaryDirectory() as tmp:
                slice_path = Path(tmp) / "faultline.geojson"
                clipped_gdf[["geometry"]].to_file(str(slice_path), driver="GeoJSON")
                pmtile_url = _generate_pmtiles(slice_path, minio_key)

        wkbs = [w for g in clipped_gdf.geometry if (w := _geom_to_wkb(g)) is not None]
        count = _replace_features(str(city.id), pmtile_url, wkbs)
        total_rows += count
        print(f"  [{city.name}] {count} rows", flush=True)

    print(f"\n  → {total_rows} faultline rows inserted")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed faultline data from local GeoJSON")
    parser.add_argument("--skip-pmtiles", action="store_true")
    parser.add_argument("--city", default=None, metavar="NAME",
                        help="Seed only cities whose name contains NAME (case-insensitive)")
    args = parser.parse_args()

    if not args.skip_pmtiles and not _check_tippecanoe():
        print(
            "ERROR: tippecanoe not found.\n"
            "  Use --skip-pmtiles to seed geometry without generating tiles.\n"
            "  Install tippecanoe on Linux/Mac/WSL: https://github.com/felt/tippecanoe"
        )
        sys.exit(1)

    print("\n" + "=" * 55)
    print("  FAULTLINES")
    print("=" * 55)
    seed_faultlines(skip_pmtiles=args.skip_pmtiles, city_filter=args.city)
    print("\nDone.")