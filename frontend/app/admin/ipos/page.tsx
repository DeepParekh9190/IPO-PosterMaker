"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { formatDate, formatINR } from "@/lib/format";
import type { Ipo, IpoListMeta, IpoStatus } from "@/lib/types";

interface AdminIpoRow extends Ipo {
  hidden: boolean;
  verified: boolean;
}

interface FormState {
  id?: string;
  company_name: string;
  category: "Mainboard" | "SME";
  open_date: string;
  close_date: string;
  allotment_date: string;
  listing_date: string;
  price_min: string;
  price_max: string;
  lot_size: string;
  issue_size_cr: string;
  gmp: string;
  gmp_percent: string;
  subscription: string;
  status: IpoStatus;
  source_url: string;
  notes: string;
  reason: string;
  clearNotes: boolean;
}

const EMPTY_FORM: FormState = {
  company_name: "",
  category: "Mainboard",
  open_date: "",
  close_date: "",
  allotment_date: "",
  listing_date: "",
  price_min: "",
  price_max: "",
  lot_size: "",
  issue_size_cr: "",
  gmp: "",
  gmp_percent: "",
  subscription: "",
  status: "upcoming",
  source_url: "",
  notes: "",
  reason: "",
  clearNotes: false,
};

function toForm(ipo: AdminIpoRow): FormState {
  return {
    id: ipo.id,
    company_name: ipo.company_name,
    category: ipo.category,
    open_date: ipo.open_date ?? "",
    close_date: ipo.close_date ?? "",
    allotment_date: ipo.allotment_date ?? "",
    listing_date: ipo.listing_date ?? "",
    price_min: ipo.price_min === null ? "" : String(ipo.price_min),
    price_max: ipo.price_max === null ? "" : String(ipo.price_max),
    lot_size: ipo.lot_size === null ? "" : String(ipo.lot_size),
    issue_size_cr: ipo.issue_size_cr === null ? "" : String(ipo.issue_size_cr),
    gmp: ipo.gmp === null ? "" : String(ipo.gmp),
    gmp_percent: ipo.gmp_percent === null ? "" : String(ipo.gmp_percent),
    subscription: ipo.subscription ?? "",
    status: ipo.status,
    source_url: ipo.source_url ?? "",
    notes: ipo.notes ?? "",
    reason: "",
    clearNotes: false,
  };
}

