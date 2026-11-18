"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LangSwitcher } from "@/components/lang-switcher";
import { ToastProvider } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import type { Key } from "@/lib/i18n/shared";
import { LogoutButton } from "../../panel/logout-button";

const NAV: { href: string; key: Key }[] = [
  { href: "/admin", key: "adm.nav.tenants" },
  { href: "/admin/sms", key: "adm.nav.sms" },
  { href: "/admin/fiyatlar", key: "adm.nav.prices" },
  { href: "/admin/denetim", key: "adm.nav.audit" },
];

export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const t = useT();
  const path = usePathname();
  const active = (h: string) => (h === "/admin" ? path === "/admin" || path.startsWith("/admin/salon") : path.startsWith(h));
  return (
    <ToastProvider>
      <div className="min-h-dvh bg-paper">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[80] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">{t("common.skipToContent")}</a>
        <header className="sticky top-0 z-30 border-b border-line bg-surface">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
            <h1 className="display-heading text-xl font-semibold text-sea">{t("admin.title")}</h1>
            <span className="hidden truncate text-xs text-slate-600 sm:inline">{email}</span>
            <span className="flex-1" />
            <LangSwitcher />
            <LogoutButton label={t("panel.logoutShort")} compact />
          </div>
          <nav aria-label={t("adm.nav.label")} className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined} className={cn("flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-semibold", active(n.href) ? "border-brand text-brand" : "border-transparent text-slate-700 hover:text-slate-900")}>{t(n.key)}</Link>
            ))}
          </nav>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-3 py-4 md:px-4">{children}</main>
      </div>
    </ToastProvider>
  );
}
