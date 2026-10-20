"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, ErrorState, Skeleton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

interface SourceHealth {
  provider: string;
  demo_mode: boolean;
  stale: boolean;
  last_updated: string | null;
  error: string | null;
  records: number;
  configured_mode: string;
  source_ready: boolean;
}

interface Metrics {
  total_users: number;
  active_subscribers: number;
  free_users: number;
  suspended_users: number;
  poster_exports_today: number;
  poster_exports_total: number;
  recent_errors: { at: string; path: string; status: number; detail: string }[];
  source_health: SourceHealth;
  last_successful_refresh: string | null;
  payments_mode: string;
  persistence: string;
}

export default function AdminOverviewPage() {
  const toast = useToast();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setMetrics(await api.get<Metrics>("/api/admin/metrics"));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load metrics.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function refreshSource() {
    setRefreshing(true);
    try {
      const result = await api.post<{ records: number; error: string | null }>(
        "/api/admin/ipos/refresh",
      );
      toast.success(`Refreshed ${result.records} IPO records`);
      if (result.error) toast.push(`Source notice: ${result.error}`, "info");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!metrics) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const health = metrics.source_health;
  const stats = [
    { label: "Registered users", value: metrics.total_users },
    { label: "Active subscribers", value: metrics.active_subscribers },
    { label: "Free users", value: metrics.free_users },
    { label: "Poster exports today", value: metrics.poster_exports_today },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin overview</h1>
          <p className="mt-1 text-sm text-slate-500">
            Application health, data source status and usage.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void load()}>
            Reload
          </Button>
          <Button variant="primary" onClick={() => void refreshSource()} loading={refreshing}>
            Refresh IPO data
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {stat.label}
            </p>
            <p className="numeric mt-1 text-3xl font-bold text-slate-900">{stat.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Data source health</h2>
            <Badge tone={health.stale ? "amber" : "emerald"}>
              {health.stale ? "Stale" : "Fresh"}
            </Badge>
          </div>
          <dl className="mt-4 space-y-2.5 text-sm">
            <Row label="Provider" value={health.provider} />
            <Row label="Configured mode" value={health.configured_mode} />
            <Row
              label="Authorized source ready"
              value={health.source_ready ? "Yes" : "No - demo/manual only"}
            />
            <Row label="Records served" value={String(health.records)} />
            <Row
              label="Last successful refresh"
              value={formatDateTime(metrics.last_successful_refresh)}
            />
            <Row label="Payments mode" value={metrics.payments_mode} />
            <Row label="Persistence" value={metrics.persistence} />
          </dl>
          {health.error && (
            <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {health.error}
            </p>
          )}
          {health.demo_mode && (
            <p className="mt-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
              Running on demo data. Automated access to external sources stays disabled until
              written permission and API credentials are configured - see docs/DATA_SOURCE.md.
            </p>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-900">Recent application errors</h2>
          {metrics.recent_errors.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No errors recorded on this instance.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {metrics.recent_errors.map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="rounded-md border border-slate-200 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-slate-800">{entry.path}</span>
                    <Badge tone={entry.status >= 500 ? "red" : "amber"}>{entry.status}</Badge>
                  </div>
                  <p className="mt-0.5 text-slate-500">{formatDateTime(entry.at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 pb-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="numeric text-right font-medium capitalize text-slate-800">{value}</dd>
    </div>
  );
}
