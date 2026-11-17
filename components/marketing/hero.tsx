import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/kit";
import type { TFn } from "@/lib/i18n";
import { heroVideo, type HeroVideo as VideoCfg } from "@/config/hero";
import { HeroStage } from "./hero-stage";
import { HeroVideo } from "./hero-video";
import { FloatCards, Phones, type CardSpec } from "./phones";
import { SalonScene } from "./salon-scene";

/** Ana sayfa hero: koyu zemin, solda söz, sağda kemer çerçeveli iki sahne (salon ↔ ürün). */
function cards(t: TFn) {
  const A: CardSpec[] = [
    { cls: "fa fa-1", icon: "check", tone: "green", t: t("home.fa1.t"), d: t("home.fa1.d") },
    { cls: "fa fa-2", icon: "bell", tone: "gold", t: t("home.fa2.t"), d: t("home.fa2.d") },
  ];
  const B: CardSpec[] = [
    { cls: "fb fc-1", icon: "calendar", t: t("home.fb1.t"), d: t("home.fb1.d") },
    { cls: "fb fc-2", icon: "message", tone: "gold", t: t("home.fb2.t"), d: t("home.fb2.d") },
    { cls: "fb fc-3", icon: "clock", tone: "warm", t: t("home.fb3.t"), d: t("home.fb3.d") },
    { cls: "fb fc-4", icon: "check", tone: "green", t: t("home.fb4.t"), d: t("home.fb4.d") },
  ];
  return { A, B };
}

function Copy({ t }: { t: TFn }) {
  return (
    <div className="mk-rise">
      <Eyebrow tone="brass">{t("home.badge")}</Eyebrow>
      <h1 className="font-display text-balance mt-4 text-[2.55rem] font-semibold leading-[1] tracking-[-0.02em] sm:text-[3.4rem] lg:text-[4.5rem]">
        {t("home.h1a")} <em className="font-semibold italic text-brass-bright">{t("home.h1b")}</em>
      </h1>
      <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-on-ink-mute">{t("home.heroSub")}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/kayit" className={buttonClass("inverse", "px-6")}>{t("home.ctaPrimary")}</Link>
        <a href="#fiyatlar" className={buttonClass("ghost", "border border-white/30 px-6 text-on-ink hover:bg-white/10")}>{t("home.ctaSecondary")}</a>
      </div>
      <p className="mt-4 text-sm text-on-ink-mute">{t("home.heroNote")}</p>
    </div>
  );
}

/** Video varsa: tam yüzey video + koyu perde + metin. Ürün sahnesi hemen altındaki ProductBand'de. */
function VideoHero({ t, cfg }: { t: TFn; cfg: VideoCfg }) {
  return (
    <section data-surface="ink" className="on-ink relative isolate overflow-hidden bg-ink-deep text-on-ink" aria-label={t("home.video.alt")}>
      <HeroVideo cfg={cfg} />
      {/* perde: metin kontrastı için (sol/alt ağırlıklı, ≥ AA) */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(14_35_38/.78)0%,rgb(14_35_38/.72)45%,rgb(14_35_38/.94)100%)] md:bg-[linear-gradient(90deg,rgb(14_35_38/.94)0%,rgb(14_35_38/.8)42%,rgb(14_35_38/.3)100%)]" />
      <div className="mx-auto flex min-h-[min(46rem,calc(100svh-4rem))] max-w-6xl items-center px-4 py-16 md:px-8 md:py-24">
        <div className="max-w-xl"><Copy t={t} /></div>
      </div>
      {cfg.credit ? <p className="absolute bottom-3 right-4 text-[11px] text-on-ink-mute md:right-8">{cfg.credit}</p> : null}
    </section>
  );
}

/** Video hero'nun altında ürün sahnesi (3 telefon + değişen kartlar). */
export function ProductBand({ t }: { t: TFn }) {
  const { A, B } = cards(t);
  return (
    <section data-surface="ink" className="on-ink relative overflow-hidden bg-ink-deep py-16 text-on-ink md:py-24">
      <span aria-hidden className="grain-ink" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 md:grid-cols-[1.08fr_.92fr] md:gap-10 md:px-8">
        <div>
          <Eyebrow tone="brass">{t("home.show.eyebrow")}</Eyebrow>
          <h2 className="font-display text-balance mt-3 text-[2.125rem] font-semibold leading-[1.1] tracking-[-0.015em] md:text-[3.25rem] md:leading-[1.05]">{t("home.show.title")}</h2>
          <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-on-ink-mute">{t("home.show.sub")}</p>
        </div>
        <HeroStage only="b" a={null} b={<Phones t={t} />} cardsA={<FloatCards items={A} />} cardsB={<FloatCards items={B} />}
          labels={{ group: t("home.stage.label"), a: t("home.stage.a"), b: t("home.stage.b"), pause: t("home.stage.pause"), play: t("home.stage.play"), sample: t("home.sample") }} />
      </div>
    </section>
  );
}

export function Hero({ t, photoSrc }: { t: TFn; photoSrc?: string }) {
  if (heroVideo) return <VideoHero t={t} cfg={heroVideo} />;
  const { A, B } = cards(t);
  return (
    <section data-surface="ink" className="on-ink relative overflow-hidden bg-ink-deep text-on-ink">
      <span aria-hidden className="grain-ink" />
      <div aria-hidden className="pointer-events-none absolute -right-40 top-10 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(closest-side,rgb(226_177_90/.16),transparent)]" />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-6 pt-10 md:grid-cols-[1.08fr_.92fr] md:items-center md:gap-10 md:px-8 md:pb-16 md:pt-16">
        <Copy t={t} />
        <HeroStage
          a={<SalonScene photoSrc={photoSrc} alt={t("home.stage.sceneAlt")} />}
          b={<Phones t={t} />}
          cardsA={<FloatCards items={A} />}
          cardsB={<FloatCards items={B} />}
          labels={{ group: t("home.stage.label"), a: t("home.stage.a"), b: t("home.stage.b"), pause: t("home.stage.pause"), play: t("home.stage.play"), sample: t("home.sample") }}
        />
      </div>
    </section>
  );
}
