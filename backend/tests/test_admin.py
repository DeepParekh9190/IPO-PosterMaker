"""Admin panel API: protection, user management, IPO management, plans,
templates, settings."""

from __future__ import annotations

from conftest import bearer, login_admin, register


def _admin_headers(client):
    data = login_admin(client)
    return bearer(data["token"])


# --------------------------------------------------------------------------
# Access control
# --------------------------------------------------------------------------
def test_admin_routes_require_authentication(client):
    for path in ("/api/admin/metrics", "/api/admin/users", "/api/admin/ipos",
                 "/api/admin/plans", "/api/admin/settings", "/api/admin/audit",
                 "/api/admin/templates", "/api/admin/payments"):
        assert client.get(path).status_code == 401, path


def test_regular_client_cannot_access_admin_routes(client):
    user = register(client, email="notadmin@test.dev")
    headers = bearer(user["token"])
    assert client.get("/api/admin/metrics", headers=headers).status_code == 403
    assert client.post("/api/admin/ipos/refresh", headers=headers).status_code == 403
    assert client.get("/api/admin/users", headers=headers).status_code == 403
    client.post("/api/auth/logout")


def test_refresh_endpoint_not_public(client):
    assert client.post("/api/admin/ipos/refresh").status_code == 401


# --------------------------------------------------------------------------
# Metrics + users
# --------------------------------------------------------------------------
def test_metrics_shape(client):
    headers = _admin_headers(client)
    body = client.get("/api/admin/metrics", headers=headers).json()
    for key in ("total_users", "active_subscribers", "free_users", "poster_exports_today",
                "recent_errors", "source_health", "last_successful_refresh",
                "payments_mode", "persistence"):
        assert key in body, key
    assert body["payments_mode"] == "test"
    assert body["source_health"]["demo_mode"] is True
    client.post("/api/auth/logout")


def test_user_list_never_exposes_credentials(client):
    register(client, email="exposed@test.dev")
    headers = _admin_headers(client)
    items = client.get("/api/admin/users", headers=headers).json()["items"]
    assert items
    for user in items:
        assert "password_hash" not in user or user["password_hash"] is None
        raw = str(user)
        assert "pbkdf2" not in raw
    client.post("/api/auth/logout")


def test_user_search(client):
    register(client, email="findme@test.dev")
    headers = _admin_headers(client)
    found = client.get("/api/admin/users", params={"q": "findme"}, headers=headers).json()
    assert found["items"] and found["items"][0]["email"] == "findme@test.dev"
    none = client.get("/api/admin/users", params={"q": "zzz-nothing"}, headers=headers).json()
    assert none["items"] == []
    client.post("/api/auth/logout")


def test_admin_changes_user_plan_with_audit(client):
    victim = register(client, email="promotee@test.dev")
    headers = _admin_headers(client)
    response = client.patch(
        f"/api/admin/users/{victim['user']['id']}",
        json={"plan_id": "pro", "reason": "manual bank transfer received"},
        headers=headers,
    )
    assert response.status_code == 200
    audit = client.get("/api/admin/audit", headers=headers).json()
    assert any(e["action"] == "admin.user_update" for e in audit)
    client.post("/api/auth/logout")

    # The victim sees the new entitlements from the server.
    me = client.get("/api/me", headers=bearer(victim["token"])).json()
    assert me["plan"]["id"] == "pro"
    assert me["entitlements"]["watermark_free"] is True


def test_admin_cannot_set_unknown_plan(client):
    victim = register(client, email="badplan@test.dev")
    headers = _admin_headers(client)
    response = client.patch(
        f"/api/admin/users/{victim['user']['id']}",
        json={"plan_id": "platinum", "reason": "typo"},
        headers=headers,
    )
    assert response.status_code == 404


