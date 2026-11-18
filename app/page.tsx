import { HeroMedia } from "@/components/hero/media";
import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";
import { PLANS, type PlanId } from "@/config/plans";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { buttonClass } from "@/components/ui/button";
import { getT, type Key } from "@/lib/i18n";
import { getAllPlanPrices } from "@/lib/plan-price";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getT();
  return { title: `${brand.name} — ${brand.tagline[locale]}`, description: brand.tagline[locale] };
}

const FEATURES = ["f1", "f2", "f3", "f4", "f5", "f6"] as const;
const FAQ = ["faq1", "faq2", "faq3", "faq4", "faq5", "faq6"] as const;
const POPULAR: PlanId = "pro";
const SCENARIOS = [
  { city: "home.nicosia", service: "home.nicosia.service", detail: "home.nicosia.detail", style: "border-clay bg-white" },
  { city: "home.kyrenia", service: "home.kyrenia.service", detail: "home.kyrenia.detail", style: "border-sea bg-paper" },
  { city: "home.famagusta", service: "home.famagusta.service", detail: "home.famagusta.detail", style: "border-olive bg-white" },
] as const;
const testimonials: { quote: string; attribution: string }[] = [];

function Check() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 fill-current text-brand"><path d="M8.2 14.2 4.5 10.5l1.4-1.4 2.3 2.3 5.9-5.9 1.4 1.4z" /></svg>
  );
}

