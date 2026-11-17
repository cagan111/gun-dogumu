"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/client";
import { LANG_COOKIE, type Locale } from "@/lib/i18n/shared";

/** TR/EN anahtarı: `lang` çerezini yazar ve sayfayı sunucuda yeniler. */
export function LangSwitcher({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  function pick(l: Locale) {
    if (l === locale) return;
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    start(() => router.refresh());
  }
  return (
    <div role="group" aria-label={t("lang.label")} className={cn("inline-flex rounded-full border border-line-strong bg-bone p-0.5 text-xs font-semibold", pending && "opacity-60", className)}>
      {(["tr", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={locale === l}
          aria-label={t(l === "tr" ? "lang.trFull" : "lang.enFull")}
          onClick={() => pick(l)}
          className={cn("min-h-9 min-w-10 rounded-full px-2.5", locale === l ? "bg-ink text-on-ink" : "text-ink-soft hover:bg-sand")}
        >
          {t(l === "tr" ? "lang.tr" : "lang.en")}
        </button>
      ))}
    </div>
  );
}
