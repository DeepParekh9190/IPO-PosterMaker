import Link from "next/link";
import { MarketingFooter, MarketingNav } from "@/components/marketing";

const FEATURES = [
  {
    title: "IPO data at a glance",
    body: "Searchable Mainboard and SME IPOs with price band, lot size, dates, subscription and reported GMP. Missing values show as unavailable - never invented.",
    icon: "M4 6h16M4 12h16M4 18h10",
  },
  {
    title: "Copy & share in one tap",
    body: "WhatsApp, Telegram or plain text in English, Hindi or Gujarati, with a built-in educational disclaimer and source attribution.",
    icon: "M8 7h8M8 11h5m-5 4h8M5 4h14v16H5z",
  },
  {
    title: "Branded poster generator",
    body: "Upload your logo, pick a template, toggle fields and export a crisp 1080×1080 or 1080×1350 PNG in seconds.",
    icon: "M4 5h16v14H4zM4 15l4-4 3 3 4-5 5 6",
  },
  {
    title: "Free and paid plans",
    body: "Free exports carry a small platform watermark. Paid plans remove it, unlock premium templates and save your brand - all verified on the server.",
    icon: "M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 16.5 7.1 18.2l.9-5.5-4-3.9L9.5 8z",
  },
];

const STEPS = [
  { step: "1", title: "Pick an IPO", body: "Filter by status and segment, then open the details drawer." },
  { step: "2", title: "Copy the message", body: "Choose a language and share it on WhatsApp or Telegram." },
  { step: "3", title: "Make the poster", body: "Add your logo and export a watermarked-free PNG on the paid plan." },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingNav />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-20">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
                Built for Indian IPO distributors and finance creators
              </span>
              <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
                IPO posts and posters,
                <span className="text-emerald-700"> ready in seconds.</span>
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
                Browse IPO details, copy perfectly formatted WhatsApp messages in your
                client&apos;s language, and generate branded social media posters - without
                designing anything by hand.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href="/login?mode=register"
                  className="inline-flex h-11 items-center rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Start free
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex h-11 items-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  See pricing
                </Link>
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Free plan: browse, copy and export watermarked posters. No card required.
              </p>
            </div>

            {/* Sample poster preview (static) */}
            <div className="relative mx-auto w-full max-w-md">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tracking-wide text-slate-900">
                    NEW IPO
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    OPEN
                  </span>
                </div>
                <p className="mt-3 text-xl font-bold text-slate-900">Aarav Finserv Ltd</p>
                <p className="text-xs text-slate-500">Mainboard · 18 Oct – 21 Oct 2026</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">
                      Price band
                    </p>
                    <p className="numeric mt-0.5 text-sm font-bold text-slate-900">
                      ₹412 – ₹434
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Lot</p>
                    <p className="numeric mt-0.5 text-sm font-bold text-slate-900">34</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">
                      Issue size
                    </p>
                    <p className="numeric mt-0.5 text-sm font-bold text-slate-900">
                      ₹3,240 Cr
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">
                      Reported GMP
                    </p>
                    <p className="numeric mt-0.5 text-sm font-bold text-emerald-700">
                      +₹24 (5.5%)
                    </p>
                  </div>
                </div>
                <p className="mt-4 border-t border-dashed border-slate-200 pt-3 text-[10px] leading-relaxed text-slate-500">
                  For educational information only. GMP is unofficial, indicative and may
                  change. Not investment advice.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Everything you post, in one workspace
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                  </svg>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Steps */}
        <section className="border-y border-slate-200 bg-slate-50">
          <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-14 sm:px-6 md:grid-cols-3">
            {STEPS.map((item) => (
              <div key={item.step} className="flex gap-4">
                <span className="numeric flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                  {item.step}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto w-full max-w-6xl px-4 py-14 text-center sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Create your free account and post your first IPO today
          </h2>
          <div className="mt-6">
            <Link
              href="/login?mode=register"
              className="inline-flex h-11 items-center rounded-lg bg-emerald-600 px-6 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              Get started free
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
