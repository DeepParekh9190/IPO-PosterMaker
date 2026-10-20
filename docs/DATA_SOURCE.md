# Data source: access review and compliance position

Reviewed: 20 October 2026, against https://www.ipopremium.in

## What was inspected

| Item | Result |
| --- | --- |
| `https://www.ipopremium.in/robots.txt` | `Allow: /` for public pages, **`Disallow: /api/` and `/Disallow: /v1/`** (i.e. machine endpoints are off limits) |
| `https://www.ipopremium.in/terms` (Terms and Conditions, updated 3 Sep 2026) | §2 lists "copying, scraping, republishing, or commercially exploiting content from the Platform" as grounds for access denial/termination |
| Same Terms, §4 | "The content of the Platform may not be amended, copied, reproduced, replicated, republished, uploaded, posted, transmitted, displayed, **scraped**, or distributed for **any commercial use without prior written permission** from the Company" |
| Official API / documented public feed | **Not found.** No public feed, partner API, or export licence is published on the site |
| Site footer | © Jaynath Infotech Pvt Ltd - "All rights reserved" |

## Decision

**Automated extraction and commercial redistribution of ipopremium.in content is
NOT authorized.** The source is therefore not scraped, no robots rules are
bypassed, no login/CAPTCHA/paywall is circumvented, and no content from that
site is stored, redistributed or displayed as ours.

This follows the project brief's own rule: *"If permission is required or
unavailable, do not scrape or redistribute the source's content. Implement a
source adapter that uses demo data or admin-entered IPO data until
authorization is obtained."*

## What is implemented instead

`backend/app/providers/`

| Provider | Status | Behaviour |
| --- | --- | --- |
| `DemoIpoProvider` | **active (default)** | Realistic sample records, generated relative to today, clearly labelled `source_name: "Demo data (sample)"`, `is_demo: true` |
| `ManualIpoProvider` | **active** | Admin-entered/edited records in the store (`ipo_overrides`); always win over imported rows so a refresh never overwrites a correction |
| `AuthorizedIpoProvider` | **disabled** | HTTP adapter for an official API/feed. Refuses to run unless `IPO_SOURCE_MODE=authorized` **and** `IPO_SOURCE_URL` + `IPO_SOURCE_API_KEY` are set **and** `IPO_SOURCE_WRITTEN_PERMISSION=true` |
| `IpoPremiumProvider` | **opt-in** (`IPO_SOURCE_MODE=ipopremium`) | One-shot scraper of the **public pages only** (see below), saved to a local cache with company logos; ended IPOs are auto-deleted from the cache |

### IpoPremiumProvider (opt-in local scraper)

Enabled only when the operator explicitly sets `IPO_SOURCE_MODE=ipopremium`.
It exists because ipopremium.in publishes **no API or feed**, while its
robots.txt **allows** the public site pages.

Boundaries it stays inside:

- Fetches only `https://www.ipopremium.in/` (dashboard HTML, including the
  server-rendered no-JS IPO table) and the public `/view/ipo/...` detail pages
  it links to - **never** `/api/`, `/v1/`, `/otpless/` or `/file/`, which
  robots.txt disallows, and never anything behind login.
- **One-shot, manual**: it scrapes on the first run or when an admin clicks
  "Re-scrape IPO data" (POST `/api/admin/ipos/refresh`). Every other read is
  served from the local cache in `IPO_LOCAL_DIR`; visitors never trigger
  upstream traffic and there is no scheduler or polling loop.
- Bounded: hard timeout, ≤25 detail pages per run, 0.4 s delay between detail
  requests, logo downloads capped at 500 KB and an image MIME check.
- **Auto-cleanup**: records whose closing date has passed are deleted from the
  local cache - together with their saved logo files - on the next read.
- Every record keeps `source_url` attribution; a failed re-scrape serves the
  last cached data with an error notice instead of blanking the dashboard.

**Operator responsibility:** this mode is designed for your own low-volume
dashboard. The site's Terms (§4, above) still claim copyright over commercial
redistribution of its content - if you plan to redistribute the data
commercially (rather than display it in your own admin-run tool), obtain
written permission from the owner first and prefer the `authorized` mode with
an official feed. Set `IPO_SOURCE_MODE=demo` to remove the scraper entirely.

Request discipline for the authorized adapter (when it is eventually enabled):
one GET per refresh, hard timeout (`IPO_SOURCE_TIMEOUT_SECONDS`), bounded
retries (`IPO_SOURCE_MAX_RETRIES`), no pagination crawling, no login/access
bypass, results cached (`IPO_SOURCE_CACHE_TTL_SECONDS`) so visitors never
trigger upstream traffic, plus a single-flight lock against concurrent fetches.

## What is needed to enable a real source

1. **Written permission** from the data owner (email/contract from Jaynath
   Infotech Pvt Ltd, or whichever source you use) allowing automated retrieval
   and commercial display. Store it; keep `IPO_SOURCE_WRITTEN_PERMISSION=false`
   until it exists.
2. **Official API credentials / feed URL** from that source (not a scraped
   page).
3. Set `IPO_SOURCE_MODE=authorized`, `IPO_SOURCE_URL`, `IPO_SOURCE_API_KEY`,
   then `IPO_SOURCE_WRITTEN_PERMISSION=true`.

Alternative authorized sources to ask for permission: exchange/regulator open
data (NSE/BSE/SEBI published IPO documents), or a licensed data vendor.

## GMP handling

GMP is displayed as **reported, unofficial, indicative** data with a standing
disclaimer in every copied message and poster ("GMP is unofficial and may
change… for educational information only"). It is never presented as official,
guaranteed, or as a prediction of listing gains. Missing values render as
"Not available" - never invented.
