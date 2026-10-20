"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useAuth } from "@/components/auth";
import {
  DEFAULT_FIELDS,
  PosterCanvas,
  THEMES,
  ACCENTS,
  type FieldToggles,
  type PosterSettings,
  type TemplateKey,
  type ThemeKey,
} from "@/components/poster/PosterCanvas";
import { Badge, Button, Card, Field, Input, SegmentedControl, Skeleton, cn } from "@/components/ui";
import { useToast } from "@/components/toast";
import { api, ApiError } from "@/lib/api";
import {
  canShareFiles,
  downloadDataUrl,
  readLogoFile,
  renderPosterPng,
  sharePng,
  slugify,
} from "@/lib/export";
import type { AppConfig, ExportGrant, Ipo, Lang } from "@/lib/types";

const FIELD_LABELS: { key: keyof FieldToggles; label: string }[] = [
  { key: "dates", label: "IPO dates" },
  { key: "price", label: "Price band" },
  { key: "lot", label: "Lot size" },
  { key: "issue", label: "Issue size" },
  { key: "minInvestment", label: "Min investment" },
  { key: "gmp", label: "Reported GMP" },
  { key: "subscription", label: "Subscription" },
  { key: "allotment", label: "Allotment date" },
  { key: "listing", label: "Listing date" },
  { key: "status", label: "Status badge" },
  { key: "disclaimer", label: "Disclaimer" },
  { key: "source", label: "Source line" },
];

const STORAGE_KEY = "ipo-poster-studio:brand";

