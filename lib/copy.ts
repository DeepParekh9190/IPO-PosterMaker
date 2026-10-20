import type { Ipo } from "./ipos";

const DISCLAIMER = "GMP is unofficial. Not investment advice.";

export const templates = [
  {
    key: "whatsapp",
    label: "WhatsApp chat",
    build: (ipo: Ipo) =>
      [
        `🚀 ${ipo.name} IPO`,
        "",
        `💰 Price: ${ipo.priceBand}`,
        `📦 Lot: ${ipo.lot ?? "-"} shares (${ipo.minInvestment})`,
        `📈 GMP: ${ipo.gmp != null ? `+₹${ipo.gmp} (${ipo.gmpPercent})` : "-"}`,
        `🗓 ${ipo.open} → ${ipo.close}`,
        `✅ Allotment: ${ipo.allotment}`,
        `📊 Listing: ${ipo.listing}`,
        "",
        DISCLAIMER,
      ].join("\n"),
  },
  {
    key: "community",
    label: "WhatsApp community",
    build: (ipo: Ipo) =>
      [
        `📢 ${ipo.name} IPO`,
        ipo.board === "SME" ? "SME · High risk" : "Mainboard",
        "",
        `• Price band: ${ipo.priceBand}`,
        `• Lot size: ${ipo.lot ?? "-"} shares`,
        `• Minimum investment: ${ipo.minInvestment}`,
        `• Issue size: ${ipo.issueSize}`,
        `• GMP: ${ipo.gmp != null ? `+₹${ipo.gmp} (${ipo.gmpPercent})` : "-"}`,
        `• Open / Close: ${ipo.open} → ${ipo.close}`,
        `• Allotment: ${ipo.allotment}`,
        `• Listing: ${ipo.listing}`,
        "",
        `${DISCLAIMER} Apply at your own risk.`,
        "#IPO #IPOAlert",
      ].join("\n"),
  },
  {
    key: "x",
    label: "X / Twitter",
    build: (ipo: Ipo) =>
      [
        `${ipo.name} IPO`,
        `${ipo.priceBand} | Lot ${ipo.lot ?? "-"} | Min ${ipo.minInvestment}`,
        `GMP ${ipo.gmp != null ? `+₹${ipo.gmp} (${ipo.gmpPercent})` : "-"}`,
        `Open ${ipo.open} → ${ipo.close} | Lists ${ipo.listing}`,
        "",
        "Not investment advice.",
      ].join("\n"),
  },
] as const;

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}
