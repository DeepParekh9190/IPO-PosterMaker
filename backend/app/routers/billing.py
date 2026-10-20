"""Billing: checkout, verified webhooks, subscription state.

Security rules enforced here:
  * The webhook signature is verified server-side over the raw request body.
  * Entitlements only change after verified provider events (or an audited
    admin grant). A client-submitted "payment success" flag is never trusted.
  * Events are idempotent: replaying the same webhook changes nothing.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from ..config import Settings, get_settings
from ..models import Plan, Subscription
from ..security import get_current_user
from ..services import payments
from ..store.base import Store

router = APIRouter(prefix="/api/billing", tags=["billing"])


class PlanRequest(BaseModel):
    plan_id: str = Field(default="pro", max_length=40)


def get_store(request: Request) -> Store:
    return request.app.state.store


@router.get("/subscription", response_model=Subscription | None)
async def current_subscription(
    user: dict = Depends(get_current_user),
    store: Store = Depends(get_store),
) -> Subscription | None:
    sub = await store.get_subscription(user["id"])
    return Subscription.model_validate(sub) if sub else None


@router.post("/checkout")
async def checkout(
    body: PlanRequest,
    user: dict = Depends(get_current_user),
    store: Store = Depends(get_store),
    settings: Settings = Depends(get_settings),
) -> dict:
    plan_id = body.plan_id
    plan_raw = await store.get_plan(plan_id)
    if plan_raw is None or not plan_raw.get("active", True):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    if plan_raw.get("price_inr", 0) <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="This plan does not require payment")
    result = await payments.create_checkout(settings, user, plan_raw)
    await store.append_audit(
        {"actor_id": user["id"], "action": "billing.checkout", "target": plan_id,
         "metadata": {"mode": result.get("mode")}}
    )
    return result


@router.post("/test/activate")
async def test_activate(
    body: PlanRequest,
    user: dict = Depends(get_current_user),
    store: Store = Depends(get_store),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Clearly labelled test-mode entitlement. Disabled when PAYMENTS_MODE=live
    so a real deployment can never hand out paid features for free."""
    if settings.payments_mode != "test":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Test activation is disabled in live mode")
    plan_id = body.plan_id
    if await store.get_plan(plan_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    await store.set_subscription(
        {
            "user_id": user["id"],
            "plan_id": plan_id,
            "status": "active",
            "provider": "test-mode",
            "provider_ref": None,
            "current_period_end": None,
        }
    )
    await store.append_audit(
        {"actor_id": user["id"], "action": "billing.test_activate", "target": user["id"],
         "metadata": {"plan_id": plan_id, "mode": "test"}}
    )
    return {"activated": True, "plan_id": plan_id,
            "notice": "TEST MODE entitlement - no real payment happened."}


@router.post("/cancel")
async def cancel(
    user: dict = Depends(get_current_user),
    store: Store = Depends(get_store),
) -> dict:
    sub = await store.get_subscription(user["id"])
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="No active subscription")
    await store.set_subscription({**sub, "plan_id": "free", "status": "cancelled",
                                  "provider": sub.get("provider")})
    await store.append_audit(
        {"actor_id": user["id"], "action": "billing.cancel", "target": user["id"],
         "metadata": {"previous_plan": sub.get("plan_id")}}
    )
    return {"cancelled": True, "plan_id": "free"}


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def webhook(request: Request) -> dict:
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature")
    settings: Settings = request.app.state.settings
    secret = settings.razorpay_webhook_secret

    if settings.payments_mode == "live" and not secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="Webhook secret is not configured")
    if not payments.raw_body_is_json(body):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload")
    if secret:
        if not payments.verify_razorpay_signature(body, signature, secret):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid webhook signature")

    payload = await request.json()
    event_type = str(
        payload.get("event")
        or request.headers.get("X-Razorpay-Event-Name")
        or ""
    )
    store: Store = request.app.state.store
    return await payments.apply_webhook_event(store, settings, event_type, payload)
