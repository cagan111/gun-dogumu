import type { Metadata, Viewport } from "next";
import "./globals.css";
import { brand } from "@/config/brand";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s` },
  description: brand.tagline.tr,
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
