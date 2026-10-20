"use client";

import { formatDate, formatGmp, formatINR, formatIssueSize, formatLot, statusLabel } from "@/lib/format";
import type { Ipo, Lang } from "@/lib/types";

export type TemplateKey =
  | "clean-white"
  | "premium-corporate"
  | "dark-market"
  | "minimal-announcement"
  | "gujarati-business";

export type ThemeKey = "finance-green" | "navy-gold" | "charcoal" | "crimson" | "sky";

export const THEMES: { key: ThemeKey; label: string; swatch: string }[] = [
  { key: "finance-green", label: "Finance Green", swatch: "#059669" },
  { key: "navy-gold", label: "Navy Gold", swatch: "#b8860b" },
  { key: "charcoal", label: "Charcoal", swatch: "#334155" },
  { key: "crimson", label: "Crimson", swatch: "#be123c" },
  { key: "sky", label: "Sky Blue", swatch: "#0284c7" },
];

export const ACCENTS: Record<ThemeKey, string> = {
  "finance-green": "#059669",
  "navy-gold": "#b8860b",
  charcoal: "#334155",
  crimson: "#be123c",
  sky: "#0284c7",
};

export interface FieldToggles {
  dates: boolean;
  price: boolean;
  lot: boolean;
  issue: boolean;
  minInvestment: boolean;
  gmp: boolean;
  subscription: boolean;
  allotment: boolean;
  listing: boolean;
  status: boolean;
  disclaimer: boolean;
  source: boolean;
}

export const DEFAULT_FIELDS: FieldToggles = {
  dates: true,
  price: true,
  lot: true,
  issue: true,
  minInvestment: true,
  gmp: true,
  subscription: true,
  allotment: false,
  listing: false,
  status: true,
  disclaimer: true,
  source: true,
};

export interface PosterSettings {
  template: TemplateKey;
  theme: ThemeKey;
  fields: FieldToggles;
  businessName: string;
  footerText: string;
  logoDataUrl: string | null;
  logoX: number; // percent of poster width
  logoY: number;
  logoSize: number; // percent of poster width
  width: number;
  height: number;
  language: Lang;
  watermark: boolean;
  watermarkText: string;
}

interface TemplatePalette {
  background: string;
  surface: string;
  border: string;
  heading: string;
  body: string;
  muted: string;
  label: string;
  accent: string;
  accentText: string;
  headingWeight: number;
  headingSize: number;
  uppercaseHeader: boolean;
}

function paletteFor(template: TemplateKey, accent: string): TemplatePalette {
  switch (template) {
    case "premium-corporate":
      return {
        background: "#0b1f3a",
        surface: "#13294b",
        border: "#23406b",
        heading: "#f8fafc",
        body: "#e2e8f0",
        muted: "#94a3b8",
        label: "#8ea6c9",
        accent: accent === "#059669" ? "#d4af37" : accent,
        accentText: "#0b1f3a",
        headingWeight: 800,
        headingSize: 76,
        uppercaseHeader: true,
      };
    case "dark-market":
      return {
        background: "#0b1120",
        surface: "#111a2e",
        border: "#1f2b42",
        heading: "#f1f5f9",
        body: "#dbe4f0",
        muted: "#7c8ba1",
        label: "#64748b",
        accent: accent === "#b8860b" ? "#10b981" : accent,
        accentText: "#ffffff",
        headingWeight: 800,
        headingSize: 74,
        uppercaseHeader: true,
      };
    case "minimal-announcement":
      return {
        background: "#fafafa",
        surface: "#ffffff",
        border: "#e5e7eb",
        heading: "#111827",
        body: "#1f2937",
        muted: "#6b7280",
        label: "#9ca3af",
        accent,
        accentText: "#ffffff",
        headingWeight: 700,
        headingSize: 84,
        uppercaseHeader: false,
      };
    case "gujarati-business":
      return {
        background: "#fffaf3",
        surface: "#ffffff",
        border: "#f3e2c7",
        heading: "#7c2d12",
        body: "#3f2d1e",
        muted: "#8a6a4b",
        label: "#a9805a",
        accent: "#ea580c",
        accentText: "#ffffff",
        headingWeight: 800,
        headingSize: 70,
        uppercaseHeader: false,
      };
    case "clean-white":
    default:
      return {
        background: "#ffffff",
        surface: "#f8fafc",
        border: "#e2e8f0",
        heading: "#0f172a",
        body: "#1e293b",
        muted: "#64748b",
        label: "#94a3b8",
        accent,
        accentText: "#ffffff",
        headingWeight: 800,
        headingSize: 78,
        uppercaseHeader: true,
      };
  }
}

const NA: Record<Lang, string> = {
  en: "Not available",
  hi: "उपलब्ध नहीं",
  gu: "ઉપલબ્ધ નથી",
};

