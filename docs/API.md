# API reference

Base URL (local): `http://localhost:8000` · Interactive docs: `/docs` (Swagger) and `/redoc`.

Conventions
- JSON in/out; dates ISO `YYYY-MM-DD`; timestamps ISO 8601 UTC.
- Authentication: `Authorization: Bearer <token>` **or** the httpOnly `ipo_session` cookie set by `/api/auth/login`.
- Errors: `{"detail": "<human readable message>"}` with a standard status code (401/403/404/409/413/422/429/503).
- Rate limits per IP (429 + `Retry-After`): login/register 10/min, IPO refresh 10/min, export authorization 60/min, billing 20/min, default 300/min.

## Public

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness + runtime modes (`source_mode`, `payments_mode`, `persistence`) |
| GET | `/api/config` | App name, default language/size, watermark text, enabled templates, `demo_mode` |
| GET | `/api/plans` | Plan list with feature flags and prices |
| GET | `/api/ipos?q=&category=&status=` | IPO list. `category`: `Mainboard\|SME`; `status`: `upcoming\|open\|closed\|listed`. Returns `meta.last_updated`, `meta.stale`, `meta.demo_mode`, `meta.source_error` |
| GET | `/api/ipos/{ipo_id}` | One IPO (404 if unknown or hidden) |
| GET | `/api/ipos/{ipo_id}/logo` | Company logo image saved by the local `ipopremium` scraper cache (PNG/JPEG/WebP, 404 when absent) |
| GET | `/api/privacy` | Privacy notice + what is not collected |
| POST | `/api/auth/register` | `{email, password≥8, business_name?}` → 201, sets cookie, returns token |
| POST | `/api/auth/login` | `{email, password}` → 200 (401 invalid, 403 suspended), sets httpOnly cookie |
| POST | `/api/auth/logout` | Clears the session cookie |

## Authenticated (any active user)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/me` | User, plan, entitlements, `usage.exports_today`, subscription |
| GET/PUT | `/api/brand` | Brand profile (logo data URL, template, colours, footer). **PUT is paid-only** → 402 on free plan; logo validated for MIME (`png/jpeg/webp`) and size (≤400 KB) |
| DELETE | `/api/me` | Self-deletion: anonymises email, drops brand data, kills the session (privacy workflow) |
| POST | `/api/posters/authorize-export` | `{template_key, width, height}` → signed export token + `watermark` decision + limits. 402 when the plan's daily limit is used up or the template is premium; 400 for unknown/disabled templates |
| GET | `/api/posters/verify-token` | Debug/validation of an export token |
| POST | `/api/billing/checkout` | `{plan_id}` → `{mode:"test"\|"live", order…}`. In test mode: labelled notice, no credentials exposed |
| POST | `/api/billing/test/activate` | Test-mode entitlement. **403 when `PAYMENTS_MODE=live`** |
| GET | `/api/billing/subscription` | Current subscription |
| POST | `/api/billing/cancel` | Downgrade to free (audited) |

## Billing webhook (server-to-server)

`POST /api/billing/webhook` - raw body required. Signature verified with
`X-Razorpay-Signature` = HMAC-SHA256(body, `RAZORPAY_WEBHOOK_SECRET`). Invalid
signature → **401**. Events mapped: `subscription.activated|charged|pending|halted|cancelled|completed|paused`,
`payment.captured|failed`, `refund.processed`. Events are idempotent by
provider event id (replays return `{"status":"duplicate"}`).

## Admin (requires `role=admin`, checked server-side)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/admin/metrics` | Users, active subscribers, free/suspended counts, exports today/total, recent errors, source health, last refresh |
| GET | `/api/admin/users?q=` | Users + subscription + usage (credentials never returned) |
| PATCH | `/api/admin/users/{id}` | `{status?, role?, plan_id?, reason}` - audited administrative change |
| GET | `/api/admin/ipos` | All records including hidden ones, with meta |
| POST | `/api/admin/ipos/refresh` | Force refresh from the configured provider (audited). In `ipopremium` mode this **re-scrapes** the public pages and rewrites the local cache (button: "Re-scrape IPO data") |
| POST | `/api/admin/ipos` | Add a manual IPO (409 on duplicate id) |
| PATCH | `/api/admin/ipos/{id}` | Edit fields, `clear_fields: [...]` to blank them, `hidden`, `verified`, `reason` - stored as an override that survives refreshes |
| GET/PUT | `/api/admin/plans[/{id}]` | Plan names, prices, feature flags |
| GET/PUT | `/api/admin/templates[/{key}]` | Enable/disable, plan availability, single default |
| GET/PUT | `/api/admin/settings` | App name, support email, refresh interval, default language/size, watermark text, maintenance mode |
| GET | `/api/admin/audit` | Audit trail (actor, action, target, metadata, time) |
| GET | `/api/admin/payments` | Verified payment/webhook events |
| POST | `/api/admin/entitlements` | `{user_id, plan_id, reason}` - manual grant/revoke with audit trail |
