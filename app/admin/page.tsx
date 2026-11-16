import type { Metadata } from "next";
import { getT } from "@/lib/i18n";
import { LogoutButton } from "../panel/logout-button";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("admin.title"), robots: { index: false } };
}

/** YER TUTUCU — gerçek süper-admin ekranları (T-061) başka ajan tarafından yazılacak. */
export default async function AdminPage() {
  const { t } = await getT();
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-extrabold">{t("admin.title")}</h1>
      <p className="mt-2 text-slate-700">{t("admin.soon")}</p>
      <div className="mt-6"><LogoutButton label={t("panel.logout")} /></div>
    </main>
  );
}
