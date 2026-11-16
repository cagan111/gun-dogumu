import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/lib/i18n";

export default async function NotFound() {
  const { t } = await getT();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-5xl font-extrabold text-slate-300" aria-hidden>404</p>
      <h1 className="text-2xl font-bold">{t("b.notFound.title")}</h1>
      <p className="text-slate-700">{t("b.notFound.body")}</p>
      <Link href="/" className={buttonClass("primary", "mt-2")}>{t("b.notFound.home")}</Link>
    </main>
  );
}
