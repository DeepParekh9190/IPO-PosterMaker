"""Pydantic request/response schemas. All IPO data is validated and normalized
before it is stored, returned or used in a poster."""

from __future__ import annotations

from datetime import date, datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Category(str, Enum):
    MAINBOARD = "Mainboard"
    SME = "SME"


class IpoStatus(str, Enum):
    UPCOMING = "upcoming"
    OPEN = "open"
    CLOSED = "closed"
    LISTED = "listed"


class IpoRecord(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    company_name: str = Field(min_length=1, max_length=160)
    category: Category = Category.MAINBOARD
    open_date: date | None = None
    close_date: date | None = None
    allotment_date: date | None = None
    listing_date: date | None = None
    price_min: float | None = Field(default=None, ge=0)
    price_max: float | None = Field(default=None, ge=0)
    lot_size: int | None = Field(default=None, ge=1)
    issue_size_cr: float | None = Field(default=None, ge=0)
    gmp: float | None = None
    gmp_percent: float | None = None
    subscription: str | None = Field(default=None, max_length=60)
    status: IpoStatus = IpoStatus.UPCOMING
    min_investment: float | None = Field(default=None, ge=0)
    source_url: str | None = Field(default=None, max_length=500)
    source_name: str = Field(default="Demo data", max_length=80)
    logo_url: str | None = Field(default=None, max_length=500)
    updated_at: datetime = Field(default_factory=utcnow)
    verified: bool = False
    hidden: bool = False
    manual: bool = False
    is_demo: bool = False
    notes: str | None = Field(default=None, max_length=400)

    @field_validator(
        "price_min", "price_max", "issue_size_cr", "gmp", "gmp_percent", mode="before"
    )
    @classmethod
    def _blank_to_none(cls, value: Any) -> Any:
        if isinstance(value, str) and value.strip() == "":
            return None
        return value

    @model_validator(mode="after")
    def _derive(self) -> "IpoRecord":
        if self.min_investment is None and self.lot_size and self.price_max:
            self.min_investment = round(self.lot_size * self.price_max, 2)
        if self.price_min and self.price_max and self.price_min > self.price_max:
            self.price_min, self.price_max = self.price_max, self.price_min
        return self


class IpoListMeta(BaseModel):
    last_updated: datetime | None = None
    stale: bool = False
    provider: str = "demo"
    demo_mode: bool = True
    source_error: str | None = None
    total: int = 0


class IpoListResponse(BaseModel):
    items: list[IpoRecord]
    meta: IpoListMeta


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    business_name: str | None = Field(default=None, max_length=80)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    id: str
    email: str
    role: str
    status: str
    business_name: str | None = None
    created_at: datetime


class AuthResponse(BaseModel):
    user: UserOut
    token: str
    expires_in: int


class PlanFeatures(BaseModel):
    watermark_free: bool = False
    daily_exports: int = 10
    premium_templates: bool = False
    save_brand: bool = False
    extras: dict[str, bool] = Field(default_factory=dict)


class Plan(BaseModel):
    id: str
    name: str
    price_inr: int = 0
    period: str = "month"
    description: str = ""
    features: PlanFeatures = Field(default_factory=PlanFeatures)
    active: bool = True


class PlanUpsert(BaseModel):
    name: str | None = Field(default=None, max_length=60)
    price_inr: int | None = Field(default=None, ge=0)
    description: str | None = Field(default=None, max_length=200)
    active: bool | None = None
    features: PlanFeatures | None = None


class Subscription(BaseModel):
    user_id: str
    plan_id: str = "free"
    status: str = "active"  # active | pending | past_due | cancelled | expired
    provider: str | None = None
    provider_ref: str | None = None
    current_period_end: datetime | None = None
    updated_at: datetime = Field(default_factory=utcnow)


class MeResponse(BaseModel):
    user: UserOut
    plan: Plan
    entitlements: PlanFeatures
    usage: dict[str, Any]
    subscription: Subscription | None = None


# --------------------------------------------------------------------------
# Brand profile
# --------------------------------------------------------------------------
ALLOWED_IMAGE_MIMES = {"image/png", "image/jpeg", "image/webp"}
MAX_LOGO_BYTES = 400_000


class BrandProfile(BaseModel):
    business_name: str = Field(default="", max_length=80)
    logo_data_url: str | None = None
    logo_mime: str | None = None
    template_key: str = Field(default="clean-white", max_length=40)
    color_theme: str = Field(default="finance-green", max_length=40)
    footer_text: str = Field(default="", max_length=120)

    @field_validator("logo_data_url")
    @classmethod
    def _validate_logo(cls, value: str | None) -> str | None:
        if not value:
            return None
        if not value.startswith("data:"):
            raise ValueError("Logo must be a data URL produced by an upload")
        try:
            header, data = value.split(",", 1)
        except ValueError as exc:  # pragma: no cover - defensive
            raise ValueError("Malformed logo data URL") from exc
        mime = header[5:].split(";")[0].lower()
        if mime not in ALLOWED_IMAGE_MIMES:
            raise ValueError("Logo must be PNG, JPEG or WebP")
        # Rough base64 size check (4 chars -> 3 bytes).
        if len(data) > MAX_LOGO_BYTES * 4 / 3 + 8:
            raise ValueError("Logo too large (max 400KB)")
        return value

    @field_validator("footer_text", "business_name")
    @classmethod
    def _strip_text(cls, value: str) -> str:
        return " ".join(value.split())


# --------------------------------------------------------------------------
# Poster export
# --------------------------------------------------------------------------
class ExportAuthorizeRequest(BaseModel):
    template_key: str = Field(default="clean-white", max_length=40)
    width: int = Field(default=1080, ge=360, le=2160)
    height: int = Field(default=1080, ge=360, le=2700)


class ExportAuthorizeResponse(BaseModel):
    token: str
    watermark: bool
    watermark_text: str
    template_key: str
    width: int
    height: int
    expires_at: int
    plan_id: str


# --------------------------------------------------------------------------
# Admin
# --------------------------------------------------------------------------
class AdminIpoCreate(BaseModel):
    company_name: str = Field(min_length=1, max_length=160)
    category: Category = Category.MAINBOARD
    open_date: date | None = None
    close_date: date | None = None
    allotment_date: date | None = None
    listing_date: date | None = None
    price_min: float | None = Field(default=None, ge=0)
    price_max: float | None = Field(default=None, ge=0)
    lot_size: int | None = Field(default=None, ge=1)
    issue_size_cr: float | None = Field(default=None, ge=0)
    gmp: float | None = None
    gmp_percent: float | None = None
    subscription: str | None = Field(default=None, max_length=60)
    status: IpoStatus = IpoStatus.UPCOMING
    source_url: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=400)


