import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_pg_user = os.environ["POSTGRES_USERNAME"]
_pg_pass = os.environ["POSTGRES_PASSWORD"]
_pg_host = os.environ.get("POSTGRES_HOST", "localhost")
_pg_port = os.environ.get("POSTGRES_PORT", "5432")
_pg_db = os.environ["POSTGRES_DB"]

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    f"postgresql+pg8000://{_pg_user}:{_pg_pass}@{_pg_host}:{_pg_port}/{_pg_db}",
)

SECRET_KEY = os.environ["SECRET_KEY"]
ALGORITHM = os.environ.get("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_SECONDS = int(os.environ.get("ACCESS_TOKEN_EXPIRE_SECONDS", "900"))
REFRESH_TOKEN_EXPIRE_SECONDS = int(os.environ.get("REFRESH_TOKEN_EXPIRE_SECONDS", "604800"))
JWT_COOKIE_NAME = os.environ.get("JWT_COOKIE_NAME", "ACCESS_TOKEN")
REFRESH_COOKIE_NAME = os.environ.get("REFRESH_COOKIE_NAME", "REFRESH_TOKEN")
SECURE_COOKIES = os.environ.get("SECURE_COOKIES", "false")

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
