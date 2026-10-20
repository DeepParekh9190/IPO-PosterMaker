import { toPng } from "html-to-image";

/**
 * Renders a poster node to a PNG data URL.
 * The node is captured at its intrinsic size (the preview scaling lives on a
 * wrapper element), so the downloaded file matches what the user sees.
 */
export async function renderPosterPng(node: HTMLElement, width: number, height: number): Promise<string> {
  return toPng(node, {
    width,
    height,
    pixelRatio: 1,
    cacheBust: true,
    backgroundColor: "#ffffff",
    style: { transform: "none", transformOrigin: "top left" },
  });
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "poster"
  );
}

export interface LogoValidation {
  ok: boolean;
  error?: string;
  dataUrl?: string;
  mime?: string;
}

export const MAX_LOGO_BYTES = 400_000;
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];

/** Validates the file type/size before reading it as a data URL. */
export function readLogoFile(file: File): Promise<LogoValidation> {
  return new Promise((resolve) => {
    if (!ALLOWED_MIME.includes(file.type)) {
      resolve({ ok: false, error: "Logo must be a PNG, JPEG or WebP image." });
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      resolve({
        ok: false,
        error: `Logo is too large (${Math.round(file.size / 1024)}KB). Maximum is ${Math.round(MAX_LOGO_BYTES / 1024)}KB.`,
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      resolve({ ok: true, dataUrl: String(reader.result), mime: file.type });
    reader.onerror = () => resolve({ ok: false, error: "Could not read the file." });
    reader.readAsDataURL(file);
  });
}

export async function canShareFiles(files: File[]): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.share) return false;
  const anyNav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
  };
  return Boolean(anyNav.canShare && anyNav.canShare({ files }));
}

export async function sharePng(file: File): Promise<void> {
  await navigator.share({ files: [file], title: file.name });
}
