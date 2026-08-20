"""
Geo-processing pipeline for zoning image analysis:
  1. Map-furniture detection → legend/title exclusion mask
  2. K-means color segmentation (furniture regions white-filled before clustering)
  3. OpenCV contour detection (excluded regions zeroed out)
  4. Projective transform (homography) → pixel coords to geographic coords
  5. Google Vision OCR → zone label extraction (legend text filtered out)
  6. Tippecanoe → PMTiles for MapLibre rendering
"""
from __future__ import annotations

import io
import json
import subprocess
import tempfile
from datetime import timedelta
from pathlib import Path
from uuid import UUID

import cv2
import numpy as np
from minio.error import S3Error
from shapely.geometry import Polygon, mapping
from shapely.validation import make_valid
from sklearn.cluster import KMeans

from core.minio_client import minio_client, BUCKET_NAME

_ZONING_PMTILE_PREFIX  = "pmtiles/zoning"
_HAZARD_PMTILE_PREFIX  = "pmtiles/hazards"
_PMTILE_PRESIGN_HOURS = 5
_WHITE_THRESHOLD = 230
_BLACK_THRESHOLD = 30


# ---------------------------------------------------------------------------
# Image loading
# ---------------------------------------------------------------------------

def load_image_from_minio(file_id: str) -> tuple[bytes, np.ndarray]:
    """
    Download image from MinIO and decode with OpenCV.
    Returns (raw_bytes, BGR ndarray).
    raw_bytes passed to Vision API; ndarray used for CV operations.
    """
    try:
        obj = minio_client.get_object(BUCKET_NAME, file_id)
        raw = obj.read()
        obj.close()
        obj.release_conn()
    except S3Error as exc:
        raise ValueError(f"Image not found in storage: {file_id}") from exc

    arr = np.frombuffer(raw, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"Cannot decode image (unsupported format): {file_id}")
    return raw, img


# ---------------------------------------------------------------------------
# Map-furniture detection — legend boxes, title bars, scale inserts
# ---------------------------------------------------------------------------

def detect_map_furniture(image_bgr: np.ndarray) -> np.ndarray:
    """
    Detect legend boxes, title bars, and other non-zone inserts in a zoning map.
    Returns a boolean mask (H×W) — True = exclude from zone detection and OCR.

    Strategy:
    - Find near-white rectangular blobs that touch an image border.
    - Legend/title boxes sit at the image edges with a white paper background.
    - Actual map zones are colored and rarely abut the very image edge.

    The mask is applied:
    1. Before K-means: excluded pixels replaced with white so swatch colors
       don't pollute zone clusters.
    2. Before contour building: excluded pixels zeroed so legend swatches
       don't create zone polygons.
    3. Before OCR assignment: legend text centroid falls in excluded region
       → discarded so it isn't attached to a nearby real zone.
    """
    h, w = image_bgr.shape[:2]
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

    # Near-white blobs (legend/title backgrounds are white paper)
    _, white = cv2.threshold(gray, 228, 255, cv2.THRESH_BINARY)

    # Close small gaps so text characters and swatch patches merge into one blob
    k = cv2.getStructuringElement(cv2.MORPH_RECT, (18, 18))
    closed = cv2.morphologyEx(white, cv2.MORPH_CLOSE, k)

    cnts, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    exclude = np.zeros((h, w), dtype=bool)
    img_area = float(h * w)

    for c in cnts:
        x, y, bw, bh = cv2.boundingRect(c)
        box_area = bw * bh
        if box_area == 0:
            continue

        # Size gate: 0.5 % – 35 % of image
        if box_area < img_area * 0.005 or box_area > img_area * 0.35:
            continue

        # Rectangularity: contour fill ratio (irregular blobs < 0.55)
        fill = cv2.contourArea(c) / box_area
        if fill < 0.55:
            continue

        # Aspect: not a thin borderline (max 7:1)
        aspect = max(bw, bh) / max(min(bw, bh), 1)
        if aspect > 7.0:
            continue

        # Interior must be predominantly white (≥ 45 %)
        roi = gray[y:y + bh, x:x + bw]
        if (roi > 210).mean() < 0.45:
            continue

        # Must touch an image border — legend/title boxes always sit at an edge
        margin_x = int(w * 0.06)
        margin_y = int(h * 0.06)
        if not (
            x <= margin_x
            or (x + bw) >= w - margin_x
            or y <= margin_y
            or (y + bh) >= h - margin_y
        ):
            continue

        exclude[y:y + bh, x:x + bw] = True

    return exclude


