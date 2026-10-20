"""FastAPI application factory and middleware stack."""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import Settings, get_settings
from .ratelimit import RateLimiter
from .security import hash_password
from .services import metrics as metrics_service
from .services.entitlements import ensure_defaults
from .services.ipo_service import IpoService
from .store import build_store
from .store.base import Store

logger = logging.getLogger("app")

# (path prefixes, limit, window seconds)
RATE_RULES: list[tuple[tuple[str, ...], int, int]] = [
    (("/api/auth/login", "/api/auth/register"), 10, 60),
    (("/api/admin/ipos/refresh",), 10, 60),
    (("/api/posters/authorize-export",), 60, 60),
    (("/api/billing/",), 20, 60),
    (("/api/auth/",), 30, 60),
]
DEFAULT_RATE = (300, 60)

MAINTENANCE_ALLOWLIST = ("/api/health", "/api/auth/login", "/api/auth/logout",
                         "/api/config", "/api/admin/")


def create_app(
    settings: Settings | None = None,
    store: Store | None = None,
) -> FastAPI:
    settings = settings or get_settings()

    # State is initialised here so middleware and dependencies behave even if a
    # client never triggers the lifespan (import-only usage).
    fastapi_store = store or build_store(settings)
    app = FastAPI(
        title=settings.app_name,
        version=settings.version,
        description=(
            "IPO poster and messaging API. Demo mode uses sample data; see "
            "docs/DATA_SOURCE.md for the data-source compliance position."
        ),
    )
    app.state.settings = settings
    app.state.store = fastapi_store
    app.state.ipo_service = IpoService(settings, fastapi_store)
    app.state.rate_limiter = RateLimiter()
    app.state.seeded = False
    # Every `Depends(get_settings)` resolves to THIS app's settings, so a
    # second app in the same process (tests) can never read another app's config.
    app.dependency_overrides[get_settings] = lambda: settings

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await ensure_defaults(app.state.store, settings)
        await _seed_admin(app.state.store, settings)
        app.state.seeded = True
        yield
        close = getattr(app.state.store, "aclose", None)
        if close:
            await close()

    app.router.lifespan_context = lifespan

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["Retry-After", "X-RateLimit-Remaining"],
    )

    @app.middleware("http")
    async def guard(request: Request, call_next):
        started = time.perf_counter()
        path = request.url.path

        # Request size limit (trust boundary).
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > settings.max_body_bytes:
            return JSONResponse(
                {"detail": "Request too large"}, status_code=413
            )

        # Maintenance mode (health, login, config and the admin API stay reachable).
        if path.startswith("/api") and not path.startswith(MAINTENANCE_ALLOWLIST):
            if await _maintenance_on(request):
                return JSONResponse(
                    {"detail": "Maintenance mode is on. Please try again later."},
                    status_code=503,
                )

        # Rate limiting per class.
        allowed, retry_after = _rate_check(request)
        if not allowed:
            return JSONResponse(
                {"detail": "Too many requests. Please slow down."},
                status_code=429,
                headers={"Retry-After": str(retry_after)},
            )

        try:
            response = await call_next(request)
        except Exception as exc:  # unexpected - record and return a clean 500
            logger.exception("Unhandled error on %s", path)
            metrics_service.record_error(path, f"{type(exc).__name__}: {exc}", 500)
            return JSONResponse({"detail": "Internal server error"}, status_code=500)

        if response.status_code >= 500:
            metrics_service.record_error(path, path, response.status_code)
        response.headers["X-Response-Time-ms"] = str(
            int((time.perf_counter() - started) * 1000)
        )
        return response

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        if exc.status_code >= 500:
            metrics_service.record_error(request.url.path, str(exc.detail), exc.status_code)
        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        detail = _first_error(exc)
        return JSONResponse({"detail": detail}, status_code=422)

    _register_routes(app)
    return app


def _register_routes(app: FastAPI) -> None:
    from .routers import account, admin, auth, billing, config, ipos, posters

    app.include_router(config.router)
    app.include_router(auth.router)
    app.include_router(ipos.router)
    app.include_router(account.router)
    app.include_router(billing.router)
    app.include_router(posters.router)
    app.include_router(admin.router)


async def _seed_admin(store: Store, settings: Settings) -> None:
    existing = await store.get_user_by_email(settings.admin_email.lower())
    if existing:
        if existing.get("role") != "admin":
            await store.update_user(existing["id"], role="admin")
        return
    user = await store.create_user(
        {
            "id": "u_admin_seed",
            "email": settings.admin_email.lower(),
            "password_hash": hash_password(settings.admin_password),
            "role": "admin",
            "status": "active",
            "business_name": "Administrator",
        }
    )
    await store.append_audit(
        {"actor_id": "system", "action": "system.admin_seeded", "target": user["id"],
         "metadata": {}}
    )


def _rate_check(request: Request) -> tuple[bool, int]:
    limiter: RateLimiter = request.app.state.rate_limiter
    path = request.url.path
    for prefixes, limit, window in RATE_RULES:
        if any(path.startswith(p) for p in prefixes):
            return limiter.check(f"{prefixes[0]}:{request.client.host if request.client else 'anon'}",
                                 limit, window)
    limit, window = DEFAULT_RATE
    return limiter.check(f"default:{request.client.host if request.client else 'anon'}",
                         limit, window)


async def _maintenance_on(request: Request) -> bool:
    """Read straight from the store so toggling takes effect immediately.
    shortcut: one read per /api request; switch to a short in-process cache if
    PERSISTENCE=supabase latency ever matters."""
    try:
        data = await request.app.state.store.get_settings_data() or {}
        return bool(data.get("maintenance_mode", False))
    except Exception:  # pragma: no cover - never block the request on this
        return False


def _first_error(exc: RequestValidationError) -> str:
    errors = exc.errors()
    if not errors:
        return "Invalid request"
    first = errors[0]
    location = ".".join(str(p) for p in first.get("loc", []) if p != "body")
    message = first.get("msg", "Invalid value")
    return f"{location}: {message}" if location else message


app = create_app()