const HEADINGS: Record<Lang, { newIpo: string; dates: string; disclaimer: string; gmpNote: string }> = {
  en: {
    newIpo: "NEW IPO",
    dates: "IPO Dates",
    disclaimer:
      "For educational information only. GMP is unofficial, indicative and may change. Not investment advice.",
    gmpNote: "Reported GMP - unofficial",
  },
  hi: {
    newIpo: "नया IPO",
    dates: "IPO तिथियाँ",
    disclaimer:
      "केवल शैक्षिक जानकारी के लिए। GMP अनौपचारिक है और बदल सकता है। यह निवेश सलाह नहीं है।",
    gmpNote: "रिपोर्टेड GMP - अनौपचारिक",
  },
  gu: {
    newIpo: "નવો IPO",
    dates: "IPO તારીખો",
    disclaimer:
      "માત્ર શૈક્ષણિક માહિતી માટે. GMP અનધિકૃત છે અને બદલાઈ શકે છે. રોકાણ સલાહ નથી.",
    gmpNote: "રિપોર્ટેડ GMP - અનધિકૃત",
  },
};

const LABELS: Record<Lang, Record<string, string>> = {
  en: {
    price: "Price Band", lot: "Lot Size", issue: "Issue Size", min: "Min Investment",
    gmp: "GMP", sub: "Subscription", allot: "Allotment", listing: "Listing", status: "Status",
    source: "Source",
  },
  hi: {
    price: "मूल्य सीमा", lot: "लॉट साइज़", issue: "इश्यू साइज़", min: "न्यूनतम निवेश",
    gmp: "GMP", sub: "सब्सक्रिप्शन", allot: "अलॉटमेंट", listing: "लिस्टिंग", status: "स्थिति",
    source: "स्रोत",
  },
  gu: {
    price: "ભાવ સીમા", lot: "લોટ સાઇઝ", issue: "ઇશ્યુ સાઇઝ", min: "લઘુતમ રોકાણ",
    gmp: "GMP", sub: "સબ્સ્ક્રિપ્શન", allot: "ફાળવણી", listing: "લિસ્ટિંગ", status: "સ્થિતિ",
    source: "સ્રોત",
  },
};