function num(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOrNull(value: string): string | null {
  return value.trim() === "" ? null : value;
}

export default function AdminIposPage() {
  const toast = useToast();
  const [rows, setRows] = useState<AdminIpoRow[]>([]);
  const [meta, setMeta] = useState<IpoListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<{ items: AdminIpoRow[]; meta: IpoListMeta }>(
        "/api/admin/ipos",
      );
      setRows(result.items);
      setMeta(result.meta);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load IPO records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    setBusy(true);
    try {
      const result = await api.post<{ records: number; error: string | null }>(
        "/api/admin/ipos/refresh",
      );
      toast.success(`Refreshed ${result.records} records`);
      if (result.error) toast.push(`Source notice: ${result.error}`, "info");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Refresh failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitForm() {
    if (!form) return;
    setBusy(true);
    try {
      const base = {
        company_name: form.company_name,
        category: form.category,
        open_date: dateOrNull(form.open_date),
        close_date: dateOrNull(form.close_date),
        allotment_date: dateOrNull(form.allotment_date),
        listing_date: dateOrNull(form.listing_date),
        price_min: num(form.price_min),
        price_max: num(form.price_max),
        lot_size: num(form.lot_size),
        issue_size_cr: num(form.issue_size_cr),
        gmp: num(form.gmp),
        gmp_percent: num(form.gmp_percent),
        subscription: form.subscription || null,
        status: form.status,
        source_url: form.source_url || null,
        notes: form.notes || null,
      };
      if (form.id) {
        await api.patch(`/api/admin/ipos/${form.id}`, {
          ...base,
          reason: form.reason || "admin edit",
          clear_fields: form.clearNotes ? ["notes"] : [],
        });
        toast.success("IPO updated (stored as a manual override)");
      } else {
        await api.post("/api/admin/ipos", base);
        toast.success("IPO created");
      }
      setForm(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleHidden(row: AdminIpoRow) {
    try {
      await api.patch(`/api/admin/ipos/${row.id}`, {
        hidden: !row.hidden,
        reason: row.hidden ? "unhidden by admin" : "hidden by admin",
      });
      toast.success(row.hidden ? "Record visible again" : "Record hidden from clients");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed.");
    }
  }

  async function markVerified(row: AdminIpoRow) {
    try {
      await api.patch(`/api/admin/ipos/${row.id}`, { verified: true, reason: "verified" });
      toast.success("Marked verified");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed.");
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">IPO management</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>
              Provider: <span className="font-medium text-slate-700">{meta?.provider ?? "—"}</span>
            </span>
            <span>·</span>
            <span>{meta?.demo_mode ? "Demo/sample source" : "Authorized source"}</span>
            {meta?.stale && <Badge tone="amber">Stale</Badge>}
            {meta?.source_error && <Badge tone="red">Source error</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void refresh()} loading={busy}>
            {meta?.provider === "ipopremium" ? "Re-scrape IPO data" : "Refresh source"}
          </Button>
          <Button variant="primary" onClick={() => setForm({ ...EMPTY_FORM })}>
            Add IPO manually
          </Button>
        </div>
      </div>

      {meta?.source_error && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {meta.source_error}
        </div>
      )}

      <Card className="overflow-x-auto">
        {loading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No IPO records"
              description="Add one manually or check the data source."
              action={<Button onClick={() => setForm({ ...EMPTY_FORM })}>Add IPO</Button>}
            />
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Company</th>
                <th scope="col" className="px-4 py-3 font-semibold">Segment</th>
                <th scope="col" className="px-4 py-3 font-semibold">Dates</th>
                <th scope="col" className="px-4 py-3 font-semibold">Price band</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 font-semibold">Flags</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className={row.hidden ? "bg-red-50/50" : "hover:bg-slate-50/70"}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{row.company_name}</p>
                    <p className="truncate text-xs text-slate-500">{row.id}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.category}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {formatDate(row.open_date)} – {formatDate(row.close_date)}
                  </td>
                  <td className="numeric px-4 py-3 text-slate-700">
                    {row.price_min !== null && row.price_max !== null
                      ? `${formatINR(row.price_min)} – ${formatINR(row.price_max)}`
                      : formatINR(row.price_max ?? row.price_min)}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-700">{row.status}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.manual && <Badge tone="amber">manual</Badge>}
                      {row.verified && <Badge tone="emerald">verified</Badge>}
                      {row.hidden && <Badge tone="red">hidden</Badge>}
                      {row.is_demo && <Badge tone="slate">sample</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setForm(toForm(row))}>
                        Edit
                      </Button>
                      {!row.verified && (
                        <Button size="sm" variant="secondary" onClick={() => void markVerified(row)}>
                          Verify
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={row.hidden ? "secondary" : "danger"}
                        onClick={() => void toggleHidden(row)}
                      >
                        {row.hidden ? "Show" : "Hide"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? `Edit ${form.company_name}` : "Add IPO manually"}
        description={
          form?.id
            ? "Saved as a manual override: automatic refreshes will not overwrite it."
            : "Manual records always win over imported data."
        }
        maxWidth="max-w-3xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void submitForm()}
              loading={busy}
              disabled={!form?.company_name.trim()}
            >
              {form?.id ? "Save changes" : "Create IPO"}
            </Button>
          </>
        }
      >
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Company name" htmlFor="f-company" required>
                <Input
                  id="f-company"
                  value={form.company_name}
                  onChange={(event) => setForm({ ...form, company_name: event.target.value })}
                />
              </Field>
            </div>
            <Field label="Segment" htmlFor="f-category">
              <Select
                id="f-category"
                value={form.category}
                onChange={(event) =>
                  setForm({ ...form, category: event.target.value as "Mainboard" | "SME" })
                }
              >
                <option value="Mainboard">Mainboard</option>
                <option value="SME">SME</option>
              </Select>
            </Field>
            <Field label="Status" htmlFor="f-status">
              <Select
                id="f-status"
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as IpoStatus })}
              >
                <option value="upcoming">Upcoming</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="listed">Listed</option>
              </Select>
            </Field>
            <Field label="Opening date" htmlFor="f-open">
              <Input
                id="f-open"
                type="date"
                value={form.open_date}
                onChange={(event) => setForm({ ...form, open_date: event.target.value })}
              />
            </Field>
            <Field label="Closing date" htmlFor="f-close">
              <Input
                id="f-close"
                type="date"
                value={form.close_date}
                onChange={(event) => setForm({ ...form, close_date: event.target.value })}
              />
            </Field>
            <Field label="Allotment date" htmlFor="f-allot">
              <Input
                id="f-allot"
                type="date"
                value={form.allotment_date}
                onChange={(event) => setForm({ ...form, allotment_date: event.target.value })}
              />
            </Field>
            <Field label="Listing date" htmlFor="f-list">
              <Input
                id="f-list"
                type="date"
                value={form.listing_date}
                onChange={(event) => setForm({ ...form, listing_date: event.target.value })}
              />
            </Field>
            <Field label="Price min (₹)" htmlFor="f-pmin">
              <Input
                id="f-pmin"
                inputMode="decimal"
                value={form.price_min}
                onChange={(event) => setForm({ ...form, price_min: event.target.value })}
              />
            </Field>
            <Field label="Price max (₹)" htmlFor="f-pmax">
              <Input
                id="f-pmax"
                inputMode="decimal"
                value={form.price_max}
                onChange={(event) => setForm({ ...form, price_max: event.target.value })}
              />
            </Field>
            <Field label="Lot size" htmlFor="f-lot">
              <Input
                id="f-lot"
                inputMode="numeric"
                value={form.lot_size}
                onChange={(event) => setForm({ ...form, lot_size: event.target.value })}
              />
            </Field>
            <Field label="Issue size (₹ Cr)" htmlFor="f-issue">
              <Input
                id="f-issue"
                inputMode="decimal"
                value={form.issue_size_cr}
                onChange={(event) => setForm({ ...form, issue_size_cr: event.target.value })}
              />
            </Field>
            <Field label="Reported GMP (₹)" htmlFor="f-gmp" hint="Leave blank when unavailable.">
              <Input
                id="f-gmp"
                inputMode="decimal"
                value={form.gmp}
                onChange={(event) => setForm({ ...form, gmp: event.target.value })}
              />
            </Field>
            <Field label="GMP %" htmlFor="f-gmppct">
              <Input
                id="f-gmppct"
                inputMode="decimal"
                value={form.gmp_percent}
                onChange={(event) => setForm({ ...form, gmp_percent: event.target.value })}
              />
            </Field>
            <Field label="Subscription figure" htmlFor="f-sub" hint="e.g. 1.42x">
              <Input
                id="f-sub"
                value={form.subscription}
                onChange={(event) => setForm({ ...form, subscription: event.target.value })}
                placeholder="1.42x"
              />
            </Field>
            <Field label="Source URL" htmlFor="f-source" hint="Public reference link only.">
              <Input
                id="f-source"
                value={form.source_url}
                onChange={(event) => setForm({ ...form, source_url: event.target.value })}
                placeholder="https://…"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes" htmlFor="f-notes" hint="Shown when important details are missing.">
                <Textarea
                  id="f-notes"
                  rows={2}
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                />
              </Field>
            </div>
            {form.id && (
              <>
                <div className="sm:col-span-2">
                  <Field label="Reason (audit trail)" htmlFor="f-reason" required>
                    <Input
                      id="f-reason"
                      value={form.reason}
                      onChange={(event) => setForm({ ...form, reason: event.target.value })}
                      placeholder="e.g. corrected lot size from RHP"
                    />
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.clearNotes}
                    onChange={(event) => setForm({ ...form, clearNotes: event.target.checked })}
                    className="h-4 w-4 accent-slate-900"
                  />
                  Clear the notes field
                </label>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
