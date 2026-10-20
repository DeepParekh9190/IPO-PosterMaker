import {
  categoryLabel,
  formatDate,
  formatGmp,
  formatINR,
  formatIssueSize,
  formatLot,
  formatSubscription,
  na,
  statusLabel,
} from "./format";
import type { Ipo, Lang } from "./types";

export type MessageKind = "plain" | "whatsapp" | "telegram";

const LABELS: Record<Lang, Record<string, string>> = {
  en: {
    header: "NEW IPO",
    dates: "IPO Dates",
    price: "Price Band",
    lot: "Lot Size",
    issue: "Issue Size",
    minInvestment: "Min Investment",
    gmp: "GMP (reported)",
    subscription: "Subscription",
    allotment: "Allotment Date",
    listing: "Listing Date",
    status: "Status",
    source: "Source",
    disclaimer:
      "For educational information only. GMP is unofficial, indicative and may change. Not investment advice.",
  },
  hi: {
    header: "नया IPO",
    dates: "IPO तिथियाँ",
    price: "मूल्य सीमा",
    lot: "लॉट साइज़",
    issue: "इश्यू साइज़",
    minInvestment: "न्यूनतम निवेश",
    gmp: "GMP (रिपोर्टेड)",
    subscription: "सब्सक्रिप्शन",
    allotment: "अलॉटमेंट तिथि",
    listing: "लिस्टिंग तिथि",
    status: "स्थिति",
    source: "स्रोत",
    disclaimer:
      "केवल शैक्षिक जानकारी के लिए। GMP अनौपचारिक और परिवर्तनशील है। यह निवेश सलाह नहीं है।",
  },
  gu: {
    header: "નવો IPO",
    dates: "IPO તારીખો",
    price: "ભાવ સીમા",
    lot: "લોટ સાઇઝ",
    issue: "ઇશ્યુ સાઇઝ",
    minInvestment: "લઘુતમ રોકાણ",
    gmp: "GMP (રિપોર્ટેડ)",
    subscription: "સબ્સ્ક્રિપ્શન",
    allotment: "ફાળવણી તારીખ",
    listing: "લિસ્ટિંગ તારીખ",
    status: "સ્થિતિ",
    source: "સ્રોત",
    disclaimer:
      "માત્ર શૈક્ષણિક માહિતી માટે. GMP અનધિકૃત છે અને બદલાઈ શકે છે. રોકાણ સલાહ નથી.",
  },
};

export function messageLabels(lang: Lang): Record<string, string> {
  return LABELS[lang] ?? LABELS.en;
}

function bold(kind: MessageKind, text: string): string {
  if (kind === "whatsapp") return `*${text}*`;
  if (kind === "telegram") return `**${text}**`;
  return text;
}

/**
 * Builds a share message from the selected IPO record.
 * Every value is resolved here: missing data becomes localized "Not available"
 * and template placeholders can never reach the clipboard.
 */
export function buildMessage(ipo: Ipo, lang: Lang = "en", kind: MessageKind = "plain"): string {
  const t = messageLabels(lang);
  const lines: string[] = [];

  lines.push(`${t.header} — ${ipo.company_name} (${categoryLabel(ipo.category, lang)})`);

  const open = formatDate(ipo.open_date, lang);
  const close = formatDate(ipo.close_date, lang);
  const bothDates = ipo.open_date && ipo.close_date;
  lines.push(
    bothDates
      ? `${bold(kind, t.dates)}: ${open} – ${close}`
      : `${bold(kind, t.dates)}: ${na(lang)}`,
  );

  const hasPrice = ipo.price_min !== null && ipo.price_max !== null;
  lines.push(
    hasPrice
      ? `${bold(kind, t.price)}: ${formatINR(ipo.price_min, lang)} – ${formatINR(ipo.price_max, lang)}`
      : `${bold(kind, t.price)}: ${na(lang)}`,
  );

  lines.push(`${bold(kind, t.lot)}: ${formatLot(ipo.lot_size, lang)}`);
  lines.push(`${bold(kind, t.issue)}: ${formatIssueSize(ipo.issue_size_cr, lang)}`);
  lines.push(`${bold(kind, t.minInvestment)}: ${formatINR(ipo.min_investment, lang)}`);
  lines.push(`${bold(kind, t.gmp)}: ${formatGmp(ipo, lang)}`);
  lines.push(`${bold(kind, t.subscription)}: ${formatSubscription(ipo.subscription, lang)}`);
  lines.push(`${bold(kind, t.allotment)}: ${formatDate(ipo.allotment_date, lang)}`);
  lines.push(`${bold(kind, t.listing)}: ${formatDate(ipo.listing_date, lang)}`);
  lines.push(`${bold(kind, t.status)}: ${statusLabel(ipo.status, lang)}`);

  if (ipo.notes) lines.push(ipo.notes);

  lines.push("");
  lines.push(t.disclaimer);
  lines.push(`${bold(kind, t.source)}: ${ipo.source_url ?? ipo.source_name}`);

  return lines.join("\n");
}

/** Official WhatsApp click-to-chat URL. Opens the app; never sends by itself. */
export function waShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function telegramShareUrl(text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent("")}&text=${encodeURIComponent(text)}`;
}
