"""Authenticated 'me' endpoints: profile, entitlements, brand profile, privacy."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status

from ..models import (
    BrandProfile,
    MeResponse,
    Subscription,
    UserOut,
)
from ..security import get_current_user, hash_password
from ..services.entitlements import resolve_plan, usage_today
from ..store.base import Store

router = APIRouter(prefix="/api", tags=["account"])


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


@router.get("/me", response_model=MeResponse)
async def me(
    request: Request,
    user: dict = Depends(get_current_user),
    store: Store = Depends(get_store),
) -> MeResponse:
    plan, sub = await resolve_plan(store, user)
    return MeResponse(
        user=_user_out(user),
        plan=plan,
        entitlements=plan.features,
        usage=await usage_today(store, user["id"]),
        subscription=Subscription.model_validate(sub) if sub else None,
    )


@router.get("/brand", response_model=BrandProfile)
async def get_brand(
    user: dict = Depends(get_current_user),
    store: Store = Depends(get_store),
) -> BrandProfile:
    brand = await store.get_brand(user["id"])
    return BrandProfile.model_validate(brand or {})


@router.put("/brand", response_model=BrandProfile)
async def put_brand(
    payload: BrandProfile,
    user: dict = Depends(get_current_user),
    store: Store = Depends(get_store),
) -> BrandProfile:
    plan, _ = await resolve_plan(store, user)
    if not plan.features.save_brand:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Saving brand preferences to your account is a paid feature. "
                   "On the free plan your logo stays on this device only.",
        )
    saved = await store.set_brand(user["id"], payload.model_dump())
    return BrandProfile.model_validate(saved)


@router.get("/privacy")
async def privacy_notice() -> dict[str, Any]:
    return {
        "collected": ["email", "business name (optional)", "poster/logo settings you upload"],
        "not_collected": ["PAN", "bank account", "UPI", "demat details"],
        "retention": "Account data is kept while your account exists. "
                     "You can delete it yourself from Settings > Privacy.",
        "deletion": "DELETE /api/me anonymises your account immediately.",
        "third_parties": ["Payment provider (only in live mode)", "Managed database (production mode)"],
    }


@router.delete("/me")
async def delete_me(
    user: dict = Depends(get_current_user),
    store: Store = Depends(get_store),
) -> dict[str, Any]:
    """Data deletion workflow: anonymise, do not leave personal data behind."""
    if user.get("role") == "admin":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Admin accounts cannot self-delete. Transfer or "
                                   "disable them from the admin panel instead.")
    anon_email = f"deleted+{user['id'][:10]}@removed.invalid"
    await store.update_user(
        user["id"],
        email=anon_email,
        status="deleted",
        business_name=None,
        password_hash=hash_password(f"deleted-{user['id']}-{datetime.now(timezone.utc).timestamp()}"),
    )
    if await store.get_brand(user["id"]):
        await store.set_brand(user["id"], BrandProfile().model_dump())
    await store.append_audit(
        {"actor_id": user["id"], "action": "account.self_delete", "target": user["id"],
         "metadata": {}}
    )
    return {"deleted": True, "message": "Your personal data has been removed."}
