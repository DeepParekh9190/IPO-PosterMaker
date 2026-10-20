"""Data-provider interface.

Compliance position (docs/DATA_SOURCE.md):
  * DemoIpoProvider    - active by default; realistic sample records.
  * ManualIpoProvider  - admin-entered/corrected records from the store.
  * AuthorizedIpoProvider - HTTP client for an official API/feed. It refuses to
    run unless written permission AND API credentials are configured, so an
    unapproved source can never be fetched by accident.

Raw input from any provider is untrusted: it is normalized and validated
before it reaches the API or the UI. Missing values stay None - never invented.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Protocol

from pydantic import ValidationError

from ..models import Category, IpoRecord, IpoStatus


class ProviderResult:
    def __init__(
        self,
        records: list[IpoRecord],
        provider: str,
        ok: bool = True,
        error: str | None = None,
        fetched_at: datetime | None = None,
        demo: bool = False,
    ) -> None:
        self.records = records
        self.provider = provider
        self.ok = ok
        self.error = error
        self.fetched_at = fetched_at or datetime.now(timezone.utc)
        self.demo = demo


class IpoProvider(Protocol):
    name: str

    async def fetch(self) -> ProviderResult: ...


# --------------------------------------------------------------------------
# Normalization helpers
# --------------------------------------------------------------------------
_MONTHS = {
    m.lower(): i
    for i, m in enumerate(
        ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        start=1,
    )
}


def parse_date(value: Any) -> date | None:
    """Accept ISO strings, datetime objects and '18 Oct 2026' style values."""
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(text[:10], fmt).date()
        except ValueError:
            continue
    parts = text.replace(",", "").split()
    if len(parts) >= 3 and parts[1][:3].lower() in _MONTHS:
        try:
            return date(int(parts[2]), _MONTHS[parts[1][:3].lower()], int(parts[0]))
        except ValueError:
            return None
    return None


def parse_num(value: Any) -> float | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().lower().replace(",", "").replace("₹", "").replace("rs.", "")
    text = text.replace("cr", "").replace("crore", "").replace("x", "").strip()
    if text in {"", "-", "n/a", "na", "not available", "none", "tba"}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_int(value: Any) -> int | None:
    number = parse_num(value)
    return int(round(number)) if number is not None else None


def parse_status(value: Any, open_date: date | None, close_date: date | None,
                 listing_date: date | None, today: date) -> IpoStatus:
    if isinstance(value, str):
        normalized = value.strip().lower()
        aliases = {
            "upcoming": IpoStatus.UPCOMING,
            "open": IpoStatus.OPEN, "live": IpoStatus.OPEN, "ongoing": IpoStatus.OPEN,
            "closed": IpoStatus.CLOSED, "ended": IpoStatus.CLOSED,
            "listed": IpoStatus.LISTED, "complete": IpoStatus.LISTED,
        }
        if normalized in aliases:
            return aliases[normalized]
    if listing_date and listing_date <= today:
        return IpoStatus.LISTED
    if open_date and close_date:
        if today < open_date:
            return IpoStatus.UPCOMING
        if today <= close_date:
            return IpoStatus.OPEN
        return IpoStatus.CLOSED
    return IpoStatus.UPCOMING


CATEGORY_ALIASES = {"sme": Category.SME, "mainboard": Category.MAINBOARD,
                    "main board": Category.MAINBOARD, "main-board": Category.MAINBOARD}


def normalize_record(raw: dict[str, Any], source_name: str, demo: bool = False) -> IpoRecord:
    """Map a loosely shaped provider payload onto the validated IpoRecord."""
    def pick(*keys: str) -> Any:
        for key in keys:
            if key in raw and raw[key] not in (None, ""):
                return raw[key]
        return None

    today = date.today()
    open_date = parse_date(pick("open_date", "open", "ipo_open_date", "subscription_open"))
    close_date = parse_date(pick("close_date", "close", "ipo_close_date", "subscription_close"))
    allotment = parse_date(pick("allotment_date", "allotment", "basis_of_allotment"))
    listing = parse_date(pick("listing_date", "listing", "listing_dt"))

    category_raw = str(pick("category", "ipo_category", "segment") or "Mainboard").lower()
    category = CATEGORY_ALIASES.get(category_raw, Category.MAINBOARD)

    payload: dict[str, Any] = {
        "id": str(pick("id", "ipo_id", "slug") or "").strip(),
        "company_name": str(pick("company_name", "name", "company") or "").strip(),
        "category": category,
        "open_date": open_date,
        "close_date": close_date,
        "allotment_date": allotment,
        "listing_date": listing,
        "price_min": parse_num(pick("price_min", "price_lower", "band_min")),
        "price_max": parse_num(pick("price_max", "price_upper", "band_max")),
        "lot_size": parse_int(pick("lot_size", "lot", "market_lot")),
        "issue_size_cr": parse_num(pick("issue_size_cr", "issue_size", "size_cr")),
        "gmp": parse_num(pick("gmp", "gmp_value")),
        "gmp_percent": parse_num(pick("gmp_percent", "gmp_pct")),
        "subscription": (lambda s: str(s).strip() if s not in (None, "") else None)(
            pick("subscription", "subscription_figures")
        ),
        "status": parse_status(pick("status"), open_date, close_date, listing, today),
        "source_url": pick("source_url", "source"),
        "source_name": source_name,
        "logo_url": pick("logo_url", "logo"),
        "is_demo": demo,
        "notes": pick("notes", "note"),
        "manual": bool(raw.get("manual", False)),
        "verified": bool(raw.get("verified", False)),
        "hidden": bool(raw.get("hidden", False)),
        "updated_at": raw.get("updated_at") or datetime.now(timezone.utc),
    }
    if not payload["id"]:
        payload["id"] = "ipo-" + str(abs(hash(payload["company_name"])) % 10_000_000)
    if not payload["company_name"]:
        raise ValueError("Provider record is missing company_name")
    if not payload["source_url"]:
        payload["source_url"] = None
    try:
        return IpoRecord.model_validate(payload)
    except ValidationError:
        # Re-raise with a helpful message instead of silently dropping data.
        raise


def safe_normalize(raw: dict[str, Any], source_name: str, demo: bool = False) -> IpoRecord | None:
    try:
        return normalize_record(raw, source_name, demo)
    except (ValidationError, ValueError, TypeError, KeyError):
        return None
