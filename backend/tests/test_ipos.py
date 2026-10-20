"""Public IPO data: health, listing, filters, search, safe missing fields."""

from __future__ import annotations


def test_health_ok(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["source_mode"] == "demo"


def test_list_returns_demo_records_with_meta(client):
    response = client.get("/api/ipos")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) >= 5
    meta = data["meta"]
    assert meta["demo_mode"] is True
    assert meta["provider"] == "demo"
    assert meta["last_updated"] is not None
    assert meta["stale"] is False
    # Compliance: source attribution is always present.
    assert all(item["source_name"] for item in data["items"])


def test_category_and_status_filters(client):
    sme = client.get("/api/ipos", params={"category": "SME"}).json()["items"]
    assert sme and all(i["category"] == "SME" for i in sme)

    listed = client.get("/api/ipos", params={"status": "listed"}).json()["items"]
    assert listed and all(i["status"] == "listed" for i in listed)

    open_now = client.get("/api/ipos", params={"status": "open"}).json()["items"]
    assert open_now and all(i["status"] == "open" for i in open_now)

    empty = client.get(
        "/api/ipos", params={"category": "SME", "status": "open", "q": "aarav"}
    ).json()["items"]
    # Combination must still be a valid (possibly empty) response, not an error.
    assert isinstance(empty, list)


def test_search_by_company_name(client):
    items = client.get("/api/ipos", params={"q": "aarav"}).json()["items"]
    assert len(items) == 1
    assert "Aarav" in items[0]["company_name"]


def test_missing_fields_are_null_not_invented(client):
    items = client.get("/api/ipos").json()["items"]
    record = next(i for i in items if i["id"] == "demo-nakshatra-infra-mainboard")
    assert record["price_max"] is None
    assert record["lot_size"] is None
    assert record["gmp"] is None
    assert record["min_investment"] is None  # cannot compute without lot/price
    assert record["notes"]  # explanation surfaced instead of a fake number


def test_min_investment_is_calculated_when_possible(client):
    items = client.get("/api/ipos").json()["items"]
    record = next(i for i in items if i["id"] == "demo-aarav-finserv-mainboard")
    assert record["min_investment"] == 34 * 434


def test_single_ipo_and_404(client):
    first = client.get("/api/ipos").json()["items"][0]
    found = client.get(f"/api/ipos/{first['id']}")
    assert found.status_code == 200
    assert found.json()["id"] == first["id"]
    assert client.get("/api/ipos/does-not-exist").status_code == 404


def test_invalid_query_rejected(client):
    assert client.get("/api/ipos", params={"category": "Bogus"}).status_code == 422
    assert client.get("/api/ipos", params={"status": "maybe"}).status_code == 422


def test_config_exposes_templates_and_watermark(client):
    body = client.get("/api/config").json()
    assert body["demo_mode"] is True
    assert body["watermark_text"]
    keys = [t["key"] for t in body["templates"]]
    assert "clean-white" in keys
