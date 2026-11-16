/**
 * Müsaitlik motoru — saf fonksiyon, veritabanı yok.
 * Yerel duvar saati (tenant.timeZone) ile çalışır; çalışma saatleri dakika cinsinden, hafta günü 0 = Pazar.
 * endMin > 1440 → vardiya ertesi güne taşar (örn. 20:00–02:00 = 1200–1560).
 */
import { addDays, utcToLocal, weekdayOf, zonedToUtc } from "./time";

export interface WorkingHoursInput {
  weekday: number;
  startMin: number;
  endMin: number;
  breaks: [number, number][];
}
export interface TimeOffInput { startsAt: Date; endsAt: Date }
export interface StaffAvailabilityInput {
  id: string;
  workingHours: WorkingHoursInput[];
  timeOff: TimeOffInput[];
}
export interface BusyInput { staffId: string; startsAt: Date; blockedUntil: Date }

export interface AvailabilityInput {
  tenant: { timeZone: string; slotMinutes: number; minLeadMinutes: number; maxAdvanceDays: number };
  service: { durationMin: number; bufferMin: number };
  /** Tek personel için tek elemanlı, "fark etmez" için hepsi (sonuç birleşimdir). */
  staff: StaffAvailabilityInput[];
  /** Yalnız aktif (pending/confirmed) randevular. */
  busy: BusyInput[];
  /** Yerel tarih, YYYY-MM-DD. */
  date: string;
  now: Date;
}
export interface Slot { start: Date; staffIds: string[] }

const MIN = 60_000;

function overlaps(aS: number, aE: number, bS: number, bE: number): boolean {
  return aS < bE && bS < aE;
}

export function computeAvailability(input: AvailabilityInput): Slot[] {
  const { tenant, service, staff, busy, date, now } = input;
  const tz = tenant.timeZone;
  const today = utcToLocal(now, tz).date;
  if (date < today || date > addDays(today, tenant.maxAdvanceDays)) return [];

  const earliest = now.getTime() + tenant.minLeadMinutes * MIN;
  const step = Math.max(1, Math.floor(tenant.slotMinutes));
  const need = (service.durationMin + service.bufferMin) * MIN;
  const found = new Map<number, string[]>();

  for (const st of staff) {
    const blockers: [number, number][] = [];
    for (const b of busy) if (b.staffId === st.id) blockers.push([b.startsAt.getTime(), b.blockedUntil.getTime()]);
    for (const o of st.timeOff) blockers.push([o.startsAt.getTime(), o.endsAt.getTime()]);

    // Önceki günden taşan vardiya (-1) ve bugünkü vardiya (0)
    for (const shiftOffset of [-1, 0]) {
      const shiftDate = addDays(date, shiftOffset);
      const wd = weekdayOf(shiftDate);
      for (const wh of st.workingHours) {
        if (wh.weekday !== wd || wh.endMin <= wh.startMin) continue;
        if (shiftOffset === -1 && wh.endMin <= 1440) continue;
        const winEnd = zonedToUtc(shiftDate, wh.endMin, tz).getTime();
        const breaks = wh.breaks.map(([s, e]) => [zonedToUtc(shiftDate, s, tz).getTime(), zonedToUtc(shiftDate, e, tz).getTime()] as const);

        for (let m = wh.startMin; m < wh.endMin; m += step) {
          const dayShift = Math.floor(m / 1440);
          if (addDays(shiftDate, dayShift) !== date) continue; // slot başka bir yerel güne düşüyor
          const start = zonedToUtc(shiftDate, m, tz);
          if (utcToLocal(start, tz).minutes !== m - dayShift * 1440) continue; // DST boşluğunda olmayan saat
          const s = start.getTime();
          const e = s + need;
          if (s < earliest || e > winEnd) continue;
          if (breaks.some(([bs, be]) => overlaps(s, e, bs, be))) continue;
          if (blockers.some(([bs, be]) => overlaps(s, e, bs, be))) continue;
          const list = found.get(s);
          if (!list) found.set(s, [st.id]);
          else if (!list.includes(st.id)) list.push(st.id);
        }
      }
    }
  }

  return [...found.entries()].sort((a, b) => a[0] - b[0]).map(([s, ids]) => ({ start: new Date(s), staffIds: ids }));
}
