"""IpoPremiumProvider - one-shot scraper of the public ipopremium.in pages,
served afterwards from a local cache on disk.

Compliance notes (docs/DATA_SOURCE.md):
  * Only pages that https://www.ipopremium.in/robots.txt allows are fetched:
    the public dashboard HTML (`/`) and public IPO detail pages
    (`/view/ipo/...`). The disallowed `/api/`, `/v1/`, `/otpless/` and
    `/file/` paths are never requested and no login is used.
  * Scraping runs once per manual trigger (admin "Re-scrape IPO data" button
    or the very first run); every other read is served from the local cache
    in `IPO_LOCAL_DIR`. There is no scheduler and no repeated polling.
  * Records whose closing date has passed are deleted from the local cache -
    together with their saved logo files - on the next read.
  * Every record keeps `source_url` attribution. Redistribution of the
    source's content may still require written permission from the site
    owner; this mode is intended for the operator's own low-volume dashboard.
"""

from __future__ import annotations

import asyncio
import html as html_lib
import json
import logging
import mimetypes
import re
from datetime import date, datetime
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

import httpx

from ..config import Settings
from ..models import IpoRecord, IpoStatus
from .base import ProviderResult, parse_date, parse_num, safe_normalize

logger = logging.getLogger("ipo.ipopremium")

BASE_URL = "https://www.ipopremium.in"
SOURCE_NAME = "ipopremium.in"
# Bounded work per scrape run: detail pages are only fetched for live IPOs.
MAX_DETAIL_FETCHES = 25
DETAIL_DELAY_SECONDS = 0.4
MAX_LOGO_BYTES = 500_000
_SAFE_ID = re.compile(r"[^A-Za-z0-9_-]")


