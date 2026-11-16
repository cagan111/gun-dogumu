import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { getT } from "@/lib/i18n";
import { SignupWizard } from "./signup-wizard";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("signup.title") };
}

export default async function Page() {
  const { t } = await getT();
  return (
    <AuthShell title={t("signup.title")} wide>
      <SignupWizard />
    </AuthShell>
  );
}
