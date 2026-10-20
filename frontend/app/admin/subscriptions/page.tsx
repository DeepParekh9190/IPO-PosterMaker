"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  Skeleton,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Plan } from "@/lib/types";

interface PaymentEvent {
  event_id: string;
  at: string;
  event_type?: string;
  data?: { event_type?: string };
}

export default function SubscriptionsPage() {
  const toast = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; price: number; daily: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [planData, eventData] = await Promise.all([
        api.get<Plan[]>("/api/admin/plans"),
        api.get<PaymentEvent[]>("/api/admin/payments"),
      ]);
      setPlans(planData);
      setEvents(eventData);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load subscriptions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePlan() {
    if (!editing) return;
    setBusy(true);
    try {
      const plan = plans.find((p) => p.id === editing.id);
      if (!plan) return;
      await api.put(`/api/admin/plans/${editing.id}`, {
        price_inr: editing.price,
        features: { ...plan.features, daily_exports: editing.daily },
      });
      toast.success("Plan updated");
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save the plan.");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Subscription management</h1>
        <p className="mt-1 text-sm text-slate-500">
          Plan pricing, poster limits and verified payment events.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {loading && !plans.length
          ? [0, 1].map((i) => <Skeleton key={i} className="h-56 rounded-xl" />)
          : plans.map((plan) => (
              <Card key={plan.id} className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">{plan.name}</h2>
                    <p className="text-sm text-slate-500">{plan.description}</p>
                  </div>
                  <Badge tone={plan.id === "free" ? "slate" : "emerald"}>
                    ₹{plan.price_inr}/{plan.period}
                  </Badge>
                </div>
                <dl className="mt-4 space-y-1.5 text-sm">
                  <Line label="Watermark-free exports" value={plan.features.watermark_free ? "Yes" : "No"} />
                  <Line label="Daily poster exports" value={String(plan.features.daily_exports)} />
                  <Line label="Premium templates" value={plan.features.premium_templates ? "Yes" : "No"} />
                  <Line label="Save brand to account" value={plan.features.save_brand ? "Yes" : "No"} />
                </dl>
                <div className="mt-4">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setEditing({
                        id: plan.id,
                        price: plan.price_inr,
                        daily: plan.features.daily_exports,
                      })
                    }
                  >
                    Configure
                  </Button>
                </div>
              </Card>
            ))}
      </div>

      <Card className="overflow-x-auto">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">Verified payment events</h2>
          <p className="text-xs text-slate-500">
            Events arrive through the signature-verified webhook (or labelled test mode).
          </p>
        </div>
        {loading ? (
          <div className="space-y-3 p-4">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No payment events recorded yet.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Event</th>
                <th scope="col" className="px-4 py-3 font-semibold">Event ID</th>
                <th scope="col" className="px-4 py-3 font-semibold">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((event) => (
                <tr key={event.event_id}>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {event.data?.event_type ?? event.event_type ?? "unknown"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{event.event_id}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(event.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {editing && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setEditing(null)} aria-hidden="true" />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900">Configure {editing.id} plan</h2>
            <div className="mt-4 space-y-4">
              <Field label="Price (₹ per month)" htmlFor="plan-price">
                <Input
                  id="plan-price"
                  type="number"
                  min={0}
                  value={editing.price}
                  onChange={(event) => setEditing({ ...editing, price: Number(event.target.value) })}
                />
              </Field>
              <Field
                label="Daily poster exports"
                htmlFor="plan-limit"
                hint="Server enforces this limit per user per day."
              >
                <Input
                  id="plan-limit"
                  type="number"
                  min={1}
                  value={editing.daily}
                  onChange={(event) => setEditing({ ...editing, daily: Number(event.target.value) })}
                />
              </Field>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="primary" loading={busy} onClick={() => void savePlan()}>
                Save plan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 pb-1.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}
