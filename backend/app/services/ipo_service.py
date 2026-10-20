"""IPO aggregation service: provider selection, caching, dedupe and merge.

Design points that matter for the acceptance criteria:
  * Visitors never trigger an external request on every page load - results are
    cached in-process for `source_cache_ttl_seconds`, with a single-flight lock
    so concurrent requests produce one upstream fetch.
  * Manual admin records are stored separately and win on merge, so a refresh
    never silently overwrites an admin correction.
  * A stale-data flag is returned when the last successful refresh is old, and
    the last valid snapshot is reused when the source is down.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from ..config import Settings
from ..models import IpoRecord
from ..providers.authorized import AuthorizedIpoProvider
from ..providers.base import ProviderResult, safe_normalize
from ..providers.demo import DemoIpoProvider
from ..providers.ipopremium import IpoPremiumProvider
from ..store.base import Store

logger = logging.getLogger("ipo.service")


@dataclass
class Snapshot:
    records: list[IpoRecord] = field(default_factory=list)
    provider: str = "demo"
    demo_mode: bool = True
    last_updated: datetime | None = None
    error: str | None = None
    fetching: bool = False
    stale_minutes: int = 90

    @property
    def stale(self) -> bool:
        if self.last_updated is None:
            return True
        age = datetime.now(timezone.utc) - self.last_updated
        return age > timedelta(minutes=self.stale_minutes)


class IpoService:
    def __init__(self, settings: Settings, store: Store) -> None:
        self.settings = settings
        self.store = store
        self.demo = DemoIpoProvider()
        self.authorized = AuthorizedIpoProvider(settings)
        self.ipopremium = IpoPremiumProvider(settings)
        self._cache: Snapshot | None = None
        self._cached_at: datetime | None = None
        self._lock = asyncio.Lock()
        self.last_successful_refresh: datetime | None = None

    def _snap(self, **kwargs) -> Snapshot:
        kwargs.setdefault("stale_minutes", self.settings.stale_after_minutes)
        return Snapshot(**kwargs)

    # -- public ------------------------------------------------------------
    async def snapshot(self, force: bool = False) -> Snapshot:
        now = datetime.now(timezone.utc)
        ttl = timedelta(seconds=self.settings.source_cache_ttl_seconds)
        if (
            not force
            and self._cache is not None
            and self._cached_at is not None
            and now - self._cached_at < ttl
        ):
            return await self._with_overrides(self._cache)

        async with self._lock:
            if (
                not force
                and self._cache is not None
                and self._cached_at is not None
                and datetime.now(timezone.utc) - self._cached_at < ttl
            ):
                return await self._with_overrides(self._cache)
            fresh = await self._fetch(force=force)
            self._cache = fresh
            self._cached_at = datetime.now(timezone.utc)
            return await self._with_overrides(fresh)

    async def get_record(self, ipo_id: str, force: bool = False) -> IpoRecord | None:
        snap = await self.snapshot(force=force)
        for record in snap.records:
            if record.id == ipo_id:
                return record
        return None

    async def list_records(
        self,
        q: str = "",
        category: str = "",
        status: str = "",
        include_hidden: bool = False,
    ) -> Snapshot:
        snap = await self.snapshot()
        items = [
            r
            for r in snap.records
            if include_hidden or not r.hidden
        ]
        if category:
            items = [r for r in items if r.category.value.lower() == category.lower()]
        if status:
            items = [r for r in items if r.status.value.lower() == status.lower()]
        if q:
            needle = q.strip().lower()
            items = [r for r in items if needle in r.company_name.lower()]
        return self._snap(
            records=items,
            provider=snap.provider,
            demo_mode=snap.demo_mode,
            last_updated=snap.last_updated,
            error=snap.error,
        )

    # -- internals ---------------------------------------------------------
    async def _fetch(self, force: bool = False) -> Snapshot:
        result: ProviderResult
        if self.settings.ipo_source_mode == "ipopremium":
            # One-shot scraper + local cache; force re-scrapes (admin button).
            result = await self.ipopremium.fetch(force=force)
            if not result.ok:
                logger.warning("ipopremium scrape failed: %s", result.error)
                if self._cache is not None and self._cache.records:
                    fallback = self._cache
                    fallback.error = result.error
                    return fallback
                demo = await self.demo.fetch()
                demo.error = result.error
                result = demo
        elif self.settings.authorized_source_ready:
            result = await self.authorized.fetch()
            if not result.ok:
                logger.warning("Authorized source failed: %s - serving last valid snapshot",
                               result.error)
                # graceful fallback to demo when no prior snapshot exists
                if self._cache is not None and self._cache.records:
                    fallback = self._cache
                    fallback.error = result.error
                    return fallback
                result = await self.demo.fetch()
                result.error = f"Authorized source unavailable: {result.error}"
        elif self.settings.ipo_source_mode == "authorized":
            result = await self.authorized.fetch()  # returns ok=False + reason
            if not result.ok and self._cache is not None and self._cache.records:
                fallback = self._cache
                fallback.error = result.error
                return fallback
            demo = await self.demo.fetch()
            demo.error = result.error
            result = demo
        else:
            result = await self.demo.fetch()

        if result.ok:
            self.last_successful_refresh = result.fetched_at
        return self._snap(
            records=result.records,
            provider=result.provider,
            demo_mode=result.demo or result.provider == "demo",
            last_updated=result.fetched_at if result.ok else self.last_successful_refresh,
            error=result.error,
        )

    async def _with_overrides(self, snap: Snapshot) -> Snapshot:
        """Merge admin-entered/edited records. Manual data always wins."""
        overrides = await self.store.list_ipo_overrides()
        if not overrides:
            return snap
        by_id = {r.id: r for r in snap.records}
        for raw in overrides:
            record = safe_normalize(
                raw, source_name=str(raw.get("source_name") or "Admin entered"), demo=False
            )
            if record is None:
                continue
            record.manual = True
            by_id[record.id] = record
        merged = sorted(
            by_id.values(),
            key=lambda r: (r.open_date is None, r.open_date or datetime.min.date()),
        )
        return self._snap(
            records=merged,
            provider=snap.provider,
            demo_mode=snap.demo_mode,
            last_updated=snap.last_updated,
            error=snap.error,
        )
