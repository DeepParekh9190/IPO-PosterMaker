"""Security requirements: rate limits, payload size, input validation,
isolation between users, privacy/deletion."""

from __future__ import annotations

from conftest import bearer, login_admin, register

PNG_DATA_URL = ("data:image/png;base64,"
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")


def test_login_rate_limited(client):
    responses = [
        client.post("/api/auth/login",
                    json={"email": "flood@test.dev", "password": "nope-nope-1"})
        for _ in range(14)
    ]
    statuses = [r.status_code for r in responses]
    assert 429 in statuses, statuses
    limited = next(r for r in responses if r.status_code == 429)
    assert limited.headers.get("Retry-After")


def test_oversized_body_rejected(client):
    payload = {"email": "big@test.dev", "password": "password123",
               "business_name": "x" * 1_200_000}
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 413


def test_weak_password_rejected(client):
    response = client.post("/api/auth/register",
                           json={"email": "weak@test.dev", "password": "short"})
    assert response.status_code == 422
    assert "password" in response.json()["detail"].lower()


def test_brand_save_is_paid_only(client):
    free = register(client, email="freebrand@test.dev")
    response = client.put(
        "/api/brand",
        json={"business_name": "Free Firm", "logo_data_url": PNG_DATA_URL,
              "template_key": "clean-white"},
        headers=bearer(free["token"]),
    )
    assert response.status_code == 402
    assert "paid feature" in response.json()["detail"]

    # Give the same user a pro entitlement server-side, then it works.
    login_admin(client)
    client.post("/api/admin/entitlements",
                json={"user_id": free["user"]["id"], "plan_id": "pro",
                      "reason": "test grant"})
    client.post("/api/auth/logout")

    allowed = client.put(
        "/api/brand",
        json={"business_name": "Pro Firm", "logo_data_url": PNG_DATA_URL,
              "template_key": "premium-corporate", "color_theme": "navy-gold",
              "footer_text": "Call 99999 00000"},
        headers=bearer(free["token"]),
    )
    assert allowed.status_code == 200
    fetched = client.get("/api/brand", headers=bearer(free["token"])).json()
    assert fetched["business_name"] == "Pro Firm"
    assert fetched["logo_data_url"].startswith("data:image/png")


def test_brand_logo_validation(client):
    user = register(client, email="logotest@test.dev")
    headers = bearer(user["token"])

    bad_mime = client.put("/api/brand",
                          json={"logo_data_url": "data:text/html;base64,PGgxPmhpPC9oMT4="},
                          headers=headers)
    assert bad_mime.status_code == 422

    not_a_data_url = client.put("/api/brand",
                                json={"logo_data_url": "https://evil.example/x.png"},
                                headers=headers)
    assert not_a_data_url.status_code == 422

    huge = client.put("/api/brand",
                      json={"logo_data_url": "data:image/png;base64," + "A" * 600_000},
                      headers=headers)
    assert huge.status_code == 422


def test_users_cannot_read_each_others_brand(client):
    a = register(client, email="brand-a@test.dev")
    b = register(client, email="brand-b@test.dev")

    # Both need paid plans to persist brands (server-enforced).
    login_admin(client)
    for user_id in (a["user"]["id"], b["user"]["id"]):
        client.post("/api/admin/entitlements",
                    json={"user_id": user_id, "plan_id": "pro", "reason": "isolation test"})
    client.post("/api/auth/logout")

    client.put("/api/brand", json={"business_name": "Firm A"},
               headers=bearer(a["token"]))
    client.put("/api/brand", json={"business_name": "Firm B"},
               headers=bearer(b["token"]))

    assert client.get("/api/brand", headers=bearer(a["token"])).json()["business_name"] == "Firm A"
    assert client.get("/api/brand", headers=bearer(b["token"])).json()["business_name"] == "Firm B"

    # A user cannot address another account by id: the field is ignored and
    # every brand row is keyed by the authenticated user only.
    assert client.put("/api/brand",
                      json={"business_name": "Hijack",
                            "user_id": b["user"]["id"]},
                      headers=bearer(a["token"])).status_code == 200
    assert client.get("/api/brand", headers=bearer(b["token"])).json()["business_name"] == "Firm B"


def test_privacy_notice_and_self_deletion(client):
    user = register(client, email="leaver@test.dev")
    notice = client.get("/api/privacy").json()
    assert "PAN" in notice["not_collected"]

    response = client.delete("/api/me", headers=bearer(user["token"]))
    assert response.status_code == 200
    assert response.json()["deleted"] is True

    # Session is dead and the email is gone.
    assert client.get("/api/me", headers=bearer(user["token"])).status_code in (401, 403)
    client.post("/api/auth/logout")
    assert client.post("/api/auth/login",
                       json={"email": "leaver@test.dev", "password": "password123"}
                       ).status_code == 401


def test_admin_cannot_self_delete(client):
    admin = login_admin(client)
    response = client.delete("/api/me", headers=bearer(admin["token"]))
    assert response.status_code == 400