# ---------------------------------------------------------------------------
# Georeferencing — pixel ↔ geographic coordinate transform
# ---------------------------------------------------------------------------

def compute_homography(gcps: list) -> np.ndarray:
    """
    Compute pixel→geo homography from ≥4 ground control points.
    gcps: objects with .pixel_x, .pixel_y, .longitude, .latitude
    Returns 3×3 H such that: [lng, lat, w] = H @ [px, py, 1]
    """
    src = np.array([[g.pixel_x, g.pixel_y] for g in gcps], dtype=np.float64)
    dst = np.array([[g.longitude, g.latitude] for g in gcps], dtype=np.float64)
    H, _ = cv2.findHomography(src, dst, method=0)
    if H is None:
        raise ValueError(
            "Cannot compute homography — GCPs may be collinear or degenerate"
        )
    return H


def transform_pixels_to_geo(pixel_pts: np.ndarray, H: np.ndarray) -> np.ndarray:
    """(N, 2) pixel [col, row] → (N, 2) geographic [lng, lat]."""
    pts = pixel_pts.reshape(-1, 1, 2).astype(np.float64)
    return cv2.perspectiveTransform(pts, H).reshape(-1, 2)


# ---------------------------------------------------------------------------
# Color helpers
# ---------------------------------------------------------------------------

def color_to_hex(rgb: np.ndarray) -> str:
    """Convert a 3-element uint8 RGB array to a '#RRGGBB' hex string."""
    r, g, b = int(rgb[0]), int(rgb[1]), int(rgb[2])
    return f"#{r:02X}{g:02X}{b:02X}"


def _is_near_white(rgb: np.ndarray) -> bool:
    return bool(np.all(rgb >= _WHITE_THRESHOLD))


def _is_near_black(rgb: np.ndarray) -> bool:
    return bool(np.all(rgb <= _BLACK_THRESHOLD))


# ---------------------------------------------------------------------------
# Color segmentation — K-means
# ---------------------------------------------------------------------------

def segment_by_color(
    image_bgr: np.ndarray,
    n_colors: int = 8,
    exclude_mask: np.ndarray | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """
    K-means clustering on pixel colors.
    Fits on a ≤600px thumbnail for speed; predicts at full resolution.

    exclude_mask (H×W bool): regions white-filled before clustering so
    legend/title swatches don't create spurious color clusters.

    Returns (label_map H×W int32, cluster_centers N×3 uint8 RGB).
    """
    img_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)

    if exclude_mask is not None:
        img_rgb = img_rgb.copy()
        img_rgb[exclude_mask] = [255, 255, 255]

    h, w = img_rgb.shape[:2]
    scale = min(1.0, 600.0 / max(h, w, 1))
    small = cv2.resize(img_rgb, (max(1, int(w * scale)), max(1, int(h * scale))))

    km = KMeans(n_clusters=n_colors, random_state=42, n_init=10, max_iter=300)
    km.fit(small.reshape(-1, 3).astype(np.float32))

    labels = km.predict(img_rgb.reshape(-1, 3).astype(np.float32))
    centers = km.cluster_centers_.astype(np.uint8)  # RGB
    return labels.reshape(h, w).astype(np.int32), centers


# ---------------------------------------------------------------------------
# Contour detection
# ---------------------------------------------------------------------------

