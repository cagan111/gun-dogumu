import { en } from "./en";
import { tr, type Dict, type Key } from "./tr";

export type Locale = "tr" | "en";
export type { Key, Dict };
export const LOCALES: Locale[] = ["tr", "en"];
export const LANG_COOKIE = "lang";
export const DICTS: Record<Locale, Dict> = { tr, en };

export type Params = Record<string, string | number>;
export type TFn = (key: Key, params?: Params) => string;

/** `{ad}` yer tutucularını doldurur. Saf; istemci ve sunucuda ortak. */
export function translate(locale: Locale, key: Key, params?: Params): string {
  let s: string = DICTS[locale][key] ?? tr[key];
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function isLocale(v: unknown): v is Locale {
  return v === "tr" || v === "en";
}

/** Accept-Language başlığından en uygun dili seçer (varsayılan tr). */
export function pickFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return "tr";
  const parts = header
    .split(",")
    .map((p) => {
      const [tag = "", q] = p.trim().split(";q=");
      return { lang: tag.toLowerCase().split("-")[0] ?? "", q: q ? Number(q) : 1 };
    })
    .filter((p) => !Number.isNaN(p.q))
    .sort((a, b) => b.q - a.q);
  for (const p of parts) if (isLocale(p.lang)) return p.lang;
  return "tr";
}
