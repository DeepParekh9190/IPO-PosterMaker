"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MarketingFooter, MarketingNav } from "@/components/marketing";
import { useAuth } from "@/components/auth";
import { Badge, Button, Card, cn } from "@/components/ui";
import { useToast } from "@/components/toast";
import { api, ApiError } from "@/lib/api";
import type { AppConfig, Plan } from "@/lib/types";

const FEATURE_ROWS: { label: string; free: string; pro: string }[] = [
  { label: "Browse IPO data & filters", free: "Yes", pro: "Yes" },
  { label: "Copy / WhatsApp / Telegram messages", free: "Yes", pro: "Yes" },
  { label: "Poster export", free: "With watermark", pro: "No watermark" },
  { label: "Templates", free: "Limited", pro: "All premium templates" },
  { label: "Save brand (logo, colours, footer)", free: "Device only", pro: "Saved to account" },
  { label: "Daily poster exports", free: "Configurable limit", pro: "Higher limit" },
];

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function PricingPage() {
  const router = useRouter();
  const { me, refresh } = useAuth();
  const toast = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [planData, configData] = await Promise.all([
        api.get<Plan[]>("/api/plans"),
        api.get<AppConfig>("/api/config"),
      ]);
      setPlans(planData);
      setConfig(configData);
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Could not load pricing.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function startCheckout(planId: string) {
    if (!me) {
      router.push(`/login?next=${encodeURIComponent("/pricing")}`);
      return;
    }
    setBusy(planId);
    setNotice(null);
    try {
      const order = await api.post<{
        mode: "test" | "live";
        notice?: string;
        order_id?: string;
        key_id?: string | null;
      }>("/api/billing/checkout", { plan_id: planId });

      if (order.mode === "test") {
        setNotice(order.notice ?? "Test mode: no real payment is created.");
        toast.push("Test mode - activate a test entitlement below.", "info");
        return;
      }

      await loadRazorpayScript();
      if (!window.Razorpay || !order.order_id) {
        throw new ApiError(0, "Payment window could not be loaded.");
      }
      const checkout = new window.Razorpay({
        key: order.key_id,
        order_id: order.order_id,
        name: config?.app_name ?? "IPO Poster Studio",
        prefill: { email: me.user.email },
        theme: { color: "#059669" },
        handler: () => {
          toast.success(
            "Payment submitted. Your plan activates after the server verifies it with the provider.",
          );
          setTimeout(() => void refresh(), 3500);
        },
        modal: { ondismiss: () => setBusy(null) },
      });
      checkout.open();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Checkout failed.");
    } finally {
      setBusy(null);
    }
  }

  async function activateTest() {
    if (!me) return;
    setBusy("test");
    try {
      const result = await api.post<{ activated: boolean; notice: string }>(
        "/api/billing/test/activate",
        { plan_id: "pro" },
      );
      await refresh();
      toast.success(result.notice);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not activate.");
    } finally {
      setBusy(null);
    }
  }

  const currentPlanId = me?.plan.id ?? "free";
  const proPlan = plans.find((p) => p.id === "pro");
  const freePlan = plans.find((p) => p.id === "free");

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <MarketingNav />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Simple pricing</h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">
            Start free. Upgrade when you want watermark-free posters, premium templates and a
            saved brand.
          </p>
        </div>

        {config?.payments_mode === "test" && (
          <div className="mx-auto mt-6 max-w-3xl rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-center text-xs font-medium text-amber-900">
            TEST MODE: payment gateway credentials are not configured on this deployment, so no
            real payment is created. Paid features below are enabled through an admin-approved
            test entitlement.
          </div>
        )}

        {notice && (
          <div className="mx-auto mt-4 max-w-3xl rounded-lg border border-slate-300 bg-white px-4 py-3 text-center text-xs text-slate-700">
            {notice}
          </div>
        )}

        <div className="mx-auto mt-8 grid max-w-4xl gap-6 md:grid-cols-2">
          <PricingCard
            plan={freePlan}
            current={currentPlanId === "free"}
            actionLabel={currentPlanId === "free" ? "Your current plan" : "Downgrade to Free"}
            onAction={() => router.push("/dashboard/settings")}
          />
          <PricingCard
            plan={proPlan}
            highlight
            current={currentPlanId === "pro"}
            actionLabel={
              currentPlanId === "pro"
                ? "Your current plan"
                : config?.payments_mode === "test"
                  ? "Activate test entitlement"
                  : `Upgrade for ₹${proPlan?.price_inr ?? 0}/mo`
            }
            onAction={() => (config?.payments_mode === "test" ? activateTest() : startCheckout("pro"))}
            busy={busy !== null}
          />
        </div>

        <Card className="mx-auto mt-8 max-w-4xl overflow-hidden">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Plan feature comparison</caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Feature</th>
                <th scope="col" className="px-4 py-3 font-semibold">Free</th>
                <th scope="col" className="px-4 py-3 font-semibold">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {FEATURE_ROWS.map((row) => (
                <tr key={row.label}>
                  <td className="px-4 py-3 text-slate-700">{row.label}</td>
                  <td className="px-4 py-3 text-slate-600">{row.free}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-slate-500">
          Subscription state is verified by the server. Watermark removal and premium templates
          are never enabled by changing anything in your browser.{" "}
          <Link href="/login" className="text-slate-700 underline">
            {me ? "Go to dashboard" : "Sign in to start"}
          </Link>
        </p>
      </main>

      <MarketingFooter />
    </div>
  );
}

function PricingCard({
  plan,
  current,
  actionLabel,
  onAction,
  highlight,
  busy,
}: {
  plan?: Plan;
  current: boolean;
  actionLabel: string;
  onAction: () => void;
  highlight?: boolean;
  busy?: boolean;
}) {
  if (!plan) return null;
  const features = plan.features;
  const points = [
    `${features.daily_exports} poster exports / day`,
    features.watermark_free ? "No platform watermark" : "Platform watermark on exports",
    features.premium_templates ? "All templates" : "Limited template selection",
    features.save_brand ? "Brand saved to your account" : "Brand kept on this device",
  ];
  return (
    <Card
      className={cn(
        "relative flex flex-col p-6",
        highlight && "border-emerald-300 ring-1 ring-emerald-200",
      )}
    >
      {highlight && (
        <span className="absolute -top-3 left-6 rounded-full bg-emerald-600 px-3 py-0.5 text-[11px] font-bold text-white">
          MOST POPULAR
        </span>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">{plan.name}</h2>
        {current && <Badge tone="emerald">Current</Badge>}
      </div>
      <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
      <p className="mt-4">
        <span className="numeric text-4xl font-bold text-slate-900">
          {plan.price_inr === 0 ? "₹0" : `₹${plan.price_inr.toLocaleString("en-IN")}`}
        </span>
        <span className="text-sm text-slate-500"> / {plan.period}</span>
      </p>
      <ul className="mt-5 space-y-2 text-sm text-slate-700">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-2">
            <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.3 6.8-6.8a1 1 0 0 1 1.4 0Z"
                clipRule="evenodd"
              />
            </svg>
            <span>{point}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6 pt-2">
        <Button
          className="w-full"
          variant={highlight ? "accent" : "secondary"}
          disabled={current}
          loading={busy && !current}
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      </div>
    </Card>
  );
}

function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined" || document.getElementById("razorpay-js")) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "razorpay-js";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the payment script."));
    document.body.appendChild(script);
  });
}
