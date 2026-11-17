import Link from "next/link";
import { PLANS, type PlanId } from "@/config/plans";
import { buttonClass } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icons";
import { Eyebrow } from "@/components/ui/kit";
import type { Key, Locale, TFn } from "@/lib/i18n";
import { ViewStamp } from "./view-stamp";

const wrap = "mx-auto max-w-6xl px-4 md:px-8";
const h2 = "font-display text-balance text-[2.125rem] font-semibold leading-[1.1] tracking-[-0.015em] md:text-[3.25rem] md:leading-[1.05]";

function Sample({ t, dark }: { t: TFn; dark?: boolean }) {
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-[.12em] ${dark ? "bg-white/10 text-on-ink-mute" : "bg-sand text-mute"}`}>{t("home.sample")}</span>;
}

/* ---------- Sorun ---------- */
export function Problem({ t }: { t: TFn }) {
  const items = ["p1", "p2", "p3"] as const;
  return (
    <section className="py-16 md:py-28">
      <div className={`${wrap} grid gap-10 md:grid-cols-[.9fr_1.1fr] md:gap-20`}>
        <div className="self-start md:sticky md:top-28">
          <Eyebrow>{t("home.p.eyebrow")}</Eyebrow>
          <h2 className={`${h2} mt-3`}>{t("home.p.title")}</h2>
          <p className="mt-6 max-w-[44ch] border-l-2 border-clay pl-4 text-lg leading-relaxed text-ink-soft">{t("home.why.body")}</p>
        </div>
        <ol className="divide-y divide-line border-y border-line">
          {items.map((k, i) => (
            <li key={k} className="mk-reveal grid grid-cols-[3.2rem_1fr] gap-4 py-7 md:grid-cols-[4.5rem_1fr] md:py-9">
              <span aria-hidden className="mk-num text-[2.75rem] text-clay md:text-[3.75rem]">{i + 1}</span>
              <div>
                <h3 className="font-display text-2xl font-semibold leading-tight md:text-[1.75rem]">{t(`home.${k}.t` as Key)}</h3>
                <p className="mt-2 max-w-[52ch] text-ink-soft">{t(`home.${k}.d` as Key)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- 3 adım ---------- */
export function Steps({ t }: { t: TFn }) {
  const slots = ["14:00", "14:30", "15:30", "16:00"];
  return (
    <section id="nasil" className="relative scroll-mt-16 bg-sand py-16 md:py-28">
      <div className={wrap}>
        <Eyebrow>{t("home.s.eyebrow")}</Eyebrow>
        <h2 className={`${h2} mt-3`}>{t("home.s.title")}</h2>
        <ol className="mt-12 grid gap-12 md:mt-16 md:grid-cols-3 md:gap-8">
          {(["s1", "s2", "s3"] as const).map((k, i) => (
            <li key={k} className="mk-reveal">
              <div className="flex items-center gap-4"><span aria-hidden className="mk-num text-[4.5rem] text-brass-deep/90 md:text-[5.5rem]">{i + 1}</span><span aria-hidden className="h-px flex-1 border-t border-dashed border-line-strong" /></div>
              <div aria-hidden className="mt-4 flex min-h-28 items-center rounded-2xl border border-line bg-bone p-4 shadow-card">
                {i === 0 ? (
                  <div className="flex w-full items-center gap-3 rounded-lg border border-line-strong bg-paper px-3 py-3 text-sm font-semibold"><Icon name="globe" size={18} className="text-sea" /><span className="min-w-0 truncate">{t("home.s.link")}</span></div>
                ) : i === 1 ? (
                  <div className="w-full"><p className="mb-2 text-xs font-bold uppercase tracking-[.12em] text-mute">{t("home.s.slot")}</p>
                    <div className="grid grid-cols-4 gap-2">{slots.map((s) => <span key={s} className={`tnum rounded-lg border py-2 text-center text-sm font-semibold ${s === "15:30" ? "border-sea bg-sea text-white" : "border-line-strong bg-paper"}`}>{s}</span>)}</div></div>
                ) : (
                  <p className="rounded-2xl rounded-bl-sm bg-ink-2 px-4 py-3 text-sm leading-snug text-on-ink">{t("home.ph.sms.b1")} <span className="text-brass-bright underline underline-offset-2">kibrisrandevu.com/r/…</span></p>
                )}
              </div>
              <h3 className="font-display mt-5 text-2xl font-semibold">{t(`home.${k}.t` as Key)}</h3>
              <p className="mt-2 text-ink-soft">{t(`home.${k}.d` as Key)}</p>
            </li>
          ))}
        </ol>
        <p className="mt-10"><Sample t={t} /></p>
      </div>
    </section>
  );
}

/* ---------- Özellikler + takvim ---------- */
const F_ICON: Record<string, IconName> = { f1: "scissors", f2: "bell", f3: "clock", f4: "globe", f5: "calendar", f6: "user" };

export function CalendarMock({ t }: { t: TFn }) {
  const rowsA = [["10:00", "home.ph.cal.e1", "home.ph.cal.e1s", "#1F5A60", false, 45], ["12:00", "home.ph.cal.e3", "home.ph.cal.e3s", "#4A5A36", false, 40]] as const;
  const rowsB = [["11:00", "home.ph.cal.e2", "home.ph.cal.e2s", "#A8432B", true, 30]] as const;
  const hours = ["10:00", "11:00", "12:00", "13:00"];
  const ev = (r: readonly [string, Key, Key, string, boolean, number], col: number) => (
    <div key={r[0] + col} className="absolute inset-x-1.5 overflow-hidden rounded-md border border-line bg-white py-1 pl-3.5 pr-2 shadow-card"
      style={{ top: `${(Number(r[0].slice(0, 2)) - 10) * 88 + 2}px`, height: `${Math.round((r[5] / 60) * 88) - 4}px` }}>
      <span aria-hidden className={`absolute inset-y-0 left-0 ${r[4] ? "pole w-1.5" : "w-1"}`} style={r[4] ? undefined : { background: r[3] }} />
      <p className="truncate text-[13px] font-semibold">{t(r[1])}</p><p className="truncate text-xs text-ink-soft">{t(r[2])}</p>
    </div>
  );
  return (
    <figure role="img" aria-label={t("home.cal.title")} className="rounded-2xl border border-line bg-bone p-4 shadow-lift md:p-5">
      <figcaption className="mb-3 flex items-center justify-between gap-2">
        <span><span className="font-display text-xl font-semibold">{t("home.cal.today")}</span> <span className="text-sm text-mute">{t("home.ph.cal.sub")}</span></span>
        <Sample t={t} />
      </figcaption>
      <div className="grid grid-cols-[2.6rem_1fr_1fr] border-b border-line pb-2 text-xs font-bold uppercase tracking-[.1em] text-mute"><span /><span className="px-2">{t("home.cal.s1")}</span><span className="border-l border-line px-2">{t("home.cal.s2")}</span></div>
      <div className="relative grid grid-cols-[2.6rem_1fr_1fr]" style={{ height: hours.length * 88 }}>
        <div>{hours.map((h) => <p key={h} className="tnum h-[88px] border-b border-line/70 pt-1 text-xs text-mute">{h}</p>)}</div>
        <div className="relative border-b border-line/0">{hours.map((h, i) => <span key={h} aria-hidden className="absolute inset-x-0 border-b border-line/70" style={{ top: (i + 1) * 88 - 1 }} />)}{rowsA.map((r) => ev(r, 0))}</div>
        <div className="relative border-l border-line">{hours.map((h, i) => <span key={h} aria-hidden className="absolute inset-x-0 border-b border-line/70" style={{ top: (i + 1) * 88 - 1 }} />)}{rowsB.map((r) => ev(r, 1))}</div>
        <span aria-hidden className="absolute left-[2.1rem] right-0 flex items-center" style={{ top: 75 }}><span className="h-2.5 w-2.5 rounded-full bg-clay" /><span className="h-0.5 flex-1 bg-clay" /></span>
      </div>
    </figure>
  );
}

export function Features({ t }: { t: TFn }) {
  return (
    <section id="ozellikler" className="scroll-mt-16 py-16 md:py-28">
      <div className={`${wrap} grid gap-12 md:grid-cols-[1fr_1.05fr] md:gap-20`}>
        <div className="self-start md:sticky md:top-28">
          <Eyebrow>{t("nav.features")}</Eyebrow>
          <h2 className={`${h2} mt-3`}>{t("home.featuresTitle")}</h2>
          <p className="mt-4 max-w-[46ch] text-lg text-ink-soft">{t("home.featuresSub")}</p>
          <div className="mt-8"><CalendarMock t={t} /></div>
        </div>
        <ul className="divide-y divide-line border-y border-line self-start">
          {(["f1", "f2", "f3", "f4", "f5", "f6"] as const).map((f) => (
            <li key={f} className="mk-reveal flex gap-4 py-6 md:gap-5 md:py-7">
              <span className="arch grid h-14 w-11 shrink-0 place-items-center border border-line-strong bg-sand/60 pt-2 text-sea"><Icon name={F_ICON[f]!} size={22} /></span>
              <div><h3 className="font-display text-xl font-semibold md:text-2xl">{t(`home.${f}.t` as Key)}</h3><p className="mt-1.5 text-ink-soft">{t(`home.${f}.d` as Key)}</p></div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- Yerel ---------- */
const CITY_DOTS = [
  { k: "home.l.c4", x: 100, y: 79, a: "middle" }, { k: "home.l.c6", x: 60, y: 94, a: "end" }, { k: "home.l.c2", x: 172, y: 62, a: "middle" },
  { k: "home.l.c1", x: 178, y: 102, a: "start" }, { k: "home.l.c3", x: 262, y: 117, a: "start" }, { k: "home.l.c5", x: 291, y: 70, a: "start" },
] as const;
export function Local({ t }: { t: TFn }) {
  const cities = ["home.l.c1", "home.l.c2", "home.l.c3", "home.l.c4", "home.l.c5", "home.l.c6"] as const;
  const scen = [["home.nicosia", "home.nicosia.service", "home.nicosia.detail"], ["home.kyrenia", "home.kyrenia.service", "home.kyrenia.detail"], ["home.famagusta", "home.famagusta.service", "home.famagusta.detail"]] as const;
  return (
    <section data-surface="ink" className="on-ink relative overflow-hidden bg-ink-deep py-16 text-on-ink md:py-28">
      <span aria-hidden className="grain-ink" />
      <div className={`${wrap} relative grid gap-12 md:grid-cols-[1.05fr_.95fr] md:items-center md:gap-20`}>
        <div>
          <Eyebrow tone="brass">{t("home.l.eyebrow")}</Eyebrow>
          <h2 className={`${h2} mt-3`}>{t("home.l.title")}</h2>
          <p className="mt-5 max-w-[50ch] text-lg leading-relaxed text-on-ink-mute">{t("home.l.body")}</p>
          <ul className="mt-8 grid grid-cols-2 gap-x-6 sm:grid-cols-3">
            {cities.map((c) => <li key={c} className="font-display border-b border-white/10 py-3 text-2xl font-semibold">{t(c)}</li>)}
          </ul>
        </div>
        <figure className="arch relative mx-auto w-full max-w-md border border-brass-bright/40 bg-ink-2 px-4 pb-6 pt-24 md:max-w-none">
          <svg viewBox="0 0 340 168" className="w-full" role="img" aria-label={t("home.l.map")}>
            <path transform="translate(0 -5) scale(1 1.45)" d="M12 72C20 60 34 58 46 62C60 66 72 58 84 50C96 42 112 52 124 48C150 40 176 42 204 44C232 46 252 40 272 32C292 24 312 14 332 6L337 13C322 26 306 40 292 52C280 62 276 74 266 84C250 98 230 100 210 104C180 112 146 114 118 108C90 102 60 100 40 92C28 86 16 82 12 72Z" fill="#1D3E44" stroke="#E2B15A" strokeOpacity=".75" strokeWidth="1" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <path transform="translate(0 -5) scale(1 1.45)" d="M84 52C130 40 180 40 240 42" stroke="#E2B15A" strokeOpacity=".22" fill="none" strokeDasharray="1 5" strokeLinecap="round" />
            {CITY_DOTS.map((c) => (
              <g key={c.k}><circle cx={c.x} cy={c.y} r="3.4" fill="#E2B15A" /><circle cx={c.x} cy={c.y} r="7" fill="none" stroke="#E2B15A" strokeOpacity=".4" />
                <text x={c.x + (c.a === "start" ? 9 : c.a === "end" ? -9 : 0)} y={c.y + (c.a === "middle" ? -11 : 4)} textAnchor={c.a} fontSize="9.5" fontWeight="600" fill="#F4ECDD" style={{ fontFamily: "var(--font-body)" }}>{t(c.k)}</text></g>
            ))}
          </svg>
          <figcaption className="mt-4 text-center text-xs font-semibold uppercase tracking-[.12em] text-on-ink-mute">{t("home.l.map")}</figcaption>
        </figure>
      </div>
      <div className={`${wrap} relative mt-14 md:mt-20`}>
        <h3 className="eyebrow text-brass-bright">{t("home.scenarios")}</h3>
        <ul className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-3">
          {scen.map(([c, s, d]) => (
            <li key={c} className="bg-ink-deep p-6">
              <p className="eyebrow text-on-ink-mute">{t(c)}</p>
              <h4 className="font-display mt-2 text-2xl font-semibold">{t(s)}</h4>
              <p className="mt-2 text-on-ink-mute">{t(d)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- Fiyatlar ---------- */
export function Pricing({ t, locale, prices }: { t: TFn; locale: Locale; prices: Record<PlanId, number> }) {
  const fmt = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB");
  const POPULAR: PlanId = "pro";
  const Check = ({ dark }: { dark?: boolean }) => <Icon name="check" size={18} className={`mt-0.5 ${dark ? "text-brass-bright" : "text-sea"}`} />;
  return (
    <section id="fiyatlar" className="scroll-mt-16 bg-sand py-16 md:py-28">
      <div className={wrap}>
        <Eyebrow>{t("home.pricingEyebrow")}</Eyebrow>
        <h2 className={`${h2} mt-3`}>{t("home.pricingTitle")}</h2>
        <p className="mt-4 max-w-[50ch] text-lg text-ink-soft">{t("home.pricingSub")}</p>
        <div className="mt-12 grid gap-6 md:grid-cols-3 md:items-stretch">
          {(Object.keys(PLANS) as PlanId[]).map((id) => {
            const p = PLANS[id];
            const pop = id === POPULAR;
            return (
              <article key={id} data-surface={pop ? "ink" : undefined} className={`relative flex flex-col rounded-2xl p-6 md:p-7 ${pop ? "on-ink bg-ink-deep text-on-ink shadow-pop md:-my-3 md:py-10" : "border border-line bg-bone shadow-card"}`}>
                {pop ? <span className="absolute -top-3 left-6 rounded-md bg-brass-bright px-3 py-1 text-xs font-bold uppercase tracking-[.1em] text-ink">{t("home.plan.popular")}</span> : null}
                <h3 className="font-display text-2xl font-semibold">{p.name[locale]}</h3>
                <p className="mt-4 flex items-baseline gap-2"><span className="mk-num tnum text-[3.5rem]">{fmt.format(prices[id])}</span><span className={pop ? "text-on-ink-mute" : "text-mute"}>{t("common.perMonth")}</span></p>
                <p className={`mt-1 text-sm font-semibold ${pop ? "text-brass-bright" : "text-olive"}`}>{t("home.plan.trial")}</p>
                <div className={`my-5 h-px ${pop ? "bg-white/15" : "bg-line"}`} />
                <ul className="flex-1 space-y-3 text-[15px]">
                  <li className="flex gap-2.5"><Check dark={pop} />{p.maxStaff === null ? t("home.plan.staffUnlimited") : p.maxStaff === 1 ? t("home.plan.staffOne") : t("home.plan.staffN", { n: p.maxStaff })}</li>
                  <li className="flex gap-2.5"><Check dark={pop} />{t("home.plan.sms", { n: p.monthlySms })}</li>
                  {p.features.reports ? <li className="flex gap-2.5"><Check dark={pop} />{t("home.plan.reports")}</li> : null}
                  {p.features.customerNotes ? <li className="flex gap-2.5"><Check dark={pop} />{t("home.plan.notes")}</li> : null}
                  {p.features.whatsapp ? <li className="flex gap-2.5"><Check dark={pop} />{t("home.plan.whatsapp")}</li> : null}
                  {p.features.campaigns ? <li className="flex gap-2.5"><Check dark={pop} />{t("home.plan.campaigns")}</li> : null}
                </ul>
                <Link href="/kayit" className={buttonClass(pop ? "inverse" : "secondary", "mt-7")}>{t("home.plan.cta")}</Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------- SSS ---------- */
export function Faq({ t }: { t: TFn }) {
  return (
    <section id="sss" className="scroll-mt-16 py-16 md:py-28">
      <div className="mx-auto max-w-3xl px-4 md:px-8">
        <Eyebrow>{t("nav.faq")}</Eyebrow>
        <h2 className={`${h2} mt-3`}>{t("home.faqTitle")}</h2>
        <div className="mt-8 divide-y divide-line border-y border-line">
          {(["faq1", "faq2", "faq3", "faq4", "faq5", "faq6"] as const).map((f) => (
            <details key={f} className="group py-1">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="font-display text-lg font-semibold md:text-xl">{t(`home.${f}.q` as Key)}</span>
                <Icon name="plus" size={22} className="text-sea transition-transform duration-200 group-open:rotate-45" />
              </summary>
              <p className="max-w-[62ch] pb-4 text-ink-soft">{t(`home.${f}.a` as Key)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Son çağrı ---------- */
export function FinalCta({ t, waHref }: { t: TFn; waHref: string | null }) {
  return (
    <section data-surface="ink" className="on-ink relative overflow-hidden bg-ink-deep py-16 text-on-ink md:py-24">
      <span aria-hidden className="grain-ink" />
      <div className={`${wrap} relative flex flex-col items-start gap-10 md:flex-row md:items-center md:justify-between`}>
        <div className="max-w-xl">
          <h2 className={h2}>{t("home.ctaTitle")}</h2>
          <p className="mt-4 text-lg text-on-ink-mute">{t("home.ctaSub")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/kayit" className={buttonClass("inverse", "px-6")}>{t("home.ctaPrimary")}</Link>
            {waHref ? <a href={waHref} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost", "border border-white/30 px-6 text-on-ink hover:bg-white/10")}>{t("home.whatsapp")}</a> : null}
          </div>
        </div>
        <div className="relative mx-auto w-64 shrink-0 self-center pb-6 md:mx-0 md:mr-8" data-surface="paper">
          <div className="arch border border-brass-bright/50 bg-bone px-6 pb-8 pt-12 text-center text-ink shadow-pop">
            <p className="eyebrow text-clay">{t("home.nicosia")}</p>
            <p className="font-display tnum mt-2 text-[3.5rem] font-semibold leading-none">15:30</p>
            <p className="mt-3 font-semibold">{t("home.mockService")}</p>
            <p className="mt-1 text-sm text-mute">{t("home.mockSalon")}</p>
            <p className="mt-4"><Sample t={t} /></p>
          </div>
          <div className="absolute -bottom-2 -left-10 md:-left-14"><ViewStamp top={t("home.fa1.t").split(" ")[0] ?? ""} bottom={t("home.fa1.t").split(" ").slice(1).join(" ")} className="bg-bone [box-shadow:inset_0_0_0_4px_#FFFCF6,inset_0_0_0_5.5px_currentColor,0_10px_24px_rgb(0_0_0/.35)]" /></div>
        </div>
      </div>
    </section>
  );
}
