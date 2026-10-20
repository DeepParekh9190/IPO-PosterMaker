"""Auth flow: register, login, session cookie, suspension handling."""

from __future__ import annotations

from conftest import bearer, login_admin, register


def test_register_login_me_logout(client):
    data = register(client)
    assert data["user"]["email"] == "user@test.dev"
    assert data["user"]["role"] == "client"
    assert "password" not in data["user"]

    me = client.get("/api/me")
    assert me.status_code == 200
    body = me.json()
    assert body["plan"]["id"] == "free"
    assert body["entitlements"]["watermark_free"] is False
    assert body["usage"]["exports_today"] == 0

    # Cookie is httpOnly: JavaScript cannot read the session token.
    cookie = client.cookies.get("ipo_session")
    assert cookie

    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/me").status_code == 401


def test_login_rejects_bad_password_and_unknown_email(client):
    register(client)
    client.post("/api/auth/logout")
    bad = client.post("/api/auth/login",
                      json={"email": "user@test.dev", "password": "wrong-password"})
    assert bad.status_code == 401
    unknown = client.post("/api/auth/login",
                          json={"email": "nobody@test.dev", "password": "whatever123"})
    assert unknown.status_code == 401
    # Same error for both: no account enumeration.
    assert bad.json()["detail"] == unknown.json()["detail"]


def test_duplicate_registration_rejected(client):
    register(client)
    client.post("/api/auth/logout")
    duplicate = client.post(
        "/api/auth/register",
        json={"email": "user@test.dev", "password": "another-pass-1"},
    )
    assert duplicate.status_code == 409


def test_admin_can_login_and_sees_admin_data(client):
    admin = login_admin(client)
    assert admin["user"]["role"] == "admin"
    metrics = client.get("/api/admin/metrics")
    assert metrics.status_code == 200
    assert metrics.json()["total_users"] >= 1
    assert "source_health" in metrics.json()
    client.post("/api/auth/logout")
    assert client.get("/api/admin/metrics").status_code == 401


def test_suspended_account_cannot_login_or_use_api(client):
    admin = login_admin(client)
    victim = register(client, email="victim@test.dev")
    client.post("/api/auth/logout")

    login_admin(client)  # admin session
    patch = client.patch(
        f"/api/admin/users/{victim['user']['id']}",
        json={"status": "suspended", "reason": "chargeback"},
    )
    assert patch.status_code == 200
    client.post("/api/auth/logout")

    login_attempt = client.post(
        "/api/auth/login", json={"email": "victim@test.dev", "password": "password123"}
    )
    assert login_attempt.status_code == 403
    assert "suspended" in login_attempt.json()["detail"].lower()


def test_bearer_token_works_for_api_clients(client):
    data = register(client, email="api@test.dev")
    client.post("/api/auth/logout")
    me = client.get("/api/me", headers=bearer(data["token"]))
    assert me.status_code == 200
    assert me.json()["user"]["email"] == "api@test.dev"


def test_tampered_token_rejected(client):
    data = register(client, email="tamper@test.dev")
    token = data["token"]
    forged = token[:-4] + ("AAAA" if not token.endswith("AAAA") else "BBBB")
    client.post("/api/auth/logout")
    assert client.get("/api/me", headers=bearer(forged)).status_code == 401
