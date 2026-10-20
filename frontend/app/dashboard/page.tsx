"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { IpoCard, IpoDetailGrid, STATUS_TONE } from "@/components/IpoCard";
import { SharePanel } from "@/components/SharePanel";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Modal, SegmentedControl, Skeleton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { formatDateTime, statusLabel } from "@/lib/format";
import type { Ipo, IpoListResponse, IpoStatus } from "@/lib/types";

type CategoryFilter = "" | "Mainboard" | "SME";
type StatusFilter = "" | IpoStatus;

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: "", label: "All segments" },
  { value: "Mainboard", label: "Mainboard" },
  { value: "SME", label: "SME" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "upcoming", label: "Upcoming" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "listed", label: "Listed" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [data, setData] = useState<IpoListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareIpo, setShareIpo] = useState<Ipo | null>(null);
  const [detail, setDetail] = useState<Ipo | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstLoad = useRef(true);

  const load = useCallback(
    async (q: string, cat: CategoryFilter, st: StatusFilter) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (cat) params.set("category", cat);
      if (st) params.set("status", st);
      try {
        const result = await api.get<IpoListResponse>(`/api/ipos?${params.toString()}`);
        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load IPO data.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const delay = firstLoad.current ? 0 : 300;
    firstLoad.current = false;
    setLoading(true);
    debounce.current = setTimeout(() => {
      void load(query, category, status);
    }, delay);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, category, status, load]);

  function refresh() {
    setLoading(true);
    void load(query, category, status);
  }

  const meta = data?.meta;
  const hasFilters = Boolean(query || category || status);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">IPO Dashboard</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {meta ? (
              <>
                <span>
                  Last updated:{" "}
                  <span className="font-medium text-slate-700">
                    {formatDateTime(meta.last_updated)}
                  </span>
                </span>
                {meta.stale && <Badge tone="amber">Refresh may be due</Badge>}
                {meta.demo_mode && <Badge tone="blue">Demo data (sample)</Badge>}
                {meta.source_error && <Badge tone="red">Source issue</Badge>}
              </>
            ) : (
              <span>Loading…</span>
            )}
          </div>
        </div>
        <Button variant="secondary" onClick={refresh} loading={loading}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 11a8 8 0 1 0-2.3 6M20 5v6h-6" />
          </svg>
          Refresh data
        </Button>
      </div>

      {meta?.source_error && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <span className="font-semibold">Source notice:</span> {meta.source_error} Showing the
          last valid data (or demo data) instead.
        </div>
      )}

      {/* Filters */}
      <div className="mt-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <label htmlFor="ipo-search" className="sr-only">
            Search by company name
          </label>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          >
            <path strokeLinecap="round" d="M21 21l-4.3-4.3M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z" />
          </svg>
          <Input
            id="ipo-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search company name…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            ariaLabel="Filter by segment"
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={setCategory}
          />
          <SegmentedControl
            ariaLabel="Filter by status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={setStatus}
          />
        </div>
      </div>

      {/* States */}
      <div className="mt-6">
        {error && <ErrorState message={error} onRetry={refresh} />}

        {!error && loading && !data && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <div key={index} className="rounded-xl border border-slate-200 bg-white p-4">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="mt-3 h-3 w-1/3" />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[0, 1, 2, 3, 4, 5].map((cell) => (
                    <Skeleton key={cell} className="h-10" />
                  ))}
                </div>
                <Skeleton className="mt-4 h-9" />
              </div>
            ))}
          </div>
        )}

        {!error && data && data.items.length === 0 && (
          <EmptyState
            title={hasFilters ? "No IPOs match your filters" : "No IPO records yet"}
            description={
              hasFilters
                ? "Try a different company name, segment or status."
                : "Refresh the data, or add an IPO from the admin panel."
            }
            action={
              hasFilters ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery("");
                    setCategory("");
                    setStatus("");
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        )}

        {!error && data && data.items.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((ipo) => (
              <IpoCard
                key={ipo.id}
                ipo={ipo}
                onShare={() => setShareIpo(ipo)}
                onOpen={() => setDetail(ipo)}
                onPoster={() => router.push(`/dashboard/posters?ipo=${encodeURIComponent(ipo.id)}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Details drawer */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.company_name ?? ""}
        description={detail ? `${detail.category === "SME" ? "SME" : "Mainboard"} IPO details` : undefined}
        maxWidth="max-w-3xl"
        footer={
          detail && (
            <>
              <Button variant="secondary" onClick={() => setDetail(null)}>
                Close
              </Button>
              <Button variant="secondary" onClick={() => { setShareIpo(detail); }}>
                Copy &amp; Share
              </Button>
              <Button
                variant="primary"
                onClick={() => router.push(`/dashboard/posters?ipo=${encodeURIComponent(detail.id)}`)}
              >
                Create Poster
              </Button>
            </>
          )
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONE[detail.status]}>{statusLabel(detail.status)}</Badge>
              <Badge tone="slate">{detail.category}</Badge>
              {detail.verified && <Badge tone="emerald">Verified</Badge>}
              {detail.is_demo && <Badge tone="blue">Sample record</Badge>}
              {detail.manual && <Badge tone="amber">Admin entered</Badge>}
            </div>
            <IpoDetailGrid ipo={detail} />
            {detail.notes && (
              <Card className="bg-slate-50 p-3 text-sm text-slate-600">{detail.notes}</Card>
            )}
            <p className="text-xs text-slate-500">
              GMP and subscription figures are unofficial and indicative. For educational use only.
              Record updated {formatDateTime(detail.updated_at)}.
            </p>
          </div>
        )}
      </Modal>

      <SharePanel ipo={shareIpo} open={Boolean(shareIpo)} onClose={() => setShareIpo(null)} />
    </div>
  );
}
