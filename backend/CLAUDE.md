# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

FastAPI + PostgreSQL (SQLAlchemy sync + PostGIS via geoalchemy2) + MinIO (object storage). JWT auth via HTTP-only cookies.

## Infrastructure

```bash
docker compose up -d
```

- PostgreSQL: `localhost:5433` (mapped from 5432), db/user/pass all `fastapi`
- MinIO: `localhost:9000` (API), `localhost:9090` (console), user `minio` / pass `minio123`
- MinIO bucket `uploads` auto-created on startup via `core/minio_client.py`

## Running the app

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Tables created via `Base.metadata.create_all` on startup. Seed (subscription plans + permissions + roles) runs every startup via `core/seed.py` (idempotent).

API docs: `http://localhost:8000/docs`

## Required ENV vars

`.env` at repo root, loaded by `python-dotenv` before any imports in `main.py`.

| Var | Required | Default |
|-----|----------|---------|
| `DATABASE_URL` | yes | — |
| `SECRET_KEY` | yes | — |
| `MINIO_ENDPOINT` | yes | — |
| `MINIO_ACCESS_KEY` | yes | — |
| `MINIO_SECRET_KEY` | yes | — |
| `ALGORITHM` | no | `HS256` |
| `ACCESS_TOKEN_EXPIRE_SECONDS` | no | `900` (15 min) |
| `REFRESH_TOKEN_EXPIRE_SECONDS` | no | `604800` (7 days) |
| `JWT_COOKIE_NAME` | no | `ACCESS_TOKEN` |
| `REFRESH_COOKIE_NAME` | no | `REFRESH_TOKEN` |
| `SECURE_COOKIES` | no | `false` |
| `FRONTEND_URL` | no | `http://localhost:3001` |
| `LGU_INVITE_EXPIRE_HOURS` | no | `24` |
| `SMTP_HOST` | no | — (disables email) |
| `SMTP_PORT` | no | — |
| `SMTP_USER` | no | — |
| `SMTP_PASSWORD` | no | — |
| `SMTP_FROM` | no | — |
| `HUGGING_FACE_TOKEN` | scripts only | — |

All config constants read from ENV in `core/db.py`. Exception: `core/minio_client.py` uses hardcoded credentials matching docker compose defaults — update that file directly when deploying.

SMTP config is optional — LGU invitation emails silently no-op when `SMTP_HOST` is unset.

## Migrations (Alembic)

```bash
alembic revision --autogenerate -m "description"
alembic upgrade head
```

DB URL hardcoded in both `core/db.py` and `alembic.ini`. Prefer `create_all` for local dev; Alembic for versioned production migrations.

`create_all` does not run Alembic migrations — GIST spatial indexes and composite B-tree indexes (e.g., `idx_hazard_areas_city_type_scenario`) only exist after `alembic upgrade head`.

**PostGIS Tiger extension warning**: Alembic autogenerate will generate drop statements for ~30 Tiger geocoder extension tables. Always manually strip those from generated migrations before running. Use `sqlalchemy.inspect()` guards on all ops to handle `create_all` having already run.

## Architecture

```
main.py              # App entry: create_all, seed, router registrations
core/
  db.py              # Engine + config constants from ENV
  minio_client.py    # MinIO singleton + bucket init (hardcoded creds)
  seed.py            # Seeds subscription plans + 13 permissions + 3 roles
models/
  base.py            # Declarative Base
  __init__.py        # Imports all models — always update when adding a model
dto/                 # Pydantic request/response schemas (PascalCase filenames: UserDto.py)
routes/              # Thin route handlers — delegate entirely to services
services/            # Business logic (one file per domain)
  auth_service.py    # Cookie helpers, get_authenticated_user (cookie or Bearer header)
  geo_processing_service.py  # CV/ML pipeline: image → zoning polygons (see below)
utils/
  jwtUtils.py        # JWT creation (custom HS256), SHA256+salt password hashing, get_db
  email_utils.py     # SMTP email sender (silent no-op if SMTP_HOST unset)
scripts/             # One-off data seeders (run manually)
boundaries/          # Local GeoJSON files for PH administrative boundaries
geo_hazard/          # Local hazard shapefiles/data
```

## Domain models

All use UUID PKs and `func.now()` server-default timestamps.

