"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth";
import { Logo } from "@/components/marketing";
import { Button, Skeleton, cn } from "@/components/ui";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/ipos", label: "IPO Management" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
  { href: "/admin/templates", label: "Templates" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { me, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const allowed = me?.user.role === "admin";

  useEffect(() => {
    if (loading) return;
    if (!me) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (me.user.role !== "admin") router.replace("/dashboard");
  }, [loading, me, router, pathname]);

  if (loading || !me || !allowed) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  const nav = (
    <nav className="space-y-1 px-3 py-4" aria-label="Admin">
      {NAV.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            {item.label}
          </Link>
        );
      })}
      <div className="pt-3">
        <Link
          href="/dashboard"
          className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
        >
          ← Back to client dashboard
        </Link>
      </div>
    </nav>
  );

  const brand = (
    <div className="flex h-16 items-center border-b border-slate-200 px-5">
      <Link href="/admin" className="rounded focus-visible:ring-2 focus-visible:ring-slate-900">
        <Logo />
      </Link>
      <span className="ml-2 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
        ADMIN
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-full flex-col">
          {brand}
          <div className="flex-1">{nav}</div>
          <div className="border-t border-slate-200 p-4">
            <p className="truncate text-xs font-medium text-slate-700">{me.user.email}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2 w-full"
              onClick={async () => {
                await logout();
                router.replace("/login");
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
            <div className="flex h-full flex-col">
              {brand}
              <div className="flex-1">{nav}</div>
            </div>
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label="Toggle admin navigation"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <p className="hidden text-xs text-slate-500 lg:block">
            Administrative actions are logged with actor, action and time.
          </p>
          <Link
            href="/pricing"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Pricing page
          </Link>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
