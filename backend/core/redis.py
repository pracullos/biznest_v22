import os

import redis
from fastapi import Request

_pool = redis.ConnectionPool(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", 6381)),
    db=int(os.getenv("REDIS_DB", 0)),
    decode_responses=True,
    max_connections=20,
)


def get_redis_client() -> redis.Redis:
    """Return a Redis instance backed by the shared connection pool."""
    return redis.Redis(connection_pool=_pool)


def get_redis(request: Request) -> redis.Redis:
    """FastAPI dependency — injects Redis from app.state (set during lifespan)."""
    return request.app.state.redis