**Core**: `User` (`is_superuser` boolean, `is_active` boolean), `Document`, `RefreshToken`
- `RefreshToken` stores SHA256 hash of token (not raw), `user_agent`, `ip_address`. Revocation sets `revoked_at` — tokens are never deleted.

**Philippine administrative hierarchy**: `Region` → `Province` → `City` → `Barangay`
- All four levels have `boundary` (PostGIS `MULTIPOLYGON`, srid=4326) and `pmtile_url`
- `code` is the PSA/PSGC code at each level (adm1/adm2/adm3/adm4) — used as PMTile filename stem
- `City` also carries denormalized `province` and `region` string columns alongside the FK to `Province`
- `CityResponse` DTO includes serialized `boundary` (GeoJSON dict), `province_id`, and `pmtile_url`

**Geo / city-scoped**: `ZoningArea`, `Establishment`, `Alert` — FK `cities.id` (`ondelete="CASCADE"`)

**City-scoped**: `HazardArea` — FK `cities.id` (`ondelete="CASCADE"`). NOAH/faultline seeding scripts spatial-join features to city boundaries and store per-city PMTiles.
- `ZoningArea.geometry` — PostGIS `GEOMETRY` (srid=4326)
- `HazardArea.geometry` — PostGIS `GEOMETRY` (srid=4326); also has `hazard_type` (`flood`, `landslide`, `storm_surge`, `debris_flow`, `faultline`), `scenario` (`5yr`/`25yr`/`100yr`/`ssa1`–`ssa4`, nullable for faultlines), and `pmtile_url`

**Access control**: `Permission`, `Role`, `RolePermission`, `UserRole`
- `InvestorCityAccess` — which cities an investor user can access (unique on user_id + city_id)
- `LguAssignment` — `user_id` unique + `city_id` unique (1-to-1: one admin per city, one city per admin)
- `LguInvitation` — magic-link token, `expires_at`, `used_at` nullable (marks consumed)

**Subscription**: `SubscriptionPlan` + `InvestorSubscription`
- `SubscriptionPlan` — `name` (unique), `max_cities` (nullable = unlimited). Seeded: `free`(1), `premium`(10), `pro`(40), `enterprise`(null).
- `InvestorSubscription` — `user_id` (unique FK), `plan_id` FK → `subscription_plans.id` (RESTRICT), optional `expires_at`. Has `plan` relationship. New users auto-subscribed to `free` plan on register.

**Utility**: `SavedLocation`, `AuditLog`
- `AuditLog` — `user_id`/`city_id` are nullable with no FK constraints (records survive entity deletion)

## Routes

City-scoped routes share the `/cities` prefix in `main.py` but live in separate router files:

```
/users              → routes/users.py
/files              → routes/files.py
/cities             → routes/cities.py + zoning_areas.py + establishments.py + alerts.py
/provinces          → routes/hazard_areas.py  (/{province_id}/hazards/*)
/subscriptions      → routes/investor_subscriptions.py  (GET /subscriptions/plans is public)
/lgu-assignments    → routes/lgu_assignments.py
/city-access        → routes/investor_city_access.py
/permissions        → routes/permissions.py
/roles              → routes/roles.py
/user-roles         → routes/user_roles.py
/saved-locations    → routes/saved_locations.py
/audit-logs         → routes/audit_logs.py
```

**Public endpoints** (no auth): `GET /cities/`, `GET /subscriptions/plans`, `GET /permissions/`, `GET /roles/`, `GET /files/{file_id}`, `GET /users/` (gotcha — list all users requires no auth).

**LGU invite flow** (`/users/lgu/*`): superuser-only `POST /users/lgu/invite` → sends magic-link email (24h expiry) → `GET /users/lgu/verify-invitation?token=...` → `POST /users/lgu/register`. City must be unassigned; duplicate pending invites blocked at service level.

**Zoning PMTile endpoints** (in `routes/zoning_areas.py`):
- `POST /cities/{city_id}/zoning/process-image` — runs geo-processing pipeline; request body: `{ file_id, gcps: [{pixel_x, pixel_y, lng, lat}] (≥4), n_colors: int=8, min_area_px: int=500 }`; returns `{ zones_created, skipped_zones, pmtile_url, zones[] }`
- `GET /cities/{city_id}/zoning/pmtiles` — returns fresh 5-hour presigned URL for city's zoning PMTile (re-fetches each call)

