import { describe, expect, it } from "vitest";
import { buildMessage, telegramShareUrl, waShareUrl } from "./messages";
import type { Ipo, Lang } from "./types";

const LANGS: Lang[] = ["en", "hi", "gu"];

const full: Ipo = {
  id: "demo-1",
  company_name: "Aurora Industries Ltd",
  category: "Mainboard",
  open_date: "2026-10-12",
  close_date: "2026-10-14",
  allotment_date: "2026-10-16",
  listing_date: "2026-10-19",
  price_min: 320,
  price_max: 340,
  lot_size: 44,
  issue_size_cr: 2500,
  gmp: 15,
  gmp_percent: 4.5,
  subscription: "2.1x",
  status: "open",
  min_investment: 14960,
  source_url: "https://example.com/aurora",
  source_name: "Example Exchange",
  logo_url: null,
  updated_at: "2026-10-13T09:00:00Z",
  verified: true,
  hidden: false,
  manual: true,
  is_demo: true,
  notes: null,
};

const sparse: Ipo = {
  ...full,
  id: "demo-2",
  company_name: "Sparse Ltd",
  open_date: null,
  close_date: null,
  allotment_date: null,
  listing_date: null,
  price_min: null,
  price_max: null,
  lot_size: null,
  issue_size_cr: null,
  gmp: null,
  gmp_percent: null,
  subscription: null,
  min_investment: null,
  source_url: null,
  notes: null,
};

describe("buildMessage", () => {
  it("never emits unresolved placeholders for a sparse record, in any language", () => {
    for (const lang of LANGS) {
      const msg = buildMessage(sparse, lang);
      expect(msg, lang).not.toMatch(/undefined|null|NaN|\[.*?\]|\{\{/);
      // localized "Not available" must replace missing values
      expect(msg).toContain(naFor(lang));
    }
  });

  it("localizes the not-available fallback", () => {
    expect(buildMessage(sparse, "hi")).toContain("उपलब्ध नहीं");
    expect(buildMessage(sparse, "gu")).toContain("ઉપલબ્ધ નથી");
    expect(buildMessage(sparse, "en")).toContain("Not available");
  });

  it("renders all values for a complete record", () => {
    const msg = buildMessage(full, "en");
    expect(msg).toContain("Aurora Industries Ltd");
    expect(msg).toContain("₹320");
    expect(msg).toContain("2.1x");
    expect(msg).toContain("https://example.com/aurora");
    expect(msg).toContain("For educational information only");
  });

  it("applies platform-specific bold markers", () => {
    expect(buildMessage(full, "en", "whatsapp")).toContain("*Price Band*");
    expect(buildMessage(full, "en", "telegram")).toContain("**Price Band**");
    expect(buildMessage(full, "en", "plain")).toContain("Price Band:");
    expect(buildMessage(full, "en", "plain")).not.toMatch(/[*]/);
  });
});

describe("share urls", () => {
  it("encodes the WhatsApp text so newlines and symbols survive the URL", () => {
    const text = buildMessage(full, "en");
    const url = waShareUrl(text);
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(url).not.toMatch(/\n/);
    expect(decodeURIComponent(url.slice("https://wa.me/?text=".length))).toBe(text);
  });

  it("encodes the Telegram text", () => {
    const text = "IPO & price = ₹340? #test";
    const url = telegramShareUrl(text);
    expect(url.startsWith("https://t.me/share/url?url=&text=")).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1])).toBe(text);
  });
});

function naFor(lang: Lang): string {
  return { en: "Not available", hi: "उपलब्ध नहीं", gu: "ઉપલબ્ધ નથી" }[lang];
}
