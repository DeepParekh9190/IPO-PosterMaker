"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  Field,
  Input,
  Select,
  Skeleton,
} from "@/components/ui";
import { api, ApiError } from "@/lib/api";

interface AdminSettings {
  app_name: string;
  support_email: string;
  source_mode: string;
  source_name: string;
  refresh_interval_minutes: number;
  default_language: string;
  default_width: number;
  default_height: number;
  maintenance_mode: boolean;
  default_watermark_text: string;
}

export default function AdminSettingsPage() {
  const toast = useToast();
  const [form, setForm] = useState<AdminSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmMaintenance, setConfirmMaintenance] = useState(false);

  const load = useCallback(async () => {
    try {
      setForm(await api.get<AdminSettings>("/api/admin/settings"));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load settings.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(patch: Partial<AdminSettings>, message = "Settings saved") {
    setBusy(true);
    try {
      const updated = await api.put<AdminSettings>("/api/admin/settings", patch);
      setForm(updated);
      toast.success(message);
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save settings.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!form) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Application settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Branding, defaults and maintenance. Only admins can change these values.
        </p>
      </div>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-slate-900">Branding</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Application name" htmlFor="app-name" required>
            <Input
              id="app-name"
              value={form.app_name}
              onChange={(event) => setForm({ ...form, app_name: event.target.value })}
            />
          </Field>
          <Field label="Support email" htmlFor="support-email">
            <Input
              id="support-email"
              type="email"
              value={form.support_email}
              onChange={(event) => setForm({ ...form, support_email: event.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Default watermark text"
              htmlFor="watermark-text"
              hint="Shown on free-plan poster exports."
              required
            >
              <Input
                id="watermark-text"
                value={form.default_watermark_text}
                maxLength={80}
                onChange={(event) =>
                  setForm({ ...form, default_watermark_text: event.target.value })
                }
              />
            </Field>
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={() => void save(form)} loading={busy}>
            Save branding
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-slate-900">Data &amp; defaults</h2>
        <dl className="mt-3 space-y-2 text-sm text-slate-600">
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <dt>Configured data source</dt>
            <dd className="font-medium capitalize text-slate-800">
              {form.source_mode} · {form.source_name}
            </dd>
          </div>
        </dl>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Refresh interval (minutes)" htmlFor="refresh-interval">
            <Input
              id="refresh-interval"
              type="number"
              min={5}
              max={1440}
              value={form.refresh_interval_minutes}
              onChange={(event) =>
                setForm({ ...form, refresh_interval_minutes: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Default message language" htmlFor="default-language">
            <Select
              id="default-language"
              value={form.default_language}
              onChange={(event) => setForm({ ...form, default_language: event.target.value })}
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="gu">Gujarati</option>
            </Select>
          </Field>
          <Field label="Default poster width" htmlFor="default-width">
            <Input
              id="default-width"
              type="number"
              min={360}
              max={2160}
              value={form.default_width}
              onChange={(event) => setForm({ ...form, default_width: Number(event.target.value) })}
            />
          </Field>
          <Field label="Default poster height" htmlFor="default-height">
            <Input
              id="default-height"
              type="number"
              min={360}
              max={2700}
              value={form.default_height}
              onChange={(event) => setForm({ ...form, default_height: Number(event.target.value) })}
            />
          </Field>
        </div>
        <div className="mt-4">
          <Button onClick={() => void save(form)} loading={busy}>
            Save defaults
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-slate-900">Maintenance mode</h2>
        <p className="mt-1 text-sm text-slate-500">
          Blocks client API traffic (health, login, config and this admin area stay reachable).
        </p>
        <div className="mt-4 flex items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              form.maintenance_mode
                ? "bg-red-50 text-red-800 ring-1 ring-red-200"
                : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
            }`}
          >
            {form.maintenance_mode ? "Maintenance ON" : "Normal operation"}
          </span>
          <Button
            variant={form.maintenance_mode ? "secondary" : "danger"}
            onClick={() => setConfirmMaintenance(true)}
            loading={busy}
          >
            {form.maintenance_mode ? "Turn off" : "Turn on"}
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmMaintenance}
        title={form.maintenance_mode ? "Turn off maintenance?" : "Enable maintenance mode?"}
        message={
          form.maintenance_mode
            ? "Clients will be able to use the dashboard again."
            : "Clients will get a 503 response on dashboard data until you turn it off."
        }
        confirmLabel={form.maintenance_mode ? "Turn off" : "Enable"}
        danger={!form.maintenance_mode}
        busy={busy}
        onConfirm={() => {
          setConfirmMaintenance(false);
          void save(
            { maintenance_mode: !form.maintenance_mode },
            form.maintenance_mode ? "Maintenance mode off" : "Maintenance mode on",
          );
        }}
        onCancel={() => setConfirmMaintenance(false)}
      />
    </div>
  );
}