# --------------------------------------------------------------------------
# IPO management
# --------------------------------------------------------------------------
def test_admin_can_create_edit_hide_and_verify_ipo(client):
    headers = _admin_headers(client)
    created = client.post(
        "/api/admin/ipos",
        json={"company_name": "Manual Enteries Ltd", "category": "SME",
              "open_date": "2026-11-01", "close_date": "2026-11-03",
              "price_min": 100, "price_max": 105, "lot_size": 1000,
              "issue_size_cr": 55},
        headers=headers,
    )
    assert created.status_code == 201, created.text
    ipo_id = created.json()["id"]
    assert created.json()["verified"] is True

    public = client.get("/api/ipos").json()["items"]
    assert any(i["id"] == ipo_id for i in public)

    # Manual record survives a source refresh (never silently overwritten).
    refresh = client.post("/api/admin/ipos/refresh", headers=headers)
    assert refresh.status_code == 200
    after = client.get(f"/api/ipos/{ipo_id}")
    assert after.status_code == 200
    assert after.json()["company_name"] == "Manual Enteries Ltd"

    # Edit persists too.
    patched = client.patch(
        f"/api/admin/ipos/{ipo_id}",
        json={"price_max": 110, "reason": "corrected band", "clear_fields": ["notes"]},
        headers=headers,
    )
    assert patched.status_code == 200
    assert patched.json()["price_max"] == 110
    assert patched.json()["manual"] is True

    # Hide removes it from the public API but keeps it for admins.
    client.patch(f"/api/admin/ipos/{ipo_id}", json={"hidden": True}, headers=headers)
    assert client.get(f"/api/ipos/{ipo_id}").status_code == 404
    admin_list = client.get("/api/admin/ipos", headers=headers).json()["items"]
    assert any(i["id"] == ipo_id for i in admin_list)


def test_admin_edits_of_demo_records_win_over_refresh(client):
    headers = _admin_headers(client)
    target = client.get("/api/ipos").json()["items"][0]
    response = client.patch(
        f"/api/admin/ipos/{target['id']}",
        json={"company_name": "Corrected Name Pvt Ltd", "reason": "typo"},
        headers=headers,
    )
    assert response.status_code == 200
    client.post("/api/admin/ipos/refresh", headers=headers)
    updated = client.get(f"/api/ipos/{target['id']}").json()
    assert updated["company_name"] == "Corrected Name Pvt Ltd"
    assert updated["manual"] is True


def test_admin_ipo_not_found(client):
    headers = _admin_headers(client)
    response = client.patch("/api/admin/ipos/nope", json={"verified": True},
                            headers=headers)
    assert response.status_code == 404


# --------------------------------------------------------------------------
# Plans, templates, settings
# --------------------------------------------------------------------------
def test_admin_updates_plan_price(client):
    headers = _admin_headers(client)
    response = client.put("/api/admin/plans/pro", json={"price_inr": 999},
                          headers=headers)
    assert response.status_code == 200
    assert response.json()["price_inr"] == 999
    public = {p["id"]: p for p in client.get("/api/plans").json()}
    assert public["pro"]["price_inr"] == 999


def test_admin_disables_template_and_it_disappears_from_public_config(client):
    headers = _admin_headers(client)
    templates = client.get("/api/admin/templates", headers=headers).json()
    gujarati = next(t for t in templates if t["key"] == "gujarati-business")
    gujarati["enabled"] = False
    assert client.put("/api/admin/templates/gujarati-business", json=gujarati,
                      headers=headers).status_code == 200
    public_keys = [t["key"] for t in client.get("/api/config").json()["templates"]]
    assert "gujarati-business" not in public_keys

    # A disabled template cannot be authorized for export either.
    user = register(client, email="tmpl@test.dev")
    response = client.post("/api/posters/authorize-export",
                           json={"template_key": "gujarati-business", "width": 1080,
                                 "height": 1080},
                           headers=bearer(user["token"]))
    assert response.status_code == 400
    client.post("/api/auth/logout")


def test_admin_settings_change_watermark_text(client):
    headers = _admin_headers(client)
    response = client.put(
        "/api/admin/settings",
        json={"default_watermark_text": "Made by MyIPO Firm", "default_language": "hi"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["default_watermark_text"] == "Made by MyIPO Firm"

    user = register(client, email="wm@test.dev")
    export = client.post("/api/posters/authorize-export",
                         json={"template_key": "clean-white", "width": 1080, "height": 1080},
                         headers=bearer(user["token"])).json()
    assert export["watermark_text"] == "Made by MyIPO Firm"


def test_maintenance_mode_blocks_clients_but_not_health_or_admin(client):
    headers = _admin_headers(client)
    assert client.put("/api/admin/settings", json={"maintenance_mode": True},
                      headers=headers).status_code == 200
    assert client.get("/api/ipos").status_code == 503
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/admin/metrics", headers=headers).status_code == 200
    client.put("/api/admin/settings", json={"maintenance_mode": False}, headers=headers)
    assert client.get("/api/ipos").status_code == 200


def test_audit_trail_records_admin_actions(client):
    headers = _admin_headers(client)
    client.put("/api/admin/plans/free", json={"description": "updated"}, headers=headers)
    audit = client.get("/api/admin/audit", headers=headers).json()
    assert any(e["action"] == "admin.plan_update" for e in audit)
    assert all("password" not in str(e).lower() for e in audit)
