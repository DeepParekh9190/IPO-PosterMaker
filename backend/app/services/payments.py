"""Payments (Razorpay) scaffolding.

Modes:
  * test (default) - no live credentials. Checkout is clearly labelled test
    mode; activation happens through an admin grant or the explicit
    POST /api/billing/test/activate endpoint. A real successful payment is
    never simulated in production (PAYMENTS_MODE=live).
  * live           - server calls Razorpay's REST API with key/secret to create
    an order or subscription; the webhook handler verifies the HMAC signature
    server-side before any entitlement changes.

Never stored: card details, UPI credentials, client-claimed "payment success".
"""

from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any

import httpx
from fastapi import HTTPException, status

from ..config import Settings
from ..store.base import Store


def verify_razorpay_signature(body: bytes, signature: str | None, secret: str) -> bool:
    if not signature or not secret:
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


async def create_checkout(
    settings: Settings, user: dict[str, Any], plan: dict[str, Any]
) -> dict[str, Any]:
    live = (
        settings.payments_mode == "live"
        and settings.razorpay_key_id
        and settings.razorpay_key_secret
    )
    if not live:
        return {
            "mode": "test",
            "notice": (
                "TEST MODE - payment gateway credentials are not configured. "
                "No real payment is created. Use an admin-approved test "
                "entitlement to try paid features."
            ),
            "plan_id": plan["id"],
            "amount_inr": plan.get("price_inr", 0),
            "key_id": None,
        }

    payload = {
        "amount": int(plan.get("price_inr", 0)) * 100,  # paise
        "currency": "INR",
        "receipt": f"rcpt_{user['id'][:12]}_{plan['id']}",
        "notes": {"user_id": user["id"], "plan_id": plan["id"]},
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.razorpay.com/v1/orders",
                json=payload,
                auth=(settings.razorpay_key_id, settings.razorpay_key_secret),  # type: ignore[arg-type]
            )
            response.raise_for_status()
            order = response.json()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment provider is unavailable right now. Please try again.",
        ) from exc
    return {
        "mode": "live",
        "order_id": order.get("id"),
        "amount": order.get("amount"),
        "currency": order.get("currency"),
        "key_id": settings.razorpay_key_id,
        "plan_id": plan["id"],
    }


# Server-side mapping of trusted provider events to subscription states.
EVENT_PLAN_MAP = {
    "subscription.activated": "active",
    "subscription.charged": "active",
    "subscription.pending": "past_due",
    "subscription.halted": "past_due",
    "subscription.cancelled": "cancelled",
    "subscription.completed": "expired",
    "subscription.paused": "past_due",
    "payment.captured": "active",
    "payment.failed": "past_due",
    "refund.processed": "cancelled",
}


async def apply_webhook_event(
    store: Store, settings: Settings, event_type: str, payload: dict[str, Any]
) -> dict[str, Any]:
    """Apply one verified webhook event. Idempotent by provider event id."""
    event_id = str(
        payload.get("id")
        or (payload.get("payload") or {}).get("payment", {}).get("entity", {}).get("id")
        or f"{event_type}:{payload.get('created_at', '')}"
    )
    is_new = await store.record_payment_event(
        event_id, {"event_type": event_type, "at": payload.get("created_at")}
    )
    if not is_new:
        return {"status": "duplicate", "event_id": event_id}

    target_status = EVENT_PLAN_MAP.get(event_type)
    if target_status is None:
        return {"status": "ignored", "event_id": event_id, "reason": "unhandled event"}

    notes = (
        ((payload.get("payload") or {}).get("payment", {}).get("entity", {}) or {}).get("notes")
        or payload.get("notes")
        or {}
    )
    user_id = notes.get("user_id")
    plan_id = notes.get("plan_id", "pro")
    if not user_id:
        user = await store.get_user_by_email(str(notes.get("email", "")))
        user_id = user["id"] if user else None
    if not user_id:
        return {"status": "ignored", "event_id": event_id, "reason": "no user mapping"}

    user = await store.get_user(user_id)
    if not user:
        return {"status": "ignored", "event_id": event_id, "reason": "unknown user"}

    await store.set_subscription(
        {
            "user_id": user_id,
            "plan_id": plan_id if target_status == "active" else "free",
            "status": target_status,
            "provider": "razorpay",
            "provider_ref": event_id,
            "current_period_end": None,
        }
    )
    await store.append_audit(
        {
            "actor_id": "system",
            "action": f"billing.{event_type}",
            "target": user_id,
            "metadata": {"event_id": event_id, "status": target_status},
        }
    )
    return {"status": "applied", "event_id": event_id, "subscription_status": target_status}


def raw_body_is_json(body: bytes) -> bool:
    try:
        json.loads(body.decode("utf-8"))
        return True
    except (ValueError, UnicodeDecodeError):
        return False
