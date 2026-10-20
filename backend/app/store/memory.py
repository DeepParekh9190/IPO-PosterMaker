"""Default no-database store. Suitable for demo mode and local development.

Not persistent across serverless cold starts - that is why production mode uses
SupabaseStore. Never used to grant paid features from client input.
"""

from __future__ import annotations

import copy
from datetime import datetime, timezone
from typing import Any


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class MemoryStore:
    def __init__(self) -> None:
        self.users: dict[str, dict[str, Any]] = {}
        self.subscriptions: dict[str, dict[str, Any]] = {}
        self.plans: dict[str, dict[str, Any]] = {}
        self.brands: dict[str, dict[str, Any]] = {}
        self.audit: list[dict[str, Any]] = []
        self.usage: dict[str, int] = {}
        self.ipo_overrides: dict[str, dict[str, Any]] = {}
        self.settings: dict[str, Any] = {}
        self.payment_events: dict[str, dict[str, Any]] = {}

    # -- users -------------------------------------------------------------
    async def create_user(self, user: dict[str, Any]) -> dict[str, Any]:
        record = copy.deepcopy(user)
        record.setdefault("created_at", _now())
        self.users[record["id"]] = record
        return copy.deepcopy(record)

    async def get_user(self, user_id: str) -> dict[str, Any] | None:
        user = self.users.get(user_id)
        return copy.deepcopy(user) if user else None

    async def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        wanted = email.strip().lower()
        for user in self.users.values():
            if user["email"].lower() == wanted:
                return copy.deepcopy(user)
        return None

    async def list_users(
        self, q: str = "", limit: int = 50, offset: int = 0
    ) -> list[dict[str, Any]]:
        rows = sorted(
            self.users.values(), key=lambda u: u.get("created_at", ""), reverse=True
        )
        if q:
            needle = q.lower()
            rows = [
                u
                for u in rows
                if needle in u["email"].lower()
                or needle in (u.get("business_name") or "").lower()
            ]
        return copy.deepcopy(rows[offset : offset + limit])

    async def count_users(self) -> int:
        return len(self.users)

    async def update_user(self, user_id: str, **fields: Any) -> dict[str, Any] | None:
        user = self.users.get(user_id)
        if not user:
            return None
        user.update(fields)
        user["updated_at"] = _now()
        return copy.deepcopy(user)

    # -- subscriptions -----------------------------------------------------
    async def get_subscription(self, user_id: str) -> dict[str, Any] | None:
        sub = self.subscriptions.get(user_id)
        return copy.deepcopy(sub) if sub else None

    async def set_subscription(self, sub: dict[str, Any]) -> dict[str, Any]:
        record = copy.deepcopy(sub)
        record["updated_at"] = _now()
        self.subscriptions[record["user_id"]] = record
        return copy.deepcopy(record)

    # -- plans -------------------------------------------------------------
    async def list_plans(self) -> list[dict[str, Any]]:
        return copy.deepcopy(list(self.plans.values()))

    async def get_plan(self, plan_id: str) -> dict[str, Any] | None:
        plan = self.plans.get(plan_id)
        return copy.deepcopy(plan) if plan else None

    async def upsert_plan(self, plan: dict[str, Any]) -> dict[str, Any]:
        record = copy.deepcopy(plan)
        self.plans[record["id"]] = record
        return copy.deepcopy(record)

    # -- brand profiles ----------------------------------------------------
    async def get_brand(self, user_id: str) -> dict[str, Any] | None:
        brand = self.brands.get(user_id)
        return copy.deepcopy(brand) if brand else None

    async def set_brand(self, user_id: str, brand: dict[str, Any]) -> dict[str, Any]:
        record = copy.deepcopy(brand)
        record["user_id"] = user_id
        record["updated_at"] = _now()
        self.brands[user_id] = record
        return copy.deepcopy(record)

    # -- audit -------------------------------------------------------------
    async def append_audit(self, event: dict[str, Any]) -> None:
        record = copy.deepcopy(event)
        record.setdefault("at", _now())
        self.audit.append(record)
        del self.audit[:-500]

    async def list_audit(self, limit: int = 100) -> list[dict[str, Any]]:
        return copy.deepcopy(list(reversed(self.audit[-limit:])))

    # -- usage -------------------------------------------------------------
    async def incr_usage(self, user_id: str, key: str) -> int:
        composite = f"{user_id}:{key}"
        self.usage[composite] = self.usage.get(composite, 0) + 1
        return self.usage[composite]

    async def get_usage(self, user_id: str, key: str) -> int:
        return self.usage.get(f"{user_id}:{key}", 0)

    # -- IPO overrides -----------------------------------------------------
    async def list_ipo_overrides(self) -> list[dict[str, Any]]:
        return copy.deepcopy(list(self.ipo_overrides.values()))

    async def set_ipo_override(self, ipo_id: str, record: dict[str, Any]) -> None:
        self.ipo_overrides[ipo_id] = copy.deepcopy(record)

    async def delete_ipo_override(self, ipo_id: str) -> bool:
        return self.ipo_overrides.pop(ipo_id, None) is not None

    # -- settings / templates / payments ----------------------------------
    async def get_settings_data(self) -> dict[str, Any]:
        return copy.deepcopy(self.settings)

    async def save_settings_data(self, data: dict[str, Any]) -> None:
        self.settings = copy.deepcopy(data)

    async def record_payment_event(self, event_id: str, data: dict[str, Any]) -> bool:
        """Return False when the event was already processed (idempotency)."""
        if event_id in self.payment_events:
            return False
        self.payment_events[event_id] = copy.deepcopy(data)
        return True

    async def list_payment_events(self, limit: int = 50) -> list[dict[str, Any]]:
        rows = sorted(
            self.payment_events.values(),
            key=lambda e: e.get("at", ""),
            reverse=True,
        )
        return copy.deepcopy(rows[:limit])
