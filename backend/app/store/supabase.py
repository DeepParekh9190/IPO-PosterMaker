"""Supabase (PostgreSQL) store for production accounts.

Uses the PostgREST HTTP API with the service-role key, which keeps the
dependency list at `httpx` only. Run backend/db/schema.sql once to create the
tables. The service-role key must only ever live server-side.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx

from ..config import Settings


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class SupabaseStore:
    def __init__(self, settings: Settings) -> None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise ValueError(
                "PERSISTENCE=supabase requires SUPABASE_URL and "
                "SUPABASE_SERVICE_ROLE_KEY environment variables"
            )
        self._base = settings.supabase_url.rstrip("/") + "/rest/v1"
        self._headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
        }
        self._client = httpx.AsyncClient(timeout=10.0, headers=self._headers)
        # Supabase keeps its own idempotency state, but webhook events are also
        # mirrored in the payment_events table with a unique event id.

    async def aclose(self) -> None:
        await self._client.aclose()

    # -- generic helpers ---------------------------------------------------
    async def _one(
        self, table: str, params: list[tuple[str, str]]
    ) -> dict[str, Any] | None:
        resp = await self._client.get(f"{self._base}/{table}", params=params)
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if rows else None

    async def _rows(
        self, table: str, params: list[tuple[str, str]]
    ) -> list[dict[str, Any]]:
        resp = await self._client.get(f"{self._base}/{table}", params=params)
        resp.raise_for_status()
        return resp.json()

    async def _insert(self, table: str, payload: dict[str, Any]) -> dict[str, Any]:
        resp = await self._client.post(
            f"{self._base}/{table}", json=payload, headers={"Prefer": "return=representation"}
        )
        resp.raise_for_status()
        return resp.json()[0]

    async def _update(
        self, table: str, params: list[tuple[str, str]], payload: dict[str, Any]
    ) -> list[dict[str, Any]]:
        resp = await self._client.patch(
            f"{self._base}/{table}",
            params=params,
            json=payload,
            headers={"Prefer": "return=representation"},
        )
        resp.raise_for_status()
        return resp.json()

    # -- users -------------------------------------------------------------
    async def create_user(self, user: dict[str, Any]) -> dict[str, Any]:
        payload = {
            "id": user["id"],
            "email": user["email"],
            "password_hash": user["password_hash"],
            "role": user.get("role", "client"),
            "status": user.get("status", "active"),
            "business_name": user.get("business_name"),
            "created_at": user.get("created_at", _now()),
        }
        return await self._insert("users", payload)

    async def get_user(self, user_id: str) -> dict[str, Any] | None:
        return await self._one("users", [("id", f"eq.{user_id}")])

    async def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        return await self._one("users", [("email", f"eq.{email.strip().lower()}")])

    async def list_users(
        self, q: str = "", limit: int = 50, offset: int = 0
    ) -> list[dict[str, Any]]:
        params = [
            ("order", "created_at.desc"),
            ("limit", str(limit)),
            ("offset", str(offset)),
        ]
        if q:
            params.append(
                ("or", f"email.ilike.*{q}*,business_name.ilike.*{q}*")
            )
        return await self._rows("users", params)

    async def count_users(self) -> int:
        rows = await self._rows("users", [("select", "id"), ("limit", "10000")])
        return len(rows)

    async def update_user(self, user_id: str, **fields: Any) -> dict[str, Any] | None:
        allowed = {k: v for k, v in fields.items() if k in {"role", "status", "business_name"}}
        if not allowed:
            return await self.get_user(user_id)
        rows = await self._update("users", [("id", f"eq.{user_id}")], allowed)
        return rows[0] if rows else None

    # -- subscriptions -----------------------------------------------------
    async def get_subscription(self, user_id: str) -> dict[str, Any] | None:
        return await self._one("subscriptions", [("user_id", f"eq.{user_id}")])

    async def set_subscription(self, sub: dict[str, Any]) -> dict[str, Any]:
        payload = dict(sub)
        payload["updated_at"] = _now()
        existing = await self.get_subscription(sub["user_id"])
        if existing:
            rows = await self._update(
                "subscriptions", [("user_id", f"eq.{sub['user_id']}")], payload
            )
            return rows[0]
        return await self._insert("subscriptions", payload)

    # -- plans -------------------------------------------------------------
    async def list_plans(self) -> list[dict[str, Any]]:
        return await self._rows("plans", [("order", "price_inr.asc")])

    async def get_plan(self, plan_id: str) -> dict[str, Any] | None:
        return await self._one("plans", [("id", f"eq.{plan_id}")])

    async def upsert_plan(self, plan: dict[str, Any]) -> dict[str, Any]:
        payload = dict(plan)
        payload["features"] = payload.get("features") or {}
        resp = await self._client.post(
            f"{self._base}/plans",
            json=payload,
            headers={
                "Prefer": "resolution=merge-duplicates,return=representation",
                "on_conflict": "id",
            },
        )
        resp.raise_for_status()
        return resp.json()[0]

    # -- brand profiles ----------------------------------------------------
    async def get_brand(self, user_id: str) -> dict[str, Any] | None:
        return await self._one("brand_profiles", [("user_id", f"eq.{user_id}")])

    async def set_brand(self, user_id: str, brand: dict[str, Any]) -> dict[str, Any]:
        payload = dict(brand)
        payload["user_id"] = user_id
        payload["updated_at"] = _now()
        existing = await self.get_brand(user_id)
        if existing:
            rows = await self._update(
                "brand_profiles", [("user_id", f"eq.{user_id}")], payload
            )
            return rows[0]
        return await self._insert("brand_profiles", payload)

    # -- audit -------------------------------------------------------------
    async def append_audit(self, event: dict[str, Any]) -> None:
        payload = dict(event)
        payload.setdefault("at", _now())
        await self._insert("audit_events", payload)

    async def list_audit(self, limit: int = 100) -> list[dict[str, Any]]:
        return await self._rows(
            "audit_events", [("order", "at.desc"), ("limit", str(limit))]
        )

    # -- usage -------------------------------------------------------------
    async def incr_usage(self, user_id: str, key: str) -> int:
        rows = await self._rows(
            "usage_counters",
            [("user_id", f"eq.{user_id}"), ("counter_key", f"eq.{key}")],
        )
        if rows:
            new_value = int(rows[0]["value"]) + 1
            await self._update(
                "usage_counters",
                [("id", f"eq.{rows[0]['id']}")],
                {"value": new_value},
            )
            return new_value
        await self._insert(
            "usage_counters", {"user_id": user_id, "counter_key": key, "value": 1}
        )
        return 1

    async def get_usage(self, user_id: str, key: str) -> int:
        row = await self._one(
            "usage_counters",
            [("user_id", f"eq.{user_id}"), ("counter_key", f"eq.{key}")],
        )
        return int(row["value"]) if row else 0

    # -- IPO overrides -----------------------------------------------------
    async def list_ipo_overrides(self) -> list[dict[str, Any]]:
        rows = await self._rows("ipo_overrides", [("order", "updated_at.desc")])
        # Normalized to the same shape the memory store returns.
        return [r["record"] for r in rows if isinstance(r.get("record"), dict)]

    async def set_ipo_override(self, ipo_id: str, record: dict[str, Any]) -> None:
        payload = {"ipo_id": ipo_id, "record": dict(record), "updated_at": _now()}
        existing = await self._one("ipo_overrides", [("ipo_id", f"eq.{ipo_id}")])
        if existing:
            await self._update(
                "ipo_overrides", [("ipo_id", f"eq.{ipo_id}")], payload
            )
        else:
            await self._insert("ipo_overrides", payload)

    async def delete_ipo_override(self, ipo_id: str) -> bool:
        resp = await self._client.delete(
            f"{self._base}/ipo_overrides", params=[("ipo_id", f"eq.{ipo_id}")]
        )
        resp.raise_for_status()
        return True

    # -- settings / payments ----------------------------------------------
    async def get_settings_data(self) -> dict[str, Any]:
        row = await self._one("app_settings", [("id", "eq.1")])
        return dict(row["data"]) if row and row.get("data") else {}

    async def save_settings_data(self, data: dict[str, Any]) -> None:
        payload = {"id": 1, "data": data, "updated_at": _now()}
        resp = await self._client.post(
            f"{self._base}/app_settings",
            json=payload,
            headers={
                "Prefer": "resolution=merge-duplicates,return=representation",
                "on_conflict": "id",
            },
        )
        resp.raise_for_status()

    async def record_payment_event(self, event_id: str, data: dict[str, Any]) -> bool:
        try:
            await self._insert(
                "payment_events", {"event_id": event_id, "data": data, "at": _now()}
            )
            return True
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == "409":
                return False
            raise

    async def list_payment_events(self, limit: int = 50) -> list[dict[str, Any]]:
        return await self._rows(
            "payment_events", [("order", "at.desc"), ("limit", str(limit))]
        )
