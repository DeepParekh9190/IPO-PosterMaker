"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ShareCard } from "@/components/ShareCard";
import { copyText, templates } from "@/lib/copy";
import { initials, type Ipo } from "@/lib/ipos";

const STATUSES = [
  { key: "all", label: "All" },
  { key: "live", label: "Open" },
  { key: "upcoming", label: "Upcoming" },
  { key: "closed", label: "Closed" },
  { key: "listed", label: "Listed" },
] as const;

const BOARDS = [
  { key: "all", label: "All boards" },
  { key: "MAINBOARD", label: "Mainboard" },
  { key: "SME", label: "SME" },
] as const;

type Status = (typeof STATUSES)[number]["key"];
type Board = (typeof BOARDS)[number]["key"];

export default function Page() {
  const [ipos, setIpos] = useState<Ipo[]>([]);
  const [status, setStatus] = useState<Status>("all");
  const [board, setBoard] = useState<Board>("all");
  const [copied, setCopied] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [imageIpo, setImageIpo] = useState<Ipo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  async function load(fresh = false) {
    if (fresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");
    try {
      // ?fresh busts the browser cache; the route also skips its 5-min upstream cache
      const res = await fetch(`/api/ipos${fresh ? `?fresh=${Date.now()}` : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data: { ipos: Ipo[] } = await res.json();
      setIpos(data.ipos);
    } catch {
      setError("Couldn't load IPOs. Try again in a minute.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (imageIpo && !dialog.open) dialog.showModal();
    if (!imageIpo && dialog.open) dialog.close();
  }, [imageIpo]);

  useEffect(() => {
    if (menuFor === null) return;
    const close = () => setMenuFor(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuFor]);

  const visible = useMemo(
    () =>
      ipos.filter(
        (i) => (status === "all" || i.status === status) && (board === "all" || i.board === board),
      ),
    [ipos, status, board],
  );

  const count = (key: Status) =>
    key === "all" ? ipos.length : ipos.filter((i) => i.status === key).length;

  async function copy(ipo: Ipo, key: string, value: string) {
    const ok = await copyText(value);
    setMenuFor(null);
    if (ok) {
      setCopied(`${ipo.id}:${key}`);
      setTimeout(() => setCopied(null), 1500);
    }
  }

  return (
    <>
      <header className="site-header">
        <div className="shell header-inner">
          <a className="brand" href="/">
            IPO Studio
          </a>
          <div className="header-right">
            {!loading && !error && (
              <p className="header-live">
                <span />
                {count("live")} open now
              </p>
            )}
            <button
              className="btn ghost header-refresh"
              onClick={() => load(true)}
              disabled={refreshing || loading}
              title="Fetch fresh IPO data"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      <main className="shell">
        <section className="hero">
          <p className="eyebrow">Live IPO data · share-ready cards</p>
          <h1>Share IPOs, beautifully.</h1>
          <p className="hero-copy">
            Price bands, GMP and dates for every open, upcoming and closed issue. Copy the details
            straight into WhatsApp, or make a pastel card with the company logo and download it.
          </p>
        </section>

        <section className="filters" aria-label="Filters">
          <div className="filter-row" role="group" aria-label="Status">
            {STATUSES.map((s) => (
              <button
                key={s.key}
                className={status === s.key ? "chip on" : "chip"}
                onClick={() => setStatus(s.key)}
                aria-pressed={status === s.key}
              >
                {s.label}
                <span className="count">{count(s.key)}</span>
              </button>
            ))}
          </div>
          <div className="filter-row" role="group" aria-label="Board">
            {BOARDS.map((b) => (
              <button
                key={b.key}
                className={board === b.key ? "chip small on" : "chip small"}
                onClick={() => setBoard(b.key)}
                aria-pressed={board === b.key}
              >
                {b.label}
              </button>
            ))}
          </div>
        </section>

        {loading && <p className="note">Loading…</p>}
        {error && <p className="note error">{error}</p>}

        <section className="grid" aria-label="IPOs">
          {visible.map((ipo) => (
            <article className="ipo-card" key={ipo.id}>
              <div className="ipo-top">
                <span className="ipo-logo">
                  <span>{initials(ipo.name)}</span>
                  <img
                    src={ipo.logo}
                    alt=""
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </span>
                <div className="ipo-heading">
                  <h2 className="ipo-name">{ipo.name}</h2>
                  <p className="ipo-sub">
                    <span className="tag">{ipo.board}</span>
                    <span className={`tag ${ipo.status}`}>{ipo.status === "live" ? "open" : ipo.status}</span>
                  </p>
                </div>
              </div>

              <dl className="ipo-stats">
                <div className="stat">
                  <dt>Price band</dt>
                  <dd>{ipo.priceBand}</dd>
                </div>
                <div className="stat accent">
                  <dt>GMP</dt>
                  <dd className={ipo.gmp != null && ipo.gmp < 0 ? "neg" : ""}>
                    {ipo.gmp != null ? `${ipo.gmp > 0 ? "+" : ""}₹${ipo.gmp}` : "-"}
                    {ipo.gmpPercent && <small> ({ipo.gmpPercent})</small>}
                  </dd>
                </div>
                <div className="stat">
                  <dt>Lot size</dt>
                  <dd>{ipo.lot ? `${ipo.lot} shares` : "-"}</dd>
                </div>
                <div className="stat">
                  <dt>Min investment</dt>
                  <dd>{ipo.minInvestment}</dd>
                </div>
              </dl>

              <p className="ipo-dates">
                {ipo.open} → {ipo.close}
                {ipo.issueSize !== "-" && <span> · Issue {ipo.issueSize}</span>}
              </p>

              <div className="ipo-actions">
                <div className="menu-wrap">
                  <button
                    className="btn ghost"
                    onClick={() => setMenuFor(menuFor === ipo.id ? null : ipo.id)}
                    aria-expanded={menuFor === ipo.id}
                  >
                    {copied?.startsWith(`${ipo.id}:`) ? "Copied ✓" : "Copy ▾"}
                  </button>
                  {menuFor === ipo.id && (
                    <div className="menu" role="menu">
                      {templates.map((t) => (
                        <button key={t.key} onClick={() => copy(ipo, t.key, t.build(ipo))}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button className="btn" onClick={() => setImageIpo(ipo)}>
                  Image
                </button>
              </div>
            </article>
          ))}
          {!loading && !error && visible.length === 0 && (
            <p className="note">Nothing matches that filter right now. Try another one.</p>
          )}
        </section>
      </main>

      <footer className="site-footer">
        <div className="shell footer-inner">
          <p>GMP is unofficial and not investment advice.</p>
          <p>Cards are generated in your browser, so nothing gets uploaded.</p>
          <p>Designed by DEEP PAREKH</p>
        </div>
      </footer>

      <dialog
        className="card-dialog"
        ref={dialogRef}
        aria-label="IPO image card"
        onClose={() => setImageIpo(null)}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        {imageIpo && (
          <div className="dialog-body">
            <button className="dialog-close" onClick={() => dialogRef.current?.close()} aria-label="Close">
              ×
            </button>
            <h3>{imageIpo.name}</h3>
            <ShareCard ipo={imageIpo} />
            <p className="note">GMP is unofficial, not investment advice.</p>
          </div>
        )}
      </dialog>
    </>
  );
}
