import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SalonHeader } from "@/components/salon-header";
import { brandVars } from "@/lib/brand-color";
import { getT } from "@/lib/i18n";
import { loadSalon } from "@/lib/public-page";
import { listPublicServices, listPublicStaff } from "@/lib/public";
import { utcToLocal } from "@/lib/time";
import { BookingFlow } from "./booking-flow";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ salonSlug: string }> };

const appUrl = () => (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { salonSlug } = await params;
  const r = await loadSalon(salonSlug);
  const { t } = await getT();
  if (r.kind === "notfound") return { title: t("b.notFound.title"), robots: { index: false } };
  if (r.kind === "closed") return { title: t("b.closed.title", { name: r.salon.name }), robots: { index: false } };
  const { name, city } = r.salon;
  const title = t("b.meta.title", { name, city });
  const description = t("b.meta.desc", { name, city });
  const url = `${appUrl()}/${salonSlug}`;
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: "KıbrısRandevu", ...(r.salon.coverUrl ? { images: [r.salon.coverUrl] } : {}) },
    twitter: { card: "summary", title, description },
  };
}

export default async function SalonPage({ params }: Props) {
  const { salonSlug } = await params;
  const r = await loadSalon(salonSlug);
  if (r.kind === "notfound") notFound();
  const { t } = await getT();

  if (r.kind === "closed") {
    return (
      <div style={brandVars(r.salon.brandColor) as React.CSSProperties} className="min-h-screen bg-slate-50">
        <SalonHeader name={r.salon.name} compact />
        <main className="mx-auto max-w-2xl px-4 py-12 text-center">
          <h2 className="text-xl font-bold">{t("b.closed.title", { name: r.salon.name })}</h2>
          <p className="mt-2 text-slate-700">{t("b.closed.body")}</p>
        </main>
      </div>
    );
  }

  const { salon } = r;
  const [services, staff] = await Promise.all([listPublicServices(salonSlug), listPublicStaff(salonSlug)]);
  const today = utcToLocal(new Date(), salon.timeZone).date;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    name: salon.name,
    url: `${appUrl()}/${salonSlug}`,
    ...(salon.phone ? { telephone: salon.phone } : {}),
    address: {
      "@type": "PostalAddress",
      ...(salon.address ? { streetAddress: salon.address } : {}),
      addressLocality: salon.city,
      addressCountry: "CY",
    },
    ...(salon.coverUrl || salon.logoUrl ? { image: salon.coverUrl ?? salon.logoUrl } : {}),
  };

  return (
    <div style={brandVars(salon.brandColor) as React.CSSProperties} className="min-h-screen bg-slate-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <SalonHeader name={salon.name} city={salon.city} address={salon.address} logoUrl={salon.logoUrl} coverUrl={salon.coverUrl} slug={salon.slug} />
      <BookingFlow
        slug={salon.slug}
        salonName={salon.name}
        timeZone={salon.timeZone}
        today={today}
        maxAdvanceDays={Math.min(salon.maxAdvanceDays, 60)}
        services={services}
        staff={staff}
      />
    </div>
  );
}