## Geo-processing pipeline

`services/geo_processing_service.py` converts a georeferenced raster image (e.g., a zoning map scan) into PostGIS `ZoningArea` polygons + a city-level PMTile.

**Pipeline steps** (called from `zoning_area_service.process_zoning_image`):
1. Load image from MinIO by `file_id` via OpenCV
2. Compute pixel→geo homography from ≥4 GCPs (`cv2.findHomography`) — raises 422 if degenerate
3. K-means color segmentation (default 8 clusters) on 600px thumbnail; applied full-res
4. Morphological ops (close→open) to clean masks, then `cv2.findContours` + Douglas-Peucker simplification
5. Google Vision API OCR on full image → map text to zone contours by centroid / bounding-poly corners (deferred import, silent fallback to `[]` on any error — pipeline continues unlabeled)
6. Transform pixel contours → Shapely polygons → validate + persist `ZoningArea` rows
7. Generate city-level PMTile from ALL city zoning areas (new + existing) via tippecanoe
8. Store MinIO object key on ALL `ZoningArea` rows for the city; return fresh 5-hour presigned URL

**tippecanoe on Windows**: `_run_tippecanoe()` tries native binary first, then falls back to `wsl.exe` with Windows→WSL path conversion. Use `--skip-pmtiles` on Windows for seeding scripts.

**Google Vision**: requires Application Default Credentials (`gcloud auth application-default login`). No `GOOGLE_APPLICATION_CREDENTIALS` env var is set in `.env` — configure ADC externally.

## Data seeding scripts

Run from backend root. All require docker compose running and `.env` loaded.

```bash
# Seed PH boundaries from local GeoJSON files in boundaries/
python scripts/seed_local_boundaries.py                        # all levels
python scripts/seed_local_boundaries.py --levels province city # specific levels
python scripts/seed_local_boundaries.py --skip-pmtiles         # DB only, skip tippecanoe

# Seed Project NOAH hazard maps — downloads ZIPs directly from HuggingFace,
# converts in-memory (temp dir), generates PMTiles, stores geometry to DB.
# No local GeoJSON cache. Requires provinces already seeded with geometry.
# pip install fiona geopandas requests
python scripts/seed_noah_hazards.py                                    # all hazards
python scripts/seed_noah_hazards.py --hazards flood                    # one type
python scripts/seed_noah_hazards.py --hazards flood --scenarios 100yr  # one scenario
python scripts/seed_noah_hazards.py --skip-pmtiles                     # geometry only
python scripts/seed_noah_hazards.py --province Cebu                    # debug one province
python scripts/seed_noah_hazards.py --list-files                       # inspect HF repo structure

# Seed faultlines from local geo_hazard/faultline/faultline.geojson
# (PHIVOLCS/GEM data — not from NOAH, kept in repo)
python scripts/seed_faultlines.py
python scripts/seed_faultlines.py --skip-pmtiles
```

**PMTile storage layout in MinIO**:
```
pmtiles/provinces/province-{adm2_psgc}.pmtiles
pmtiles/cities/city-{adm3_psgc}.pmtiles
pmtiles/hazards/{hazard_type}/{scenario}/province-{adm2_psgc}.pmtiles
pmtiles/hazards/faultline/all/province-{adm2_psgc}.pmtiles
```

`tippecanoe` must be installed on Linux/Mac/WSL — not available natively on Windows. Use `--skip-pmtiles` on Windows to seed geometry into DB without generating tiles.

**HazardArea geometry**: stored as individual features (one row per GeoJSON feature), not dissolved. Used for PostGIS spatial queries only (ST_Intersects, ST_Contains, ST_Within). PMTiles handle all rendering.

## Key design decisions

**Auth flow**: JWT issued on register/login via `jwtUtils.create_jwt` (custom HS256 implementation). Decoded via `python-jose`. Set as HTTP-only cookie (`samesite=lax`). `auth_service.get_authenticated_user` accepts cookie (`ACCESS_TOKEN`) or `Authorization: Bearer <token>`. Checks `user.is_active` — inactive users get 403. New users auto-subscribed to `free` plan in same transaction as `UserRole` assignment (`user_service.py`).

