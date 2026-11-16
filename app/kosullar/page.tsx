import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("legal.terms.title"), robots: { index: false } };
}
export default function Page() { return <LegalPage doc="terms" />; }
