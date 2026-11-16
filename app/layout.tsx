import type { Metadata } from "next";
import "./globals.css";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: brand.name, description: brand.tagline.tr };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-white text-slate-900 antialiased">{children}</body>
    </html>
  );
}
