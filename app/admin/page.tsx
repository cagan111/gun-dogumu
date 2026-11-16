import type { Metadata } from "next";
import { getT } from "@/lib/i18n";
import { TenantsView } from "./_ui/tenants";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("admin.title"), robots: { index: false } };
}
export default function AdminPage() {
  return <TenantsView />;
}
