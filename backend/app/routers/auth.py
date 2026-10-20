"""Auth endpoints: register, login, logout.

Sessions are HMAC-signed tokens delivered as an httpOnly cookie (plus a bearer
token for API/test clients). Passwords are hashed with PBKDF2-HMAC-SHA256.
"""

from __future__ import annotations

import secrets
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from ..config import Settings, get_settings
from ..models import AuthResponse, LoginRequest, RegisterRequest, UserOut
from ..security import (
    SESSION_COOKIE,
    hash_password,
    sign_token,
    verify_password,
)
from ..store.base import Store
from ..services.entitlements import resolve_plan

router = APIRouter(prefix="/api/auth", tags=["auth"])


def get_store(request: Request) -> Store:
    return request.app.state.store


def _user_out(user: dict[str, Any]) -> UserOut:
    return UserOut(
        id=user["id"],
        email=user["email"],
        role=user.get("role", "client"),
        status=user.get("status", "active"),
        business_name=user.get("business_name"),
        created_at=user["created_at"],
    )


def _issue_cookie(response: Response, token: str, settings: Settings) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.is_production,
        max_age=settings.session_ttl_seconds,
        path="/",
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    store: Store = Depends(get_store),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    if not settings.allow_register:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Self-registration is disabled")
    email = payload.email.lower()
    if await store.get_user_by_email(email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="An account with this email already exists")
    user = await store.create_user(
        {
            "id": f"u_{secrets.token_hex(8)}",
            "email": email,
            "password_hash": hash_password(payload.password),
            "role": "client",
            "status": "active",
            "business_name": (payload.business_name or "").strip() or None,
        }
    )
    await store.append_audit(
        {"actor_id": user["id"], "action": "auth.register", "target": user["id"],
         "metadata": {"email": email}}
    )
    return _login_response(user, response, settings)


@router.post("/login", response_model=AuthResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    store: Store = Depends(get_store),
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    user = await store.get_user_by_email(payload.email.lower())
    # Constant-ish behaviour: same error for unknown email and bad password.
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid email or password")
    if user.get("status") != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="This account is suspended. Contact support.")
    await store.append_audit(
        {"actor_id": user["id"], "action": "auth.login", "target": user["id"],
         "metadata": {}}
    )
    return _login_response(user, response, settings)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> Response:
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


def _login_response(user: dict[str, Any], response: Response,
                    settings: Settings) -> AuthResponse:
    token = sign_token(
        {"typ": "session", "sub": user["id"], "role": user.get("role", "client")},
        settings.session_ttl_seconds,
        settings.secret_key,
    )
    _issue_cookie(response, token, settings)
    return AuthResponse(user=_user_out(user), token=token,
                        expires_in=settings.session_ttl_seconds)