export default async function Home() {
  const { t, locale } = await getT();
  let prices: Record<PlanId, number>;
  try { prices = await getAllPlanPrices(); } catch { prices = { baslangic: PLANS.baslangic.priceTry, pro: PLANS.pro.priceTry, salon_plus: PLANS.salon_plus.priceTry }; }
  const wa = (process.env.CONTACT_WHATSAPP ?? "").replace(/[^\d]/g, "");
  const waHref = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(t("home.whatsappText"))}` : null;
  const fmt = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB");

  return (
    <>
      <a href="#icerik" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">{t("common.skipToContent")}</a>
      <SiteHeader />
      <main id="icerik">
        <section className="relative isolate overflow-hidden border-b border-line bg-olive">
          <HeroMedia />
          <div className="mx-auto grid max-w-6xl items-center gap-9 px-4 py-12 md:grid-cols-[1.2fr_1fr] md:py-20">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-sand">{t("home.badge")}</p>
              <h1 className="display-heading mt-3 max-w-xl text-[2.5rem] font-semibold leading-[1.08] tracking-tight text-white sm:text-[3.6rem]">{t("home.heroTitle")}</h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-white sm:text-lg">{t("home.heroSub")}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/kayit" className={buttonClass("primary", "px-6")}>{t("home.ctaPrimary")}</Link>
                <a href="#fiyatlar" className={buttonClass("secondary", "px-6")}>{t("home.ctaSecondary")}</a>
              </div>
              <p className="mt-3 text-sm text-white">{t("home.heroNote")}</p>
            </div>
            <div aria-hidden className="relative isolate mx-auto flex min-h-64 w-full max-w-sm items-center justify-center p-4 md:min-h-96">
              <div className="relative w-full max-w-60 rotate-[-3deg] rounded-lg border border-line bg-white p-5 shadow-lg">
                <p className="text-xs font-bold uppercase tracking-wider text-clay">{t("home.nicosia")}</p>
                <p className="display-heading mt-1 text-xl font-semibold">{t("home.mockSalon")}</p>
                <div className="mt-3 border-y border-line py-2 text-sm">
                  <p className="font-semibold">{t("home.mockService")}</p>
                  <p className="mt-0.5 text-slate-600">{t("home.mockTime")}</p>
                </div>
                <p className="mt-3 text-sm font-bold text-sea">{t("home.mockBook")} <span>→</span></p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-5 px-4 py-14 md:grid-cols-[1fr_1.2fr] md:items-start">
          <h2 className="display-heading text-3xl font-semibold text-olive sm:text-4xl">{t("home.why.title")}</h2>
          <p className="max-w-2xl border-l-2 border-clay pl-4 text-lg leading-relaxed text-slate-700">{t("home.why.body")}</p>
          <div className="md:col-span-2">
            <h3 className="mt-3 text-sm font-bold uppercase tracking-wider text-clay">{t("home.scenarios")}</h3>
            <ul className="mt-4 grid gap-4 sm:grid-cols-3">
              {SCENARIOS.map(({ city, service, detail, style }) => (
                <li key={city} className={`rounded-lg border-t-4 p-5 ${style}`}>
                  <p className="text-xs font-bold uppercase tracking-wider text-olive">{t(city)}</p>
                  <h4 className="display-heading mt-2 text-xl font-semibold">{t(service)}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{t(detail)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {testimonials.length > 0 ? (
          <section className="mx-auto max-w-6xl px-4 pb-12" aria-label={t("home.testimonials")}>
            {testimonials.map(({ quote, attribution }) => (
              <figure key={attribution} className="border-l-2 border-clay pl-4">
                <blockquote>{quote}</blockquote>
                <figcaption className="mt-2 text-sm text-slate-600">{attribution}</figcaption>
              </figure>
            ))}
          </section>
        ) : null}

        <section id="ozellikler" className="mx-auto max-w-6xl scroll-mt-16 border-t border-line px-4 py-14">
          <h2 className="display-heading text-3xl font-semibold sm:text-4xl">{t("home.featuresTitle")}</h2>
          <p className="mt-2 max-w-2xl text-slate-700">{t("home.featuresSub")}</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f} className="border-t border-line py-4">
                <h3 className="font-bold text-sea">{t(`home.${f}.t` as Key)}</h3>
                <p className="mt-1 text-sm text-slate-700">{t(`home.${f}.d` as Key)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="fiyatlar" className="scroll-mt-16 bg-sand py-14">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="display-heading text-3xl font-semibold sm:text-4xl">{t("home.pricingTitle")}</h2>
            <p className="mt-2 text-slate-700">{t("home.pricingSub")}</p>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {(Object.keys(PLANS) as PlanId[]).map((id) => {
                const p = PLANS[id];
                const popular = id === POPULAR;
                return (
                  <article key={id} className={`relative flex flex-col rounded-lg border bg-white p-6 ${popular ? "border-sea ring-1 ring-sea" : "border-slate-200"}`}>
                    {popular ? <span className="absolute -top-3 left-6 rounded-full bg-sea px-3 py-0.5 text-xs font-semibold text-white">{t("home.plan.popular")}</span> : null}
                    <h3 className="text-lg font-bold">{p.name[locale]}</h3>
                    <p className="mt-3"><span className="text-4xl font-extrabold">{fmt.format(prices[id])}</span> <span className="text-slate-600">{t("common.perMonth")}</span></p>
                    <p className="mt-1 text-sm font-medium text-olive">{t("home.plan.trial")}</p>
                    <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-800">
                      <li className="flex gap-2"><Check />{p.maxStaff === null ? t("home.plan.staffUnlimited") : p.maxStaff === 1 ? t("home.plan.staffOne") : t("home.plan.staffN", { n: p.maxStaff })}</li>
                      <li className="flex gap-2"><Check />{t("home.plan.sms", { n: p.monthlySms })}</li>
                      {p.features.reports ? <li className="flex gap-2"><Check />{t("home.plan.reports")}</li> : null}
                      {p.features.customerNotes ? <li className="flex gap-2"><Check />{t("home.plan.notes")}</li> : null}
                      {p.features.whatsapp ? <li className="flex gap-2"><Check />{t("home.plan.whatsapp")}</li> : null}
                      {p.features.campaigns ? <li className="flex gap-2"><Check />{t("home.plan.campaigns")}</li> : null}
                    </ul>
                    <Link href="/kayit" className={buttonClass(popular ? "primary" : "secondary", "mt-6")}>{t("home.plan.cta")}</Link>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="sss" className="mx-auto max-w-3xl scroll-mt-16 px-4 py-14">
          <h2 className="display-heading text-3xl font-semibold sm:text-4xl">{t("home.faqTitle")}</h2>
          <div className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200">
            {FAQ.map((f) => (
              <details key={f} className="group p-4">
                <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-4 font-semibold marker:hidden">
                  {t(`home.${f}.q` as Key)}
                  <span aria-hidden className="text-xl text-slate-500 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-slate-700">{t(`home.${f}.a` as Key)}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="bg-sea text-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-12 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">{t("home.ctaTitle")}</h2>
              <p className="mt-1 text-paper">{t("home.ctaSub")}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/kayit" className={buttonClass("secondary", "border-transparent px-6")}>{t("home.ctaPrimary")}</Link>
              {waHref ? (
                <a href={waHref} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost", "border border-white/60 px-6 text-white hover:bg-white/10")}>{t("home.whatsapp")}</a>
              ) : null}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
