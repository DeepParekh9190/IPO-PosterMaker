"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth";
import { Logo } from "@/components/marketing";
import { Button, Skeleton, cn } from "@/components/ui";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const ICONS = {
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  image: "M4 5h16v14H4zM4 15l4-4 3 3 4-5 5 6",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8.4-3a8.4 8.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a8.6 8.6 0 0 0-2-1.2L15.5 3h-4l-.4 2.6c-.7.3-1.4.7-2 1.2l-2.4-1-2 3.4 2 1.6a8.4 8.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2l.4 2.6h4l.4-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",
  shield: "M12 3l7 3v6c0 4.4-3 8.2-7 9-4-.8-7-4.6-7-9V6l7-3Z",
} as const;

function icon(path: string) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { me, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !me) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, me, router, pathname]);

  if (loading || !me) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-6xl space-y-4">
          <Skeleton className="h-10 w-56" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const nav: NavItem[] = [
    { href: "/dashboard", label: "IPO Dashboard", icon: icon(ICONS.grid) },
    { href: "/dashboard/posters", label: "Poster Studio", icon: icon(ICONS.image) },
    { href: "/dashboard/settings", label: "Settings & Plan", icon: icon(ICONS.settings) },
  ];
  if (me.user.role === "admin") {
    nav.push({ href: "/admin", label: "Admin panel", icon: icon(ICONS.shield) });
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-slate-200 px-5">
        <Link href="/dashboard" className="rounded focus-visible:ring-2 focus-visible:ring-slate-900">
          <Logo />
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Dashboard">
        {nav.map((item) => {
          const active =
            item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
            {me.user.email.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">
              {me.user.business_name || me.user.email}
            </p>
            <p className="truncate text-xs text-slate-500">
              {me.plan.name} plan
              {me.entitlements.watermark_free ? "" : " · watermarked"}
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="mt-3 w-full"
          onClick={async () => {
            await logout();
            router.replace("/login");
          }}
        >
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Toggle navigation menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <div className="hidden text-sm text-slate-500 lg:block">
            IPO information for educational sharing - not investment advice.
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                me.plan.id === "free"
                  ? "border-slate-200 bg-slate-50 text-slate-600"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800",
              )}
            >
              {me.plan.name} plan
            </span>
            <Link
              href="/pricing"
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              {me.plan.id === "free" ? "Upgrade" : "Manage plan"}
            </Link>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
