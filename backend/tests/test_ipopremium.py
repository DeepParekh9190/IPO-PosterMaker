"""IpoPremium scraper: HTML parsing, local cache, auto-prune of ended IPOs,
and the public logo endpoint. All offline (fixture HTML, tmp_path cache)."""

from __future__ import annotations

import asyncio
import json
from datetime import date, timedelta
from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.providers.ipopremium import (
    IpoPremiumProvider,
    parse_dashboard_rows,
    parse_detail_page,
)

DASHBOARD_HTML = """
<html><body>
<table class="ip-table ip-table--text">
    <thead><tr><th>Company Name</th><th>Type</th><th>GMP (₹)</th><th>Open</th>
    <th>Close</th><th>Price Band (₹)</th><th>Listing Date</th></tr></thead>
    <tbody>
        <tr>
            <td><a href="https://www.ipopremium.in/view/ipo/1247/jio-platforms-ltd">Jio Platforms Ltd. (Mainboard)</a></td>
            <td>EQ</td><td>256</td><td>Oct 21, 2026</td><td>Oct 23, 2026</td>
            <td>1065&ndash;1119</td><td>Oct 28, 2026</td>
        </tr>
        <tr>
            <td><a href="https://www.ipopremium.in/view/ipo/1215/core4-engineers-ltd">Core4 Engineers Ltd (BSE SME)</a></td>
            <td>SME</td><td>0</td><td>Oct 23, 2026</td><td>Oct 27, 2026</td>
            <td>88&ndash;93</td><td>Oct 30, 2026</td>
        </tr>
        <tr>
            <td><a href="https://www.ipopremium.in/view/ipo/1416/hd-fire-protect-ltd">HD Fire Protect Ltd (MAINBOARD)</a></td>
            <td>EQ</td><td>65</td><td>Oct 13, 2026</td><td>Oct 15, 2026</td>
            <td>258&ndash;271</td><td>Oct 21, 2026</td>
        </tr>
    </tbody>
</table>
</body></html>
"""

DETAIL_HTML = """
<html><body>
<div class="ip-hero__main">
  <span class="ip-logo">
      <img src="https://assets.ipopremium.in/images/ipo/1247.png?random=1782639537" alt="Jio Platforms Ltd. (Mainboard) logo" width="64" height="64">
  </span>
  <div class="ip-stats">
    <div class="ip-stat">
        <span class="ip-stat__label">GMP Rumors *</span>
        <span class="ip-stat__value is-pos">&#8377;259</span>
        <span class="ip-stat__sub"><span class="is-pos">+23.1%</span></span>
    </div>
    <div class="ip-stat">
        <span class="ip-stat__label">Price Band</span>
        <span class="ip-stat__value">&#8377;1,065&ndash;1,119</span>
        <span class="ip-stat__sub">&#8377;30187.65 cr issue</span>
    </div>
    <div class="ip-stat">
        <span class="ip-stat__label">Lot Size</span>
        <span class="ip-stat__value">
            12 shares
        </span>
    </div>
  </div>
</div>
</body></html>
"""


def _settings(tmp_path: Path, **kwargs) -> Settings:
    return Settings(
        secret_key="t",
        ipo_source_mode="ipopremium",
        ipo_local_dir=str(tmp_path / "ipo_cache"),
        **kwargs,
    )


def _write_cache(settings: Settings, records: list[dict]) -> None:
    data_dir = Path(settings.ipo_local_dir)
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "ipos.json").write_text(json.dumps(records), encoding="utf-8")


def _record(ipo_id: str, close_date: date) -> dict:
    return {
        "id": ipo_id,
        "company_name": f"Company {ipo_id}",
        "category": "Mainboard",
        "open_date": (close_date - timedelta(days=2)).isoformat(),
        "close_date": close_date.isoformat(),
        "price_min": 100,
        "price_max": 105,
        "lot_size": 10,
    }


# --------------------------------------------------------------------------
# HTML parsing (fixtures mirror the real site markup)
# --------------------------------------------------------------------------
def test_parse_dashboard_rows_extracts_live_and_past_ipos():
    rows = parse_dashboard_rows(DASHBOARD_HTML)
    assert len(rows) == 3
    jio = rows[0]
    assert jio["id"] == "ipp-1247"
    assert jio["company_name"] == "Jio Platforms Ltd."  # suffix stripped
    assert jio["category"] == "Mainboard"
    assert jio["open_date"] == "2026-10-21"
    assert jio["close_date"] == "2026-10-23"
    assert (jio["price_min"], jio["price_max"]) == (1065, 1119)
    assert rows[1]["category"] == "SME"
    assert rows[1]["id"] == "ipp-1215"


