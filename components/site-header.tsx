import Link from "next/link";
import { brand } from "@/config/brand";
import { LangSwitcher } from "./lang-switcher";
import { buttonClass } from "./ui/button";
import { getT } from "@/lib/i18n";

/** Marka işareti: kemer içinde makas ağzı. */
function Mark({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`arch grid h-9 w-7 place-items-center bg-brand pt-1 text-brand-fg ${className}`}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><rect x="6.5" y="6.5" width="11" height="11" /><rect x="6.5" y="6.5" width="11" height="11" transform="rotate(45 12 12)" /></svg>
    </span>
  );
}

export async function SiteHeader({ tone = "paper" }: { tone?: "paper" | "ink" }) {
  const { t } = await getT();
  const ink = tone === "ink";
  return (
    <header data-surface={ink ? "ink" : undefined} className={`sticky top-0 z-30 backdrop-blur ${ink ? "on-ink border-b border-white/10 bg-ink-deep/90 text-on-ink" : "border-b border-line bg-paper/95"}`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Mark className="max-[419px]:hidden" />
          <span className="font-display text-lg font-semibold tracking-tight sm:text-xl">{brand.name}</span>
        </Link>
        <nav aria-label="Ana" className={`hidden items-center gap-7 text-sm font-semibold md:flex ${ink ? "text-on-ink-mute" : "text-ink-soft"}`}>
          <a href="/#ozellikler" className={ink ? "hover:text-on-ink" : "hover:text-ink"}>{t("nav.features")}</a>
          <a href="/#fiyatlar" className={ink ? "hover:text-on-ink" : "hover:text-ink"}>{t("nav.pricing")}</a>
          <a href="/#sss" className={ink ? "hover:text-on-ink" : "hover:text-ink"}>{t("nav.faq")}</a>
        </nav>
        <div className="flex items-center gap-2">
          <LangSwitcher />
          <Link href="/giris" className={`hidden px-2 text-sm font-semibold sm:inline ${ink ? "text-on-ink-mute hover:text-on-ink" : "text-ink-soft hover:text-ink"}`}>{t("nav.login")}</Link>
          <Link href="/kayit" className={buttonClass(ink ? "inverse" : "primary", "min-h-10 whitespace-nowrap px-3.5 text-sm")}>{t("nav.signup")}</Link>
        </div>
      </div>
    </header>
  );
}

export async function SiteFooter() {
  const { t } = await getT();
  return (
    <footer className="bg-paper">
      <div className="tile-rule" role="presentation" />
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-mute sm:flex-row sm:items-center sm:justify-between md:px-8">
        <p className="flex items-center gap-2.5"><Mark /><span><span className="font-display font-semibold text-ink">{brand.name}</span> · {t("home.footer", { year: new Date().getFullYear() })}</span></p>
        <nav aria-label="Alt" className="flex gap-5 font-medium">
          <Link href="/gizlilik" className="hover:text-ink">{t("home.privacy")}</Link>
          <Link href="/kosullar" className="hover:text-ink">{t("home.terms")}</Link>
        </nav>
      </div>
    </footer>
  );
}