**Refresh token flow**: `POST /users/refresh` issues new access+refresh token pair. Refresh cookie uses `samesite=strict`, path-restricted to `/users/refresh`. For mobile clients, refresh token can also be sent in request body (cookie takes priority). Tokens stored as SHA256 hash; revoked by setting `revoked_at` (not deleted). `POST /users/logout-all` revokes all tokens for a user. **Theft detection**: reuse of an already-revoked refresh token triggers immediate revocation of ALL tokens for that user + 401 "Refresh token reuse detected — all sessions revoked".

**Permission enforcement**: Routes authenticate via `get_authenticated_user` but do NOT check role-permission graph at the route level. The seeded permissions exist for frontend consumption and future enforcement. Adding permission checks means reading `user.user_roles` → `role.role_permissions` manually in the service or as a new dependency.

**Password hashing**: Custom SHA256+salt in `jwtUtils.py`. Format: `{base64_salt}${hex_digest}`. Constant-time comparison via `hmac.compare_digest()`.

**DB session**: `get_db` generator lives in `utils/jwtUtils.py` (not `core/db.py`). `SessionLocal` is configured with `expire_on_commit=False` — ORM objects remain readable after `db.commit()` without a reload. Used as FastAPI dependency throughout all routes.

**DTO pattern**: All Pydantic schemas use `ConfigDict(from_attributes=True)`. Files named PascalCase (`UserDto.py`). Request/response models co-located in one DTO file per domain.

**Geometry serialization**: Geometry columns store WKB via geoalchemy2. DTOs receive raw GeoJSON dicts on input (`dict` typed field) and serialize back to GeoJSON dicts on output using `mapping(to_shape(wkb))` in a `@field_validator("field", mode="before")`. All geometry is SRID 4326.

**Service layer**: Route handlers call a single service function and return the result. All logic lives in `services/`. Services raise `HTTPException` directly (not custom exceptions).

**Audit logging**: `audit_log_service.log(user_id, city_id, action, meta, db)` — call from service functions when writes need an audit trail. `AuditLog` has no FK on `user_id`/`city_id` by design — records survive entity deletion.

**Models registration**: All models must be imported in `models/__init__.py` for `Base.metadata.create_all` and Alembic autogenerate to detect them. Import order matters for FK resolution (e.g., `SubscriptionPlan` before `InvestorSubscription`).

**File storage**: Files stored in MinIO as `{uuid}_{filename}`. `file_service.upload_file` also writes a `Document` record to DB. Only the file upload route handler is `async`. File download (`GET /files/{file_id}`) is public — no auth required.

**CORS**: Hardcoded to `http://localhost:3001` and `http://127.0.0.1:3001` in `main.py`. Update when deploying or adding frontends.

**Seeded data** (`core/seed.py`):

Subscription plans: `free`(max 1 city), `premium`(10), `pro`(40), `enterprise`(unlimited/null)

Permission slugs (13 total):
```
manage:city  zoning:read  zoning:write  hazard:read  hazard:write
establishment:read  establishment:write  alert:read  alert:write
analytics:view  location:save  manage:user  manage:role
```
- `investor` (6 perms): `zoning:read`, `hazard:read`, `establishment:read`, `alert:read`, `analytics:view`, `location:save`
- `lgu_admin` (11 perms): adds `manage:city`, `zoning:write`, `hazard:write`, `establishment:write`, `alert:write`
- `admin` (13 perms): all `lgu_admin` perms + `manage:user`, `manage:role`

**HazardArea DTOs**: All route endpoints return `HazardAreaSummary` (no geometry — avoids large WKB over the wire). `HazardAreaResponse` (includes geometry) exists in `dto/HazardAreaDto.py` for future use. Apply same summary-vs-full pattern when adding new geo resources.

**Hazard pmtile URLs**: `get_pmtiles_by_city(city_id, db)` returns presigned MinIO URLs with 5-hour TTL — not static paths. Frontend must re-fetch when URLs expire. PMTile keys: `pmtiles/hazards/{hazard_type}/{scenario_slug}/city-{code}.pmtiles`.

**Zoning PMTile URLs**: same presigned-URL pattern as hazards. When `process-image` runs, the MinIO object key is written to `ZoningArea.pmtile_url` for EVERY zone in the city (not just newly created ones). `GET /cities/{city_id}/zoning/pmtiles` re-signs the key on every call — the stored value is a path, not a URL.