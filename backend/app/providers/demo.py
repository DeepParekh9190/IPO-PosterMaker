"""DemoIpoProvider - returns realistic sample IPO records.

Runs fully offline so the product works even when the real source is
unavailable or unauthorized. Dates are generated relative to today so the
demo always shows upcoming, open, closed and listed examples.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from ..models import IpoStatus
from .base import ProviderResult, parse_status

SEED_PATH = Path(__file__).resolve().parent.parent / "seed" / "demo_ipos.json"


class DemoIpoProvider:
    name = "demo"

    def __init__(self, seed_path: Path | None = None) -> None:
        self._path = seed_path or SEED_PATH

    async def fetch(self) -> ProviderResult:
        today = date.today()
        now = datetime.now(timezone.utc)
        records = []
        for row in json.loads(self._path.read_text(encoding="utf-8")):
            item = dict(row)
            for field, offset_key in (
                ("open_date", "open_offset"),
                ("close_date", "close_offset"),
                ("allotment_date", "allotment_offset"),
                ("listing_date", "listing_offset"),
            ):
                offset = row.get(offset_key)
                item.pop(offset_key, None)
                item[field] = (
                    (today + timedelta(days=offset)).isoformat()
                    if offset is not None
                    else None
                )
            item["status"] = parse_status(
                None,
                _d(item["open_date"]),
                _d(item["close_date"]),
                _d(item["listing_date"]),
                today,
            )
            item["updated_at"] = now
            item["source_url"] = None
            item["is_demo"] = True
            records.append(item)

        result = ProviderResult(
            records=[], provider=self.name, ok=True, demo=True, fetched_at=now
        )
        result.records = self._validate(records)
        return result

    @staticmethod
    def _validate(rows: list[dict]) -> list:
        from .base import safe_normalize

        validated = []
        for row in rows:
            record = safe_normalize(row, source_name="Demo data (sample)", demo=True)
            if record is not None:
                validated.append(record)
        return validated


def _d(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(value)


__all__ = ["DemoIpoProvider", "IpoStatus"]
