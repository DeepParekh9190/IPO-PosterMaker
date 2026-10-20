"use client";

import { useEffect, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import { initials, type Ipo } from "@/lib/ipos";

type ThemeKey = "mint" | "lavender" | "peach" | "sky" | "rose" | "sand" | "slate" | "lemon";
type Size = "portrait" | "square" | "story" | "pinterest" | "wide" | "a4";
type Template = "classic" | "bold" | "minimal" | "split" | "center" | "ticket" | "editorial" | "ribbon";
type Pattern = "none" | "dots" | "grid" | "stripes" | "cross" | "rings";
type BrandPlace = "bottom-left" | "bottom-right" | "bottom-center" | "top";

type Prefs = {
  template: Template;
  size: Size;
  theme: ThemeKey;
  tinted: boolean;
  accent: string;
  title: string;
  cta: string;
  pattern: Pattern;
  brandPlace: BrandPlace;
  showGmp: boolean;
  showStats: boolean;
  showIssue: boolean;
  showDates: boolean;
  note: string;
  handle: string;
  qr: boolean;
  qrLink: string;
  logoScale: number;
  nameScale: number;
  brandW: number;
  brandH: number;
  pillScale: number;
  removeLogoBg: boolean;
  logoBgTol: number;
  removeBrandBg: boolean;
  brandBgTol: number;
};

const DEFAULTS: Prefs = {
  template: "classic",
  size: "portrait",
  theme: "mint",
  tinted: true,
  accent: "",
  title: "",
  cta: "",
  pattern: "none",
  brandPlace: "bottom-left",
  showGmp: true,
  showStats: true,
  showIssue: true,
  showDates: true,
  note: "",
  handle: "",
  qr: false,
  qrLink: "",
  logoScale: 100,
  nameScale: 100,
  brandW: 100,
  brandH: 100,
  pillScale: 100,
  removeLogoBg: false,
  logoBgTol: 32,
  removeBrandBg: false,
  brandBgTol: 32,
};

const STORAGE_KEY = "ipo-studio-prefs";
const SCALE_RANGE = { min: 60, max: 160, step: 10 };
const SLIDER_STEP = 5;
const SCALES: { key: "logoScale" | "nameScale"; label: string }[] = [
  { key: "logoScale", label: "IPO logo" },
  { key: "nameScale", label: "IPO name" },
];

function clampScale(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 100;
  return Math.min(SCALE_RANGE.max, Math.max(SCALE_RANGE.min, Math.round(n)));
}

function clampTolerance(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 32;
  return Math.min(80, Math.max(0, Math.round(n)));
}

function loadPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const saved = JSON.parse(raw);
    if (saved.brandPlace === "footer") saved.brandPlace = "bottom-left";
    // old single business scale becomes both axes on first load
    if (saved.brandW == null && saved.brandScale != null) saved.brandW = saved.brandScale;
    if (saved.brandH == null && saved.brandScale != null) saved.brandH = saved.brandScale;
    delete saved.brandScale;
    const merged = { ...DEFAULTS, ...saved };
    merged.logoScale = clampScale(merged.logoScale);
    merged.nameScale = clampScale(merged.nameScale);
    merged.brandW = clampScale(merged.brandW);
    merged.brandH = clampScale(merged.brandH);
    merged.pillScale = clampScale(merged.pillScale);
    merged.logoBgTol = clampTolerance(merged.logoBgTol);
    merged.brandBgTol = clampTolerance(merged.brandBgTol);
    return merged;
  } catch {
    return DEFAULTS;
  }
}

const THEMES: Record<ThemeKey, { label: string; bg: string; accent: string; ink: string; muted: string }> = {
  mint: { label: "Mint", bg: "#e9f7f0", accent: "#2f9e75", ink: "#22312b", muted: "#6b7f76" },
  lavender: { label: "Lavender", bg: "#f1ecfb", accent: "#7c63c8", ink: "#2b2540", muted: "#756d8a" },
  peach: { label: "Peach", bg: "#fff0e6", accent: "#d97745", ink: "#3a2a22", muted: "#8a7264" },
  sky: { label: "Sky", bg: "#e8f3fd", accent: "#3f82c0", ink: "#1f2e3d", muted: "#657b8f" },
  rose: { label: "Rose", bg: "#fdeef3", accent: "#c2456b", ink: "#3a1f2a", muted: "#8a6573" },
  sand: { label: "Sand", bg: "#f8f1e3", accent: "#a3742e", ink: "#332a1e", muted: "#8a7a64" },
  slate: { label: "Slate", bg: "#eef1f6", accent: "#475569", ink: "#1f2937", muted: "#6b7280" },
  lemon: { label: "Lemon", bg: "#fbf7dc", accent: "#9a7b00", ink: "#33300f", muted: "#857f4e" },
};

const TEMPLATES: { key: Template; label: string }[] = [
  { key: "classic", label: "Classic" },
  { key: "bold", label: "Bold" },
  { key: "minimal", label: "Minimal" },
  { key: "split", label: "Split" },
  { key: "center", label: "Center" },
  { key: "ticket", label: "Ticket" },
  { key: "editorial", label: "Editorial" },
  { key: "ribbon", label: "Ribbon" },
];

const SIZE_SPECS: Record<Size, { label: string; W: number; H: number; u: number; cols?: number }> = {
  portrait: { label: "Portrait", W: 1080, H: 1350, u: 1 },
  square: { label: "Square", W: 1080, H: 1080, u: 0.74 },
  story: { label: "Story", W: 1080, H: 1920, u: 1.32 },
  pinterest: { label: "Pinterest", W: 1000, H: 1500, u: 0.93 },
  wide: { label: "Wide", W: 1200, H: 630, u: 0.68, cols: 4 },
  a4: { label: "A4 print", W: 2480, H: 3508, u: 2.3 },
};

const PATTERNS: { key: Pattern; label: string }[] = [
  { key: "none", label: "None" },
  { key: "dots", label: "Dots" },
  { key: "grid", label: "Grid" },
  { key: "stripes", label: "Stripes" },
  { key: "cross", label: "Cross" },
  { key: "rings", label: "Rings" },
];

const BRAND_PLACES: { key: BrandPlace; label: string }[] = [
  { key: "bottom-left", label: "Bottom left" },
  { key: "bottom-right", label: "Bottom right" },
  { key: "bottom-center", label: "Bottom centre" },
  { key: "top", label: "Top centre" },
];

// one-click looks; everything below them stays editable afterwards
const LOOKS: { key: string; label: string; prefs: Pick<Prefs, "template" | "theme" | "tinted" | "pattern" | "accent"> }[] = [
  { key: "mint", label: "Mint Classic", prefs: { template: "classic", theme: "mint", tinted: true, pattern: "none", accent: "" } },
  { key: "ocean", label: "Ocean Bold", prefs: { template: "bold", theme: "sky", tinted: false, pattern: "dots", accent: "" } },
  { key: "paper", label: "Paper Minimal", prefs: { template: "minimal", theme: "mint", tinted: false, pattern: "none", accent: "" } },
  { key: "peach", label: "Peach Grid", prefs: { template: "classic", theme: "peach", tinted: true, pattern: "grid", accent: "" } },
  { key: "lavender", label: "Lavender Dots", prefs: { template: "minimal", theme: "lavender", tinted: true, pattern: "dots", accent: "" } },
  { key: "split", label: "Split Peach", prefs: { template: "split", theme: "peach", tinted: true, pattern: "none", accent: "" } },
  { key: "center", label: "Center Sky", prefs: { template: "center", theme: "sky", tinted: true, pattern: "dots", accent: "" } },
  { key: "ticket", label: "Ticket Cream", prefs: { template: "ticket", theme: "lavender", tinted: false, pattern: "none", accent: "" } },
  { key: "roseEdit", label: "Rose Editorial", prefs: { template: "editorial", theme: "rose", tinted: true, pattern: "none", accent: "" } },
  { key: "sandRibbon", label: "Sand Ribbon", prefs: { template: "ribbon", theme: "sand", tinted: true, pattern: "stripes", accent: "" } },
  { key: "monoEdit", label: "Mono Editorial", prefs: { template: "editorial", theme: "slate", tinted: false, pattern: "none", accent: "" } },
  { key: "lemonBold", label: "Lemon Bold", prefs: { template: "bold", theme: "lemon", tinted: false, pattern: "dots", accent: "" } },
  { key: "slateClassic", label: "Slate Classic", prefs: { template: "classic", theme: "slate", tinted: true, pattern: "cross", accent: "" } },
];

