"use client";
import { createContext, useCallback, useContext, useMemo } from "react";
import { translate, type Key, type Locale, type Params, type TFn } from "./shared";

interface Ctx { locale: Locale; t: TFn }
const I18nContext = createContext<Ctx>({ locale: "tr", t: (k, p) => translate("tr", k, p) });

/** Sunucudan gelen dili istemci bileşenlerine taşır. */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const t = useCallback((key: Key, params?: Params) => translate(locale, key, params), [locale]);
  const value = useMemo(() => ({ locale, t }), [locale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
export const useT = () => useContext(I18nContext).t;
