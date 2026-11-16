/**
 * Bağımlılıksız saat dilimi yardımcıları (Intl tabanlı).
 * "Yerel duvar saati" = IANA bölgesindeki tarih (YYYY-MM-DD) + gün içi dakika (0–1440).
 * DST: olmayan yerel saat (ileri atlama) ileri kaydırılır; çift geçen saat (geri alma) ilk (yaz saati) anına çözülür.
 */

const DAY_MS = 86_400_000;
const fmtCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = fmtCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    fmtCache.set(timeZone, f);
  }
  return f;
}

/** Geçerli IANA bölgesi mi? */
export function isValidTimeZone(timeZone: string): boolean {
  try { formatter(timeZone); return true; } catch { return false; }
}

/** Bölgenin o andaki UTC farkı (ms): yerel duvar saati − UTC. */
export function offsetMs(timeZone: string, utc: Date | number): number {
  const t = typeof utc === "number" ? utc : utc.getTime();
  const sec = Math.floor(t / 1000) * 1000;
  const p: Record<string, number> = {};
  for (const part of formatter(timeZone).formatToParts(sec)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const wall = Date.UTC(p.year ?? 1970, (p.month ?? 1) - 1, p.day ?? 1, p.hour ?? 0, p.minute ?? 0, p.second ?? 0);
  return wall - sec;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDate(date: string): { y: number; m: number; d: number } {
  const mt = DATE_RE.exec(date);
  if (!mt) throw new Error(`Geçersiz tarih: ${date}`);
  const y = Number(mt[1]), m = Number(mt[2]), d = Number(mt[3]);
  const chk = new Date(Date.UTC(y, m - 1, d));
  if (chk.getUTCFullYear() !== y || chk.getUTCMonth() !== m - 1 || chk.getUTCDate() !== d) throw new Error(`Geçersiz tarih: ${date}`);
  return { y, m, d };
}

export function isValidDate(date: string): boolean {
  try { parseDate(date); return true; } catch { return false; }
}

function fmtDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Takvim günü kaydır (DST'den bağımsız, saf takvim aritmetiği). */
export function addDays(date: string, n: number): string {
  const { y, m, d } = parseDate(date);
  return fmtDate(Date.UTC(y, m - 1, d) + n * DAY_MS);
}

/** 0 = Pazar … 6 = Cumartesi. */
export function weekdayOf(date: string): number {
  const { y, m, d } = parseDate(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Yerel tarih + dakika → UTC anı. Dakika 0–1440 dışındaysa gün taşar (örn. 1500 = ertesi gün 01:00). */
export function zonedToUtc(date: string, minutes: number, timeZone: string): Date {
  const shift = Math.floor(minutes / 1440);
  const { y, m, d } = parseDate(shift ? addDays(date, shift) : date);
  const mins = minutes - shift * 1440;
  const wall = Date.UTC(y, m - 1, d) + mins * 60_000;
  const before = offsetMs(timeZone, wall - DAY_MS);
  const after = offsetMs(timeZone, wall + DAY_MS);
  let best: number | null = null;
  for (const off of new Set([before, after])) {
    const u = wall - off;
    if (offsetMs(timeZone, u) === off && (best === null || u < best)) best = u;
  }
  return new Date(best ?? wall - before); // boşluk: ileri kaydır
}

export interface LocalTime { date: string; minutes: number; weekday: number }

/** UTC anının bölgedeki yerel tarihi, gün içi dakikası ve haftanın günü. */
export function utcToLocal(utc: Date, timeZone: string): LocalTime {
  const wall = utc.getTime() + offsetMs(timeZone, utc);
  const dt = new Date(wall);
  return {
    date: fmtDate(wall),
    minutes: dt.getUTCHours() * 60 + dt.getUTCMinutes(),
    weekday: dt.getUTCDay(),
  };
}

/** Yerel günün [başlangıç, bitiş) UTC aralığı (DST günlerinde 23/25 saat olabilir). */
export function dayRangeUtc(date: string, timeZone: string): { start: Date; end: Date } {
  return { start: zonedToUtc(date, 0, timeZone), end: zonedToUtc(addDays(date, 1), 0, timeZone) };
}
