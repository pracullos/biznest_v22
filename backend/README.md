# BizNest v2 — Backend

FastAPI + PostgreSQL (PostGIS) + MinIO geo-intelligence API.

---

## Prerequisites

- [Python 3.10](https://www.python.org/downloads/release/python-3100/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [WSL 2](https://learn.microsoft.com/en-us/windows/wsl/install) (required for tippecanoe / PMTile generation)
- Git

---

## 1. Clone & navigate

```bash
git clone <repo-url>
cd backend
```

---

## 2. Create `.env`

Create a `.env` file in `backend/`:

```env
DATABASE_URL=postgresql://fastapi:fastapi@localhost:5433/fastapi
SECRET_KEY=your-secret-key-here
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minio
MINIO_SECRET_KEY=minio123
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_SECONDS=3600
JWT_COOKIE_NAME=ACCESS_TOKEN
SECURE_COOKIES=false

# Required only for running seed_noah_hazards.py
HUGGING_FACE_TOKEN=hf_your_token_here
```

Generate a secure `SECRET_KEY`:

```bash
python -c "import secrets, base64; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"
```

---

## 3. Start infrastructure

```bash
docker compose up -d
```

| Service    | URL                                        | Credentials          |
|------------|--------------------------------------------|----------------------|
| PostgreSQL | `localhost:5433`                           | `fastapi` / `fastapi` |
| MinIO API  | `localhost:9000`                           | `minio` / `minio123` |
| MinIO UI   | [localhost:9090](http://localhost:9090)    | `minio` / `minio123` |

Verify containers are running:

```bash
docker compose ps
```

---

## 4. Install Python dependencies

```bash
pip install -r requirements.txt
```

> If you get a SQLAlchemy error on Python 3.13, ensure `sqlalchemy>=2.0.36` is installed.

---

## 5. Run database migrations

```bash
alembic upgrade head
```

This applies all versioned schema migrations including spatial indexes and the province-scoped hazard areas schema.

> `alembic upgrade head` must be run before the app starts if this is a fresh database. The app's `create_all` on startup handles table creation for local dev but does **not** create spatial indexes or run Alembic migrations.

---

## 6. Start the API server

```bash
fastapi dev main.py
```

- API: [http://localhost:8000](http://localhost:8000)
- Swagger docs: [http://localhost:8000/docs](http://localhost:8000/docs)

The server automatically:
- Creates all tables via `Base.metadata.create_all`
- Seeds 11 permissions + `investor` and `lgu_admin` roles (idempotent)
- Initializes the MinIO `uploads` bucket

---

## To seed the data run it in wsl, navigation to the backend project folder and run cd /mnt/e/Dev/monorepo\ projects/biznest_v2/backend (note this is my path) and run the following commands:
## 7. Seed Philippine administrative boundaries

Requires local GeoJSON files in `boundaries/`. Run from `backend/`:

```bash
# Seed all levels (region → province → city → barangay)
python scripts/seed_local_boundaries.py

# Seed specific levels only
python scripts/seed_local_boundaries.py --levels province city

# Seed without generating PMTiles (Windows — tippecanoe not available natively)
python scripts/seed_local_boundaries.py --skip-pmtiles
```

> Seed boundaries **before** running the hazard seeder — the hazard seeder needs province geometry in the database.

---

## 8. Set up tippecanoe in WSL (for PMTile generation)

tippecanoe converts GeoJSON to PMTiles for map rendering. It runs inside WSL since it is not available natively on Windows.

### Install WSL Ubuntu

#### No need to do this if you already have Ubuntu installed
```powershell
wsl --install -d Ubuntu
```

Restart if prompted, then open Ubuntu from Start menu and set up a username/password.

### Install tippecanoe inside WSL

```bash
# Inside WSL Ubuntu terminal
sudo apt-get update
sudo apt-get install -y build-essential libsqlite3-dev zlib1g-dev

# Clone and build
git clone https://github.com/felt/tippecanoe.git
cd tippecanoe
make -j$(nproc)
sudo make install

# Verify
tippecanoe --version
```

### Configure the seeder to run inside WSL

The hazard seeder calls tippecanoe as a subprocess. Since it runs on Windows but tippecanoe is in WSL, launch the seeder **from inside WSL** where tippecanoe is on `PATH`:

```bash
# Open WSL Ubuntu terminal, navigate to the project
cd /mnt/e/Dev/monorepo\ projects/biznest_v2/backend

# Install Python deps inside WSL (one-time)
pip install -r requirements.txt
pip install fiona geopandas

# Run the seeder from WSL — tippecanoe is available here
python scripts/seed_noah_hazards.py
```

> The project files are accessible under `/mnt/<drive-letter>/` in WSL. Adjust the path to match your drive.

---

## 9. Seed hazard data

Hazard shapefiles must be present in the `hazard/` directory. Expected layout:

```
hazard/
  flood/
    5yr/          ← province ZIPs (e.g. Bukidnon.zip)
    25yr/
    100yr/
  landslide/
    landslide/    ← province ZIPs
    DebrisFlow/   ← national ZIPs (Philippines_DebrisFlow.zip, Philippines_AlluvialFan.zip)
  storm_surge/
    storm_surge_advisory_1/
    storm_surge_advisory_2/
    storm_surge_advisory_3/
    storm_surge_advisory_4/
  faultline/
    faultline.geojson
```

### Seed geometry only (no PMTiles — fast, Windows-compatible)

```bash
python scripts/seed_noah_hazards.py --skip-pmtiles
```

### Seed with PMTile generation (run from WSL)

```bash
# All hazards + faultlines
python scripts/seed_noah_hazards.py

# Flood only
python scripts/seed_noah_hazards.py --hazards flood

# One scenario
python scripts/seed_noah_hazards.py --hazards flood --scenarios 100yr

# One province (for testing)
python scripts/seed_noah_hazards.py --province Bukidnon

# Faultlines only
python scripts/seed_noah_hazards.py --faultline-only

# Parallel workers (default: 4 province workers)
python scripts/seed_noah_hazards.py --workers 8

# Adjust geometry simplification (default: 0.0001° ≈ 11m; 0 to disable)
python scripts/seed_noah_hazards.py --simplify 0.0001
```

Seeded data is stored per province. Each hazard type/scenario/severity combination creates one `HazardArea` row. PMTiles are uploaded to MinIO at:

```
pmtiles/hazards/{hazard_type}/{scenario}/province-{psgc_code}.pmtiles
pmtiles/hazards/faultline/all/province-{psgc_code}.pmtiles
```

---

## Seeding order summary

Run these in order on a fresh database:

```bash
# 1. Apply schema
alembic upgrade head

# 2. Start API (seeds permissions + roles)
uvicorn main:app --reload

# 3. Seed boundaries (geometry only on Windows)
python scripts/seed_local_boundaries.py --skip-pmtiles

# 4. Seed hazard data (from WSL if you need PMTiles)
python scripts/seed_noah_hazards.py --skip-pmtiles   # Windows
# or from WSL:
python scripts/seed_noah_hazards.py                  # with PMTiles
```

---

## Development notes

- **Migrations**: after any model change run `alembic revision --autogenerate -m "description"` then `alembic upgrade head`
- **New models**: import in `models/__init__.py` or Alembic and `create_all` won't detect them
- **CORS**: hardcoded to `http://localhost:3001` in `main.py`
- **MinIO credentials**: hardcoded in `core/minio_client.py` — update directly for deployment