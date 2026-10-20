"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/components/auth";
import { MarketingFooter, MarketingNav } from "@/components/marketing";
import { Button, Field, Input } from "@/components/ui";
import { useToast } from "@/components/toast";

function safeNext(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "";
}

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const { me, loading, login, register } = useAuth();
  const toast = useToast();

  const [mode, setMode] = useState<"login" | "register">(
    search.get("mode") === "register" ? "register" : "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = safeNext(search.get("next"));

  useEffect(() => {
    if (!loading && me) {
      router.replace(next || (me.user.role === "admin" ? "/admin" : "/dashboard"));
    }
  }, [loading, me, router, next]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result =
        mode === "login" ? await login(email, password) : await register(email, password, businessName);
      toast.success(mode === "login" ? "Signed in" : "Account created");
      router.replace(next || (result.user.role === "admin" ? "/admin" : "/dashboard"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <MarketingNav />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h1 className="text-xl font-bold text-slate-900">
              {mode === "login" ? "Sign in to your account" : "Create your account"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {mode === "login"
                ? "Access your IPO dashboard, messages and posters."
                : "Free plan includes IPO browsing, messages and watermarked posters."}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm">
              {(["login", "register"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setMode(value);
                    setError(null);
                  }}
                  className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                    mode === value
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {value === "login" ? "Sign in" : "Sign up"}
                </button>
              ))}
            </div>

            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <Field label="Email address" htmlFor="email" required>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@firm.com"
                />
              </Field>

              {mode === "register" && (
                <Field label="Business name" htmlFor="business" hint="Optional. Shown on your posters.">
                  <Input
                    id="business"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Sharma IPO Services"
                    maxLength={80}
                  />
                </Field>
              )}

              <Field
                label="Password"
                htmlFor="password"
                required
                hint={mode === "register" ? "At least 8 characters." : undefined}
                error={error}
              >
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  minLength={mode === "register" ? 8 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>

              <Button type="submit" className="w-full" loading={busy} size="lg">
                {mode === "login" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <p className="mt-5 text-center text-xs text-slate-500">
              We never ask for PAN, bank, UPI or demat details.
            </p>
          </div>

          <p className="mt-4 text-center text-xs text-slate-500">
            By continuing you agree to use IPO data for educational sharing only.{" "}
            <Link href="/" className="text-slate-700 underline">
              Back to home
            </Link>
          </p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <LoginInner />
    </Suspense>
  );
}