def get_zone_contours(
    label_map: np.ndarray,
    n_colors: int,
    min_area_px: int,
    centers_rgb: np.ndarray,
    exclude_mask: np.ndarray | None = None,
) -> list[tuple[np.ndarray, np.ndarray]]:
    """
    For each non-white, non-black cluster extract cleaned contours.
    Returns list of (contour_array, color_rgb_uint8).

    exclude_mask: pixels in excluded regions are zeroed before contour
    detection so legend swatches never produce zone polygons.

    Morphological close+open removes noise and fills small gaps.
    """
    results: list[tuple[np.ndarray, np.ndarray]] = []
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))

    for idx in range(n_colors):
        color = centers_rgb[idx]
        if _is_near_white(color) or _is_near_black(color):
            continue

        mask = ((label_map == idx) * 255).astype(np.uint8)

        # Zero out legend/title areas so swatch patches don't become contours
        if exclude_mask is not None:
            mask[exclude_mask] = 0

        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in contours:
            if cv2.contourArea(c) >= min_area_px:
                results.append((c, color))

    return results


# ---------------------------------------------------------------------------
# OCR — Google Vision API
# ---------------------------------------------------------------------------

def run_ocr(image_bytes: bytes) -> list[dict]:
    """
    Detect text with Google Vision (uses ADC — gcloud auth application-default login).

    Vision API returns text_annotations where:
      [0]  = full-page concatenated text  (skipped)
      [1:] = individual word/token annotations, each with:
               description  → the text string  (mapped to zone_type)
               bounding_poly.vertices → 4 pixel-space corner points

    Returns list of {text, cx, cy, vertices} dicts.
    Falls back to [] on any error so the pipeline continues without labels.
    """
    try:
        from google.cloud import vision  # deferred — optional dependency

        client = vision.ImageAnnotatorClient()
        image = vision.Image(content=image_bytes)
        response = client.text_detection(image=image)

        if response.error.message:
            return []

        results = []
        for ann in response.text_annotations[1:]:  # [0] is full-page text, skip
            verts = ann.bounding_poly.vertices
            if not verts:
                continue
            text = ann.description.strip().upper()
            if len(text) < 2:
                continue
            xs = [v.x for v in verts]
            ys = [v.y for v in verts]
            results.append({
                "text": text,
                "cx": sum(xs) / len(xs),
                "cy": sum(ys) / len(ys),
                # All 4 bounding-poly corners for edge-case matching below
                "vertices": [(x, y) for x, y in zip(xs, ys)],
            })
        return results
    except Exception as exc:
        print(f"[OCR] skipped — {type(exc).__name__}: {exc}", flush=True)
        return []


# ---------------------------------------------------------------------------
# Label assignment — OCR text → zone contours
# ---------------------------------------------------------------------------

def _point_in_contour(contour: np.ndarray, x: float, y: float) -> bool:
    return cv2.pointPolygonTest(contour, (float(x), float(y)), False) >= 0


def _point_near_contour(contour: np.ndarray, x: float, y: float, tolerance: float = 20.0) -> bool:
    """True if point is inside contour OR within `tolerance` pixels of its edge."""
    return cv2.pointPolygonTest(contour, (float(x), float(y)), measureDist=True) >= -tolerance


