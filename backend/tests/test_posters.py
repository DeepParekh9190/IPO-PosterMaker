"""Server-side entitlement enforcement for poster exports."""

from __future__ import annotations

from conftest import bearer, login_admin, register


def _authorize(client, token=None, template="clean-white", width=1080, height=1080):
    headers = bearer(token) if token else {}
    return client.post(
        "/api/posters/authorize-export",
        json={"template_key": template, "width": width, "height": height},
        headers=headers,
    )


def test_unauthenticated_export_rejected(client):
    assert _authorize(client).status_code == 401


def test_free_plan_gets_watermark_token(client):
    data = register(client)
    response = _authorize(client, data["token"])
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["watermark"] is True
    assert body["watermark_text"]
    assert body["plan_id"] == "free"

    # The token is genuinely signed by the server.
    verify = client.get("/api/posters/verify-token", params={"token": body["token"]})
    assert verify.json()["valid"] is True
    assert verify.json()["payload"]["wm"] is True


def test_premium_template_blocked_for_free_plan(client):
    data = register(client)
    response = _authorize(client, data["token"], template="dark-market")
    assert response.status_code == 402
    assert "paid plan" in response.json()["detail"]


def test_unknown_or_disabled_template_rejected(client):
    data = register(client)
    assert _authorize(client, data["token"], template="nope").status_code == 400


def test_usage_counter_increments(client):
    data = register(client)
    for _ in range(3):
        assert _authorize(client, data["token"]).status_code == 200
    me = client.get("/api/me", headers=bearer(data["token"])).json()
    assert me["usage"]["exports_today"] == 3


def test_admin_granted_pro_plan_removes_watermark(client):
    free_user = register(client, email="upgradee@test.dev")
    admin = login_admin(client)
    grant = client.post(
        "/api/admin/entitlements",
        json={"user_id": free_user["user"]["id"], "plan_id": "pro",
              "reason": "manual payment review"},
    )
    assert grant.status_code == 200
    client.post("/api/auth/logout")

    response = _authorize(client, free_user["token"])
    assert response.status_code == 200
    assert response.json()["watermark"] is False
    assert response.json()["watermark_text"] == ""
    assert response.json()["plan_id"] == "pro"

    # Pro unlocks premium templates too.
    assert _authorize(client, free_user["token"], template="dark-market").status_code == 200


def test_export_limit_returns_402_when_exhausted(client, settings):
    # Free plan allows 10 exports/day (see DEFAULT_PLANS).
    data = register(client, email="heavy@test.dev")
    codes = [
        _authorize(client, data["token"]).status_code for _ in range(12)
    ]
    assert codes[:10] == [200] * 10
    assert codes[10] == 402
    assert codes[11] == 402
