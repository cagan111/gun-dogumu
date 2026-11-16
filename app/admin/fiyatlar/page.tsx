import type { Metadata } from "next";
import { getT } from "@/lib/i18n";
import { PricesView } from "../_ui/prices";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("adm.nav.prices")} · ${t("admin.title")}`, robots: { index: false } };
}
export default function Page() {
  return <PricesView />;
}
