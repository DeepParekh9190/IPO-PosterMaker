import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IPO Studio: share-ready IPO cards",
  description: "Live IPO details you can copy into WhatsApp, plus pastel share cards with the company logo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
