import type { Metadata } from "next";
import { getT } from "@/lib/i18n";
import type { Key } from "@/lib/i18n/shared";

/** Panel sayfaları için başlık (arama motoruna kapalı). */
export function panelMeta(key: Key) {
  return async function generateMetadata(): Promise<Metadata> {
    const { t } = await getT();
    return { title: `${t(key)} · ${t("panel.title")}`, robots: { index: false } };
  };
}
