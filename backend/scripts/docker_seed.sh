#!/bin/sh
# Runs boundary + hazard seed scripts inside the backend container, scoped to
# one province via SEED_PROVINCE. Invoked by the `backend-seed` compose service
# (profile: seed) — NOT run automatically on `docker compose up`.
set -e

PROVINCE="${SEED_PROVINCE:-Agusan del Norte}"

echo "=== Seeding boundaries (province: ${PROVINCE}) ==="
python scripts/seed_local_boundaries.py --skip-pmtiles --province "${PROVINCE}"

echo "=== Seeding faultlines (province: ${PROVINCE}) ==="
python scripts/seed_faultlines.py --skip-pmtiles --province "${PROVINCE}"

echo "=== Seeding NOAH hazards (province: ${PROVINCE}) ==="
python scripts/seed_noah_hazards.py --skip-pmtiles --province "${PROVINCE}"

echo "=== Seeding done ==="