type Layout = {
  W: number;
  H: number;
  u: number;
  pad: number;
  logo: number;
  name: number;
  nameLine: number;
  pill: number;
  gmpLabel: number;
  gmp: number;
  pct: number;
  boxH: number;
  gap: number;
  statLabel: number;
  statValue: number;
  dateLabel: number;
  dateValue: number;
  foot: number;
  statCols: number;
};

function layout(size: Size): Layout {
  const spec = SIZE_SPECS[size];
  const u = spec.u;
  const r = (n: number) => Math.round(n * u);
  return {
    W: spec.W,
    H: spec.H,
    u,
    pad: r(64),
    logo: r(225),
    name: r(54),
    nameLine: r(65),
    pill: r(20),
    gmpLabel: r(22),
    gmp: r(104),
    pct: r(44),
    boxH: r(180),
    gap: r(24),
    statLabel: r(22),
    statValue: r(46),
    dateLabel: r(20),
    dateValue: r(28),
    foot: r(21),
    statCols: spec.cols ?? 2,
  };
}

type Style = { ink: string; muted: string; surface: string; line: string; panel: string };

const WHITE_STYLE: Style = {
  ink: "#ffffff",
  muted: "rgba(255,255,255,0.78)",
  surface: "rgba(255,255,255,0.14)",
  line: "rgba(255,255,255,0.28)",
  panel: "#ffffff",
};

const FONT = '"Segoe UI", system-ui, -apple-system, Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';

function font(ctx: CanvasRenderingContext2D, size: number, weight = 400, family = FONT) {
  ctx.font = `${weight} ${size}px ${family}`;
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  weight: number,
  color: string,
  maxWidth?: number,
  align: CanvasTextAlign = "left",
  family = FONT,
) {
  font(ctx, size, weight, family);
  ctx.fillStyle = color;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = align;
  let out = value;
  if (maxWidth && ctx.measureText(out).width > maxWidth) {
    while (out.length > 1 && ctx.measureText(out + "…").width > maxWidth) out = out.slice(0, -1);
    out += "…";
  }
  ctx.fillText(out, x, y);
  ctx.textAlign = "left";
}

