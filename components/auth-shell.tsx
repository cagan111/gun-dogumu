import Link from "next/link";
import { brand } from "@/config/brand";
import { LangSwitcher } from "./lang-switcher";
import { getT } from "@/lib/i18n";

/** Giriş/kayıt sayfaları için ortalanmış kart iskeleti. */
export async function AuthShell({ title, sub, children, wide }: { title: string; sub?: string; children: React.ReactNode; wide?: boolean }) {
  const { t } = await getT();
  return (
    <div className="min-h-screen bg-gradient-to-b from-sand to-paper">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 pt-4">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm text-brand-fg">K</span>
          <span>{brand.name}</span>
        </Link>
        <LangSwitcher />
      </div>
      <main className={`mx-auto px-4 pb-12 pt-8 ${wide ? "max-w-lg" : "max-w-md"}`}>
        <div className="rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-extrabold">{title}</h1>
          {sub ? <p className="mt-1 text-sm text-slate-700">{sub}</p> : null}
          <div className="mt-5">{children}</div>
        </div>
        <p className="mt-4 text-center text-sm"><Link href="/" className="text-slate-600 underline">{t("login.home")}</Link></p>
      </main>
    </div>
  );
}
