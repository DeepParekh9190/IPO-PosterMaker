"""Provider abstraction, normalization and the compliance gate that blocks
unauthorized automated access to an external source."""

from __future__ import annotations

from datetime import date

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.providers.authorized import AuthorizedIpoProvider
from app.providers.base import parse_date, parse_num, safe_normalize
from app.providers.demo import DemoIpoProvider


def _settings(**kwargs) -> Settings:
    return Settings(secret_key="t", **kwargs)


# --------------------------------------------------------------------------
# Compliance gate
# --------------------------------------------------------------------------
def test_authorized_mode_without_written_permission_is_blocked():
    settings = _settings(
        ipo_source_mode="authorized",
        ipo_source_url="https://example.invalid/api/ipos",
        ipo_source_api_key="key",
        ipo_source_written_permission=False,
    )
    assert settings.authorized_source_ready is False
    provider = AuthorizedIpoProvider(settings)
    assert provider.disabled_reason is not None
    assert "permission" in provider.disabled_reason.lower()

    import asyncio

    result = asyncio.run(provider.fetch())
    assert result.ok is False
    assert "permission" in (result.error or "").lower()
    assert result.records == []


def test_authorized_mode_without_credentials_is_blocked():
    settings = _settings(ipo_source_mode="authorized", ipo_source_url="https://x.invalid")
    assert settings.authorized_source_ready is False
    assert AuthorizedIpoProvider(settings).disabled_reason is not None


def test_authorized_provider_ready_only_with_permission_and_credentials():
    settings = _settings(
        ipo_source_mode="authorized",
        ipo_source_url="https://partner.example/api/ipos",
        ipo_source_api_key="secret-key",
        ipo_source_written_permission=True,
    )
    assert settings.authorized_source_ready is True
    assert AuthorizedIpoProvider(settings).disabled_reason is None


def test_demo_mode_never_contacts_the_network():
    """Demo mode must work fully offline (acceptance criterion)."""
    settings = _settings(ipo_source_mode="demo")
    assert settings.authorized_source_ready is False
    with TestClient(create_app(settings)) as client:
        body = client.get("/api/ipos").json()
        assert body["meta"]["demo_mode"] is True
        assert body["meta"]["source_error"] is None
        assert len(body["items"]) >= 5


def test_authorized_mode_without_credentials_falls_back_to_demo():
    settings = _settings(ipo_source_mode="authorized", ipo_source_url="https://x.invalid")
    with TestClient(create_app(settings)) as client:
        body = client.get("/api/ipos").json()
        assert len(body["items"]) >= 5  # graceful fallback, not an empty screen
        assert body["meta"]["source_error"]  # and the problem is surfaced


def test_stale_flag_when_refresh_is_old():
    settings = _settings(stale_after_minutes=0, source_cache_ttl_seconds=0)
    with TestClient(create_app(settings)) as client:
        meta = client.get("/api/ipos").json()["meta"]
        assert meta["stale"] is True


# --------------------------------------------------------------------------
# Normalization
# --------------------------------------------------------------------------
def test_parse_date_supported_formats():
    assert parse_date("2026-10-18") == date(2026, 10, 18)
    assert parse_date("18/10/2026") == date(2026, 10, 18)
    assert parse_date("18 Oct 2026") == date(2026, 10, 18)
    assert parse_date("") is None
    assert parse_date(None) is None
    assert parse_date("not a date") is None


def test_parse_num_ignores_junk_and_units():
    assert parse_num("1,150 Cr") == 1150
    assert parse_num("₹24") == 24
    assert parse_num("N/A") is None
    assert parse_num("-") is None
    assert parse_num(None) is None


def test_safe_normalize_rejects_incomplete_rows():
    assert safe_normalize({}, "src") is None
    assert safe_normalize({"company_name": ""}, "src") is None
    assert safe_normalize({"name": "  "}, "src") is None


def test_normalize_maps_aliases_and_derives_status():
    record = safe_normalize(
        {
            "id": "x-1",
            "name": "Alias Company Ltd",
            "ipo_category": "sme",
            "open": "2026-01-05",
            "close": "2026-01-07",
            "listing": "2026-01-10",
            "price_lower": "100",
            "price_upper": "105",
            "lot": "1500",
            "issue_size": "62.5",
            "gmp": "tba",
        },
        "Official feed",
    )
    assert record is not None
    assert record.category.value == "SME"
    assert record.status.value == "listed"  # listing date is in the past
    assert record.price_max == 105
    assert record.lot_size == 1500
    assert record.gmp is None  # "tba" is unavailable, not invented
    assert record.min_investment == 1500 * 105
    assert record.source_name == "Official feed"


def test_demo_provider_covers_all_statuses():
    import asyncio

    result = asyncio.run(DemoIpoProvider().fetch())
    statuses = {r.status.value for r in result.records}
    assert statuses == {"upcoming", "open", "closed", "listed"}
    assert all(r.is_demo for r in result.records)
    assert all(r.source_name for r in result.records)
