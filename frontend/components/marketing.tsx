import Link from "next/link";

// Module-load time keeps prerender output stable (Next errors on `new Date()` during SSG).
const YEAR = new Date().getFullYear();

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="flex items-center justify-center rounded-lg bg-slate-900 text-[11px] font-bold tracking-tight text-white"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        IPO
      </span>
      <span className="text-sm font-semibold text-slate-900">Poster Studio</span>
    </span>
  );
}

export function MarketingNav() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <Link href="/" className="rounded focus-visible:ring-2 focus-visible:ring-slate-900">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1.5 text-sm sm:gap-3" aria-label="Main">
          <Link
            href="/pricing"
            className="rounded-md px-2.5 py-2 font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="rounded-md px-2.5 py-2 font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            Sign in
          </Link>
          <Link
            href="/login?mode=register"
            className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          © {YEAR} IPO Poster Studio. IPO information is shared for
          education only and is not investment advice. GMP is unofficial and can change.
        </p>
        <p className="flex gap-4">
          <a className="hover:text-slate-800" href="/pricing">
            Pricing
          </a>
          <a className="hover:text-slate-800" href="/login">
            Sign in
          </a>
        </p>
      </div>
    </footer>
  );
}
