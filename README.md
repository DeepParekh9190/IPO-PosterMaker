# 📈 IPO Poster Maker

Turn live IPO listings into share-ready poster cards — price band, lot size, GMP and a scannable QR code, exported as an image.

**[Live demo →](https://ipo-poster-maker.vercel.app)** · [Report a bug](https://github.com/DeepParekh9190/IPO-PosterMaker/issues)

![Next.js](https://img.shields.io/badge/Next.js-App_Router-000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Deployed on Vercel](https://img.shields.io/badge/Vercel-deployed-black?logo=vercel&logoColor=white)

---

## Why

IPO content creators post the same numbers every week by hand: price band, lot size, GMP, dates. This app pulls the current IPO list, normalises it, and renders a branded poster card you can download and post in one click.

## Features

- **Live IPO feed** — server-side route (`app/api/ipos`) fetches and normalises listings into a typed `Ipo` model: board (Mainboard / SME), price band, lot size, minimum investment, GMP and GMP %, issue size, open / close / allotment / listing dates.
- **Poster card generator** — renders company logo, name, key numbers and a QR code that points at the source listing.
- **Logo proxy** — `app/api/logo/[id]` serves IPO logos through the server, avoiding hotlink/CORS breakage.
- **Copy helpers** — pre-built caption text per IPO for quick posting.
- **One-click download** of the finished card.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + React |
| Language | TypeScript |
| Poster + QR | Custom `ShareCard` component, `qrcode-generator` |
| Data | Route handlers normalising an external IPO feed |
| Hosting | Vercel |
| Tests | `node --test` on the normalisation layer |

## How it works

```
app/api/ipos/route.ts      fetch + normalise raw feed → Ipo[]
lib/ipos.ts                pure mapping: price band, lot, min investment, GMP %, dates
components/ShareCard.tsx   poster layout + QR + download
app/api/logo/[id]/route.ts logo proxy
```

The mapping in `lib/ipos.ts` is deliberately pure so it can be unit-tested without network access — `lib/ipos.test.ts` covers the formatting edge cases (null price band, missing dates, zero lot).

## Run locally

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # normalisation tests
```

## What I'd improve next

- Cache the IPO feed (currently fetched per request) with revalidation to cut upstream calls.
- Move poster rendering to `@vercel/og`/canvas so the export is pixel-perfect across browsers.
- Add a "post directly to X/LinkedIn" step instead of download-then-upload.
