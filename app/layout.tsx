import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { brand } from "@/config/brand";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale } from "@/lib/i18n";

const bodyFont = Instrument_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-body", display: "swap" });
// Fraunces: değişken eksenler (opsz/SOFT/WONK) — ğ ş ı İ ç ö ü latin-ext ile gelir.
const displayFont = Fraunces({ subsets: ["latin", "latin-ext"], axes: ["opsz", "SOFT", "WONK"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s` },
  description: brand.tagline.tr,
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className={`${bodyFont.variable} ${displayFont.variable} min-h-screen bg-paper font-sans text-ink antialiased`}>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
