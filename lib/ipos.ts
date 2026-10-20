export type RawIpo = {
  id: number;
  name: string;
  is_new_sme: number | null;
  lot_size: number | null;
  min_price: number | null;
  max_price: number | null;
  open: string | null;
  close: string | null;
  allotment_date: string | null;
  listing_date: string | null;
  icon_url: string | null;
  premium: number | null;
  issue_size: string | null;
  current_status: string | null;
  slug: string | null;
};

export type Ipo = {
  id: number;
  name: string;
  board: "MAINBOARD" | "SME";
  status: string;
  priceBand: string;
  lot: number | null;
  minInvestment: string;
  gmp: number | null;
  gmpPercent: string | null;
  issueSize: string;
  open: string;
  close: string;
  allotment: string;
  listing: string;
  logo: string;
  slug: string;
  sourceUrl: string;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function fmtDate(value: string | null): string {
  if (!value) return "-";
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d || m > 12) return "-";
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function normalize(raw: RawIpo): Ipo {
  const price = (n: number | null) => (n != null && n > 0 ? n : null);
  const min = price(raw.min_price);
  const max = price(raw.max_price);
  // shortcut: issue_size is assumed to be ₹ crore (site prints bare numbers); verify before public use.
  const crores = Number(raw.issue_size);
  const gmp = typeof raw.premium === "number" ? raw.premium : null;
  const status = (raw.current_status || "unknown").toLowerCase();

  return {
    id: raw.id,
    name: raw.name.replace(/\s*\((?:BSE |NSE )?(?:MAINBOARD|SME)\)\s*$/i, "").trim(),
    board: raw.is_new_sme || /\([^)]*SME\)\s*$/i.test(raw.name) ? "SME" : "MAINBOARD",
    // upstream says "open"; the UI filter/card keys use "live"
    status: status === "open" ? "live" : status,
    priceBand: min && max ? (min === max ? inr(min) : `${inr(min)} – ${inr(max)}`) : "TBA",
    lot: raw.lot_size && raw.lot_size > 0 ? raw.lot_size : null,
    minInvestment: raw.lot_size && max ? inr(raw.lot_size * max) : "-",
    gmp,
    gmpPercent: gmp != null && max ? `${((gmp / max) * 100).toFixed(1)}%` : null,
    issueSize:
      Number.isFinite(crores) && crores > 0
        ? `₹${crores.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr`
        : "-",
    open: fmtDate(raw.open),
    close: fmtDate(raw.close),
    allotment: fmtDate(raw.allotment_date),
    listing: fmtDate(raw.listing_date),
    logo: `/api/logo/${raw.id}`,
    slug: raw.slug || String(raw.id),
    sourceUrl: "https://www.ipopremium.in",
  };
}

export async function fetchIpos(fresh = false): Promise<Ipo[]> {
  const res = await fetch("https://www.ipopremium.in/api/ipo/list", {
    headers: { accept: "application/json", "user-agent": "Mozilla/5.0 (compatible; ipo-share/1.0)" },
    // The upstream is undocumented; cache 5 min so page views never hammer it.
    // Manual refresh (fresh) skips the cache so a recovery is visible immediately.
    next: { revalidate: fresh ? 0 : 300 },
  });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const json = (await res.json()) as { data?: RawIpo[] };
  return (json.data ?? []).map(normalize);
}

export function logoUrl(id: number): string {
  return `https://assets.ipopremium.in/images/ipo/${id}.png`;
}

export function initials(name: string): string {
  const words = name.replace(/\b(limited|ltd|private|pvt)\b/gi, "").trim().split(/\s+/);
  return words.slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "IPO";
}
