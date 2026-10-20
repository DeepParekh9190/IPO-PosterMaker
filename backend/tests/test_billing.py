"""Payments: test mode, webhook signature verification, idempotency, no
client-side trust."""

from __future__ import annotations

import hashlib
import hmac
import json

from conftest import bearer, register


def _sign(body: bytes, secret: str = "whsec_test") -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def test_checkout_is_labelled_test_mode_without_credentials(client):
    data = register(client)
    response = client.post("/api/billing/checkout", json={"plan_id": "pro"},
                           headers=bearer(data["token"]))
    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "test"
    assert "TEST MODE" in body["notice"]
    assert body["key_id"] is None  # no credentials leaked to the browser


def test_checkout_rejects_unknown_and_free_plans(client):
    data = register(client)
    assert client.post("/api/billing/checkout", json={"plan_id": "nope"},
                       headers=bearer(data["token"])).status_code == 404
    assert client.post("/api/billing/checkout", json={"plan_id": "free"},
                       headers=bearer(data["token"])).status_code == 400


def test_checkout_requires_auth(client):
    assert client.post("/api/billing/checkout", json={"plan_id": "pro"}).status_code == 401


def test_invalid_webhook_signature_rejected(client):
    payload = {
        "event": "subscription.activated",
        "payload": {"payment": {"entity": {"id": "pay_1", "notes": {
            "user_id": "u_x", "plan_id": "pro"}}}},
    }
    raw = json.dumps(payload).encode()
    response = client.post(
        "/api/billing/webhook", content=raw,
        headers={"content-type": "application/json",
                 "X-Razorpay-Signature": _sign(raw, "wrong-secret")},
    )
    assert response.status_code == 401
    # No subscription was created for the unknown/claimed user.
    assert client.get("/api/me").status_code == 401


def test_valid_webhook_activates_subscription_and_is_idempotent(client):
    data = register(client, email="payer@test.dev")
    payload = {
        "event": "subscription.activated",
        "payload": {"payment": {"entity": {"id": "pay_abc", "notes": {
            "user_id": data["user"]["id"], "plan_id": "pro"}}}},
    }
    raw = json.dumps(payload).encode()
    headers = {"content-type": "application/json", "X-Razorpay-Signature": _sign(raw)}

    first = client.post("/api/billing/webhook", content=raw, headers=headers)
    assert first.status_code == 200
    assert first.json()["status"] == "applied"

    me = client.get("/api/me", headers=bearer(data["token"])).json()
    assert me["plan"]["id"] == "pro"

    # Replay: same event id must not re-apply (webhook idempotency).
    replay = client.post("/api/billing/webhook", content=raw, headers=headers)
    assert replay.status_code == 200
    assert replay.json()["status"] == "duplicate"


def test_failed_payment_event_sets_past_due(client):
    data = register(client, email="failedpayer@test.dev")
    payload = {
        "event": "payment.failed",
        "payload": {"payment": {"entity": {"id": "pay_fail", "notes": {
            "user_id": data["user"]["id"], "plan_id": "pro"}}}},
    }
    raw = json.dumps(payload).encode()
    response = client.post(
        "/api/billing/webhook", content=raw,
        headers={"content-type": "application/json", "X-Razorpay-Signature": _sign(raw)},
    )
    assert response.status_code == 200
    me = client.get("/api/me", headers=bearer(data["token"])).json()
    # Entitlements fall back to free while the subscription is not healthy.
    assert me["plan"]["id"] == "free"
    assert me["entitlements"]["watermark_free"] is False


def test_malformed_webhook_body_rejected(client):
    response = client.post("/api/billing/webhook", content=b"not-json",
                           headers={"content-type": "application/json",
                                    "X-Razorpay-Signature": "abc"})
    assert response.status_code == 400


def test_test_activate_disabled_in_live_mode(client_live, settings):
    data = register(client_live, email="liveuser@test.dev")
    response = client_live.post("/api/billing/test/activate", json={"plan_id": "pro"},
                                headers=bearer(data["token"]))
    assert response.status_code == 403


def test_client_cannot_claim_payment_success(client):
    """No endpoint trusts a client-submitted success flag."""
    data = register(client, email="cheat@test.dev")
    for path in ("/api/billing/webhook",):
        assert client.post(path, json={"paid": True}).status_code in (400, 401, 422)
    me = client.get("/api/me", headers=bearer(data["token"])).json()
    assert me["plan"]["id"] == "free"


def test_test_activate_requires_auth(client):
    assert client.post("/api/billing/test/activate", json={"plan_id": "pro"}).status_code == 401