function PosterEditorInner() {
  const router = useRouter();
  const toast = useToast();
  const { me, refresh, loading: authLoading } = useAuth();

  const [config, setConfig] = useState<AppConfig | null>(null);
  const [ipos, setIpos] = useState<Ipo[]>([]);
  const [ipoId, setIpoId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<PosterSettings | null>(null);
  const [exporting, setExporting] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const canvasNode = useRef<HTMLDivElement | null>(null);
  const previewBox = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.5);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------------------------------------------------------- data loading */
  const load = useCallback(async () => {
    try {
      const [configData, listData] = await Promise.all([
        api.get<AppConfig>("/api/config"),
        api.get<{ items: Ipo[] }>("/api/ipos"),
      ]);
      setConfig(configData);
      setIpos(listData.items);

      const stored = readStoredBrand();
      const defaultTemplate =
        (stored?.template_key as TemplateKey) ??
        configData.templates.find((t) => t.is_default)?.key ??
        configData.templates[0]?.key ??
        "clean-white";

      setSettings({
        template: defaultTemplate,
        theme: (stored?.color_theme as ThemeKey) ?? "finance-green",
        fields: { ...DEFAULT_FIELDS },
        businessName: stored?.business_name ?? "",
        footerText: stored?.footer_text ?? "",
        logoDataUrl: stored?.logo_data_url ?? null,
        logoX: stored?.logo_x ?? 4,
        logoY: stored?.logo_y ?? 14,
        logoSize: stored?.logo_size ?? 16,
        width: configData.default_width,
        height: configData.default_height,
        language: configData.default_language,
        watermark: true,
        watermarkText: configData.watermark_text,
      });

      const fromQuery = new URLSearchParams(window.location.search).get("ipo");
      const valid = fromQuery && listData.items.some((i) => i.id === fromQuery);
      setIpoId(valid ? fromQuery : (listData.items[0]?.id ?? ""));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load the poster studio.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* Watermark preview must reflect SERVER entitlement, not browser state. */
  useEffect(() => {
    if (!me) return;
    setSettings((current) =>
      current
        ? {
            ...current,
            watermark: !me.entitlements.watermark_free,
            watermarkText: current.watermarkText,
            businessName: current.businessName || (me.user.business_name ?? ""),
          }
        : current,
    );
  }, [me]);

  /* Load saved brand from the server for paid users (device storage for free). */
  useEffect(() => {
    if (!me || !config) return;
    if (!me.entitlements.save_brand) return;
    let cancelled = false;
    api
      .get<{ business_name: string; logo_data_url: string | null; template_key: string; color_theme: string; footer_text: string }>(
        "/api/brand",
      )
      .then((brand) => {
        if (cancelled || (!brand.logo_data_url && !brand.business_name)) return;
        setSettings((current) =>
          current
            ? {
                ...current,
                businessName: brand.business_name || current.businessName,
                footerText: brand.footer_text || current.footerText,
                logoDataUrl: brand.logo_data_url ?? current.logoDataUrl,
                template: (brand.template_key as TemplateKey) || current.template,
                theme: (brand.color_theme as ThemeKey) || current.theme,
              }
            : current,
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [me, config]);

  /* Persist preferences on this device (localStorage - not a paid feature). */
  useEffect(() => {
    if (!settings) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            business_name: settings.businessName,
            footer_text: settings.footerText,
            logo_data_url: settings.logoDataUrl,
            logo_x: settings.logoX,
            logo_y: settings.logoY,
            logo_size: settings.logoSize,
            template_key: settings.template,
            color_theme: settings.theme,
          }),
        );
      } catch {
        /* storage full - preferences simply do not persist on this device */
      }
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [settings]);

  /* Preview scaling: intrinsic poster size -> container width. */
  useEffect(() => {
    if (!settings || !previewBox.current) return;
    const element = previewBox.current;
    const update = () => {
      const available = element.clientWidth;
      setScale(Math.min(1, available / settings.width));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [settings?.width, settings]);

  const ipo = useMemo(() => ipos.find((i) => i.id === ipoId) ?? null, [ipos, ipoId]);

  const update = useCallback((patch: Partial<PosterSettings>) => {
    setSettings((current) => (current ? { ...current, ...patch } : current));
  }, []);

  async function onLogoChange(file: File | undefined) {
    if (!file) return;
    const result = await readLogoFile(file);
    if (!result.ok) {
      toast.error(result.error ?? "Invalid logo file.");
      return;
    }
    update({ logoDataUrl: result.dataUrl ?? null, logoX: 4, logoY: 14 });
    toast.success("Logo added");
  }

  async function exportPoster(mode: "download" | "share") {
    if (!settings || !ipo || !canvasNode.current) return;
    setExporting(true);
    try {
      // Server decides watermark, template access and limits - always.
      const grant = await api.post<ExportGrant>("/api/posters/authorize-export", {
        template_key: settings.template,
        width: settings.width,
        height: settings.height,
      });

      flushSync(() =>
        setSettings((current) =>
          current
            ? {
                ...current,
                watermark: grant.watermark,
                watermarkText: grant.watermark_text || current.watermarkText,
              }
            : current,
        ),
      );
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const dataUrl = await renderPosterPng(canvasNode.current, settings.width, settings.height);
      const filename = `${slugify(ipo.company_name)}-ipo-${settings.width}x${settings.height}.png`;

      if (mode === "download") {
        downloadDataUrl(dataUrl, filename);
        toast.success(grant.watermark ? "Poster downloaded (with watermark)" : "Poster downloaded");
      } else {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], filename, { type: "image/png" });
        if (await canShareFiles([file])) {
          await sharePng(file);
        } else {
          downloadDataUrl(dataUrl, filename);
          toast.push("Sharing files is not supported here - the poster was downloaded instead.", "info");
        }
      }
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
        if (err.status === 402) await refresh();
      } else {
        toast.error(
          "The poster could not be rendered in this browser. Try another browser or disable strict privacy extensions.",
        );
      }
    } finally {
      setExporting(false);
    }
  }

  async function saveBrandToAccount() {
    if (!settings || !me) return;
    setSavedNotice(null);
    try {
      await api.put("/api/brand", {
        business_name: settings.businessName,
        logo_data_url: settings.logoDataUrl,
        logo_mime: settings.logoDataUrl?.match(/^data:(image\/[a-z+]+);/)?.[1] ?? null,
        template_key: settings.template,
        color_theme: settings.theme,
        footer_text: settings.footerText,
      });
      toast.success("Brand saved to your account");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not save brand.";
      setSavedNotice(message);
      toast.error(message);
    }
  }

  /* --------------------------------------------------------------- states */
  if (authLoading || loading || !settings || !config) {
    return (
      <div className="mx-auto w-full max-w-7xl">
        <Skeleton className="h-9 w-64" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
          <Skeleton className="h-[520px] rounded-xl" />
          <Skeleton className="h-[520px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-semibold text-red-800">Poster Studio could not load</p>
        <p className="mt-1 text-sm text-red-700">{error}</p>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!ipo) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-900">Choose an IPO first</h2>
        <p className="mt-1 text-sm text-slate-600">
          Select an IPO from the dashboard to build its poster.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Button onClick={() => router.push("/dashboard")}>Go to dashboard</Button>
        </div>
      </div>
    );
  }

  const templateLocked = (key: string, plan: string) =>
    plan === "pro" && !me?.entitlements.premium_templates;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Poster Studio</h1>
          <p className="mt-1 text-sm text-slate-500">
            {me?.entitlements.watermark_free
              ? "Your plan exports without the platform watermark."
              : "Free plan exports include the platform watermark."}{" "}
            Every export is authorized by the server.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={me?.entitlements.watermark_free ? "emerald" : "amber"}>
            {me?.entitlements.watermark_free ? "No watermark" : "Watermarked"}
          </Badge>
          <Badge tone="slate">
            {me?.usage.exports_today ?? 0} / {me?.entitlements.daily_exports ?? "-"} exports today
          </Badge>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* ------------------------------------------------------ controls */}
        <div className="space-y-4">
          <Card className="p-4">
            <Field label="IPO" htmlFor="ipo-select">
              <select
                id="ipo-select"
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                value={ipoId}
                onChange={(event) => setIpoId(event.target.value)}
              >
                {ipos.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.company_name} ({item.category})
                  </option>
                ))}
              </select>
            </Field>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900">Template</h2>
            <div className="mt-3 grid gap-2">
              {config.templates.map((template) => {
                const locked = templateLocked(template.key, template.plan);
                const active = settings.template === template.key;
                return (
                  <button
                    key={template.key}
                    type="button"
                    onClick={() => update({ template: template.key as TemplateKey })}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition",
                      active
                        ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                        : "border-slate-200 hover:border-slate-300",
                    )}
                  >
                    <span>
                      <span className="block font-medium text-slate-900">{template.name}</span>
                      <span className="block text-xs text-slate-500">{template.description}</span>
                    </span>
                    {locked && <Badge tone="amber">Paid</Badge>}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="space-y-4 p-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Colour theme</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {THEMES.map((theme) => (
                  <button
                    key={theme.key}
                    type="button"
                    title={theme.label}
                    aria-label={`Theme ${theme.label}`}
                    onClick={() => update({ theme: theme.key })}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition",
                      settings.theme === theme.key
                        ? "border-slate-900 ring-2 ring-slate-300"
                        : "border-white ring-1 ring-slate-200",
                    )}
                    style={{ background: ACCENTS[theme.key] }}
                  />
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-900">Size</h2>
              <div className="mt-2">
                <SegmentedControl
                  ariaLabel="Poster size"
                  value={`${settings.width}x${settings.height}`}
                  onChange={(value) => {
                    const [width, height] = value.split("x").map(Number);
                    update({ width, height });
                  }}
                  options={[
                    { value: "1080x1080", label: "1080 × 1080" },
                    { value: "1080x1350", label: "1080 × 1350" },
                  ]}
                />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-900">Text language</h2>
              <div className="mt-2">
                <SegmentedControl
                  ariaLabel="Poster language"
                  value={settings.language}
                  onChange={(value) => update({ language: value as Lang })}
                  options={[
                    { value: "en" as Lang, label: "English" },
                    { value: "hi" as Lang, label: "हिन्दी" },
                    { value: "gu" as Lang, label: "ગુજરાતી" },
                  ]}
                />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-900">Show fields</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {FIELD_LABELS.map((field) => (
                <label
                  key={field.key}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={settings.fields[field.key]}
                    onChange={(event) =>
                      update({
                        fields: { ...settings.fields, [field.key]: event.target.checked },
                      })
                    }
                    className="h-3.5 w-3.5 accent-slate-900"
                  />
                  {field.label}
                </label>
              ))}
            </div>
          </Card>

          <Card className="space-y-4 p-4">
            <h2 className="text-sm font-semibold text-slate-900">Branding</h2>

            <Field
              label="Logo (PNG, JPEG or WebP, max 400KB)"
              htmlFor="logo-input"
              hint="Drag the logo on the preview to reposition it."
            >
              <div className="flex items-center gap-2">
                <input
                  id="logo-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => void onLogoChange(event.target.files?.[0])}
                  className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-50"
                />
                {settings.logoDataUrl && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => update({ logoDataUrl: null })}
                    type="button"
                  >
                    Remove
                  </Button>
                )}
              </div>
            </Field>

            {settings.logoDataUrl && (
              <div className="space-y-3">
                <Slider
                  label="Logo size"
                  value={settings.logoSize}
                  min={6}
                  max={32}
                  suffix="%"
                  onChange={(logoSize) => update({ logoSize })}
                />
                <Slider
                  label="Horizontal"
                  value={settings.logoX}
                  min={0}
                  max={70}
                  suffix="%"
                  onChange={(logoX) => update({ logoX })}
                />
                <Slider
                  label="Vertical"
                  value={settings.logoY}
                  min={0}
                  max={40}
                  suffix="%"
                  onChange={(logoY) => update({ logoY })}
                />
              </div>
            )}

            <Field label="Business name" htmlFor="business-name">
              <Input
                id="business-name"
                maxLength={80}
                value={settings.businessName}
                onChange={(event) => update({ businessName: event.target.value })}
                placeholder="Sharma IPO Services"
              />
            </Field>

            <Field label="Contact / footer line" htmlFor="footer-text">
              <Input
                id="footer-text"
                maxLength={120}
                value={settings.footerText}
                onChange={(event) => update({ footerText: event.target.value })}
                placeholder="Call 98765 43210 · Rajkot"
              />
            </Field>

            {me?.entitlements.save_brand ? (
              <Button variant="secondary" className="w-full" onClick={() => void saveBrandToAccount()}>
                Save brand to my account
              </Button>
            ) : (
              <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Saving your brand to your account is a paid feature. On the free plan your logo and
                details are kept on this device only.{" "}
                <a href="/pricing" className="font-semibold text-emerald-700 underline">
                  See plans
                </a>
              </p>
            )}
            {savedNotice && <p className="text-xs text-red-600">{savedNotice}</p>}
          </Card>
        </div>

        {/* ------------------------------------------------------- preview */}
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Preview</h2>
                <p className="text-xs text-slate-500">
                  The downloaded PNG matches this preview ({settings.width} × {settings.height}).
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => void exportPoster("share")}
                  loading={exporting}
                >
                  Share / Save
                </Button>
                <Button variant="accent" onClick={() => void exportPoster("download")} loading={exporting}>
                  Download PNG
                </Button>
              </div>
            </div>

            <div ref={previewBox} className="bg-slate-100 p-4 sm:p-6">
              <div
                style={{
                  width: settings.width * scale,
                  height: settings.height * scale,
                  overflow: "hidden",
                  margin: "0 auto",
                  boxShadow: "0 10px 30px rgba(15,23,42,0.14)",
                  borderRadius: 6,
                }}
              >
                <div
                  style={{
                    width: settings.width,
                    height: settings.height,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                  }}
                  onPointerDown={(event) => {
                    if (!settings.logoDataUrl) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    const x = ((event.clientX - rect.left) / rect.width) * 100;
                    const y = ((event.clientY - rect.top) / rect.height) * 100;
                    update({
                      logoX: Math.max(0, Math.min(70, Math.round(x - settings.logoSize / 2))),
                      logoY: Math.max(0, Math.min(45, Math.round(y - 6))),
                    });
                  }}
                >
                  <PosterCanvas ipo={ipo} settings={settings} forwardRef={(node) => (canvasNode.current = node)} />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4 text-xs leading-relaxed text-slate-600">
            <p className="font-semibold text-slate-800">Before you post</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>GMP is unofficial, indicative and can change - the disclaimer stays on the poster.</li>
              <li>Sample/demo records are labelled in the dashboard until an authorized data source is connected.</li>
              <li>
                Watermark removal and premium templates are checked on the server for every export,
                so changing browser settings cannot unlock them.
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const id = `slider-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="flex items-center justify-between text-xs font-medium text-slate-600">
        {label}
        <span className="numeric text-slate-400">
          {value}
          {suffix}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full accent-slate-900"
      />
    </div>
  );
}

interface StoredBrand {
  business_name?: string;
  footer_text?: string;
  logo_data_url?: string | null;
  logo_x?: number;
  logo_y?: number;
  logo_size?: number;
  template_key?: string;
  color_theme?: string;
}

function readStoredBrand(): StoredBrand | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredBrand) : null;
  } catch {
    return null;
  }
}

export default function PosterEditorPage() {
  return <PosterEditorInner />;
}
