import { cookies, headers } from "next/headers";
import { LANG_COOKIE, isLocale, pickFromAcceptLanguage, translate, type Locale, type TFn } from "./shared";

export * from "./shared";

/** Sunucu bileşenlerinde dil: önce `lang` çerezi, sonra Accept-Language, varsayılan tr. */
export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLocale(c)) return c;
  return pickFromAcceptLanguage((await headers()).get("accept-language"));
}

/** Sunucu bileşeni yardımcısı: `const { t, locale } = await getT()`. */
export async function getT(): Promise<{ t: TFn; locale: Locale }> {
  const locale = await getLocale();
  return { locale, t: (key, params) => translate(locale, key, params) };
}
