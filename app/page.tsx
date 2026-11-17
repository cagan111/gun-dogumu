import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { PLANS, type PlanId } from "@/config/plans";
import { Faq, Features, FinalCta, Local, Pricing, Problem, Steps } from "@/components/marketing/sections";
import { Hero } from "@/components/marketing/hero";
import "@/components/marketing/marketing.css";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getT } from "@/lib/i18n";
import { getAllPlanPrices } from "@/lib/plan-price";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getT();
  return { title: `${brand.name} — ${brand.tagline[locale]}`, description: brand.tagline[locale] };
}

export default async function Home() {
  const { t, locale } = await getT();
  let prices: Record<PlanId, number>;
  try { prices = await getAllPlanPrices(); } catch { prices = { baslangic: PLANS.baslangic.priceTry, pro: PLANS.pro.priceTry, salon_plus: PLANS.salon_plus.priceTry }; }
  const wa = (process.env.CONTACT_WHATSAPP ?? "").replace(/[^\d]/g, "");
  const waHref = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(t("home.whatsappText"))}` : null;

  return (
    <>
      <a href="#icerik" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-bone focus:px-3 focus:py-2">{t("common.skipToContent")}</a>
      <SiteHeader tone="ink" />
      <main id="icerik">
        <Hero t={t} />
        <div className="bg-ink-deep"><div className="tile-rule" role="presentation" /></div>
        <Problem t={t} />
        <Steps t={t} />
        <Features t={t} />
        <Local t={t} />
        <Pricing t={t} locale={locale} prices={prices} />
        <Faq t={t} />
        <FinalCta t={t} waHref={waHref} />
      </main>
      <SiteFooter />
    </>
  );
}
