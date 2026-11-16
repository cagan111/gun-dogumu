import type { Metadata } from "next";
import { getT } from "@/lib/i18n";
import { TenantDetailView } from "../../_ui/detail";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("adm.tenant")} · ${t("admin.title")}`, robots: { index: false } };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <TenantDetailView id={(await params).id} />;
}
