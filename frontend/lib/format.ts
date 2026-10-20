import type { Ipo, IpoStatus, Lang } from "./types";

const NA: Record<Lang, string> = {
  en: "Not available",
  hi: "उपलब्ध नहीं",
  gu: "ઉપલબ્ધ નથી",
};

export function na(lang: Lang): string {
  return NA[lang];
}

const DATE_LOCALE: Record<Lang, string> = { en: "en-IN", hi: "hi-IN", gu: "gu-IN" };

export function formatDate(iso: string | null | undefined, lang: Lang = "en"): string {
  if (!iso) return NA[lang];
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return NA[lang];
  return d.toLocaleDateString(DATE_LOCALE[lang], { day: "2-digit", month: "short", year: "numeric" });
}

export function formatINR(value: number | null | undefined, lang: Lang = "en"): string {
  if (value === null || value === undefined) return NA[lang];
  return `₹${value.toLocaleString(DATE_LOCALE[lang], { maximumFractionDigits: 2 })}`;
}

export function formatIssueSize(cr: number | null | undefined, lang: Lang = "en"): string {
  if (cr === null || cr === undefined) return NA[lang];
  return `₹${cr.toLocaleString(DATE_LOCALE[lang], { maximumFractionDigits: 2 })} Cr`;
}

export function formatGmp(ipo: Ipo, lang: Lang = "en"): string {
  if (ipo.gmp === null || ipo.gmp === undefined) return NA[lang];
  const sign = ipo.gmp > 0 ? "+" : "";
  const pct = ipo.gmp_percent !== null && ipo.gmp_percent !== undefined ? ` (${sign}${ipo.gmp_percent}%)` : "";
  return `₹${sign}${ipo.gmp}${pct}`;
}

export function formatSubscription(value: string | null | undefined, lang: Lang = "en"): string {
  if (!value) return NA[lang];
  return value;
}

export function formatLot(lot: number | null | undefined, lang: Lang = "en"): string {
  if (lot === null || lot === undefined) return NA[lang];
  return lot.toLocaleString(DATE_LOCALE[lang]);
}

const STATUS_LABEL: Record<Lang, Record<IpoStatus, string>> = {
  en: { upcoming: "Upcoming", open: "Open", closed: "Closed", listed: "Listed" },
  hi: { upcoming: "आने वाला", open: "खुला", closed: "बंद", listed: "सूचीबद्ध" },
  gu: { upcoming: "આવનારૂં", open: "ખુલ્લું", closed: "બંધ", listed: "યાદીમાં" },
};

export function statusLabel(status: IpoStatus, lang: Lang = "en"): string {
  return STATUS_LABEL[lang][status] ?? status;
}

export function categoryLabel(category: "Mainboard" | "SME", lang: Lang = "en"): string {
  if (lang === "en") return category;
  return category === "SME" ? "SME" : lang === "hi" ? "मुख्य बोर्ड" : "મુખ્ય બોર્ડ";
}

export function formatDateTime(iso: string | null | undefined, lang: Lang = "en"): string {
  if (!iso) return NA[lang];
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NA[lang];
  return d.toLocaleString(DATE_LOCALE[lang], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
