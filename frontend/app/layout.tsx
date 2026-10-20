import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth";
import { ToastProvider } from "@/components/toast";

export const metadata: Metadata = {
  title: {
    default: "IPO Poster Studio",
    template: "%s · IPO Poster Studio",
  },
  description:
    "Browse IPO details, copy WhatsApp-ready messages and create branded IPO posters for your finance business.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white text-slate-900">
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
