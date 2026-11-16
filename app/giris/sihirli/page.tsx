import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { getT } from "@/lib/i18n";
import { MagicSignIn } from "./magic-sign-in";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("login.title"), robots: { index: false, follow: false } };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { t } = await getT();
  const token = (await searchParams).token ?? "";
  return (
    <AuthShell title={t("login.magicTitle")}>
      <MagicSignIn token={token} />
    </AuthShell>
  );
}