function wrap(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, size: number, family = FONT) {
  font(ctx, size, 700, family);
  const lines: string[] = [];
  let line = "";
  for (const word of value.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fitName(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, size: number, family = FONT) {
  let s = size;
  let lines = wrap(ctx, value, maxWidth, s, family);
  while (lines.length > 2 && s > size * 0.6) {
    s -= Math.max(1, Math.round(size * 0.05));
    lines = wrap(ctx, value, maxWidth, s, family);
  }
  return { size: s, lines: lines.slice(0, 2) };
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function rgba(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return `rgba(15,23,42,${alpha})`;
  const n = Number.parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function fitSize(ctx: CanvasRenderingContext2D, value: string, size: number, weight: number, maxWidth: number, family = FONT) {
  let s = size;
  font(ctx, s, weight, family);
  while (s > 12 && ctx.measureText(value).width > maxWidth) {
    s -= 2;
    font(ctx, s, weight, family);
  }
  return s;
}

type Art = HTMLImageElement | HTMLCanvasElement;

// Flood-fills the flat background inward from the image border, so enclosed white details stay.
function cutBackground(img: Art, tolerance: number): Art {
  const side = Math.max(img.width, img.height);
  if (!side) return img;
  const scale = Math.min(1, 900 / side);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return img;
  ctx.drawImage(img, 0, 0, w, h);
  let pixels: ImageData;
  try {
    pixels = ctx.getImageData(0, 0, w, h);
  } catch {
    return img;
  }
  const px = pixels.data;

  // the lightest opaque corner is almost always the background on logo images
  let bg: [number, number, number] | null = null;
  let best = -1;
  for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) {
    const i = (y * w + x) * 4;
    if (px[i + 3] < 200) continue;
    const luma = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
    if (luma > best) {
      best = luma;
      bg = [px[i], px[i + 1], px[i + 2]];
    }
  }
  if (!bg) return img;
  const [br, bgc, bb] = bg;

  const limit = tolerance * 2.55;
  const limit2 = limit * limit;
  const feather = limit2 * 0.55;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const visit = (x: number, y: number) => {
    const i = y * w + x;
    if (seen[i]) return;
    seen[i] = 1;
    const p = i * 4;
    if (px[p + 3] === 0) return;
    const dr = px[p] - br;
    const dg = px[p + 1] - bgc;
    const db = px[p + 2] - bb;
    const d = dr * dr + dg * dg + db * db;
    if (d > limit2) return;
    if (limit2 > 0 && d > feather) {
      px[p + 3] = Math.min(px[p + 3], Math.round(255 * ((d - feather) / (limit2 - feather))));
    } else {
      px[p + 3] = 0;
    }
    stack.push(i);
  };
  for (let x = 0; x < w; x++) {
    visit(x, 0);
    visit(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    visit(0, y);
    visit(w - 1, y);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) visit(x - 1, y);
    if (x < w - 1) visit(x + 1, y);
    if (y > 0) visit(x, y - 1);
    if (y < h - 1) visit(x, y + 1);
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

function drawPattern(ctx: CanvasRenderingContext2D, L: Layout, color: string, pattern: Pattern) {
  if (pattern === "none") return;
  const step = Math.round(L.gap * 2.4);
  ctx.save();
  if (pattern === "dots") {
    ctx.fillStyle = rgba(color, 0.16);
    const r = Math.max(2, L.gap * 0.12);
    for (let y = L.pad; y < L.H - L.pad; y += step) {
      for (let x = L.pad; x < L.W - L.pad; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (pattern === "grid") {
    ctx.strokeStyle = rgba(color, 0.1);
    ctx.lineWidth = Math.max(1, L.u * 2);
    for (let x = L.pad; x <= L.W - L.pad; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, L.pad);
      ctx.lineTo(x, L.H - L.pad);
      ctx.stroke();
    }
    for (let y = L.pad; y <= L.H - L.pad; y += step) {
      ctx.beginPath();
      ctx.moveTo(L.pad, y);
      ctx.lineTo(L.W - L.pad, y);
      ctx.stroke();
    }
  } else if (pattern === "stripes" || pattern === "cross") {
    ctx.strokeStyle = rgba(color, 0.1);
    ctx.lineWidth = Math.max(1, L.u * 3);
    for (let x = -L.H; x <= L.W; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + L.H, L.H);
      ctx.stroke();
      if (pattern === "cross") {
        ctx.beginPath();
        ctx.moveTo(x + L.H, 0);
        ctx.lineTo(x, L.H);
        ctx.stroke();
      }
    }
  } else {
    ctx.strokeStyle = rgba(color, 0.09);
    ctx.lineWidth = Math.max(1, L.u * 3);
    const cx = L.W / 2;
    const cy = L.H / 2;
    for (let r = step; r < Math.max(L.W, L.H); r += step * 1.6) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawRibbons(ctx: CanvasRenderingContext2D, L: Layout, color: string) {
  ctx.save();
  ctx.fillStyle = rgba(color, 0.13);
  ctx.beginPath();
  ctx.moveTo(L.W * 0.72, 0);
  ctx.lineTo(L.W, 0);
  ctx.lineTo(L.W, L.H * 0.26);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, L.H - L.H * 0.2);
  ctx.lineTo(L.W * 0.3, L.H);
  ctx.lineTo(0, L.H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawQr(ctx: CanvasRenderingContext2D, link: string, x: number, y: number, size: number, line: string) {
  if (!link) return;
  try {
    const qr = qrcode(0, "M");
    qr.addData(link);
    qr.make();
    const count = qr.getModuleCount();
    const pad = Math.round(size * 0.09);
    const radius = Math.round(size * 0.08);
    box(ctx, x, y, size, size, radius, "#ffffff");
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, radius);
    ctx.stroke();
    const cell = (size - pad * 2) / count;
    ctx.fillStyle = "#14201a";
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          ctx.fillRect(x + pad + c * cell, y + pad + r * cell, Math.ceil(cell), Math.ceil(cell));
        }
      }
    }
  } catch {
    // invalid custom link: leave the space empty rather than crash the card
  }
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  img: Art | null,
  x: number,
  y: number,
  w: number,
  h: number,
  line: string,
  bare = false,
  stretch = false,
) {
  if (!img) return;
  if (!bare) {
    const radius = Math.round(Math.min(w, h) * 0.18);
    box(ctx, x, y, w, h, radius, "#ffffff");
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.stroke();
  }
  const pad = Math.min(w, h) * (bare ? 0.02 : 0.11);
  const innerW = Math.max(1, w - pad * 2);
  const innerH = Math.max(1, h - pad * 2);
  if (stretch) {
    // unequal width and height are an intentional stretch of the supplied logo
    ctx.drawImage(img, x + pad, y + pad, innerW, innerH);
    return;
  }
  const scale = Math.min(innerW / img.width, innerH / img.height);
  const imgW = img.width * scale;
  const imgH = img.height * scale;
  ctx.drawImage(img, x + (w - imgW) / 2, y + (h - imgH) / 2, imgW, imgH);
}

function drawLogo(
  ctx: CanvasRenderingContext2D,
  img: Art | null,
  name: string,
  x: number,
  y: number,
  size: number,
  surface: string,
  bare = false,
) {
  const floating = bare && !!img;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, size * 0.16);
  ctx.clip();
  if (!floating) {
    ctx.fillStyle = surface;
    ctx.fillRect(x, y, size, size);
  }
  if (img) {
    const pad = size * (floating ? 0 : 0.09);
    const scale = Math.min((size - pad * 2) / img.width, (size - pad * 2) / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h);
  } else {
    font(ctx, size * 0.31, 700);
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials(name), x + size / 2, y + size / 2 + 2);
  }
  ctx.restore();
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  ipo: Ipo,
  logo: Art | null,
  L: Layout,
  style: Style,
  accent: string,
  onAccent: boolean,
  title: string,
  offset: number,
  family = FONT,
  reserveRight = 0,
  bareLogo = false,
) {
  const titleSize = Math.round(L.name * 0.5);
  const titleH = title ? titleSize + Math.round(18 * L.u) : 0;
  const top = L.pad + offset + titleH;
  if (title) {
    text(ctx, title.toUpperCase(), L.pad, L.pad + offset + titleSize, titleSize, 700, onAccent ? "#ffffff" : accent, L.W - L.pad * 2);
  }

  drawLogo(ctx, logo, ipo.name, L.pad, top, L.logo, onAccent ? "#ffffff" : style.panel, bareLogo);

  const nameX = L.pad + L.logo + Math.round(32 * L.u);
  const nameMax = L.W - L.pad - nameX - reserveRight;
  const fit = fitName(ctx, ipo.name, nameMax, L.name, family);
  fit.lines.forEach((line, i) =>
    text(ctx, line, nameX, top + fit.size + i * L.nameLine, fit.size, 700, style.ink, nameMax, "left", family),
  );

  const pillH = Math.round(L.pill * 2.1);
  const nameBottom = top + fit.size + (fit.lines.length - 1) * L.nameLine;
  // keep the pills inside the tile normally, but below the name if a large name outgrows it
  const pillY = Math.max(top + L.logo - pillH, nameBottom + Math.round(12 * L.u));
  const status = ipo.status.toUpperCase();
  font(ctx, L.pill, 600);
  const boardW = ctx.measureText(ipo.board).width + L.pill * 2;
  const statusW = ctx.measureText(status).width + L.pill * 2.4;
  const gap = Math.round(10 * L.u);
  box(ctx, nameX, pillY, boardW, pillH, pillH / 2, onAccent ? "rgba(255,255,255,0.18)" : "rgba(15,23,42,0.06)");
  text(ctx, ipo.board, nameX + L.pill, pillY + pillH * 0.68, L.pill, 600, style.ink);
  box(ctx, nameX + boardW + gap, pillY, statusW, pillH, pillH / 2, onAccent ? "#ffffff" : accent);
  text(ctx, status, nameX + boardW + gap + L.pill * 1.2, pillY + pillH * 0.68, L.pill, 600, onAccent ? accent : "#ffffff");

  return Math.max(top + L.logo, pillY + pillH);
}

function drawCenterHeader(
  ctx: CanvasRenderingContext2D,
  ipo: Ipo,
  logo: Art | null,
  L: Layout,
  style: Style,
  accent: string,
  title: string,
  offset: number,
  family = FONT,
  bareLogo = false,
) {
  const titleSize = Math.round(L.name * 0.5);
  const titleH = title ? titleSize + Math.round(18 * L.u) : 0;
  if (title) {
    text(ctx, title.toUpperCase(), L.W / 2, L.pad + offset + titleSize, titleSize, 700, accent, L.W - L.pad * 2, "center");
  }

  const top = L.pad + offset + titleH;
  drawLogo(ctx, logo, ipo.name, (L.W - L.logo) / 2, top, L.logo, style.panel, bareLogo);

  let y = top + L.logo + Math.round(28 * L.u);
  const fit = fitName(ctx, ipo.name, L.W - L.pad * 2, L.name, family);
  fit.lines.forEach((line) => {
    text(ctx, line, L.W / 2, y + fit.size, fit.size, 700, style.ink, L.W - L.pad * 2, "center", family);
    y += L.nameLine;
  });

  y += Math.round(20 * L.u);
  const pillH = Math.round(L.pill * 2.1);
  const status = ipo.status.toUpperCase();
  font(ctx, L.pill, 600);
  const boardW = ctx.measureText(ipo.board).width + L.pill * 2;
  const statusW = ctx.measureText(status).width + L.pill * 2.4;
  const gap = Math.round(10 * L.u);
  const startX = (L.W - (boardW + statusW + gap)) / 2;

  box(ctx, startX, y, boardW, pillH, pillH / 2, "rgba(15,23,42,0.06)");
  text(ctx, ipo.board, startX + L.pill, y + pillH * 0.68, L.pill, 600, style.ink);
  box(ctx, startX + boardW + gap, y, statusW, pillH, pillH / 2, accent);
  text(ctx, status, startX + boardW + gap + L.pill * 1.2, y + pillH * 0.68, L.pill, 600, "#ffffff");

  return y + pillH;
}

function centerHeaderHeight(ctx: CanvasRenderingContext2D, ipo: Ipo, L: Layout, title: string, offset: number, family = FONT) {
  const titleSize = Math.round(L.name * 0.5);
  const titleH = title ? titleSize + Math.round(18 * L.u) : 0;
  const lines = fitName(ctx, ipo.name, L.W - L.pad * 2, L.name, family).lines.length;
  return L.pad + offset + titleH + L.logo + Math.round(28 * L.u) + lines * L.nameLine + Math.round(20 * L.u) + Math.round(L.pill * 2.1);
}

function statsItems(ipo: Ipo, prefs: Prefs): [string, string][] {
  const items: [string, string][] = [
    ["PRICE BAND", ipo.priceBand],
    ["LOT SIZE", `${ipo.lot ?? "-"} shares`],
    ["MIN INVESTMENT", ipo.minInvestment],
  ];
  if (prefs.showIssue) items.push(["ISSUE SIZE", ipo.issueSize]);
  return items;
}

function gmpHeight(L: Layout, centered: boolean, hasPct: boolean) {
  const base = L.gmpLabel + Math.round(24 * L.u) + L.gmp;
  return centered && hasPct ? base + L.pct + Math.round(10 * L.u) : base;
}

function statsHeight(L: Layout, count: number, mode: "boxes" | "rows" | "cols") {
  if (mode === "rows") return count * (L.statValue + Math.round(44 * L.u));
  if (mode === "cols") {
    const cols = Math.min(L.statCols, count);
    const rows = Math.ceil(count / cols);
    const rowH = L.statLabel + Math.round(18 * L.u) + L.statValue + Math.round(16 * L.u);
    return rows * rowH + (rows - 1) * L.gap;
  }
  const r = Math.ceil(count / 2);
  return r * L.boxH + (r - 1) * L.gap;
}

function datesHeight(L: Layout) {
  return L.dateLabel + Math.round(12 * L.u) + L.dateValue;
}

function drawGmp(
  ctx: CanvasRenderingContext2D,
  ipo: Ipo,
  L: Layout,
  style: Style,
  accent: string,
  y: number,
  onAccent: boolean,
  family = FONT,
) {
  const gap = Math.round(24 * L.u);
  text(ctx, "GMP (RUMOURED)", L.pad, y + L.gmpLabel, L.gmpLabel, 700, style.muted);
  const value = ipo.gmp == null ? "-" : `${ipo.gmp > 0 ? "+" : ipo.gmp < 0 ? "−" : ""}₹${Math.abs(ipo.gmp)}`;
  const color = ipo.gmp == null ? style.muted : ipo.gmp < 0 ? (onAccent ? "#ffe1dc" : "#b4544b") : onAccent ? "#ffffff" : accent;
  const baseline = y + L.gmpLabel + gap + L.gmp;
  text(ctx, value, L.pad, baseline, L.gmp, 700, color, L.W - L.pad * 2, "left", family);
  if (ipo.gmpPercent) {
    font(ctx, L.gmp, 700, family);
    const w = ctx.measureText(value).width;
    text(ctx, `(${ipo.gmpPercent})`, L.pad + w + gap, baseline - L.pct * 0.45, L.pct, 600, color);
  }
}

function drawGmpCentered(
  ctx: CanvasRenderingContext2D,
  ipo: Ipo,
  L: Layout,
  style: Style,
  accent: string,
  y: number,
  family = FONT,
  onAccent = false,
) {
  const gap = Math.round(24 * L.u);
  text(ctx, "GMP (RUMOURED)", L.W / 2, y + L.gmpLabel, L.gmpLabel, 700, style.muted, L.W - L.pad * 2, "center");
  const value = ipo.gmp == null ? "-" : `${ipo.gmp > 0 ? "+" : ipo.gmp < 0 ? "−" : ""}₹${Math.abs(ipo.gmp)}`;
  const color = ipo.gmp == null ? style.muted : ipo.gmp < 0 ? (onAccent ? "#ffe1dc" : "#b4544b") : accent;
  const baseline = y + L.gmpLabel + gap + L.gmp;
  text(ctx, value, L.W / 2, baseline, L.gmp, 700, color, L.W - L.pad * 2, "center", family);
  if (ipo.gmpPercent) {
    text(ctx, ipo.gmpPercent, L.W / 2, baseline + L.pct + Math.round(10 * L.u), L.pct, 600, color, L.W - L.pad * 2, "center");
  }
}

function drawStatBoxes(
  ctx: CanvasRenderingContext2D,
  items: [string, string][],
  L: Layout,
  style: Style,
  y: number,
  x: number,
  width: number,
  centered: boolean,
  dashed: boolean,
  family = FONT,
) {
  const boxW = (width - L.gap) / 2;
  const radius = Math.round(18 * L.u);
  const inset = Math.round(24 * L.u);
  items.forEach(([label, value], i) => {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const oddLast = items.length % 2 === 1 && i === items.length - 1;
    const w = oddLast ? width : boxW;
    const bx = x + col * (boxW + L.gap);
    const by = y + row * (L.boxH + L.gap);
    if (dashed) {
      ctx.save();
      ctx.setLineDash([Math.round(8 * L.u), Math.round(7 * L.u)]);
      ctx.lineWidth = Math.max(1.5, 2 * L.u);
      ctx.strokeStyle = style.line;
      ctx.beginPath();
      ctx.roundRect(bx, by, w, L.boxH, radius);
      ctx.stroke();
      ctx.restore();
    } else {
      box(ctx, bx, by, w, L.boxH, radius, style.surface);
    }
    const align = centered ? "center" : "left";
    const tx = centered ? bx + w / 2 : bx + inset;
    text(ctx, label, tx, by + L.boxH * 0.3, L.statLabel, 700, style.muted, w - inset * 2, align);
    const size = fitSize(ctx, value, L.statValue, 700, w - inset * 2, family);
    text(ctx, value, tx, by + L.boxH * 0.72, size, 700, style.ink, w - inset * 2, align, family);
  });
}

function drawStatRows(
  ctx: CanvasRenderingContext2D,
  items: [string, string][],
  L: Layout,
  style: Style,
  y: number,
  x: number,
  width: number,
  family = FONT,
) {
  const rowH = L.statValue + Math.round(44 * L.u);
  items.forEach(([label, value], i) => {
    const ry = y + i * rowH;
    text(ctx, label, x, ry + rowH * 0.62, L.statLabel, 700, style.muted);
    text(ctx, value, x + width, ry + rowH * 0.62, L.statValue, 700, style.ink, width * 0.6, "right", family);
    if (i > 0) {
      ctx.strokeStyle = style.line;
      ctx.lineWidth = Math.max(1, 2 * L.u);
      ctx.beginPath();
      ctx.moveTo(x, ry);
      ctx.lineTo(x + width, ry);
      ctx.stroke();
    }
  });
  ctx.strokeStyle = style.line;
  ctx.lineWidth = Math.max(1, 2 * L.u);
  ctx.beginPath();
  ctx.moveTo(x, y + items.length * rowH);
  ctx.lineTo(x + width, y + items.length * rowH);
  ctx.stroke();
}

function drawStatColumns(
  ctx: CanvasRenderingContext2D,
  items: [string, string][],
  L: Layout,
  style: Style,
  y: number,
  x: number,
  width: number,
  family = FONT,
  dashed = false,
) {
  const cols = Math.min(L.statCols, items.length);
  const colW = (width - (cols - 1) * L.gap) / cols;
  const rowH = L.statLabel + Math.round(18 * L.u) + L.statValue + Math.round(16 * L.u);
  items.forEach(([label, value], i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const cx = x + col * (colW + L.gap);
    const cy = y + row * (rowH + L.gap);
    ctx.save();
    if (dashed) ctx.setLineDash([Math.round(8 * L.u), Math.round(7 * L.u)]);
    ctx.strokeStyle = style.line;
    ctx.lineWidth = Math.max(1, 2 * L.u);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + colW, cy);
    ctx.stroke();
    ctx.restore();
    text(ctx, label, cx, cy + Math.round(14 * L.u) + L.statLabel, L.statLabel, 700, style.muted, colW);
    const size = fitSize(ctx, value, L.statValue, 700, colW, family);
    text(ctx, value, cx, cy + Math.round(14 * L.u) + L.statLabel + Math.round(14 * L.u) + L.statValue, size, 700, style.ink, colW, "left", family);
  });
}

function drawDates(
  ctx: CanvasRenderingContext2D,
  ipo: Ipo,
  L: Layout,
  style: Style,
  y: number,
  x: number,
  width: number,
  centered: boolean,
  family = FONT,
) {
  const dates: [string, string][] = [
    ["OPENS", ipo.open],
    ["CLOSES", ipo.close],
    ["ALLOTMENT", ipo.allotment],
    ["LISTING", ipo.listing],
  ];
  const colW = (width - L.gap * 3) / 4;
  const gap = Math.round(12 * L.u);
  dates.forEach(([label, value], i) => {
    const cx = x + i * (colW + L.gap);
    const tx = centered ? cx + colW / 2 : cx;
    const align = centered ? "center" : "left";
    text(ctx, label, tx, y + L.dateLabel, L.dateLabel, 700, style.muted, colW, align);
    text(ctx, value, tx, y + L.dateLabel + gap + L.dateValue, L.dateValue, 600, style.ink, colW, align, family);
  });
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  L: Layout,
  style: Style,
  handle: string,
  cta: string,
  top: number,
  dashed: boolean,
  brand?: Art | null,
  brandW?: number,
  brandH?: number,
  footerHeight?: number,
  bareBrand = false,
) {
  ctx.save();
  if (dashed) ctx.setLineDash([Math.round(8 * L.u), Math.round(7 * L.u)]);
  ctx.strokeStyle = style.line;
  ctx.lineWidth = Math.max(1, 2 * L.u);
  ctx.beginPath();
  ctx.moveTo(L.pad, top);
  ctx.lineTo(L.W - L.pad, top);
  ctx.stroke();
  ctx.restore();

  const footerH = footerHeight ?? L.foot + Math.round(24 * L.u);
  let inset = 0;
  if (brand) {
    const h = brandH ?? Math.min(Math.round(L.foot * 2.4), footerH - Math.round(8 * L.u));
    const w = brandW ?? h;
    drawBadge(ctx, brand, L.pad, top + (footerH - h) / 2, w, h, style.line, bareBrand, brandW != null && brandH != null && brandW !== brandH);
    inset = w + Math.round(12 * L.u);
  }

  const baseline = footerHeight
    ? top + footerHeight / 2 + L.foot * 0.35
    : top + Math.round(24 * L.u) + L.foot;
  const left = [handle, cta].filter(Boolean).join(" · ");
  if (left) {
    text(ctx, left, L.pad + inset, baseline, L.foot, 600, style.muted, (L.W - L.pad * 2 - inset) * 0.55);
  }
  text(
    ctx,
    "GMP is unofficial · Not investment advice",
    L.W - L.pad,
    baseline,
    L.foot,
    500,
    style.muted,
    L.W * 0.55,
    "right",
  );
}

type DrawCtx = {
  ipo: Ipo;
  prefs: Prefs;
  theme: (typeof THEMES)[ThemeKey];
  brand: string;
  style: Style;
  dark: boolean;
  split: boolean;
  centered: boolean;
  ticket: boolean;
  editorial: boolean;
  family: string;
  panel: string;
  bg: string;
};

function palette(prefs: Prefs): DrawCtx {
  const theme = THEMES[prefs.theme];
  const template = prefs.template;
  const dark = template === "bold";
  const split = template === "split";
  const ticket = template === "ticket";
  const editorial = template === "editorial";
  const brand = prefs.accent || theme.accent;
  const bg = dark ? brand : ticket ? (prefs.tinted ? theme.bg : "#fffdf8") : prefs.tinted ? theme.bg : "#ffffff";
  const panel = dark ? "#ffffff" : ticket ? "#ffffff" : prefs.tinted ? "rgba(255,255,255,0.8)" : "#f7f7f5";
  const style: Style = dark
    ? WHITE_STYLE
    : {
        ink: theme.ink,
        muted: theme.muted,
        surface: panel,
        line: ticket ? "rgba(15,23,42,0.2)" : "rgba(15,23,42,0.08)",
        panel,
      };
  return {
    ipo: { sourceUrl: "" } as Ipo,
    prefs,
    theme,
    brand,
    style,
    dark,
    split,
    centered: template === "center",
    ticket,
    editorial,
    family: editorial ? SERIF : FONT,
    panel,
    bg,
  };
}

function drawWide(
  ctx: CanvasRenderingContext2D,
  ipo: Ipo,
  logo: Art | null,
  brandImg: Art | null,
  prefs: Prefs,
) {
  const L = layout(prefs.size);
  const p = palette(prefs);
  const { W, H, pad } = L;
  const s = H / 630;
  const brandW = Math.round(58 * s * (prefs.brandW / 100));
  const brandH = Math.round(58 * s * (prefs.brandH / 100));
  const footerH = Math.max(Math.round(76 * s), brandH + Math.round(14 * s));
  const realFooterTop = H - pad - footerH;
  const onAccent = p.dark || p.split;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, W, H);
  drawPattern(ctx, L, onAccent ? "#ffffff" : p.brand, prefs.pattern);
  if (prefs.template === "ribbon") drawRibbons(ctx, L, onAccent ? "#ffffff" : p.brand);

  const panelW = Math.round(W * 0.44);
  const headerStyle = p.split ? WHITE_STYLE : p.style;
  if (p.split) {
    ctx.fillStyle = p.brand;
    ctx.fillRect(0, 0, panelW, realFooterTop);
  } else if (!p.dark) {
    ctx.fillStyle = p.brand;
    ctx.fillRect(0, 0, W, Math.max(6, Math.round(8 * s)));
  }

  const titleSize = Math.round(18 * s);
  const logoSize = Math.round(136 * s * (prefs.logoScale / 100));
  const nameSize = Math.round(39 * s * (prefs.nameScale / 100));
  const nameLine = Math.round(47 * s * (prefs.nameScale / 100));
  const pillSize = Math.round(15 * s * (prefs.pillScale / 100));
  const gmpSize = Math.round(70 * s);
  const labelSize = Math.round(14 * s);

  let y = pad + (prefs.title ? titleSize + Math.round(12 * s) : 0);
  if (prefs.title) {
    text(ctx, prefs.title.toUpperCase(), pad, pad + titleSize, titleSize, 700, onAccent ? "#ffffff" : p.brand, Math.round(W * 0.4));
  }
  drawLogo(ctx, logo, ipo.name, pad, y, logoSize, onAccent ? "#ffffff" : p.panel, prefs.removeLogoBg);
  const nameX = pad + logoSize + Math.round(18 * s);
  const nameW = p.split
    ? panelW - nameX - Math.round(16 * s)
    : Math.round(W * 0.44) - logoSize - Math.round(34 * s);
  const fit = fitName(ctx, ipo.name, nameW, nameSize, p.family);
  fit.lines.forEach((line, i) => {
    text(ctx, line, nameX, y + fit.size + i * nameLine, fit.size, 700, headerStyle.ink, nameW, "left", p.family);
  });

  const pillH = Math.round(pillSize * 2.1);
  const nameBottom = y + fit.size + (fit.lines.length - 1) * nameLine;
  const pillY = Math.max(y + logoSize - pillH, nameBottom + Math.round(10 * s));
  font(ctx, pillSize, 600);
  const boardW = ctx.measureText(ipo.board).width + pillSize * 2;
  box(ctx, nameX, pillY, boardW, pillH, pillH / 2, onAccent ? "rgba(255,255,255,0.18)" : "rgba(15,23,42,0.06)");
  text(ctx, ipo.board, nameX + pillSize, pillY + pillH * 0.68, pillSize, 600, headerStyle.ink);

  const status = ipo.status.toUpperCase();
  font(ctx, pillSize, 600);
  const statusW = ctx.measureText(status).width + pillSize * 2.4;
  const statusX = W - pad - statusW;
  box(ctx, statusX, pad, statusW, pillH, pillH / 2, onAccent ? "#ffffff" : p.brand);
  text(ctx, status, statusX + pillSize * 1.2, pad + pillH * 0.68, pillSize, 600, onAccent ? p.brand : "#ffffff");

  let gmpY = Math.max(y + logoSize, pillY + pillH) + Math.round(26 * s);
  if (prefs.showGmp) {
    text(ctx, "GMP (RUMOURED)", pad, gmpY + labelSize, labelSize, 700, headerStyle.muted);
    const value = ipo.gmp == null ? "-" : `${ipo.gmp > 0 ? "+" : ipo.gmp < 0 ? "−" : ""}₹${Math.abs(ipo.gmp)}`;
    const color = ipo.gmp == null ? p.style.muted : ipo.gmp < 0 ? (onAccent ? "#ffe1dc" : "#b4544b") : onAccent ? "#ffffff" : p.brand;
    const baseline = gmpY + labelSize + Math.round(18 * s) + gmpSize;
    text(ctx, value, pad, baseline, gmpSize, 700, color, Math.round(W * 0.36), "left", p.family);
    if (ipo.gmpPercent) {
      font(ctx, gmpSize, 700, p.family);
      const w = ctx.measureText(value).width;
      text(ctx, `(${ipo.gmpPercent})`, pad + w + Math.round(16 * s), baseline - gmpSize * 0.18, Math.round(gmpSize * 0.42), 600, color);
    }
    gmpY = baseline;
  }

  const qrSize = Math.round(H * 0.15);
  if (prefs.qr) {
    drawQr(ctx, prefs.qrLink.trim() || ipo.sourceUrl, W - pad - qrSize, pad + pillH + Math.round(12 * s), qrSize, p.style.line);
  }

  const rightX = Math.round(W * 0.47);
  const rightW = W - pad - rightX;
  const items = prefs.showStats ? statsItems(ipo, prefs) : [];
  const statBoxH = Math.round(H * 0.14);
  const statL = { ...L, boxH: statBoxH };
  const boxesH = items.length ? Math.ceil(items.length / 2) * statBoxH + (Math.ceil(items.length / 2) - 1) * L.gap : 0;
  const rightTop = Math.round(H * 0.34);
  if (prefs.showStats) {
    drawStatBoxes(ctx, items, statL, p.style, rightTop, rightX, rightW, false, p.ticket, p.family);
  }
  if (prefs.showDates) {
    drawDates(ctx, ipo, L, p.style, rightTop + boxesH + Math.round(22 * s), rightX, rightW, false, p.family);
  }

  // banner has no free corner for a badge: keep the business logo in the footer
  drawFooter(ctx, L, p.style, prefs.handle, prefs.cta, realFooterTop, p.ticket, brandImg, brandW, brandH, footerH, prefs.removeBrandBg);
}

function draw(ctx: CanvasRenderingContext2D, ipo: Ipo, logo: Art | null, brandImg: Art | null, prefs: Prefs) {
  if (SIZE_SPECS[prefs.size].W > SIZE_SPECS[prefs.size].H) {
    drawWide(ctx, ipo, logo, brandImg, prefs);
    return;
  }

  const L = layout(prefs.size);
  const p = palette(prefs);
  const { W, H } = L;
  const landscape = false;
  // scaled metrics for the header only; the rest of the card keeps the layout grid
  const V: Layout = {
    ...L,
    logo: Math.round(L.logo * (prefs.logoScale / 100)),
    name: Math.round(L.name * (prefs.nameScale / 100)),
    nameLine: Math.round(L.nameLine * (prefs.nameScale / 100)),
    pill: Math.round(L.pill * (prefs.pillScale / 100)),
  };
  const titleSize = Math.round(V.name * 0.5);
  const titleH = prefs.title ? titleSize + Math.round(18 * L.u) : 0;

  let place: BrandPlace | "none" | "footer" = brandImg ? prefs.brandPlace : "none";
  const brandBase = Math.round(L.logo * 0.45);
  const badgeW = Math.round(brandBase * (prefs.brandW / 100));
  const badgeH = Math.round(brandBase * (prefs.brandH / 100));
  const badgeBand = badgeH + Math.round(16 * L.u);
  if (place === "top" && landscape) place = "bottom-left";
  let topOffset = place === "top" ? badgeBand : 0;

  const pillH = Math.round(V.pill * 2.1);
  const sideHeaderHeight = (reserve: number) => {
    const top = L.pad + topOffset + titleH;
    const nameX = L.pad + V.logo + Math.round(32 * L.u);
    const nameMax = W - L.pad - nameX - reserve;
    const fit = fitName(ctx, ipo.name, nameMax, V.name, p.family);
    const nameBottom = top + fit.size + (fit.lines.length - 1) * V.nameLine;
    const pillY = Math.max(top + V.logo - pillH, nameBottom + Math.round(12 * L.u));
    return Math.max(top + V.logo, pillY + pillH);
  };
  const headerBaseFor = (reserve = 0) =>
    p.centered ? centerHeaderHeight(ctx, ipo, V, prefs.title, topOffset, p.family) : sideHeaderHeight(reserve);
  const bandHFor = (headerBase: number) =>
    p.split ? headerBase + L.gap * 1.2 + gmpHeight(L, false, false) + L.gap * 1.2 : 0;

  const items = prefs.showStats ? statsItems(ipo, prefs) : [];
  const statMode: "boxes" | "rows" | "cols" =
    (prefs.template === "minimal" || p.editorial) && !landscape ? "rows" : L.statCols > 2 ? "cols" : "boxes";
  const noteH = prefs.note ? L.dateValue + Math.round(8 * L.u) : 0;

  const blocks: number[] = [];
  if (prefs.showGmp && !p.split) blocks.push(gmpHeight(L, p.centered, !!ipo.gmpPercent));
  if (prefs.showStats) blocks.push(statsHeight(L, items.length, statMode));
  if (prefs.showDates) blocks.push(datesHeight(L) + noteH);
  else if (prefs.note) blocks.push(noteH);
  const bodyH = blocks.reduce((a, b) => a + b, 0);
  const needed = bodyH + (blocks.length > 1 ? (blocks.length - 1) * L.gap * 1.2 : 0);

  const qrSize = Math.round(L.foot * 6.2);
  const footerH = L.foot + Math.round(24 * L.u);
  const realFooterTop = H - L.pad - footerH;
  let topQr = false;
  if (prefs.qr && place === "bottom-right") topQr = true;

  const qrReserve = () => (topQr ? qrSize + Math.round(16 * L.u) : 0);
  let headerBase = headerBaseFor(qrReserve());
  let bandH = bandHFor(headerBase);
  let headerBottom = (p.split ? bandH : headerBase) + L.gap * 1.6;
  let bottomBand = 0;

  for (let pass = 0; pass < 4; pass++) {
    const qrBand = prefs.qr && !topQr ? qrSize + Math.round(24 * L.u) : 0;
    const badgeBandNow = place === "bottom-left" || place === "bottom-right" || place === "bottom-center" ? badgeBand : 0;
    bottomBand = Math.max(qrBand, badgeBandNow);
    const available = realFooterTop - bottomBand - L.gap * 2 - headerBottom;
    if (needed <= available) break;
    if (prefs.qr && !topQr) {
      topQr = true;
      headerBase = headerBaseFor(qrReserve());
      bandH = bandHFor(headerBase);
      headerBottom = (p.split ? bandH : headerBase) + L.gap * 1.6;
      continue;
    }
    if (place === "top") {
      place = "bottom-left";
      topOffset = 0;
      headerBase = headerBaseFor(qrReserve());
      bandH = bandHFor(headerBase);
      headerBottom = (p.split ? bandH : headerBase) + L.gap * 1.6;
      continue;
    }
    if (place === "bottom-left" || place === "bottom-right" || place === "bottom-center") {
      // tight card: a badge above the footer would collide with the dates
      place = "footer";
      continue;
    }
    break;
  }

  const footerTop = realFooterTop - bottomBand;
  const baseGap = L.gap * 1.2;
  const spare = Math.max(0, footerTop - headerBottom - bodyH - (blocks.length - 1) * baseGap - L.gap * 2);
  // cap gap growth so tall Story cards never open up giant holes
  const gapCap = L.gap * 0.8;
  const extra = blocks.length > 1 ? Math.min(spare * 0.55 / (blocks.length - 1), gapCap) : 0;
  const bodyTop = headerBottom + Math.min(spare * 0.3, L.gap * 4);
  const spacing = baseGap + extra;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, W, H);
  drawPattern(ctx, L, p.dark || p.split ? "#ffffff" : p.brand, prefs.pattern);
  if (prefs.template === "ribbon") drawRibbons(ctx, L, p.dark || p.split ? "#ffffff" : p.brand);

  if (p.split) {
    ctx.fillStyle = p.brand;
    ctx.fillRect(0, 0, W, bandH);
  } else if (!p.dark) {
    ctx.fillStyle = p.brand;
    ctx.fillRect(0, 0, W, Math.max(4, Math.round(10 * L.u)));
  }

  if (place === "top" && brandImg) {
    drawBadge(ctx, brandImg, (W - badgeW) / 2, L.pad, badgeW, badgeH, p.style.line, prefs.removeBrandBg, prefs.brandW !== prefs.brandH);
  }

  if (p.centered) {
    drawCenterHeader(ctx, ipo, logo, V, p.style, p.brand, prefs.title, topOffset, p.family, prefs.removeLogoBg);
  } else {
    drawHeader(
      ctx,
      ipo,
      logo,
      V,
      p.split ? WHITE_STYLE : p.style,
      p.brand,
      p.dark || p.split,
      prefs.title,
      topOffset,
      p.family,
      qrReserve(),
      prefs.removeLogoBg,
    );
  }

  if (p.split) {
    drawGmp(ctx, ipo, L, WHITE_STYLE, "#ffffff", headerBase + L.gap * 1.2, true, p.family);
  }

  let y = bodyTop;
  if (prefs.showGmp && !p.split) {
    const gmpAccent = p.dark ? "#ffffff" : p.brand;
    if (p.centered) drawGmpCentered(ctx, ipo, L, p.style, gmpAccent, y, p.family, p.dark);
    else drawGmp(ctx, ipo, L, p.style, gmpAccent, y, p.dark, p.family);
    y += gmpHeight(L, p.centered, !!ipo.gmpPercent) + spacing;
  }
  if (prefs.showStats) {
    if (statMode === "rows") drawStatRows(ctx, items, L, p.style, y, L.pad, W - L.pad * 2, p.family);
    else if (statMode === "cols") drawStatColumns(ctx, items, L, p.style, y, L.pad, W - L.pad * 2, p.family);
    else drawStatBoxes(ctx, items, L, p.style, y, L.pad, W - L.pad * 2, p.centered, p.ticket, p.family);
    y += statsHeight(L, items.length, statMode) + spacing;
  }
  if (prefs.showDates) {
    drawDates(ctx, ipo, L, p.style, y, L.pad, W - L.pad * 2, p.centered, p.family);
    y += datesHeight(L);
  }
  if (prefs.note) {
    text(
      ctx,
      prefs.note,
      p.centered ? W / 2 : L.pad,
      y + Math.round(8 * L.u) + L.dateValue,
      L.dateValue,
      600,
      p.dark ? "#ffffff" : p.brand,
      W - L.pad * 2,
      p.centered ? "center" : "left",
    );
  }

  if (prefs.qr) {
    const qx = W - L.pad - qrSize;
    const qy = topQr
      ? L.pad + topOffset + titleH + pillH + Math.round(16 * L.u)
      : footerTop + Math.round(8 * L.u);
    drawQr(ctx, prefs.qrLink.trim() || ipo.sourceUrl, qx, qy, qrSize, p.style.line);
  }

  if (brandImg && (place === "bottom-left" || place === "bottom-center" || place === "bottom-right")) {
    const bx = place === "bottom-left" ? L.pad : place === "bottom-center" ? (W - badgeW) / 2 : W - L.pad - badgeW;
    drawBadge(ctx, brandImg, bx, realFooterTop - Math.round(16 * L.u) - badgeH, badgeW, badgeH, p.style.line, prefs.removeBrandBg, prefs.brandW !== prefs.brandH);
  }

  drawFooter(
    ctx,
    L,
    p.style,
    prefs.handle,
    prefs.cta,
    realFooterTop,
    p.ticket,
    place === "footer" ? brandImg : null,
    undefined,
    undefined,
    place === "footer" ? footerH : undefined,
    prefs.removeBrandBg,
  );
}

