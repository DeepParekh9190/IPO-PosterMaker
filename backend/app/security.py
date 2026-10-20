"""Password hashing, signed tokens and FastAPI auth dependencies.

Tokens are compact HMAC-SHA256 signed payloads (JWT-like) so the MVP needs no
extra dependency and no database session table. Tokens are only ever issued
server-side; entitlement decisions are always made on the server.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any

from fastapi import Cookie, Depends, Header, HTTPException, Request, status

from .config import Settings, get_settings

SESSION_COOKIE = "ipo_session"
PBKDF2_ITERATIONS = 240_000


# --------------------------------------------------------------------------
# Passwords
# --------------------------------------------------------------------------
def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _scheme, iterations, salt_hex, digest_hex = stored.split("$")
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
    except (ValueError, AttributeError):
        return False
    candidate = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt, int(iterations)
    )
    return hmac.compare_digest(candidate, expected)


# --------------------------------------------------------------------------
# Signed tokens
# --------------------------------------------------------------------------
def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _b64d(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def sign_token(payload: dict[str, Any], ttl_seconds: int, secret: str) -> str:
    body = dict(payload)
    body["iat"] = int(time.time())
    body["exp"] = int(time.time()) + ttl_seconds
    raw = json.dumps(body, separators=(",", ":"), sort_keys=True).encode()
    signature = hmac.new(secret.encode(), raw, hashlib.sha256).digest()
    return f"{_b64e(raw)}.{_b64e(signature)}"


def verify_token(
    token: str, secret: str, expected_type: str | None = None
) -> dict[str, Any] | None:
    try:
        raw_part, sig_part = token.split(".", 1)
        raw = _b64d(raw_part)
        signature = _b64d(sig_part)
    except (ValueError, TypeError):
        return None
    expected_sig = hmac.new(secret.encode(), raw, hashlib.sha256).digest()
    if not hmac.compare_digest(signature, expected_sig):
        return None
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, dict):
        return None
    if int(payload.get("exp", 0)) < time.time():
        return None
    if expected_type and payload.get("typ") != expected_type:
        return None
    return payload


# --------------------------------------------------------------------------
# FastAPI dependencies
# --------------------------------------------------------------------------
def _extract_token(request: Request, authorization: str | None) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    cookie_value = request.cookies.get(SESSION_COOKIE)
    return cookie_value


async def get_current_user(
    request: Request,
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    token = _extract_token(request, authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    payload = verify_token(token, settings.secret_key, expected_type="session")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session"
        )
    store = request.app.state.store
    user = await store.get_user(payload.get("sub", ""))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Account not found"
        )
    if user.get("status") != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active"
        )
    return user


async def get_optional_user(
    request: Request,
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any] | None:
    try:
        return await get_current_user(request, authorization, settings)
    except HTTPException:
        return None


async def require_admin(
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )
    return user


async def get_csrf_placeholder() -> None:  # pragma: no cover - documentation hook
    """SameSite=Lax cookies plus same-origin CORS are used for CSRF defence.
    A dedicated CSRF token flow can be added when cross-site embedding is needed."""
    return None
