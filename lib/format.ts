import type { Locale } from "./i18n/shared";

const loc = (l: Locale) => (l === "tr" ? "tr-TR" : "en-GB");

export const formatPrice = (n: number, l: Locale) =>
  `${new Intl.NumberFormat(loc(l), { maximumFractionDigits: 0 }).format(n)} TL`;

/** "Cuma 20 Kasım, 15:30" (salon saat diliminde). */
export function formatWhen(iso: string | Date, l: Locale, timeZone: string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const date = new Intl.DateTimeFormat(loc(l), { weekday: "long", day: "numeric", month: "long", timeZone }).format(d);
  const time = new Intl.DateTimeFormat(loc(l), { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(d);
  return `${date}, ${time}`;
}

/** YYYY-MM-DD → kısa gün adı / gün / ay (saat dilimi etkisiz: öğlen UTC). */
export function dayParts(date: string, l: Locale) {
  const d = new Date(`${date}T12:00:00Z`);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(loc(l), { ...o, timeZone: "UTC" }).format(d);
  return { weekday: f({ weekday: "short" }), day: f({ day: "numeric" }), month: f({ month: "short" }), long: f({ weekday: "long", day: "numeric", month: "long" }) };
}

export const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toLocaleUpperCase("tr-TR") ?? "").join("");

export function mapsUrl(parts: (string | null | undefined)[]): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.filter(Boolean).join(" "))}`;
}