def test_parse_detail_page_extracts_logo_lot_and_issue_size():
    extra = parse_detail_page(DETAIL_HTML)
    assert extra["logo_url"] == "https://assets.ipopremium.in/images/ipo/1247.png"
    assert extra["lot_size"] == 12
    assert extra["issue_size_cr"] == 30187.65
    assert extra["gmp_percent"] == 23.1


def test_parse_dashboard_rows_ignores_foreign_markup():
    assert parse_dashboard_rows("<html><body><p>no table</p></body></html>") == []


# --------------------------------------------------------------------------
# Local cache: serve without network, prune ended IPOs + logo files
# --------------------------------------------------------------------------
def test_fetch_serves_local_cache_without_scraping(tmp_path):
    settings = _settings(tmp_path)
    today = date.today()
    _write_cache(settings, [
        _record("ipp-1", today + timedelta(days=5)),
        _record("ipp-2", today + timedelta(days=10)),
    ])
    provider = IpoPremiumProvider(settings)
    result = asyncio.run(provider.fetch())  # force=False -> local only
    assert result.ok is True
    assert result.provider == "ipopremium"
    assert {r.id for r in result.records} == {"ipp-1", "ipp-2"}


def test_fetch_prunes_ended_ipos_and_their_logo_files(tmp_path):
    settings = _settings(tmp_path)
    today = date.today()
    _write_cache(settings, [
        _record("ipp-live", today + timedelta(days=5)),
        _record("ipp-ended", today - timedelta(days=3)),
    ])
    logo_dir = Path(settings.ipo_local_dir) / "logos"
    logo_dir.mkdir(parents=True, exist_ok=True)
    (logo_dir / "ipp-live.png").write_bytes(b"\x89PNG live")
    (logo_dir / "ipp-ended.png").write_bytes(b"\x89PNG ended")

    provider = IpoPremiumProvider(settings)
    result = asyncio.run(provider.fetch())

    assert {r.id for r in result.records} == {"ipp-live"}
    assert (logo_dir / "ipp-live.png").exists()
    assert not (logo_dir / "ipp-ended.png").exists()  # auto-removed locally
    # and the rewrite is persistent, not just in-memory
    saved = json.loads((Path(settings.ipo_local_dir) / "ipos.json").read_text("utf-8"))
    assert [row["id"] for row in saved] == ["ipp-live"]


def test_logo_url_present_only_while_file_exists(tmp_path):
    settings = _settings(tmp_path)
    today = date.today()
    _write_cache(settings, [_record("ipp-9", today + timedelta(days=5))])
    logo_dir = Path(settings.ipo_local_dir) / "logos"
    logo_dir.mkdir(parents=True, exist_ok=True)
    (logo_dir / "ipp-9.png").write_bytes(b"\x89PNG")

    provider = IpoPremiumProvider(settings)
    record = asyncio.run(provider.fetch()).records[0]
    assert record.logo_url == "/api/ipos/ipp-9/logo"


# --------------------------------------------------------------------------
# End-to-end through the app: logo endpoint + admin re-scrape button
# --------------------------------------------------------------------------
def test_logo_endpoint_serves_file_and_404s(tmp_path):
    settings = _settings(tmp_path)
    app = create_app(settings)
    logo_dir = Path(settings.ipo_local_dir) / "logos"
    logo_dir.mkdir(parents=True, exist_ok=True)
    (logo_dir / "ipp-9.png").write_bytes(b"\x89PNG\r\n\x1a\n")
    with TestClient(app) as client:
        ok = client.get("/api/ipos/ipp-9/logo")
        assert ok.status_code == 200
        assert ok.headers["content-type"].startswith("image/")
        assert client.get("/api/ipos/ipp-missing/logo").status_code == 404
        # path traversal is rejected before any filesystem access
        assert client.get("/api/ipos/..%2F..%2Fsecret/logo").status_code in (404, 400)


def test_dashboard_shows_scraped_records_from_local_cache(tmp_path):
    settings = _settings(tmp_path)
    today = date.today()
    _write_cache(settings, [_record("ipp-1", today + timedelta(days=5))])
    with TestClient(create_app(settings)) as client:
        body = client.get("/api/ipos").json()
    assert body["meta"]["provider"] == "ipopremium"
    assert body["meta"]["demo_mode"] is False
    assert [item["id"] for item in body["items"]] == ["ipp-1"]
