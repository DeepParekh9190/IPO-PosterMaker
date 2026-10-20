"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import {
  DEFAULT_FIELDS,
  PosterCanvas,
  ACCENTS,
  type PosterSettings,
  type TemplateKey,
} from "@/components/poster/PosterCanvas";
import { Badge, Button, Card, ErrorState, Modal, Select, Skeleton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { Ipo, Template } from "@/lib/types";

export default function TemplatesPage() {
  const toast = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [ipos, setIpos] = useState<Ipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Template | null>(null);
  const previewBox = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.32);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [templateData, listData] = await Promise.all([
        api.get<Template[]>("/api/admin/templates"),
        api.get<{ items: Ipo[] }>("/api/ipos"),
      ]);
      setTemplates(templateData);
      setIpos(listData.items);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load templates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!preview || !previewBox.current) return;
    const element = previewBox.current;
    const update = () => setScale(Math.min(1, element.clientWidth / 1080));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [preview]);

  async function save(template: Template, patch: Partial<Template>) {
    const next = { ...template, ...patch };
    try {
      await api.put(`/api/admin/templates/${template.key}`, next);
      setTemplates((current) => current.map((t) => (t.key === template.key ? next : t)));
      toast.success(`${template.name} updated`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save the template.");
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  const sampleIpo = ipos[0] ?? null;
  const previewSettings: PosterSettings | null = preview
    ? {
        template: preview.key as TemplateKey,
        theme: "finance-green",
        fields: { ...DEFAULT_FIELDS },
        businessName: "Sharma IPO Services",
        footerText: "Call 98765 43210",
        logoDataUrl: null,
        logoX: 4,
        logoY: 14,
        logoSize: 16,
        width: 1080,
        height: 1350,
        language: "en",
        watermark: preview.plan === "free",
        watermarkText: "Created with IPO Poster Studio",
      }
    : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Template management</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enable templates, restrict them by plan and pick the default. Watermark text is set in
          Settings.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <Card key={template.key} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div
                className="hidden h-16 w-12 shrink-0 rounded-md border border-slate-200 sm:block"
                style={{
                  background:
                    template.key === "premium-corporate" || template.key === "dark-market"
                      ? "#0b1f3a"
                      : template.key === "gujarati-business"
                        ? "#fffaf3"
                        : "#ffffff",
                }}
                aria-hidden="true"
              >
                <div className="mx-2 mt-3 h-1.5 rounded" style={{ background: ACCENTS["finance-green"] }} />
                <div className="mx-2 mt-1.5 h-1 rounded bg-slate-300" />
                <div className="mx-2 mt-1 h-1 w-2/3 rounded bg-slate-300" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">{template.name}</h2>
                  <Badge tone={template.plan === "pro" ? "emerald" : "slate"}>
                    {template.plan === "pro" ? "Paid plan" : "Free plan"}
                  </Badge>
                  {template.is_default && <Badge tone="blue">Default</Badge>}
                  {!template.enabled && <Badge tone="red">Disabled</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{template.description}</p>
                <p className="mt-0.5 font-mono text-[11px] text-slate-400">{template.key}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  aria-label={`Plan availability for ${template.name}`}
                  className="h-9 w-32 py-1 text-xs"
                  value={template.plan}
                  onChange={(event) =>
                    void save(template, { plan: event.target.value as "free" | "pro" })
                  }
                >
                  <option value="free">Free plan</option>
                  <option value="pro">Paid plan</option>
                </Select>
                <Button
                  size="sm"
                  variant={template.enabled ? "secondary" : "primary"}
                  onClick={() => void save(template, { enabled: !template.enabled })}
                >
                  {template.enabled ? "Disable" : "Enable"}
                </Button>
                {!template.is_default && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void save(template, { is_default: true })}
                  >
                    Set default
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setPreview(template)}>
                  Preview
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={`Preview - ${preview?.name ?? ""}`}
        description="Sample poster using this template (1080 × 1350)."
        maxWidth="max-w-3xl"
        footer={<Button variant="secondary" onClick={() => setPreview(null)}>Close</Button>}
      >
        <div ref={previewBox} className="max-h-[70vh] overflow-y-auto bg-slate-100 p-4">
          {sampleIpo && previewSettings ? (
            <div
              style={{
                width: 1080 * scale,
                height: 1350 * scale,
                overflow: "hidden",
                margin: "0 auto",
                boxShadow: "0 10px 30px rgba(15,23,42,0.16)",
              }}
            >
              <div
                style={{
                  width: 1080,
                  height: 1350,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                <PosterCanvas ipo={sampleIpo} settings={previewSettings} />
              </div>
            </div>
          ) : (
            <Skeleton className="mx-auto h-[560px] w-[400px]" />
          )}
        </div>
      </Modal>
    </div>
  );
}
