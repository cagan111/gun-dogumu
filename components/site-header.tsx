import Link from "next/link";
import { brand } from "@/config/brand";
import { LangSwitcher } from "./lang-switcher";
import { buttonClass } from "./ui/button";
import { getT } from "@/lib/i18n";

export async function SiteHeader() {
  const { t } = await getT();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-slate-900">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm text-brand-fg">K</span>
          <span className="text-sm sm:text-base">{brand.name}</span>
        </Link>
        <nav aria-label="Ana" className="hidden items-center gap-6 text-sm font-medium text-slate-700 md:flex">
          <a href="/#ozellikler" className="hover:text-slate-950">{t("nav.features")}</a>
          <a href="/#fiyatlar" className="hover:text-slate-950">{t("nav.pricing")}</a>
          <a href="/#sss" className="hover:text-slate-950">{t("nav.faq")}</a>
        </nav>
        <div className="flex items-center gap-2">
          <LangSwitcher />
          <Link href="/giris" className="hidden px-2 text-sm font-medium text-slate-700 hover:text-slate-950 sm:inline">{t("nav.login")}</Link>
          <Link href="/kayit" className={buttonClass("primary", "min-h-9 whitespace-nowrap px-3 text-sm")}>{t("nav.signup")}</Link>
        </div>
      </div>
    </header>
  );
}

export async function SiteFooter() {
  const { t } = await getT();
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <p>{t("home.footer", { year: new Date().getFullYear() })}</p>
        <nav aria-label="Alt" className="flex gap-5">
          <Link href="/gizlilik" className="hover:text-slate-900">{t("home.privacy")}</Link>
          <Link href="/kosullar" className="hover:text-slate-900">{t("home.terms")}</Link>
        </nav>
      </div>
    </footer>
  );
}
