"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth";
import { useToast } from "@/components/toast";
import { Badge, Button, Card, ConfirmDialog, Skeleton, cn } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { AppConfig, Plan } from "@/lib/types";

interface PrivacyNotice {
  collected: string[];
  not_collected: string[];
  retention: string;
  deletion: string;
  third_parties: string[];
}

export default function SettingsPage() {
  const { me, refresh, logout, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [privacy, setPrivacy] = useState<PrivacyNotice | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      const [planData, configData, privacyData] = await Promise.all([
        api.get<Plan[]>("/api/plans"),
        api.get<AppConfig>("/api/config"),
        api.get<PrivacyNotice>("/api/privacy"),
      ]);
      setPlans(planData);
      setConfig(configData);
      setPrivacy(privacyData);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load settings.");
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function activateTest() {
    setBusy("test");
    try {
      const result = await api.post<{ notice: string }>("/api/billing/test/activate", {
        plan_id: "pro",
      });
      await refresh();
      toast.success(result.notice);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not activate test plan.");
    } finally {
      setBusy(null);
    }
  }

  async function cancelPlan() {
    setBusy("cancel");
    try {
      await api.post("/api/billing/cancel");
      await refresh();
      toast.success("Subscription cancelled - you are on the Free plan now.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not cancel.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount() {
    setBusy("delete");
    try {
      await api.del("/api/me");
      await logout();
      toast.success("Your account data has been deleted.");
      router.replace("/");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete the account.");
      setBusy(null);
      setConfirmDelete(false);
    }
  }

  if (loading || !me) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    );
  }

  const proPlan = plans.find((p) => p.id === "pro");
  const paid = me.plan.id !== "free";

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings &amp; Plan</h1>
        <p className="mt-1 text-sm text-slate-500">
          Account, subscription and privacy controls for {me.user.email}.
        </p>
      </div>

      {/* Plan */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">Current plan</h2>
              <Badge tone={paid ? "emerald" : "slate"}>{me.plan.name}</Badge>
              {me.subscription && (
                <Badge tone="blue">{me.subscription.status}</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-600">{me.plan.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!paid && config?.payments_mode === "test" && (
              <Button variant="accent" onClick={() => void activateTest()} loading={busy === "test"}>
                Activate test entitlement
              </Button>
            )}
            {paid && me.subscription && (
              <Button variant="secondary" onClick={() => void cancelPlan()} loading={busy === "cancel"}>
                Cancel subscription
              </Button>
            )}
            <Button variant="primary" onClick={() => router.push("/pricing")}>
              {paid ? "View plans" : `Upgrade for ₹${proPlan?.price_inr ?? 0}/mo`}
            </Button>
          </div>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Exports used today" value={`${me.usage.exports_today} / ${me.entitlements.daily_exports}`} />
          <Stat label="Watermark" value={me.entitlements.watermark_free ? "Removed" : "Shown"} />
          <Stat label="Premium templates" value={me.entitlements.premium_templates ? "Included" : "Locked"} />
          <Stat label="Brand saving" value={me.entitlements.save_brand ? "Account" : "This device"} />
        </dl>

        {config?.payments_mode === "test" && (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            TEST MODE deployment: no live payment credentials are configured, so paid features are
            granted through an admin-approved test entitlement. Entitlements are still verified by
            the server.
          </p>
        )}
      </Card>

      {/* Account */}
      <Card className="p-5">
        <h2 className="text-base font-semibold text-slate-900">Account</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium text-slate-800">{me.user.email}</dd>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <dt className="text-slate-500">Business name</dt>
            <dd className="font-medium text-slate-800">{me.user.business_name || "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Role</dt>
            <dd className="font-medium capitalize text-slate-800">{me.user.role}</dd>
          </div>
        </dl>
      </Card>

      {/* Privacy */}
      <Card className="p-5">
        <h2 className="text-base font-semibold text-slate-900">Privacy &amp; data</h2>
        {privacy ? (
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            <div>
              <p className="font-medium text-slate-800">We store</p>
              <p>{privacy.collected.join(", ")}</p>
            </div>
            <div>
              <p className="font-medium text-slate-800">We never ask for</p>
              <p>{privacy.not_collected.join(", ")}</p>
            </div>
            <div>
              <p className="font-medium text-slate-800">Deletion</p>
              <p>{privacy.deletion}</p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Privacy notice unavailable right now.</p>
        )}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            Delete my account &amp; data
          </Button>
          <p className="mt-2 text-xs text-slate-500">
            This anonymises your profile, removes your brand data and signs you out immediately.
          </p>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete your account?"
        message="Your email, business name and saved brand data will be removed. This cannot be undone."
        confirmLabel="Delete everything"
        danger
        busy={busy === "delete"}
        onConfirm={() => void deleteAccount()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn("rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5")}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="numeric mt-0.5 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
