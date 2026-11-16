import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { getT } from "@/lib/i18n";
import { safeNext } from "@/lib/safe-next";
import { LoginForms } from "./login-forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("login.title"), robots: { index: false } };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { t } = await getT();
  const next = safeNext((await searchParams).next);
  return (
    <AuthShell title={t("login.title")} sub={t("login.sub")}>
      <LoginForms next={next} />
    </AuthShell>
  );
}