def assign_labels(
    contours_with_colors: list[tuple[np.ndarray, np.ndarray]],
    ocr_results: list[dict],
    exclude_mask: np.ndarray | None = None,
) -> list[str | None]:
    """
    Map Vision API descriptions to zone contours.

    exclude_mask: OCR annotations whose centroid falls inside an excluded
    region (legend, title bar) are discarded before assignment so legend
    category names don't get attached to nearby real zones.

    Strategy per annotation:
      1. Test centroid (cx, cy) — covers most cases.
      2. If centroid misses, test all 4 bounding-poly vertices — catches text
         whose centroid lands on a zone edge or just outside a thin zone.

    Texts are deduplicated per zone (Vision API sometimes emits the same
    word twice from overlapping detections). Result is space-joined and
    stored as zone_type, e.g. "MUNICIPALITY" or "RESIDENTIAL ZONE".
    """
    # Filter out legend/title text before any zone matching
    if exclude_mask is not None and ocr_results:
        h, w = exclude_mask.shape
        filtered: list[dict] = []
        for ocr in ocr_results:
            cy = max(0, min(int(ocr["cy"]), h - 1))
            cx = max(0, min(int(ocr["cx"]), w - 1))
            if not exclude_mask[cy, cx]:
                filtered.append(ocr)
        ocr_results = filtered

    labels: list[str | None] = []
    for contour, _ in contours_with_colors:
        seen: set[str] = set()
        texts: list[str] = []
        for ocr in ocr_results:
            # Strict: centroid inside contour
            inside = _point_in_contour(contour, ocr["cx"], ocr["cy"])
            if not inside:
                # Tolerant: any vertex within 20 px of boundary
                # catches labels whose centroid lands just outside a thin zone edge
                inside = any(
                    _point_near_contour(contour, vx, vy, tolerance=20.0)
                    for vx, vy in ocr.get("vertices", [])
                )
            if inside and ocr["text"] not in seen:
                seen.add(ocr["text"])
                texts.append(ocr["text"])
        labels.append(" ".join(texts) if texts else None)
    return labels


# ---------------------------------------------------------------------------
# Vectorization — contour → geo polygon
# ---------------------------------------------------------------------------

def contour_to_geo_polygon(contour: np.ndarray, H: np.ndarray) -> Polygon | None:
    """
    Approximate contour with Douglas-Peucker, transform pixel→geo, build Shapely Polygon.
    epsilon_factor=0.002 balances detail vs vertex count.
    """
    peri = cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, 0.002 * peri, True)
    pixel_pts = approx.reshape(-1, 2).astype(np.float64)

    if len(pixel_pts) < 3:
        return None

    geo_pts = transform_pixels_to_geo(pixel_pts, H)

    try:
        poly = Polygon(geo_pts)
        if not poly.is_valid:
            poly = make_valid(poly)
        # make_valid may produce MultiPolygon — take largest piece
        if poly.geom_type != "Polygon":
            parts = list(poly.geoms) if hasattr(poly, "geoms") else []
            poly = max(parts, key=lambda p: p.area) if parts else None
        if poly is None or poly.is_empty or poly.area < 1e-14:
            return None
        return poly
    except Exception:
        return None


# ---------------------------------------------------------------------------
# PMTile generation — native tippecanoe or WSL fallback
# ---------------------------------------------------------------------------

_TIPPECANOE_ARGS = [
    "--force",
    "--minimum-zoom=8",
    "--maximum-zoom=18",
    "--generate-ids",
    "--no-tile-stats",
]


def _to_wsl_path(windows_path: str) -> str:
    """
    Convert a Windows absolute path to its WSL /mnt/<drive>/... equivalent.
    C:\\Users\\foo\\bar.geojson  →  /mnt/c/Users/foo/bar.geojson
    Already-unix paths (no drive letter) are returned unchanged.
    Uses p.parts to avoid backslash-escaping issues on Windows.
    """
    p = Path(windows_path)
    if not p.drive:
        return windows_path
    drive = p.drive[0].lower()          # 'C:' → 'c'
    parts = list(p.parts[1:])           # drop drive root ('C:\\')
    return "/mnt/" + drive + "/" + "/".join(parts)


