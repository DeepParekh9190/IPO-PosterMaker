"use client";

import { Badge, Button, Card } from "@/components/ui";
import { formatDate, formatGmp, formatINR, formatIssueSize, formatLot, statusLabel } from "@/lib/format";
import { API_URL } from "@/lib/api";
import type { Ipo } from "@/lib/types";
import { cn } from "@/components/ui";

export const STATUS_TONE = {
  upcoming: "blue",
  open: "emerald",
  closed: "slate",
  listed: "amber",
} as const;

export function IpoCard({
  ipo,
  onShare,
  onOpen,
  onPoster,
}: {
  ipo: Ipo;
  onShare: () => void;
  onOpen: () => void;
  onPoster: () => void;
}) {
  const gmpPositive = (ipo.gmp ?? 0) > 0;
  const gmpNegative = (ipo.gmp ?? 0) < 0;

  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="flex items-start gap-2.5 text-left rounded focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          {ipo.logo_url && (
            <img
              src={`${API_URL}${ipo.logo_url}`}
              alt=""
              width={36}
              height={36}
              loading="lazy"
              className="mt-0.5 h-9 w-9 shrink-0 rounded-md border border-slate-100 bg-white object-contain"
              onError={(e) => e.currentTarget.remove()}
            />
          )}
          <span>
            <h3 className="text-[15px] font-semibold leading-snug text-slate-900 hover:text-emerald-700">
              {ipo.company_name}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {ipo.category === "SME" ? "SME" : "Mainboard"} IPO
            </p>
          </span>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={STATUS_TONE[ipo.status]}>{statusLabel(ipo.status)}</Badge>
          {ipo.is_demo && <Badge tone="slate">Sample</Badge>}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs">
        <Fact label="Open – Close" value={`${formatDate(ipo.open_date)} – ${formatDate(ipo.close_date)}`} />
        <Fact
          label="Price band"
          value={
            ipo.price_min !== null && ipo.price_max !== null
              ? `${formatINR(ipo.price_min)} – ${formatINR(ipo.price_max)}`
              : formatINR(ipo.price_max ?? ipo.price_min)
          }
        />
        <Fact label="Lot size" value={formatLot(ipo.lot_size)} />
        <Fact label="Issue size" value={formatIssueSize(ipo.issue_size_cr)} />
        <Fact
          label="Reported GMP"
          value={formatGmp(ipo)}
          valueClass={gmpPositive ? "text-emerald-700" : gmpNegative ? "text-red-700" : ""}
        />
        <Fact label="Min investment" value={formatINR(ipo.min_investment)} />
      </dl>

      {ipo.notes && (
        <p className="mt-3 rounded-md bg-slate-50 px-2.5 py-2 text-xs leading-relaxed text-slate-600">
          {ipo.notes}
        </p>
      )}

      <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
        <Button size="sm" variant="secondary" className="flex-1" onClick={onShare}>
          Copy &amp; Share
        </Button>
        <Button size="sm" variant="primary" className="flex-1" onClick={onPoster}>
          Create Poster
        </Button>
      </div>
    </Card>
  );
}

function Fact({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={cn("numeric mt-0.5 font-medium text-slate-800", valueClass)}>{value}</dd>
    </div>
  );
}

export function IpoDetailGrid({ ipo }: { ipo: Ipo }) {
  const rows: { label: string; value: string }[] = [
    { label: "Company", value: ipo.company_name },
    { label: "Segment", value: ipo.category === "SME" ? "SME" : "Mainboard" },
    { label: "Status", value: statusLabel(ipo.status) },
    { label: "Opening date", value: formatDate(ipo.open_date) },
    { label: "Closing date", value: formatDate(ipo.close_date) },
    { label: "Allotment date", value: formatDate(ipo.allotment_date) },
    { label: "Listing date", value: formatDate(ipo.listing_date) },
    {
      label: "Price band",
      value:
        ipo.price_min !== null && ipo.price_max !== null
          ? `${formatINR(ipo.price_min)} – ${formatINR(ipo.price_max)}`
          : formatINR(ipo.price_max ?? ipo.price_min),
    },
    { label: "Lot size", value: formatLot(ipo.lot_size) },
    { label: "Issue size", value: formatIssueSize(ipo.issue_size_cr) },
    { label: "Min investment", value: formatINR(ipo.min_investment) },
    { label: "Reported GMP", value: formatGmp(ipo) },
    { label: "Subscription", value: ipo.subscription || "Not available" },
    { label: "Source", value: ipo.source_url ? "Link" : ipo.source_name },
  ];

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{row.label}</dt>
          <dd className="numeric text-right text-sm font-medium text-slate-800">
            {row.value === "Link" ? (
              <a
                href={ipo.source_url ?? undefined}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-sky-700 underline"
              >
                {ipo.source_url}
              </a>
            ) : (
              row.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
