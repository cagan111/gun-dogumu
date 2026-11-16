import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Alert } from "@/components/ui/field";
import { getT, type Key } from "@/lib/i18n";

/** Taslak hukuk metni şablonu (T-072). Bölümler sözlükte `legal.<doc>.sN.t/.b`. */
export async function LegalPage({ doc }: { doc: "privacy" | "terms" }) {
  const { t, locale } = await getT();
  const date = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { dateStyle: "long", timeZone: "Asia/Famagusta" }).format(new Date("2026-11-17"));
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Alert tone="info" className="mb-6"><strong className="block">{t("legal.draft")}</strong>{t("legal.draftNote")}</Alert>
        <h1 className="text-3xl font-extrabold">{t(`legal.${doc}.title` as Key)}</h1>
        <p className="mt-1 text-sm text-slate-600">{t("legal.updated", { date })}</p>
        <p className="mt-5 text-slate-800">{t(`legal.${doc}.intro` as Key)}</p>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <section key={n} className="mt-7">
            <h2 className="text-lg font-bold">{n}. {t(`legal.${doc}.s${n}.t` as Key)}</h2>
            <p className="mt-1.5 text-slate-800">{t(`legal.${doc}.s${n}.b` as Key)}</p>
          </section>
        ))}
      </main>
      <SiteFooter />
    </>
  );
}
