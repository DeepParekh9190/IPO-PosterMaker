"""AuthorizedIpoProvider - HTTP adapter for an official, permissioned source.

This class does NOT scrape ipopremium.in. That site's published Terms (§2, §4)
forbid copying, scraping, republication or commercial reuse without written
permission, and robots.txt disallows its API paths. See docs/DATA_SOURCE.md.

It is disabled unless all of these are true (see Settings.authorized_source_ready):
  * IPO_SOURCE_MODE=authorized
  * IPO_SOURCE_URL and IPO_SOURCE_API_KEY set (official API/feed)
  * IPO_SOURCE_WRITTEN_PERMISSION=true  (written permission on file)

Request discipline: single GET, bounded timeout, bounded retries, no looping,
no pagination crawling, no restricted endpoints. The caller caches responses.
"""

from __future__ import annotations

from datetime import datetime, timezone

import httpx

from ..config import Settings
from .base import ProviderResult, safe_normalize


class AuthorizedIpoProvider:
    name = "authorized"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @property
    def disabled_reason(self) -> str | None:
        s = self.settings
        if s.ipo_source_mode != "authorized":
            return None  # provider simply not selected
        if not (s.ipo_source_url and s.ipo_source_api_key):
            return "Authorized mode selected but IPO_SOURCE_URL / IPO_SOURCE_API_KEY are missing."
        if not s.ipo_source_written_permission:
            return (
                "IPO_SOURCE_WRITTEN_PERMISSION is not set: automated access is "
                "blocked until written permission from the data owner is on file."
            )
        return None

    async def fetch(self) -> ProviderResult:
        reason = self.disabled_reason
        if reason:
            return ProviderResult(
                records=[], provider=self.name, ok=False, error=reason, demo=False
            )

        headers = {"Accept": "application/json"}
        if self.settings.ipo_source_api_key:
            headers["Authorization"] = f"Bearer {self.settings.ipo_source_api_key}"

        attempts = 1 + max(0, self.settings.source_max_retries)
        last_error = "unknown error"
        for attempt in range(attempts):
            try:
                async with httpx.AsyncClient(
                    timeout=self.settings.source_timeout_seconds, follow_redirects=False
                ) as client:
                    response = await client.get(self.settings.ipo_source_url, headers=headers)
                    response.raise_for_status()
                    payload = response.json()
                rows = self._extract_rows(payload)
                records = [
                    rec
                    for rec in (
                        safe_normalize(row, source_name="Authorized source", demo=False)
                        for row in rows
                    )
                    if rec is not None
                ]
                if not records:
                    return ProviderResult(
                        records=[],
                        provider=self.name,
                        ok=False,
                        error="Authorized source returned no usable IPO records.",
                    )
                return ProviderResult(
                    records=records,
                    provider=self.name,
                    ok=True,
                    fetched_at=datetime.now(timezone.utc),
                )
            except httpx.HTTPError as exc:
                last_error = f"{type(exc).__name__}: {exc}"
            except ValueError as exc:
                last_error = f"Invalid payload: {exc}"
                break  # a malformed body will not be fixed by retrying
        return ProviderResult(
            records=[], provider=self.name, ok=False, error=last_error
        )

    @staticmethod
    def _extract_rows(payload: object) -> list[dict]:
        if isinstance(payload, list):
            return [r for r in payload if isinstance(r, dict)]
        if isinstance(payload, dict):
            for key in ("items", "data", "ipos", "results", "records"):
                value = payload.get(key)
                if isinstance(value, list):
                    return [r for r in value if isinstance(r, dict)]
        return []
