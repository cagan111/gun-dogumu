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
        <section className="bg-gradient-to-b from-teal-50 to-white">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
            <div>
              <p className="inline-block rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-900">{t("home.badge")}</p>
              <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">{t("home.heroTitle")}</h1>
              <p className="mt-4 max-w-xl text-lg text-slate-700">{t("home.heroSub")}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/kayit" className={buttonClass("primary", "px-6")}>{t("home.ctaPrimary")}</Link>
                <a href="#fiyatlar" className={buttonClass("secondary", "px-6")}>{t("home.ctaSecondary")}</a>
              </div>
              <p className="mt-3 text-sm text-slate-600">{t("home.heroNote")}</p>
            </div>
            <div aria-hidden className="mx-auto w-full max-w-xs rounded-[2rem] border-8 border-slate-900 bg-white p-4 shadow-xl">
              <div className="rounded-2xl bg-gradient-to-br from-teal-700 to-teal-500 p-4 text-white">
                <p className="text-xs opacity-80">Lefkoşa</p>
                <p className="text-lg font-bold">{t("home.mockSalon")}</p>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="rounded-xl border border-teal-600 bg-teal-50 p-3 font-medium">{t("home.mockService")}<span className="float-right text-slate-600">650 TL</span></div>
                <div className="rounded-xl border border-slate-200 p-3 text-slate-600">{t("home.mockTime")}</div>
                <div className="rounded-xl bg-teal-700 p-3 text-center font-semibold text-white">{t("home.mockBook")}</div>
              </div>
            </div>
          </div>
        </section>

        <section id="ozellikler" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-14">
          <h2 className="text-2xl font-bold sm:text-3xl">{t("home.featuresTitle")}</h2>
          <p className="mt-2 max-w-2xl text-slate-700">{t("home.featuresSub")}</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <li key={f} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <span aria-hidden className="grid h-9 w-9 place-items-center rounded-lg bg-teal-100 text-sm font-bold text-teal-900">{i + 1}</span>
                <h3 className="mt-3 font-semibold">{t(`home.${f}.t` as Key)}</h3>
                <p className="mt-1 text-sm text-slate-700">{t(`home.${f}.d` as Key)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="fiyatlar" className="scroll-mt-16 bg-slate-50 py-14">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-2xl font-bold sm:text-3xl">{t("home.pricingTitle")}</h2>
            <p className="mt-2 text-slate-700">{t("home.pricingSub")}</p>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {(Object.keys(PLANS) as PlanId[]).map((id) => {
                const p = PLANS[id];
                const popular = id === POPULAR;
                return (
                  <article key={id} className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${popular ? "border-teal-600 ring-2 ring-teal-600" : "border-slate-200"}`}>
                    {popular ? <span className="absolute -top-3 left-6 rounded-full bg-teal-700 px-3 py-0.5 text-xs font-semibold text-white">{t("home.plan.popular")}</span> : null}
                    <h3 className="text-lg font-bold">{p.name[locale]}</h3>
                    <p className="mt-3"><span className="text-4xl font-extrabold">{fmt.format(prices[id])}</span> <span className="text-slate-600">{t("common.perMonth")}</span></p>
                    <p className="mt-1 text-sm font-medium text-teal-800">{t("home.plan.trial")}</p>
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
          <h2 className="text-2xl font-bold sm:text-3xl">{t("home.faqTitle")}</h2>
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

        <section className="bg-teal-800 text-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-12 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">{t("home.ctaTitle")}</h2>
              <p className="mt-1 text-teal-50">{t("home.ctaSub")}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/kayit" className={buttonClass("secondary", "border-transparent px-6")}>{t("home.ctaPrimary")}</Link>
              {waHref ? (
                <a href={waHref} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost", "border border-white/60 px-6 text-white hover:bg-teal-700")}>{t("home.whatsapp")}</a>
              ) : null}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
