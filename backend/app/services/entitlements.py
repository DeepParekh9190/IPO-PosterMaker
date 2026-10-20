"""Entitlement resolution.

Every paid feature decision happens here, server-side. The client only ever
receives a signed, short-lived export token after this check - hiding a
watermark with CSS or trusting a localStorage flag is never enough.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status

from ..config import Settings
from ..models import Plan, PlanFeatures
from ..security import sign_token
from ..store.base import Store

DEFAULT_TEMPLATES = [
    {"key": "clean-white", "name": "Clean White Financial", "plan": "free",
     "enabled": True, "is_default": True,
     "description": "White background, green/red finance accents."},
    {"key": "premium-corporate", "name": "Premium Corporate", "plan": "pro",
     "enabled": True, "is_default": False,
     "description": "Deep navy with gold accents for premium brands."},
    {"key": "dark-market", "name": "Dark Market", "plan": "pro",
     "enabled": True, "is_default": False,
     "description": "Dark trading-terminal look with high contrast numbers."},
    {"key": "minimal-announcement", "name": "Minimal IPO Announcement", "plan": "free",
     "enabled": True, "is_default": False,
     "description": "Type-led minimal announcement card."},
    {"key": "gujarati-business", "name": "Gujarati Business Poster", "plan": "pro",
     "enabled": True, "is_default": False,
     "description": "Gujarati-friendly layout with bilingual date emphasis."},
]

DEFAULT_PLANS = [
    {
        "id": "free",
        "name": "Free",
        "price_inr": 0,
        "period": "month",
        "description": "Browse IPOs, copy messages and create watermarked posters.",
        "features": {
            "watermark_free": False,
            "daily_exports": 10,
            "premium_templates": False,
            "save_brand": False,
            "extras": {},
        },
        "active": True,
    },
    {
        "id": "pro",
        "name": "Pro",
        "price_inr": 499,
        "period": "month",
        "description": "Watermark-free exports, premium templates and brand saving.",
        "features": {
            "watermark_free": True,
            "daily_exports": 200,
            "premium_templates": True,
            "save_brand": True,
            "extras": {},
        },
        "active": True,
    },
]

DEFAULT_SETTINGS = {
    "app_name": "IPO Poster Studio",
    "support_email": "support@example.com",
    "refresh_interval_minutes": 30,
    "default_language": "en",
    "default_width": 1080,
    "default_height": 1080,
    "maintenance_mode": False,
    "default_watermark_text": "Created with IPO Poster Studio",
    "templates": DEFAULT_TEMPLATES,
}


def _features(raw: dict[str, Any] | None) -> PlanFeatures:
    return PlanFeatures.model_validate(raw or {})


async def ensure_defaults(store: Store, settings: Settings) -> None:
    for plan in DEFAULT_PLANS:
        if await store.get_plan(plan["id"]) is None:
            await store.upsert_plan(plan)
    data = await store.get_settings_data()
    if not data:
        await store.save_settings_data(dict(DEFAULT_SETTINGS))


async def resolve_plan(store: Store, user: dict[str, Any]) -> tuple[Plan, dict[str, Any] | None]:
    sub = await store.get_subscription(user["id"])
    plan_id = (sub or {}).get("plan_id") or "free"
    if sub and sub.get("status") not in {"active", "trialing"}:
        plan_id = "free"
    plan_raw = await store.get_plan(plan_id) or await store.get_plan("free")
    if plan_raw is None:
        plan_raw = DEFAULT_PLANS[0]
        await store.upsert_plan(plan_raw)
    plan = Plan.model_validate(plan_raw)
    return plan, sub


async def usage_today(store: Store, user_id: str) -> dict[str, Any]:
    key = "exports:" + datetime.now(timezone.utc).strftime("%Y-%m-%d")
    used = await store.get_usage(user_id, key)
    return {"key": key, "exports_today": used}


async def authorize_export(
    store: Store,
    settings: Settings,
    user: dict[str, Any],
    template_key: str,
    width: int,
    height: int,
) -> dict[str, Any]:
    plan, _sub = await resolve_plan(store, user)
    features = plan.features

    data = await store.get_settings_data() or dict(DEFAULT_SETTINGS)
    templates = {t["key"]: t for t in data.get("templates", DEFAULT_TEMPLATES)}
    template = templates.get(template_key)
    if template is None or not template.get("enabled", True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This template is not available. Pick another one.",
        )
    if template.get("plan") == "pro" and not features.premium_templates:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="This template is available on the paid plan.",
        )

    key = "exports:" + datetime.now(timezone.utc).strftime("%Y-%m-%d")
    used = await store.get_usage(user["id"], key)
    if used >= features.daily_exports:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Daily export limit reached ({features.daily_exports}). "
                "Upgrade for a higher limit."
            ),
        )

    await store.incr_usage(user["id"], key)

    watermark = not features.watermark_free
    watermark_text = str(data.get("default_watermark_text", "Created with IPO Poster Studio"))
    expires_at = int(datetime.now(timezone.utc).timestamp()) + settings.export_token_ttl_seconds
    token = sign_token(
        {
            "typ": "export",
            "sub": user["id"],
            "plan": plan.id,
            "wm": watermark,
            "wm_text": watermark_text,
            "tpl": template_key,
            "w": width,
            "h": height,
        },
        settings.export_token_ttl_seconds,
        settings.secret_key,
    )
    return {
        "token": token,
        "watermark": watermark,
        "watermark_text": watermark_text if watermark else "",
        "template_key": template_key,
        "width": width,
        "height": height,
        "expires_at": expires_at,
        "plan_id": plan.id,
    }
