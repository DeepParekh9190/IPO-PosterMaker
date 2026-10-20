"""Public configuration + plans (needed by the login/pricing/poster pages)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from ..config import Settings, get_settings
from ..models import Plan
from ..services.entitlements import DEFAULT_SETTINGS, DEFAULT_TEMPLATES
from ..store.base import Store

router = APIRouter(prefix="/api", tags=["config"])


def get_store(request: Request) -> Store:
    return request.app.state.store


@router.get("/health")
async def health(request: Request, settings: Settings = Depends(get_settings)) -> dict:
    store: Store = request.app.state.store
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.version,
        "source_mode": settings.ipo_source_mode,
        "source_ready": settings.authorized_source_ready,
        "payments_mode": settings.payments_mode,
        "persistence": settings.persistence,
        "users": await store.count_users(),
    }


@router.get("/plans")
async def plans(store: Store = Depends(get_store)) -> list[Plan]:
    rows = await store.list_plans()
    if not rows:
        from ..services.entitlements import DEFAULT_PLANS

        return [Plan.model_validate(p) for p in DEFAULT_PLANS]
    return sorted((Plan.model_validate(r) for r in rows), key=lambda p: p.price_inr)


@router.get("/config")
async def public_config(
    settings: Settings = Depends(get_settings),
    store: Store = Depends(get_store),
) -> dict:
    """Everything the poster editor needs before/without logging in."""
    data = await store.get_settings_data() or dict(DEFAULT_SETTINGS)
    templates = [
        {
            "key": t["key"],
            "name": t["name"],
            "plan": t["plan"],
            "enabled": t.get("enabled", True),
            "is_default": t.get("is_default", False),
            "description": t.get("description", ""),
        }
        for t in data.get("templates", DEFAULT_TEMPLATES)
        if t.get("enabled", True)
    ]
    return {
        "app_name": data.get("app_name", settings.app_name),
        "support_email": data.get("support_email", ""),
        "source_mode": settings.ipo_source_mode,
        "demo_mode": not settings.authorized_source_ready,
        "default_language": data.get("default_language", "en"),
        "default_width": data.get("default_width", 1080),
        "default_height": data.get("default_height", 1080),
        "watermark_text": data.get("default_watermark_text",
                                   "Created with IPO Poster Studio"),
        "templates": templates,
        "payments_mode": settings.payments_mode,
        "maintenance_mode": data.get("maintenance_mode", False),
    }