class _IpoTableParser(HTMLParser):
    """Extracts rows from the dashboard's no-JS fallback IPO table.

    The live table is filled by an API call that robots.txt disallows, but the
    same rows are server-rendered inside a <noscript> block as plain table
    markup, so a single GET of the public page is enough.
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[list[dict[str, Any]]] = []
        self._row: list[dict[str, Any]] | None = None
        self._cell: dict[str, Any] | None = None

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if tag == "tr":
            self._row = []
        elif tag == "td" and self._row is not None:
            self._cell = {"text": [], "href": None}
        elif tag == "a" and self._cell is not None:
            href = dict(attrs).get("href")
            if href and "/view/ipo/" in href and not self._cell["href"]:
                self._cell["href"] = href

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            self._cell["text"].append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "td" and self._cell is not None and self._row is not None:
            self._cell["text"] = " ".join("".join(self._cell["text"]).split())
            self._row.append(self._cell)
            self._cell = None
        elif tag == "tr" and self._row:
            if self._row:
                self.rows.append(self._row)
            self._row = None


_IPO_ID_RE = re.compile(r"/view/ipo/(\d+)/")
_NAME_SUFFIX_RE = re.compile(r"\s*\([^)]*\)\s*$")
_LOGO_RE = re.compile(r'class="ip-logo"[^>]*>\s*<img[^>]*\bsrc="([^"]+)"')
_LOT_RE = re.compile(r"Lot Size</span>\s*<span class=\"ip-stat__value\">\s*(\d+)\s*shares", re.I)
_ISSUE_SIZE_RE = re.compile(r"₹?([\d,.]+)\s*cr issue", re.I)
_GMP_PCT_RE = re.compile(r'class="is-(?:pos|neg)">\s*([+-][\d.]+)%')


def _iso_date(text: str) -> str | None:
    """'Oct 27, 2026' (site format) or anything parse_date supports -> ISO."""
    text = text.strip()
    if not text:
        return None
    try:
        return datetime.strptime(text, "%b %d, %Y").date().isoformat()
    except ValueError:
        parsed = parse_date(text)
        return parsed.isoformat() if parsed else None


def _split_price(text: str) -> tuple[float | None, float | None]:
    parts = re.split(r"[–—-]", text)
    if len(parts) != 2:
        return None, None
    low, high = parse_num(parts[0]), parse_num(parts[1])
    if not low and not high:
        return None, None  # "0-0" means the band is not announced yet
    return low, high


def parse_dashboard_rows(html_text: str) -> list[dict[str, Any]]:
    """Public dashboard HTML -> raw IPO dicts (untrusted, normalized later)."""
    parser = _IpoTableParser()
    parser.feed(html_text)
    rows: list[dict[str, Any]] = []
    for row in parser.rows:
        if len(row) < 7 or not row[0]["href"]:
            continue
        match = _IPO_ID_RE.search(row[0]["href"])
        if not match:
            continue
        low, high = _split_price(row[5]["text"])
        category_text = f"{row[0]['text']} {row[1]['text']}".upper()
        rows.append(
            {
                "id": f"ipp-{match.group(1)}",
                "company_name": _NAME_SUFFIX_RE.sub("", row[0]["text"]).strip(),
                "category": "SME" if "SME" in category_text else "Mainboard",
                "open_date": _iso_date(row[3]["text"]),
                "close_date": _iso_date(row[4]["text"]),
                "listing_date": _iso_date(row[6]["text"]),
                "price_min": low,
                "price_max": high,
                "gmp": parse_num(row[2]["text"]),
                "source_url": row[0]["href"],
            }
        )
    return rows


def parse_detail_page(html_text: str) -> dict[str, Any]:
    """Public IPO detail page -> extra fields (logo URL, lot, issue size)."""
    text = html_lib.unescape(html_text)
    extra: dict[str, Any] = {}
    logo = _LOGO_RE.search(text)
    if logo:
        extra["logo_url"] = logo.group(1).split("?")[0]
    lot = _LOT_RE.search(text)
    if lot:
        extra["lot_size"] = int(lot.group(1))
    size = _ISSUE_SIZE_RE.search(text)
    if size:
        extra["issue_size_cr"] = parse_num(size.group(1))
    pct = _GMP_PCT_RE.search(text)
    if pct:
        extra["gmp_percent"] = parse_num(pct.group(1))
    return extra


class IpoPremiumProvider:
    name = "ipopremium"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.data_dir = Path(settings.ipo_local_dir)
        self.cache_file = self.data_dir / "ipos.json"
        self.logo_dir = self.data_dir / "logos"
        self._lock = asyncio.Lock()

    # -- IpoProvider protocol ---------------------------------------------
    async def fetch(self, force: bool = False) -> ProviderResult:
        """Read the local cache; scrape the site only when forced or empty."""
        async with self._lock:
            records = self._prune(self._load_cache())
            if force or not records:
                try:
                    records = await self._scrape()
                    self._save(records)
                except (httpx.HTTPError, OSError) as exc:
                    if records:
                        return ProviderResult(
                            records=records,
                            provider=self.name,
                            ok=True,
                            error=f"Re-scrape failed ({exc}); serving cached data.",
                        )
                    return ProviderResult(
                        records=[], provider=self.name, ok=False, error=str(exc)
                    )
            return ProviderResult(records=records, provider=self.name, ok=True)

    # -- local cache --------------------------------------------------------
    def _load_cache(self) -> list[IpoRecord]:
        try:
            raw = json.loads(self.cache_file.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return []
        records = []
        for row in raw if isinstance(raw, list) else []:
            if not isinstance(row, dict):
                continue
            record = safe_normalize(row, source_name=SOURCE_NAME, demo=False)
            if record is None:
                continue
            # Self-heal: the logo URL only exists while its file does.
            record.logo_url = (
                f"/api/ipos/{record.id}/logo" if self._has_logo(record.id) else None
            )
            records.append(record)
        return records

    def _save(self, records: list[IpoRecord]) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        payload = [r.model_dump(mode="json") for r in records]
        self.cache_file.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    def _prune(self, records: list[IpoRecord]) -> list[IpoRecord]:
        """Drop IPOs whose closing date has passed, plus their logo files."""
        today = date.today()
        kept: list[IpoRecord] = []
        removed = 0
        for record in records:
            if record.close_date and record.close_date < today:
                removed += 1
                self._delete_logo(record.id)
            else:
                kept.append(record)
        if removed:
            logger.info("Pruned %d ended IPO(s) from the local cache", removed)
            self._save(kept)
        return kept

    # -- scraping -----------------------------------------------------------
    async def _scrape(self) -> list[IpoRecord]:
        today = date.today()
        async with httpx.AsyncClient(
            timeout=self.settings.source_timeout_seconds,
            follow_redirects=True,
            headers={"User-Agent": f"IPOPosterStudio/{self.settings.version} (+one-shot local cache)"},
        ) as client:
            response = await client.get(f"{BASE_URL}/")
            response.raise_for_status()

            records: list[IpoRecord] = []
            for row in parse_dashboard_rows(response.text):
                record = safe_normalize(row, source_name=SOURCE_NAME, demo=False)
                if record is None:
                    continue
                # Never store an IPO that already ended; live ones are enriched below.
                if record.close_date and record.close_date < today:
                    continue
                records.append(record)

            live = [r for r in records if r.status in (IpoStatus.UPCOMING, IpoStatus.OPEN)]
            for record in live[:MAX_DETAIL_FETCHES]:
                if not record.source_url:
                    continue
                try:
                    detail = await self._fetch_detail(client, record.source_url)
                except (httpx.HTTPError, OSError) as exc:
                    logger.warning("Detail fetch failed for %s: %s", record.id, exc)
                    continue
                record.lot_size = detail.get("lot_size") or record.lot_size
                record.issue_size_cr = detail.get("issue_size_cr") or record.issue_size_cr
                record.gmp_percent = detail.get("gmp_percent") or record.gmp_percent
                if await self._download_logo(client, record.id, detail.get("logo_url")):
                    record.logo_url = f"/api/ipos/{record.id}/logo"
                await asyncio.sleep(DETAIL_DELAY_SECONDS)

            if not records:
                raise RuntimeError(
                    "No IPO rows found on the dashboard page - the site layout may have changed."
                )
            return records

    async def _fetch_detail(self, client: httpx.AsyncClient, url: str) -> dict[str, Any]:
        response = await client.get(url)
        response.raise_for_status()
        return parse_detail_page(response.text)

    async def _download_logo(
        self, client: httpx.AsyncClient, ipo_id: str, logo_url: str | None
    ) -> bool:
        if not logo_url:
            return False
        suffix = Path(logo_url.split("?")[0]).suffix.lower()
        if suffix not in {".png", ".jpg", ".jpeg", ".webp"}:
            return False
        response = await client.get(logo_url)
        response.raise_for_status()
        if not response.headers.get("content-type", "").startswith("image/"):
            return False
        if len(response.content) > MAX_LOGO_BYTES:
            return False
        self.logo_dir.mkdir(parents=True, exist_ok=True)
        (self.logo_dir / f"{self._safe_id(ipo_id)}{suffix}").write_bytes(response.content)
        return True

    # -- logo files ----------------------------------------------------------
    def _safe_id(self, ipo_id: str) -> str:
        return _SAFE_ID.sub("_", ipo_id)[:64]

    def _has_logo(self, ipo_id: str) -> bool:
        return any(self.logo_dir.glob(f"{self._safe_id(ipo_id)}.*"))

    def _delete_logo(self, ipo_id: str) -> None:
        for path in self.logo_dir.glob(f"{self._safe_id(ipo_id)}.*"):
            try:
                path.unlink()
            except OSError:
                logger.warning("Could not delete logo file %s", path)

    def logo_path(self, ipo_id: str) -> Path | None:
        """Local logo file for an IPO id, if one was saved."""
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", ipo_id):
            return None
        for path in sorted(self.logo_dir.glob(f"{ipo_id}.*")):
            if path.is_file():
                return path
        return None


def guess_media_type(path: Path) -> str:
    return mimetypes.guess_type(path.name)[0] or "application/octet-stream"
