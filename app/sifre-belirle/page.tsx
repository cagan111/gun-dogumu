import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { getT } from "@/lib/i18n";
import { SetPasswordForm } from "./set-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("setpw.title"), robots: { index: false, follow: false } };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { t } = await getT();
  const token = (await searchParams).token ?? "";
  return (
    <AuthShell title={t("setpw.title")}>
      <SetPasswordForm token={token} />
    </AuthShell>
  );
}
