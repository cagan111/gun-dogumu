"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LangSwitcher } from "@/components/lang-switcher";
import { Badge } from "@/components/ui/form";
import { ToastProvider } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import type { Key } from "@/lib/i18n/shared";
import { LogoutButton } from "../logout-button";
import { PanelProvider, usePanel, type PanelInfo } from "./ctx";

const NAV: { href: string; key: Key; icon: string }[] = [
  { href: "/panel", key: "nav.calendar", icon: "M7 2v3M17 2v3M3.5 9h17M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" },
  { href: "/panel/musteriler", key: "nav.customers", icon: "M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.2a3.5 3.5 0 0 1 0 6.6" },
  { href: "/panel/hizmetler", key: "nav.services", icon: "M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM8.1 7.9 20 18M8.1 16.1 20 6" },
  { href: "/panel/personel", key: "nav.staff", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20a8 8 0 0 1 16 0" },
  { href: "/panel/raporlar", key: "nav.reports", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/panel/ayarlar", key: "nav.settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" },
];

function Icon({ d }: { d: string }) {
  return <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

function StatusBadge() {
  const { tenant } = usePanel();
  const t = useT();
  const d = tenant.daysLeft;
  if (tenant.status === "suspended") return <Badge tone="red">{t("sub.suspended")}</Badge>;
  if (tenant.status === "past_due") return <Badge tone="red">{t("sub.pastDue")}</Badge>;
  if (tenant.status === "trial") return <Badge tone={d !== null && d <= 3 ? "amber" : "sky"}>{d === null ? t("sub.trial") : t("sub.trialLeft", { n: Math.max(d, 0) })}</Badge>;
  return <Badge tone="green">{d === null ? tenant.planName : t("sub.activeLeft", { plan: tenant.planName, n: Math.max(d, 0) })}</Badge>;
}

function SmsChip() {
  const { balance } = usePanel();
  const t = useT();
  return (
    <Link href="/panel/ayarlar#sms" className={cn("inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-semibold", balance !== null && balance <= 10 ? "border-red-300 bg-red-50 text-red-800" : "border-slate-300 bg-white text-slate-800")} aria-label={t("sms.chip", { n: balance ?? "…" })}>
      <span aria-hidden>✉</span>&nbsp;{balance ?? "…"} SMS
    </Link>
  );
}

function MobileMenu() {
  const t = useT();
  const { tenant } = usePanel();
  const alert = tenant.status === "past_due" || tenant.status === "suspended" || (tenant.status === "trial" && tenant.daysLeft !== null && tenant.daysLeft <= 3);
  return (
    <details className="relative">
      <summary aria-label={t("panel.menu")} className="relative flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-bold leading-none text-slate-800 [&::-webkit-details-marker]:hidden">
        <span aria-hidden>⋯</span>
        {alert ? <span aria-hidden className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" /> : null}
      </summary>
      <div className="absolute right-0 top-11 z-50 w-60 space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
        <StatusBadge />
        <div><LangSwitcher /></div>
        <LogoutButton label={t("panel.logoutShort")} compact />
      </div>
    </details>
  );
}

function Inner({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const t = useT();
  const { tenant, role } = usePanel();
  const nav = role === "owner" ? NAV : NAV.slice(0, 1); // personel: yalnız takvim + randevu durumu
  const active = (href: string) => (href === "/panel" ? path === "/panel" : path.startsWith(href));
  return (
    <div className="min-h-dvh bg-slate-50 md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[80] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">{t("common.skipToContent")}</a>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="truncate text-lg font-extrabold">{tenant.name}</p>
          <p className="text-xs text-slate-600">{role === "owner" ? t("role.owner") : t("role.staff")}</p>
        </div>
        <nav aria-label={t("nav.label")} className="flex-1 space-y-1 p-3">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold", active(n.href) ? "bg-brand text-brand-fg" : "text-slate-700 hover:bg-slate-100")}>
              <Icon d={n.icon} />{t(n.key)}
            </Link>
          ))}
        </nav>
        <div className="space-y-3 border-t border-slate-200 p-4">
          <Link href={`/${tenant.slug}`} target="_blank" className="block text-sm font-semibold text-brand underline">{t("panel.publicPage")}</Link>
          <LogoutButton label={t("panel.logout")} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-3 py-1.5 backdrop-blur md:flex md:items-center md:justify-end md:gap-3 md:px-4 md:py-2">
          {/* mobil: tek kompakt satır — salon adı · SMS · menü (durum rozeti, dil, çıkış menüde) */}
          <div className="flex items-center gap-2 md:hidden">
            <h1 className="min-w-0 flex-1 truncate text-base font-extrabold">{tenant.name}</h1>
            <SmsChip />
            <MobileMenu />
          </div>
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            <StatusBadge />
            <SmsChip />
            <LangSwitcher />
          </div>
        </header>
        {tenant.status === "suspended" ? <p role="alert" className="bg-red-700 px-4 py-2 text-sm font-medium text-white">{t("sub.suspendedNote")}</p> : null}
        <main id="main" className="flex-1 px-3 py-4 pb-28 md:px-6 md:pb-8">{children}</main>
      </div>
      <nav aria-label={t("nav.label")} style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }} className="fixed inset-x-0 bottom-0 z-40 grid border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined} className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] font-semibold", active(n.href) ? "text-brand" : "text-slate-600")}>
            <Icon d={n.icon} />
            <span className="max-w-full truncate">{t(n.key)}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PanelShell({ info, children }: { info: PanelInfo; children: React.ReactNode }) {
  return (
    <PanelProvider info={info}>
      <ToastProvider><Inner>{children}</Inner></ToastProvider>
    </PanelProvider>
  );
}
