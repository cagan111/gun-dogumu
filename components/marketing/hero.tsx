import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/kit";
import type { TFn } from "@/lib/i18n";
import { HeroStage } from "./hero-stage";
import { FloatCards, Phones, type CardSpec } from "./phones";
import { SalonScene } from "./salon-scene";

/** Ana sayfa hero: koyu zemin, solda söz, sağda kemer çerçeveli iki sahne (salon ↔ ürün). */
export function Hero({ t, photoSrc }: { t: TFn; photoSrc?: string }) {
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
  return (
    <section data-surface="ink" className="on-ink relative overflow-hidden bg-ink-deep text-on-ink">
      <span aria-hidden className="grain-ink" />
      <div aria-hidden className="pointer-events-none absolute -right-40 top-10 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(closest-side,rgb(226_177_90/.16),transparent)]" />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-6 pt-10 md:grid-cols-[1.08fr_.92fr] md:items-center md:gap-10 md:px-8 md:pb-16 md:pt-16">
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
