"""Application configuration loaded from environment variables.

No secret has a real default. Secrets are read at runtime and never committed.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return value.strip()


def _bool(name: str, default: bool = False) -> bool:
    raw = _env(name)
    if raw is None:
        return default
    return raw.lower() in {"1", "true", "yes", "on"}


def _float(name: str, default: float) -> float:
    raw = _env(name)
    try:
        return float(raw) if raw is not None else default
    except ValueError:
        return default


def _int(name: str, default: int) -> int:
    raw = _env(name)
    try:
        return int(raw) if raw is not None else default
    except ValueError:
        return default


@dataclass
class Settings:
    app_name: str = "IPO Poster Studio"
    env: str = "development"
    version: str = "0.1.0"
    secret_key: str = "dev-insecure-secret-change-me"
    cors_origins: list[str] = field(default_factory=lambda: ["http://localhost:3000"])
    max_body_bytes: int = 1_000_000
    session_ttl_seconds: int = 60 * 60 * 24 * 7
    export_token_ttl_seconds: int = 60 * 5

    # Auth
    admin_email: str = "admin@example.com"
    admin_password: str = "admin12345"
    allow_register: bool = True

    # IPO data source
    ipo_source_mode: str = "demo"  # demo | authorized | ipopremium
    ipo_local_dir: str = "data/ipo_cache"
    ipo_source_url: str | None = None
    ipo_source_api_key: str | None = None
    ipo_source_written_permission: bool = False
    source_timeout_seconds: float = 8.0
    source_max_retries: int = 2
    source_cache_ttl_seconds: int = 300
    stale_after_minutes: int = 90

    # Persistence
    persistence: str = "memory"  # memory | supabase
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None

    # Payments
    payments_mode: str = "test"  # test | live
    razorpay_key_id: str | None = None
    razorpay_key_secret: str | None = None
    razorpay_webhook_secret: str | None = None

    @property
    def is_production(self) -> bool:
        return self.env.lower() in {"production", "prod"}

    @property
    def authorized_source_ready(self) -> bool:
        """Automated access to an external source is only enabled with
        written permission AND credentials. This is a compliance gate."""
        return bool(
            self.ipo_source_mode == "authorized"
            and self.ipo_source_url
            and self.ipo_source_api_key
            and self.ipo_source_written_permission
        )


def load_settings() -> Settings:
    origins = _env("CORS_ORIGINS", "http://localhost:3000") or ""
    cors = [o.strip() for o in origins.split(",") if o.strip()]
    secret = _env("SECRET_KEY")
    if secret is None:
        secret = "dev-insecure-secret-change-me"
    return Settings(
        app_name=_env("APP_NAME", "IPO Poster Studio") or "IPO Poster Studio",
        env=_env("APP_ENV", "development") or "development",
        version=_env("APP_VERSION", "0.1.0") or "0.1.0",
        secret_key=secret,
        cors_origins=cors or ["http://localhost:3000"],
        max_body_bytes=_int("MAX_BODY_BYTES", 1_000_000),
        session_ttl_seconds=_int("SESSION_TTL_SECONDS", 60 * 60 * 24 * 7),
        export_token_ttl_seconds=_int("EXPORT_TOKEN_TTL_SECONDS", 300),
        admin_email=_env("ADMIN_EMAIL", "admin@example.com") or "admin@example.com",
        admin_password=_env("ADMIN_PASSWORD", "admin12345") or "admin12345",
        allow_register=_bool("AUTH_ALLOW_REGISTER", True),
        ipo_source_mode=(_env("IPO_SOURCE_MODE", "demo") or "demo").lower(),
        ipo_local_dir=_env("IPO_LOCAL_DIR", "data/ipo_cache") or "data/ipo_cache",
        ipo_source_url=_env("IPO_SOURCE_URL"),
        ipo_source_api_key=_env("IPO_SOURCE_API_KEY"),
        ipo_source_written_permission=_bool("IPO_SOURCE_WRITTEN_PERMISSION", False),
        source_timeout_seconds=_float("IPO_SOURCE_TIMEOUT_SECONDS", 8.0),
        source_max_retries=_int("IPO_SOURCE_MAX_RETRIES", 2),
        source_cache_ttl_seconds=_int("IPO_SOURCE_CACHE_TTL_SECONDS", 300),
        stale_after_minutes=_int("STALE_AFTER_MINUTES", 90),
        persistence=(_env("PERSISTENCE", "memory") or "memory").lower(),
        supabase_url=_env("SUPABASE_URL"),
        supabase_service_role_key=_env("SUPABASE_SERVICE_ROLE_KEY"),
        payments_mode=(_env("PAYMENTS_MODE", "test") or "test").lower(),
        razorpay_key_id=_env("RAZORPAY_KEY_ID"),
        razorpay_key_secret=_env("RAZORPAY_KEY_SECRET"),
        razorpay_webhook_secret=_env("RAZORPAY_WEBHOOK_SECRET"),
    )


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = load_settings()
    return _settings


def reset_settings_cache() -> None:
    """Testing helper: force config reload on next access."""
    global _settings
    _settings = None
