"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/shared";

const pad = (n: number) => String(n).padStart(2, "0");

/** Dakika (0–1440+) → "HH:MM". */
export function fmtMin(m: number): string {
  const x = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(x / 60))}:${pad(x % 60)}`;
}

/** "HH:MM" → dakika; geçersizse null. */
export function parseHM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  return h > 23 || mi > 59 ? null : h * 60 + mi;
}

export const svcName = (s: { nameTr: string; nameEn?: string | null }, locale: Locale) => (locale === "en" && s.nameEn ? s.nameEn : s.nameTr);

export type StatusTone = "slate" | "green" | "amber" | "red" | "sky" | "violet";
export function statusTone(status: string): StatusTone {
  switch (status) {
    case "pending": return "amber";
    case "confirmed": return "sky";
    case "completed": return "green";
    case "no_show": return "red";
    default: return "slate";
  }
}

export const money = (n: number, locale: Locale) => `${new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { maximumFractionDigits: 2 }).format(n)} TL`;

export function fmtDateTime(iso: string | Date, locale: Locale, timeZone: string): string {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(typeof iso === "string" ? new Date(iso) : iso);
}

/** Basit veri yükleyici: bağımlılıklar değişince yeniden çeker; eski yanıtlar yok sayılır. */
export function useLoader<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const reload = useCallback(() => {
    const id = ++seq.current;
    setLoading(true);
    fnRef.current().then(
      (d) => { if (id === seq.current) { setData(d); setError(null); setLoading(false); } },
      (e) => { if (id === seq.current) { setError(e); setLoading(false); } },
    );
  }, []);
  useEffect(reload, deps);
  return { data, error, loading, reload, setData };
}

/** weekday: 0 = Pazar … 6 = Cumartesi (API düzeni). */
export function weekdayName(w: number, locale: Locale): string {
  const d = new Date(Date.UTC(2024, 0, 7 + w, 12));
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { weekday: "long", timeZone: "UTC" }).format(d);
}
/** Pazartesi başlangıçlı gün sırası. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
