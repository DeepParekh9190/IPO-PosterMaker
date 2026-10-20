# IPO Poster Studio (IPO PosterMaker)

A SaaS web application for Indian IPO distributors and financial creators:
it displays IPO information on a dashboard, formats shareable WhatsApp/social
messages, and generates client-branded social media posters (PNG export).

- **Frontend**: Next.js 16 + TypeScript + Tailwind CSS (`frontend/`)
- **Backend**: Python 3.12 + FastAPI (`backend/`)
- **Docs**: API reference in [`docs/API.md`](docs/API.md) · data-source
  compliance position in [`docs/DATA_SOURCE.md`](docs/DATA_SOURCE.md)

## Features

- Client dashboard: searchable IPO list, Mainboard/SME and status filters,
  IPO detail modal, loading/empty/error states, mobile responsive.
- Copy & Share: formatted messages in English/Hindi/Gujarati, one-click
  WhatsApp / Telegram sharing, clipboard fallback.
- Poster Studio: 5 templates, client logo upload, colour themes, field
  toggles, PNG export at 1080×1080 and 1080×1350. Free plan exports carry a
  watermark; watermark-free export is authorised server-side for paid plans.
- Admin panel: users, subscriptions, IPO management (add/edit/verify/hide,
  source refresh), template and plan configuration, metrics, audit trail.
- Auth with httpOnly sessions; payments via Razorpay (test mode by default,
  signature-verified webhooks).
- Storage: in-memory (demo, no database) or Supabase Postgres.

## IPO data sources

The backend is provider-based (`backend/app/providers/`):

| Mode (`IPO_SOURCE_MODE`) | Behaviour |
| --- | --- |
| `demo` (default) | Realistic sample records, fully offline |
| `ipopremium` | **One-shot scraper of the public ipopremium.in pages**, saved to a local cache (`IPO_LOCAL_DIR`) with company logos; ended IPOs are auto-deleted from the cache; re-scrape from the admin "Re-scrape IPO data" button |
| `authorized` | Official API/feed; requires URL + API key + `IPO_SOURCE_WRITTEN_PERMISSION=true` |

Read [`docs/DATA_SOURCE.md`](docs/DATA_SOURCE.md) before enabling
`ipopremium` mode: it only fetches robots.txt-allowed public pages, one manual
scrape at a time, but commercial redistribution of the source's content may
require written permission from the site owner.

## Local development

1. **Backend**

   ```bash
   cd backend
   python -m venv .venv
   .venv\Scripts\activate        # Windows; use `source .venv/bin/activate` on macOS/Linux
   pip install -r requirements.txt
   copy ..\.env.example ..\.env  # then edit values (Windows; `cp` elsewhere)
   uvicorn app.main:app --reload
   ```

   API: http://localhost:8000 (interactive docs at `/docs`).
   Default seeded admin: `admin@example.com` / `admin12345` — change it via
   `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`.

2. **Frontend**

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   App: http://localhost:3000. It calls the API at `NEXT_PUBLIC_API_URL`
   (default `http://localhost:8000`).

3. **Tests**

   ```bash
   cd backend && python -m pytest    # FastAPI backend suite
   cd frontend && npx vitest run     # frontend unit tests
   ```

## Deployment (Vercel)

Deploy `frontend/` and `backend/` as **two Vercel projects** (the backend is a
Python app; see `backend/vercel.json`). Set environment variables from
[`.env.example`](.env.example) in each project's settings — never commit a
filled `.env`.

Notes:

- Serverless functions have no persistent disk: `ipopremium` local-cache mode
  is intended for local/self-hosted runs. On Vercel use `demo` mode or the
  `authorized` provider, and `PERSISTENCE=supabase` for accounts.
- There is no background scheduler in a request handler: refresh IPO data with
  the admin button or an external scheduler that calls the authenticated
  refresh endpoint.

## Repository layout

```
backend/   FastAPI app (providers, routers, services, store, tests)
frontend/  Next.js app (dashboard, poster studio, admin panel)
docs/      API.md, DATA_SOURCE.md
.env.example   Environment template for both apps
```