class AdminIpoPatch(BaseModel):
    """Any field left as None is unchanged (use explicit nulls via clear_fields)."""

    company_name: str | None = Field(default=None, max_length=160)
    category: Category | None = None
    open_date: date | None = None
    close_date: date | None = None
    allotment_date: date | None = None
    listing_date: date | None = None
    price_min: float | None = Field(default=None, ge=0)
    price_max: float | None = Field(default=None, ge=0)
    lot_size: int | None = Field(default=None, ge=1)
    issue_size_cr: float | None = Field(default=None, ge=0)
    gmp: float | None = None
    gmp_percent: float | None = None
    subscription: str | None = Field(default=None, max_length=60)
    status: IpoStatus | None = None
    hidden: bool | None = None
    verified: bool | None = None
    source_url: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=400)
    clear_fields: list[str] = Field(default_factory=list)
    reason: str = Field(default="", max_length=200)


class AdminUserPatch(BaseModel):
    status: str | None = Field(default=None, pattern="^(active|suspended)$")
    role: str | None = Field(default=None, pattern="^(client|admin)$")
    plan_id: str | None = Field(default=None, max_length=40)
    reason: str = Field(default="", max_length=200)


class TemplateConfig(BaseModel):
    key: str
    name: str
    plan: str = Field(pattern="^(free|pro)$")
    enabled: bool = True
    is_default: bool = False
    description: str = ""


class AppSettingsOut(BaseModel):
    app_name: str
    support_email: str = ""
    source_mode: str = "demo"
    source_name: str = "Demo data"
    refresh_interval_minutes: int = 30
    default_language: str = "en"
    default_width: int = 1080
    default_height: int = 1080
    maintenance_mode: bool = False
    default_watermark_text: str = "Created with IPO Poster Studio"


class AppSettingsPatch(BaseModel):
    app_name: str | None = Field(default=None, max_length=60)
    support_email: str | None = Field(default=None, max_length=120)
    refresh_interval_minutes: int | None = Field(default=None, ge=5, le=1440)
    default_language: str | None = Field(default=None, pattern="^(en|hi|gu)$")
    default_width: int | None = Field(default=None, ge=360, le=2160)
    default_height: int | None = Field(default=None, ge=360, le=2700)
    maintenance_mode: bool | None = None
    default_watermark_text: str | None = Field(default=None, max_length=80)


class EntitlementGrant(BaseModel):
    user_id: str
    plan_id: str
    reason: str = Field(min_length=3, max_length=200)


class AdminMetrics(BaseModel):
    total_users: int
    active_subscribers: int
    free_users: int
    suspended_users: int
    poster_exports_today: int
    poster_exports_total: int
    recent_errors: list[dict[str, Any]]
    source_health: dict[str, Any]
    last_successful_refresh: datetime | None
    payments_mode: str
    persistence: str
