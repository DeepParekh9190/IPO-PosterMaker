"use client";

import { useMemo, useState } from "react";
import { Button, Modal, SegmentedControl, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { copyText } from "@/lib/clipboard";
import { buildMessage, waShareUrl, type MessageKind } from "@/lib/messages";
import type { Ipo, Lang } from "@/lib/types";
import { api } from "@/lib/api";

const LANGUAGES: { value: Lang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
  { value: "gu", label: "ગુજરાતી" },
];

type Target = "details" | "whatsapp" | "telegram" | "social";

const TARGETS: { value: Target; label: string }[] = [
  { value: "details", label: "Details" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "social", label: "Other" },
];

function kindFor(target: Target): MessageKind {
  if (target === "whatsapp") return "whatsapp";
  if (target === "telegram") return "telegram";
  return "plain";
}

/**
 * Copy & share panel. WhatsApp/Telegram links are opened explicitly by the
 * user - nothing is ever sent automatically.
 */
export function SharePanel({
  ipo,
  open,
  onClose,
}: {
  ipo: Ipo | null;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [lang, setLang] = useState<Lang>("en");
  const [target, setTarget] = useState<Target>("whatsapp");

  const message = useMemo(
    () => (ipo ? buildMessage(ipo, lang, kindFor(target)) : ""),
    [ipo, lang, target],
  );

  if (!ipo) return null;

  async function copyCurrent() {
    const ok = await copyText(message);
    if (ok) toast.success("Copied to clipboard");
    else toast.error("Could not copy. Select the text and copy manually.");
  }

  async function copyAs(kind: MessageKind, label: string) {
    const text = buildMessage(ipo as Ipo, lang, kind);
    const ok = await copyText(text);
    if (ok) toast.success(`${label} message copied`);
    else toast.error("Copy failed - select the text and copy manually.");
  }

  function openWhatsApp() {
    window.open(waShareUrl(message), "_blank", "noopener,noreferrer");
  }

  async function shareNative() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `IPO - ${ipo!.company_name}`, text: message });
        return;
      } catch {
        /* user cancelled or unsupported - fall back to copy */
      }
    }
    await copyCurrent();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Copy & Share - ${ipo.company_name}`}
      description="Messages are generated from the selected IPO record. Missing values show as unavailable."
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="accent" onClick={copyCurrent}>
            Copy current format
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Message language
            </span>
            <SegmentedControl
              ariaLabel="Message language"
              options={LANGUAGES}
              value={lang}
              onChange={setLang}
            />
          </div>
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Format
            </span>
            <SegmentedControl
              ariaLabel="Message format"
              options={TARGETS}
              value={target}
              onChange={setTarget}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="message-preview" className="block text-sm font-medium text-slate-700">
            Preview
          </label>
          <Textarea
            id="message-preview"
            readOnly
            value={message}
            rows={12}
            className="numeric bg-slate-50 font-mono text-[12.5px] leading-relaxed"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={() => copyAs("plain", "Details")}>
            Copy IPO details
          </Button>
          <Button variant="secondary" onClick={() => copyAs("whatsapp", "WhatsApp")}>
            Copy WhatsApp-formatted message
          </Button>
          <Button variant="accent" onClick={openWhatsApp}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.48 1.34 5L2 22l5.16-1.34a9.9 9.9 0 0 0 4.88 1.26h.01c5.5 0 9.96-4.46 9.96-9.96S17.54 2 12.04 2Zm5.8 14.06c-.24.68-1.42 1.32-1.96 1.36-.5.04-1.14.2-3.5-.74-2.96-1.16-4.86-4.18-5-4.38-.14-.2-1.18-1.58-1.18-3.02s.76-2.14 1.02-2.44c.26-.3.58-.36.76-.36h.56c.18 0 .42-.06.66.5.24.58.84 2.04.92 2.18.08.14.14.32.02.52-.1.2-.16.32-.32.5-.16.18-.34.4-.48.52-.16.16-.32.34-.14.66.18.32.8 1.32 1.72 2.14 1.18 1.06 2.18 1.38 2.5 1.54.32.16.5.14.68-.08.18-.22.78-.9.98-1.22.22-.32.44-.26.74-.16.3.1 1.92.9 2.26 1.08.32.16.54.24.62.36.08.14.08.78-.16 1.46Z" />
            </svg>
            Share via WhatsApp
          </Button>
          <Button variant="secondary" onClick={() => copyAs("telegram", "Telegram")}>
            Copy for Telegram
          </Button>
          <Button variant="secondary" onClick={() => copyAs("plain", "Social media")}>
            Copy for other social media
          </Button>
          <Button variant="secondary" onClick={shareNative}>
            Share… (device)
          </Button>
        </div>

        <p className="text-xs text-slate-500">
          WhatsApp opens in a new tab with the message pre-filled; you still press send there.
        </p>
      </div>
    </Modal>
  );
}

/** Export usage helper used by the poster editor. */
export async function fetchExportGrant(templateKey: string, width: number, height: number) {
  return api.post("/api/posters/authorize-export", {
    template_key: templateKey,
    width,
    height,
  });
}
