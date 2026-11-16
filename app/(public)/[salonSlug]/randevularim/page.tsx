import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SalonHeader } from "@/components/salon-header";
import { brandVars } from "@/lib/brand-color";
import { getT } from "@/lib/i18n";
import { loadSalon } from "@/lib/public-page";
import { MyAppointments } from "./my-appointments";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("mine.title"), robots: { index: false } };
}

export default async function Page({ params }: { params: Promise<{ salonSlug: string }> }) {
  const { salonSlug } = await params;
  const r = await loadSalon(salonSlug);
  if (r.kind === "notfound") notFound();
  const { t } = await getT();
  const s = r.salon;
  return (
    <div style={brandVars(s.brandColor) as React.CSSProperties} className="min-h-screen bg-slate-50">
      <SalonHeader name={s.name} slug={s.slug} compact {...(r.kind === "ok" ? { city: r.salon.city, address: r.salon.address, logoUrl: s.logoUrl, coverUrl: s.coverUrl } : {})} />
      <main className="mx-auto max-w-2xl px-4 py-6">
        {r.kind === "closed" ? (
          <p className="text-center text-slate-700">{t("b.closed.body")}</p>
        ) : (
          <MyAppointments slug={s.slug} timeZone={r.salon.timeZone} />
        )}
      </main>
    </div>
  );
}
