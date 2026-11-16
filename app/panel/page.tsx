import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { Alert } from "@/components/ui/field";
import { prisma } from "@/lib/db";
import { getT } from "@/lib/i18n";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("panel.title"), robots: { index: false } };
}

/** YER TUTUCU — gerçek panel (T-034…T-042) başka ajan tarafından yazılacak. */
export default async function PanelPage({ searchParams }: { searchParams: Promise<{ onboarding?: string }> }) {
  const { t } = await getT();
  const session = await auth();
  const tenant = session?.user.tenantId ? await prisma.tenant.findUnique({ where: { id: session.user.tenantId }, select: { slug: true, name: true } }) : null;
  const onboarding = (await searchParams).onboarding === "1";
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-extrabold">{t("panel.title")}</h1>
      <p className="mt-1 text-slate-700">{t("panel.welcome", { name: session?.user.name ?? "" })}</p>
      {onboarding ? <Alert tone="info" className="mt-4">{t("panel.onboarding")}</Alert> : null}
      <p className="mt-4 text-slate-700">{t("panel.soon")}</p>
      {tenant ? <p className="mt-4"><Link className="font-semibold text-brand underline" href={`/${tenant.slug}`}>{t("panel.publicPage")}: /{tenant.slug}</Link></p> : null}
      <div className="mt-6"><LogoutButton label={t("panel.logout")} /></div>
    </main>
  );
}
