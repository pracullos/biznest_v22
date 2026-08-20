import base64
import hashlib
import hmac
import json
import time


# ---------------------------------------------------------------------------
# JWT creation (custom HS256)
# ---------------------------------------------------------------------------

def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_json(obj: dict) -> str:
    return _b64url(json.dumps(obj, separators=(",", ":"), sort_keys=True).encode("utf-8"))


def _sign(data: bytes, key: str, algorithm: str) -> bytes:
    if algorithm.upper() != "HS256":
        raise ValueError("Unsupported algorithm")
    return hmac.new(key.encode("utf-8"), data, hashlib.sha256).digest()


def create_jwt(payload: dict, key: str, algorithm: str = "HS256") -> str:
    header_b64 = _b64url_json({"alg": algorithm, "typ": "JWT"})
    payload_b64 = _b64url_json(payload)
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    signature = _b64url(_sign(signing_input, key, algorithm))
    return f"{header_b64}.{payload_b64}.{signature}"


# ---------------------------------------------------------------------------
# Token minting (access token with user claims)
# ---------------------------------------------------------------------------

def mint_access_token(
    user,
    role_name: str | None = None,
    role_id: str | None = None,
    extra_claims: dict | None = None,
) -> str:
    from core.db import ACCESS_TOKEN_EXPIRE_SECONDS, ALGORITHM, SECRET_KEY
    now = int(time.time())
    payload: dict = {
        "sub":   str(user.id),
        "email": user.email,
        "iat":   now,
        "exp":   now + int(ACCESS_TOKEN_EXPIRE_SECONDS),
    }
    if role_name:
        payload["role"] = role_name
    if role_id:
        payload["role_id"] = role_id
    if extra_claims:
        payload.update(extra_claims)
    return create_jwt(payload, key=SECRET_KEY, algorithm=ALGORITHM)