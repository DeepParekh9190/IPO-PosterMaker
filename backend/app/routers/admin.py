"""Admin API. Every route requires an authenticated user with role=admin,
verified server-side; the frontend guard is convenience, not security."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from ..config import Settings, get_settings
from ..models import (
    AdminIpoCreate,
    AdminIpoPatch,
    AdminMetrics,
    AdminUserPatch,
    AppSettingsOut,
    AppSettingsPatch,
    EntitlementGrant,
    IpoListMeta,
    IpoRecord,
    Plan,
    PlanUpsert,
    TemplateConfig,
)
from ..security import require_admin
from ..services import metrics as metrics_service
from ..services.entitlements import DEFAULT_SETTINGS, DEFAULT_TEMPLATES, ensure_defaults
from ..services.ipo_service import IpoService
from ..store.base import Store

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def get_store(request: Request) -> Store:
    return request.app.state.store


def get_service(request: Request) -> IpoService:
    return request.app.state.ipo_service


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:48] or "ipo"


# --------------------------------------------------------------------------
# Overview
# --------------------------------------------------------------------------
@router.get("/metrics", response_model=AdminMetrics)
async def metrics(
    store: Store = Depends(get_store),
    service: IpoService = Depends(get_service),
    settings: Settings = Depends(get_settings),
) -> AdminMetrics:
    users = await store.list_users(limit=1000)
    subs = [await store.get_subscription(u["id"]) for u in users]
    active_paid = sum(
        1
        for u, s in zip(users, subs)
        if s and s.get("status") == "active" and s.get("plan_id") not in (None, "free")
        and u.get("status") == "active"
    )
    suspended = sum(1 for u in users if u.get("status") != "active")

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    audit = await store.list_audit(limit=1000)
    exports = [e for e in audit if e.get("action") == "poster.export_authorized"]
    events = await store.list_payment_events(limit=50)

    snap = await service.snapshot()
    return AdminMetrics(
        total_users=len(users),
        active_subscribers=active_paid,
        free_users=max(0, len(users) - active_paid - suspended),
        suspended_users=suspended,
        poster_exports_today=sum(1 for e in exports if str(e.get("at", "")).startswith(today)),
        poster_exports_total=len(exports),
        recent_errors=metrics_service.recent_errors(10),
        source_health={
            "provider": snap.provider,
            "demo_mode": snap.demo_mode,
            "stale": snap.stale,
            "last_updated": snap.last_updated,
            "error": snap.error,
            "records": len(snap.records),
            "configured_mode": settings.ipo_source_mode,
            "source_ready": settings.authorized_source_ready,
        },
        last_successful_refresh=service.last_successful_refresh or snap.last_updated,
        payments_mode=settings.payments_mode,
        persistence=settings.persistence,
    )


# --------------------------------------------------------------------------
# Users
# --------------------------------------------------------------------------
@router.get("/users")
async def list_users(
    q: str = Query(default="", max_length=80),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    store: Store = Depends(get_store),
) -> dict[str, Any]:
    rows = await store.list_users(q=q, limit=limit, offset=offset)
    items = []
    for user in rows:
        sub = await store.get_subscription(user["id"])
        usage = await store.get_usage(user["id"], "exports:" + datetime.now(timezone.utc).strftime("%Y-%m-%d"))
        items.append(
            {
                "id": user["id"],
                "email": user["email"],
                "role": user.get("role", "client"),
                "status": user.get("status", "active"),
                "business_name": user.get("business_name"),
                "created_at": user.get("created_at"),
                "subscription": sub,
                "exports_today": usage,
                "password_hash": None,  # never expose credentials
            }
        )
    return {"items": items, "total": await store.count_users()}


@router.patch("/users/{user_id}")
async def patch_user(
    user_id: str,
    payload: AdminUserPatch,
    admin: dict = Depends(require_admin),
    store: Store = Depends(get_store),
) -> dict[str, Any]:
    user = await store.get_user(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    fields: dict[str, Any] = {}
    changes: dict[str, Any] = {}
    if payload.status and payload.status != user.get("status"):
        fields["status"] = payload.status
        changes["status"] = payload.status
    if payload.role and payload.role != user.get("role"):
        fields["role"] = payload.role
        changes["role"] = payload.role
    if payload.plan_id:
        plan = await store.get_plan(payload.plan_id)
        if plan is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
        await store.set_subscription(
            {
                "user_id": user_id,
                "plan_id": payload.plan_id,
                "status": "active" if payload.plan_id != "free" else "cancelled",
                "provider": "admin-granted",
                "provider_ref": None,
                "current_period_end": None,
            }
        )
        changes["plan_id"] = payload.plan_id
    if not fields and not changes:
        return {"user": user, "changed": False}

    updated = await store.update_user(user_id, **fields) if fields else user
    await store.append_audit(
        {
            "actor_id": admin["id"],
            "action": "admin.user_update",
            "target": user_id,
            "metadata": {"changes": changes, "reason": payload.reason},
        }
    )
    if updated:
        updated.pop("password_hash", None)
    return {"user": updated, "changed": True, "changes": changes}


# --------------------------------------------------------------------------
# IPO management
# --------------------------------------------------------------------------
@router.get("/ipos")
async def admin_ipos(
    service: IpoService = Depends(get_service),
) -> dict[str, Any]:
    snap = await service.snapshot()
    return {
        "items": [r.model_dump() for r in snap.records],
        "meta": IpoListMeta(
            last_updated=snap.last_updated,
            stale=snap.stale,
            provider=snap.provider,
            demo_mode=snap.demo_mode,
            source_error=snap.error,
            total=len(snap.records),
        ),
    }


@router.post("/ipos/refresh")
async def refresh_ipos(
    admin: dict = Depends(require_admin),
    service: IpoService = Depends(get_service),
    store: Store = Depends(get_store),
) -> dict[str, Any]:
    snap = await service.snapshot(force=True)
    await store.append_audit(
        {
            "actor_id": admin["id"],
            "action": "admin.ipo_refresh",
            "target": snap.provider,
            "metadata": {"records": len(snap.records), "error": snap.error},
        }
    )
    return {
        "provider": snap.provider,
        "records": len(snap.records),
        "last_updated": snap.last_updated,
        "error": snap.error,
        "demo_mode": snap.demo_mode,
    }


@router.post("/ipos", response_model=IpoRecord, status_code=status.HTTP_201_CREATED)
async def create_ipo(
    payload: AdminIpoCreate,
    admin: dict = Depends(require_admin),
    store: Store = Depends(get_store),
) -> IpoRecord:
    data = payload.model_dump()
    record = IpoRecord.model_validate(
        {
            **data,
            "id": f"manual-{_slug(payload.company_name)}",
            "manual": True,
            "verified": True,
            "source_name": "Admin entered",
            "source_url": payload.source_url,
        }
    )
    existing = await store.list_ipo_overrides()
    if any(r.get("id") == record.id for r in existing):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An IPO with this ID already exists. Edit it instead.",
        )
    await store.set_ipo_override(record.id, record.model_dump(mode="json"))
    await store.append_audit(
        {"actor_id": admin["id"], "action": "admin.ipo_create", "target": record.id,
         "metadata": {"company": record.company_name}}
    )
    return record


@router.patch("/ipos/{ipo_id}", response_model=IpoRecord)
async def patch_ipo(
    ipo_id: str,
    payload: AdminIpoPatch,
    admin: dict = Depends(require_admin),
    store: Store = Depends(get_store),
    service: IpoService = Depends(get_service),
) -> IpoRecord:
    current = await service.get_record(ipo_id)
    if current is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="IPO not found")

    base = current.model_dump(mode="json")
    patch = payload.model_dump(exclude_unset=True, exclude={"clear_fields", "reason"})
    for field in payload.clear_fields:
        if field in base:
            base[field] = None
    for key, value in patch.items():
        if value is not None:
            base[key] = value
    base["manual"] = True
    base["updated_at"] = datetime.now(timezone.utc).isoformat()
    base["source_name"] = current.source_name
    try:
        record = IpoRecord.model_validate(base)
    except Exception as exc:  # pydantic ValidationError
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=str(exc)) from exc

    await store.set_ipo_override(record.id, record.model_dump(mode="json"))
    await store.append_audit(
        {"actor_id": admin["id"], "action": "admin.ipo_update", "target": record.id,
         "metadata": {"fields": list(patch) + payload.clear_fields,
                      "reason": payload.reason}}
    )
    return record


# --------------------------------------------------------------------------
# Plans, templates, settings
# --------------------------------------------------------------------------
@router.get("/plans")
async def admin_plans(
    store: Store = Depends(get_store),
    settings: Settings = Depends(get_settings),
) -> list[Plan]:
    await ensure_defaults(store, settings)
    return [Plan.model_validate(p) for p in await store.list_plans()]


@router.put("/plans/{plan_id}")
async def put_plan(
    plan_id: str,
    payload: PlanUpsert,
    admin: dict = Depends(require_admin),
    store: Store = Depends(get_store),
) -> Plan:
    plan = await store.get_plan(plan_id)
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    updated = {**plan, **payload.model_dump(exclude_none=True)}
    saved = await store.upsert_plan(updated)
    await store.append_audit(
        {"actor_id": admin["id"], "action": "admin.plan_update", "target": plan_id,
         "metadata": {"fields": list(payload.model_dump(exclude_none=True))}}
    )
    return Plan.model_validate(saved)


@router.get("/templates")
async def admin_templates(
    store: Store = Depends(get_store),
) -> list[TemplateConfig]:
    data = await store.get_settings_data() or dict(DEFAULT_SETTINGS)
    rows = data.get("templates", DEFAULT_TEMPLATES)
    return [TemplateConfig.model_validate(t) for t in rows]


@router.put("/templates/{template_key}")
async def put_template(
    template_key: str,
    payload: TemplateConfig,
    admin: dict = Depends(require_admin),
    store: Store = Depends(get_store),
) -> TemplateConfig:
    data = await store.get_settings_data() or dict(DEFAULT_SETTINGS)
    rows = list(data.get("templates", DEFAULT_TEMPLATES))
    index = next((i for i, t in enumerate(rows) if t["key"] == template_key), None)
    if index is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    replacement = payload.model_dump()
    replacement["key"] = template_key
    if replacement.get("is_default"):
        for i, t in enumerate(rows):  # only one default allowed
            rows[i] = {**t, "is_default": False}
        index = next(i for i, t in enumerate(rows) if t["key"] == template_key)
    rows[index] = replacement
    data["templates"] = rows
    await store.save_settings_data(data)
    await store.append_audit(
        {"actor_id": admin["id"], "action": "admin.template_update", "target": template_key,
         "metadata": {"plan": replacement["plan"], "enabled": replacement["enabled"]}}
    )
    return TemplateConfig.model_validate(replacement)


@router.get("/settings", response_model=AppSettingsOut)
async def get_admin_settings(
    store: Store = Depends(get_store),
    settings: Settings = Depends(get_settings),
) -> AppSettingsOut:
    data = await store.get_settings_data() or dict(DEFAULT_SETTINGS)
    return AppSettingsOut(
        app_name=data.get("app_name", settings.app_name),
        support_email=data.get("support_email", ""),
        source_mode=settings.ipo_source_mode,
        source_name="Authorized source" if settings.authorized_source_ready else "Demo data",
        refresh_interval_minutes=data.get("refresh_interval_minutes", 30),
        default_language=data.get("default_language", "en"),
        default_width=data.get("default_width", 1080),
        default_height=data.get("default_height", 1080),
        maintenance_mode=data.get("maintenance_mode", False),
        default_watermark_text=data.get("default_watermark_text",
                                        "Created with IPO Poster Studio"),
    )


@router.put("/settings", response_model=AppSettingsOut)
async def put_admin_settings(
    payload: AppSettingsPatch,
    admin: dict = Depends(require_admin),
    store: Store = Depends(get_store),
    settings: Settings = Depends(get_settings),
) -> AppSettingsOut:
    data = await store.get_settings_data() or dict(DEFAULT_SETTINGS)
    data.update(payload.model_dump(exclude_none=True))
    data.setdefault("templates", DEFAULT_TEMPLATES)
    await store.save_settings_data(data)
    await store.append_audit(
        {"actor_id": admin["id"], "action": "admin.settings_update", "target": "app",
         "metadata": {"fields": list(payload.model_dump(exclude_none=True))}}
    )
    return await get_admin_settings(store, settings)


# --------------------------------------------------------------------------
# Audit, payments, entitlements
# --------------------------------------------------------------------------
@router.get("/audit")
async def admin_audit(
    limit: int = Query(default=100, ge=1, le=500),
    store: Store = Depends(get_store),
) -> list[dict[str, Any]]:
    return await store.list_audit(limit=limit)


@router.get("/payments")
async def admin_payments(store: Store = Depends(get_store)) -> list[dict[str, Any]]:
    return await store.list_payment_events(limit=100)


@router.post("/entitlements")
async def grant_entitlement(
    payload: EntitlementGrant,
    admin: dict = Depends(require_admin),
    store: Store = Depends(get_store),
) -> dict[str, Any]:
    user = await store.get_user(payload.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    plan = await store.get_plan(payload.plan_id)
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    await store.set_subscription(
        {
            "user_id": payload.user_id,
            "plan_id": payload.plan_id,
            "status": "active" if payload.plan_id != "free" else "cancelled",
            "provider": "manual-grant",
            "provider_ref": None,
            "current_period_end": None,
        }
    )
    await store.append_audit(
        {"actor_id": admin["id"], "action": "admin.entitlement_grant",
         "target": payload.user_id,
         "metadata": {"plan_id": payload.plan_id, "reason": payload.reason}}
    )
    return {"granted": True, "user_id": payload.user_id, "plan_id": payload.plan_id}