export function PosterCanvas({
  ipo,
  settings,
  forwardRef,
}: {
  ipo: Ipo;
  settings: PosterSettings;
  forwardRef?: (node: HTMLDivElement | null) => void;
}) {
  const accent = ACCENTS[settings.theme];
  const p = paletteFor(settings.template, accent);
  const t = HEADINGS[settings.language];
  const l = LABELS[settings.language];
  const na = NA[settings.language];
  const lang = settings.language;

  const cells: { label: string; value: string; tone?: string }[] = [];
  const add = (enabled: boolean, label: string, value: string, tone?: string) => {
    if (enabled) cells.push({ label, value, tone });
  };

  const priceValue =
    ipo.price_min !== null && ipo.price_max !== null
      ? `${formatINR(ipo.price_min, lang)} – ${formatINR(ipo.price_max, lang)}`
      : formatINR(ipo.price_max ?? ipo.price_min, lang);

  add(settings.fields.price, l.price, priceValue);
  add(settings.fields.lot, l.lot, formatLot(ipo.lot_size, lang));
  add(settings.fields.issue, l.issue, formatIssueSize(ipo.issue_size_cr, lang));
  add(settings.fields.minInvestment, l.min, formatINR(ipo.min_investment, lang));
  add(settings.fields.subscription, l.sub, ipo.subscription || na);
  add(settings.fields.allotment, l.allot, formatDate(ipo.allotment_date, lang));
  add(settings.fields.listing, l.listing, formatDate(ipo.listing_date, lang));

  const showGmp = settings.fields.gmp;
  const gmpValue = formatGmp(ipo, lang);
  const gmpPositive = (ipo.gmp ?? 0) > 0;
  const gmpNegative = (ipo.gmp ?? 0) < 0;
  const gmpTone = gmpPositive ? "#059669" : gmpNegative ? "#dc2626" : p.muted;

  const statusColor =
    ipo.status === "open" ? "#059669" : ipo.status === "listed" ? "#b45309" : ipo.status === "closed" ? "#475569" : "#0284c7";

  const style: React.CSSProperties = {
    width: settings.width,
    height: settings.height,
    background: p.background,
    color: p.body,
    padding: settings.width * 0.06,
    display: "flex",
    flexDirection: "column",
    fontFamily:
      '"Segoe UI", ui-sans-serif, system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
    position: "relative",
    overflow: "hidden",
    transformOrigin: "top left",
    boxSizing: "border-box",
  };

  return (
    <div
      ref={forwardRef}
      id="poster-canvas"
      style={style}
      aria-label={`${ipo.company_name} poster preview`}
    >
      {/* Logo (positioned by percentage so it survives any size) */}
      {settings.logoDataUrl && (
        <img
          src={settings.logoDataUrl}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: `${settings.logoX}%`,
            top: `${settings.logoY}%`,
            width: `${settings.logoSize}%`,
            maxHeight: "22%",
            objectFit: "contain",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `4px solid ${p.accent}`,
          paddingBottom: settings.width * 0.022,
        }}
      >
        <span
          style={{
            fontSize: settings.width * 0.026,
            fontWeight: 800,
            letterSpacing: "0.14em",
            color: p.accent,
            textTransform: p.uppercaseHeader ? "uppercase" : "none",
          }}
        >
          {t.newIpo}
        </span>
        {settings.fields.status && (
          <span
            style={{
              fontSize: settings.width * 0.021,
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: "#ffffff",
              background: statusColor,
              padding: `${settings.width * 0.008}px ${settings.width * 0.02}px`,
              borderRadius: 999,
            }}
          >
            {statusLabel(ipo.status, lang).toUpperCase()}
          </span>
        )}
      </div>

      {/* Heading */}
      <h1
        style={{
          marginTop: settings.width * 0.035,
          fontSize: p.headingSize * (settings.width / 1080),
          fontWeight: p.headingWeight,
          lineHeight: 1.08,
          letterSpacing: "-0.02em",
          color: p.heading,
          margin: 0,
          paddingTop: settings.logoDataUrl && settings.logoY < 8 ? settings.width * 0.05 : 0,
        }}
      >
        {ipo.company_name}
      </h1>
      <p style={{ marginTop: settings.width * 0.012, fontSize: settings.width * 0.024, color: p.muted }}>
        {ipo.category === "SME" ? "SME IPO" : "Mainboard IPO"}
        {ipo.status === "listed" && ipo.listing_date
          ? ` · ${formatDate(ipo.listing_date, lang)}`
          : ""}
      </p>

      {settings.fields.dates && (
        <div
          style={{
            marginTop: settings.width * 0.03,
            background: p.surface,
            border: `1px solid ${p.border}`,
            borderRadius: 14,
            padding: `${settings.width * 0.024}px ${settings.width * 0.03}px`,
          }}
        >
          <div style={{ fontSize: settings.width * 0.019, color: p.label, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {t.dates}
          </div>
          <div style={{ marginTop: 6, fontSize: settings.width * 0.033, fontWeight: 800, color: p.heading }}>
            {ipo.open_date && ipo.close_date
              ? `${formatDate(ipo.open_date, lang)} – ${formatDate(ipo.close_date, lang)}`
              : na}
          </div>
        </div>
      )}

      {/* Facts grid */}
      <div
        style={{
          marginTop: settings.width * 0.028,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: settings.width * 0.018,
        }}
      >
        {cells.map((cell) => (
          <div
            key={cell.label}
            style={{
              border: `1px solid ${p.border}`,
              background: p.surface,
              borderRadius: 12,
              padding: `${settings.width * 0.018}px ${settings.width * 0.024}px`,
            }}
          >
            <div style={{ fontSize: settings.width * 0.017, color: p.label, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              {cell.label}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: settings.width * 0.027,
                fontWeight: 800,
                color: cell.tone ?? p.heading,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {cell.value}
            </div>
          </div>
        ))}

        {showGmp && (
          <div
            style={{
              gridColumn: "span 2",
              border: `2px solid ${gmpTone}`,
              borderRadius: 12,
              padding: `${settings.width * 0.02}px ${settings.width * 0.028}px`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: p.surface,
            }}
          >
            <div>
              <div style={{ fontSize: settings.width * 0.018, color: p.label, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {l.gmp} · {t.gmpNote}
              </div>
              <div style={{ marginTop: 4, fontSize: settings.width * 0.034, fontWeight: 900, color: gmpTone, fontVariantNumeric: "tabular-nums" }}>
                {gmpValue}
              </div>
            </div>
            {ipo.gmp_percent !== null && ipo.gmp !== null && (
              <div
                style={{
                  fontSize: settings.width * 0.03,
                  fontWeight: 900,
                  color: gmpTone,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {ipo.gmp_percent > 0 ? "+" : ""}
                {ipo.gmp_percent}%
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* Footer */}
      <div style={{ borderTop: `1px dashed ${p.border}`, paddingTop: settings.width * 0.022 }}>
        {settings.fields.disclaimer && (
          <p style={{ fontSize: settings.width * 0.0155, lineHeight: 1.5, color: p.muted, margin: 0 }}>
            {t.disclaimer}
          </p>
        )}
        <div
          style={{
            marginTop: settings.width * 0.016,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ minWidth: 0 }}>
            {settings.businessName && (
              <div style={{ fontSize: settings.width * 0.024, fontWeight: 800, color: p.heading }}>
                {settings.businessName}
              </div>
            )}
            {settings.footerText && (
              <div style={{ fontSize: settings.width * 0.02, color: p.muted, marginTop: 2 }}>
                {settings.footerText}
              </div>
            )}
            {settings.fields.source && (
              <div style={{ fontSize: settings.width * 0.016, color: p.label, marginTop: 4 }}>
                {l.source}: {ipo.source_url ?? ipo.source_name}
              </div>
            )}
          </div>
          {settings.watermark && (
            <div
              style={{
                fontSize: settings.width * 0.017,
                fontWeight: 700,
                color: p.heading,
                border: `1px solid ${p.border}`,
                background: p.surface,
                padding: `${settings.width * 0.008}px ${settings.width * 0.016}px`,
                borderRadius: 8,
                whiteSpace: "nowrap",
              }}
            >
              {settings.watermarkText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