function loadImage(src: string | null): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function ShareCard({ ipo }: { ipo: Ipo }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [flash, setFlash] = useState("");
  const L = layout(prefs.size);
  const landscape = L.W > L.H;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // private mode / storage full: preferences just won't persist
    }
  }, [prefs]);

  useEffect(() => {
    let cancelled = false;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    draw(ctx, ipo, null, null, prefs);

    Promise.all([loadImage(customLogo ?? ipo.logo), loadImage(brandLogo)]).then(([logo, brand]) => {
      if (cancelled) return;
      const cutLogo = logo && prefs.removeLogoBg ? cutBackground(logo, prefs.logoBgTol) : logo;
      const cutBrand = brand && prefs.removeBrandBg ? cutBackground(brand, prefs.brandBgTol) : brand;
      if (!cancelled) draw(ctx, ipo, cutLogo, cutBrand, prefs);
    });

    return () => {
      cancelled = true;
    };
  }, [ipo, prefs, customLogo, brandLogo]);

  function update(patch: Partial<Prefs>) {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }

  function nudge(key: "logoScale" | "nameScale", delta: number) {
    setPrefs((prev) => ({
      ...prev,
      [key]: Math.min(SCALE_RANGE.max, Math.max(SCALE_RANGE.min, prev[key] + delta)),
    }));
  }

  function upload(file: File | undefined, apply: (src: string) => void) {
    if (!file || !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => apply(String(reader.result));
    reader.readAsDataURL(file);
  }

  function download(type: "image/png" | "image/jpeg") {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${ipo.slug}-${prefs.template}-${prefs.size}.${type === "image/png" ? "png" : "jpg"}`;
        a.click();
        URL.revokeObjectURL(url);
      },
      type,
      0.92,
    );
  }

  async function copyImage() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw new Error("unsupported");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setFlash("Image copied. Paste it anywhere.");
    } catch {
      download("image/png");
      setFlash("Clipboard blocked. PNG downloaded instead.");
    }
    setTimeout(() => setFlash(""), 3000);
  }

  return (
    <div className="card-preview">
      <div className="preview-pane">
        <canvas ref={canvasRef} width={L.W} height={L.H} role="img" aria-label={`Share card for ${ipo.name}`} />

        <div className="actions">
          <button className="btn" onClick={() => download("image/png")}>
            Download PNG
          </button>
          <button className="btn ghost" onClick={() => download("image/jpeg")}>
            Download JPG
          </button>
          <button className="btn ghost" onClick={copyImage}>
            Copy image
          </button>
          {flash && <p className="editor-flash" role="status">{flash}</p>}
        </div>
      </div>

      <div className="editor">
        <div className="editor-block wide">
          <span className="editor-label">Looks</span>
          <div className="looks">
            {LOOKS.map((look) => {
              const active =
                prefs.template === look.prefs.template &&
                prefs.theme === look.prefs.theme &&
                prefs.tinted === look.prefs.tinted &&
                prefs.pattern === look.prefs.pattern &&
                prefs.accent === look.prefs.accent;
              return (
                <button
                  key={look.key}
                  className={active ? "look-btn on" : "look-btn"}
                  aria-pressed={active}
                  onClick={() => update(look.prefs)}
                >
                  {look.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="editor-block">
          <span className="editor-label">Template</span>
          <div className="segmented">
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                className={prefs.template === t.key ? "on" : ""}
                onClick={() => update({ template: t.key })}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="editor-block">
          <span className="editor-label">Size</span>
          <div className="segmented">
            {(Object.keys(SIZE_SPECS) as Size[]).map((s) => (
              <button key={s} className={prefs.size === s ? "on" : ""} onClick={() => update({ size: s })}>
                {SIZE_SPECS[s].label}
              </button>
            ))}
          </div>
        </div>

        <div className="editor-block wide">
          <span className="editor-label">Colour</span>
          <div className="editor-row">
            <div className="swatches">
              {(Object.keys(THEMES) as ThemeKey[]).map((key) => (
                <button
                  key={key}
                  className={prefs.theme === key ? "swatch on" : "swatch"}
                  style={{ background: THEMES[key].bg, borderColor: THEMES[key].accent }}
                  onClick={() => update({ theme: key })}
                  aria-label={THEMES[key].label}
                  aria-pressed={prefs.theme === key}
                  title={THEMES[key].label}
                >
                  <span style={{ background: THEMES[key].accent }} />
                </button>
              ))}
            </div>
            <label className="color-well" title="Custom accent colour">
              <input
                type="color"
                aria-label="Custom accent colour"
                value={prefs.accent || THEMES[prefs.theme].accent}
                onChange={(e) => update({ accent: e.target.value })}
              />
              <span>Custom</span>
            </label>
            {prefs.accent && (
              <button className="link-btn" onClick={() => update({ accent: "" })}>
                Auto
              </button>
            )}
            <label className="toggle">
              <input type="checkbox" checked={prefs.tinted} onChange={(e) => update({ tinted: e.target.checked })} />
              Pastel background
            </label>
          </div>
        </div>

        <div className="editor-block wide">
          <span className="editor-label">Sizes</span>
          <div className="size-grid">
            {SCALES.map(({ key, label }) => (
              <div className="size-row" key={key}>
                <span>{label}</span>
                <div className="stepper">
                  <button
                    type="button"
                    aria-label={`Decrease ${label} size`}
                    disabled={prefs[key] <= SCALE_RANGE.min}
                    onClick={() => nudge(key, -SCALE_RANGE.step)}
                  >
                    −
                  </button>
                  <span>{prefs[key]}%</span>
                  <button
                    type="button"
                    aria-label={`Increase ${label} size`}
                    disabled={prefs[key] >= SCALE_RANGE.max}
                    onClick={() => nudge(key, SCALE_RANGE.step)}
                  >
                    +
                  </button>
                </div>
                {prefs[key] !== 100 && (
                  <button className="link-btn" onClick={() => update({ [key]: 100 } as Partial<Prefs>)}>
                    Reset
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="size-sliders">
            <label className="slider-row">
              <span>Business logo width</span>
              <input
                type="range"
                min={SCALE_RANGE.min}
                max={SCALE_RANGE.max}
                step={SLIDER_STEP}
                value={prefs.brandW}
                onChange={(e) => update({ brandW: Number(e.target.value) })}
              />
              <span>{prefs.brandW}%</span>
            </label>
            <label className="slider-row">
              <span>Business logo height</span>
              <input
                type="range"
                min={SCALE_RANGE.min}
                max={SCALE_RANGE.max}
                step={SLIDER_STEP}
                value={prefs.brandH}
                onChange={(e) => update({ brandH: Number(e.target.value) })}
              />
              <span>{prefs.brandH}%</span>
            </label>
            <label className="slider-row">
              <span>Mainboard + status tags</span>
              <input
                type="range"
                min={SCALE_RANGE.min}
                max={SCALE_RANGE.max}
                step={SLIDER_STEP}
                value={prefs.pillScale}
                onChange={(e) => update({ pillScale: Number(e.target.value) })}
              />
              <span>{prefs.pillScale}%</span>
            </label>
          </div>
        </div>

        <div className="editor-block wide">
          <span className="editor-label">Logo background</span>
          <div className="bg-rows">
            <label className="toggle">
              <input
                type="checkbox"
                checked={prefs.removeLogoBg}
                onChange={(e) => update({ removeLogoBg: e.target.checked })}
              />
              Remove IPO logo background
            </label>
            {prefs.removeLogoBg && (
              <label className="range-row">
                <span>Tolerance</span>
                <input
                  type="range"
                  min={0}
                  max={80}
                  value={prefs.logoBgTol}
                  onChange={(e) => update({ logoBgTol: Number(e.target.value) })}
                />
                <span>{prefs.logoBgTol}</span>
              </label>
            )}
            <label className="toggle">
              <input
                type="checkbox"
                checked={prefs.removeBrandBg}
                onChange={(e) => update({ removeBrandBg: e.target.checked })}
              />
              Remove business logo background
            </label>
            {prefs.removeBrandBg && (
              <label className="range-row">
                <span>Tolerance</span>
                <input
                  type="range"
                  min={0}
                  max={80}
                  value={prefs.brandBgTol}
                  onChange={(e) => update({ brandBgTol: Number(e.target.value) })}
                />
                <span>{prefs.brandBgTol}</span>
              </label>
            )}
          </div>
          <span className="editor-hint">Works best on plain or white logo backgrounds. The logo floats without its tile.</span>
        </div>

        <div className="editor-block">
          <span className="editor-label">Pattern</span>
          <div className="segmented">
            {PATTERNS.map((pat) => (
              <button
                key={pat.key}
                className={prefs.pattern === pat.key ? "on" : ""}
                onClick={() => update({ pattern: pat.key })}
              >
                {pat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="editor-block">
          <span className="editor-label">QR code</span>
          <label className="toggle">
            <input type="checkbox" checked={prefs.qr} onChange={(e) => update({ qr: e.target.checked })} />
            Add a QR code
          </label>
        </div>

        {prefs.qr && (
          <div className="editor-block wide">
            <label className="field">
              <span className="editor-label">QR link</span>
              <input
                value={prefs.qrLink}
                placeholder="https://… (defaults to your source URL)"
                onChange={(e) => update({ qrLink: e.target.value })}
              />
            </label>
          </div>
        )}

        <div className="editor-block wide">
          <span className="editor-label">Show</span>
          <div className="checks">
            <label>
              <input type="checkbox" checked={prefs.showGmp} onChange={(e) => update({ showGmp: e.target.checked })} />
              GMP
            </label>
            <label>
              <input type="checkbox" checked={prefs.showStats} onChange={(e) => update({ showStats: e.target.checked })} />
              Price / lot
            </label>
            <label className={prefs.showStats ? "" : "off"}>
              <input
                type="checkbox"
                checked={prefs.showIssue && prefs.showStats}
                disabled={!prefs.showStats}
                onChange={(e) => update({ showIssue: e.target.checked })}
              />
              Issue size
            </label>
            <label>
              <input type="checkbox" checked={prefs.showDates} onChange={(e) => update({ showDates: e.target.checked })} />
              Dates
            </label>
          </div>
        </div>

        <div className="editor-block wide fields">
          <label className="field">
            <span className="editor-label">Title</span>
            <input
              value={prefs.title}
              maxLength={24}
              placeholder="IPO ALERT"
              onChange={(e) => update({ title: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="editor-label">Note</span>
            <input
              value={prefs.note}
              maxLength={60}
              placeholder="Apply before 5 PM"
              onChange={(e) => update({ note: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="editor-label">Handle</span>
            <input
              value={prefs.handle}
              maxLength={30}
              placeholder="@yourchannel"
              onChange={(e) => update({ handle: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="editor-label">CTA</span>
            <input
              value={prefs.cta}
              maxLength={40}
              placeholder="DM for allotment updates"
              onChange={(e) => update({ cta: e.target.value })}
            />
          </label>
        </div>

        <div className="editor-block wide">
          <span className="editor-label">Your business</span>
          <div className="editor-row">
            <label className="file-btn">
              {brandLogo ? "Change business logo" : "Upload business logo"}
              <input type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0], setBrandLogo)} />
            </label>
            {brandLogo && (
              <button className="link-btn" onClick={() => setBrandLogo(null)}>
                Remove
              </button>
            )}
          </div>
          {brandLogo && (
            <div className="segmented" style={{ marginTop: 6 }}>
              {BRAND_PLACES.map((place) => (
                <button
                  key={place.key}
                  className={prefs.brandPlace === place.key ? "on" : ""}
                  onClick={() => update({ brandPlace: place.key })}
                >
                  {place.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="editor-block wide extras">
          <label className="file-btn">
            {customLogo ? "Change IPO logo" : "Upload IPO logo"}
            <input type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0], setCustomLogo)} />
          </label>
          {customLogo && (
            <button className="link-btn" onClick={() => setCustomLogo(null)}>
              Remove IPO logo
            </button>
          )}
          <button className="link-btn push" onClick={() => { setPrefs(DEFAULTS); setCustomLogo(null); setBrandLogo(null); }}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
