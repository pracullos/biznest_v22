from minio import Minio
import os

_minio_host = os.environ.get("MINIO_HOST", "localhost")
_minio_port = os.environ.get("MINIO_PORT", "9000")
MINIO_URL = f"{_minio_host}:{_minio_port}"
MINIO_USERNAME = os.environ["MINIO_ROOT_USER"]
MINIO_PASSWORD = os.environ["MINIO_ROOT_PASSWORD"]
BUCKET_NAME = os.environ.get("MINIO_BUCKET", "uploads")

minio_client = Minio(
    MINIO_URL,
    access_key=MINIO_USERNAME,
    secret_key=MINIO_PASSWORD,
    secure=False,
)

if not minio_client.bucket_exists(BUCKET_NAME):
    minio_client.make_bucket(BUCKET_NAME)

# Allow the frontend to fetch PMTile files directly from MinIO via the
# PMTiles JS library, which uses HTTP range requests from the browser.
# Without this, cross-origin range requests are silently blocked by the browser.
try:
    import importlib
    _cm = importlib.import_module("minio.corsconfig")
    _set_cors = getattr(minio_client, "set_bucket_cors")
    _set_cors(
        BUCKET_NAME,
        _cm.CORSConfiguration([
            _cm.CORSRule(
                allowed_origins=["*"],
                allowed_methods=["GET", "HEAD"],
                allowed_headers=["*"],
                expose_headers=["Content-Length", "Content-Range", "ETag"],
                max_age_seconds=86400,
            )
        ]),
    )
except Exception:
    pass