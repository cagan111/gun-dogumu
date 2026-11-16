import type { Metadata } from "next";
import { Alert } from "@/components/ui/field";
import { getT } from "@/lib/i18n";
import { CalendarView } from "./_ui/calendar";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("panel.title"), robots: { index: false } };
}

export default async function PanelPage({ searchParams }: { searchParams: Promise<{ onboarding?: string }> }) {
  const { t } = await getT();
  const onboarding = (await searchParams).onboarding === "1";
  return (
    <>
      {onboarding ? <Alert tone="info" className="mb-4">{t("panel.onboarding")}</Alert> : null}
      <CalendarView />
    </>
  );
}
