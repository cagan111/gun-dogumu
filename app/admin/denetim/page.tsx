import type { Metadata } from "next";
import { getT } from "@/lib/i18n";
import { AuditView } from "../_ui/audit";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("adm.nav.audit")} · ${t("admin.title")}`, robots: { index: false } };
}
export default function Page() {
  return <AuditView />;
}