def _run_tippecanoe(
    geojson_path: str,
    pmtile_path: str,
    extra_args: list[str] | None = None,
) -> bool:
    """
    Try native tippecanoe first (Linux / Mac / WSL-native process).
    On failure / not found, fall back to invoking tippecanoe inside WSL
    from a Windows host process, converting paths to /mnt/<drive>/... format.
    Returns True if a PMTile file was produced.
    """
    args = [*_TIPPECANOE_ARGS, *(extra_args or [])]

    # 1. Native tippecanoe (Linux, Mac, or if tippecanoe is on Windows PATH)
    try:
        r = subprocess.run(
            ["tippecanoe", "-o", pmtile_path, *args, geojson_path],
            capture_output=True,
            text=True,
        )
        if r.returncode == 0 and Path(pmtile_path).exists():
            return True
    except FileNotFoundError:
        pass

    # 2. WSL tippecanoe (Windows host → wsl.exe → tippecanoe inside WSL)
    # Temp files live on a Windows path (e.g. C:\Users\...\Temp\tmpXXX\).
    # WSL exposes Windows drives under /mnt/, so we convert the paths.
    try:
        wsl_geojson = _to_wsl_path(geojson_path)
        wsl_pmtile = _to_wsl_path(pmtile_path)
        r = subprocess.run(
            ["wsl", "tippecanoe", "-o", wsl_pmtile, *args, wsl_geojson],
            capture_output=True,
            text=True,
        )
        # WSL writes the file to the Windows path (same underlying location)
        return r.returncode == 0 and Path(pmtile_path).exists()
    except FileNotFoundError:
        return False  # wsl.exe not on PATH or WSL not installed


def _upload_pmtile(
    geojson: dict,
    object_key: str,
    layer_name: str | None = None,
) -> str | None:
    """
    Shared core: GeoJSON → tippecanoe → MinIO upload.
    layer_name: passed as --layer=<name> so the vector source-layer name is
    predictable and matches the frontend engine fallback (no MinIO CORS needed).
    Returns object_key on success, None if tippecanoe unavailable.
    """
    extra_args = [f"--layer={layer_name}"] if layer_name else []
    with tempfile.TemporaryDirectory() as tmpdir:
        geojson_path = Path(tmpdir) / "data.geojson"
        pmtile_path  = Path(tmpdir) / "data.pmtiles"
        geojson_path.write_text(json.dumps(geojson), encoding="utf-8")

        if not _run_tippecanoe(str(geojson_path), str(pmtile_path), extra_args):
            return None

        pmtile_bytes = pmtile_path.read_bytes()
        minio_client.put_object(
            BUCKET_NAME,
            object_key,
            data=io.BytesIO(pmtile_bytes),
            length=len(pmtile_bytes),
            content_type="application/octet-stream",
        )
    return object_key


def generate_pmtiles(geojson: dict, city_id: UUID) -> str | None:
    """
    Write GeoJSON → run tippecanoe (native or via WSL) → upload PMTile to MinIO.
    Returns the MinIO object key or None when tippecanoe unavailable.
    Layer name forced to 'zoning' — matches engine fallback (sl ?? 'zoning').
    """
    object_key = f"{_ZONING_PMTILE_PREFIX}/city-{city_id}.pmtiles"
    return _upload_pmtile(geojson, object_key, layer_name="zoning")


def generate_hazard_pmtiles(
    geojson: dict,
    city_id: UUID,
    hazard_type: str,
    scenario: str | None,
) -> str | None:
    """
    Build a hazard PMTile for a specific city/hazard_type/scenario combination.
    Used for manually drawn hazard areas (city-scoped, distinct from seeded province tiles).
    Layer name forced to 'slice' — matches engine fallback (DEFAULT_HAZARD_SOURCE_LAYER).
    Returns the MinIO object key or None if tippecanoe is unavailable.
    """
    scenario_slug = scenario or "all"
    object_key = f"{_HAZARD_PMTILE_PREFIX}/{hazard_type}/{scenario_slug}/city-{city_id}.pmtiles"
    return _upload_pmtile(geojson, object_key, layer_name="slice")


def presign_pmtile(object_key: str) -> str:
    """Generate a presigned MinIO URL (5 h TTL) for a stored PMTile object key."""
    return minio_client.presigned_get_object(
        BUCKET_NAME,
        object_key,
        expires=timedelta(hours=_PMTILE_PRESIGN_HOURS),
    )