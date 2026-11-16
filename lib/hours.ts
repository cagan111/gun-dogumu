import { z } from "zod";
import { ValidationError } from "./errors";

export const MAX_END_MIN = 1800; // gece yarısını aşan vardiya için (ertesi gün 06:00'a kadar)

export const workingDaySchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startMin: z.number().int().min(0).max(1439),
  endMin: z.number().int().min(1).max(MAX_END_MIN),
  breaks: z.array(z.tuple([z.number().int(), z.number().int()])).max(5).default([]),
});
export type WorkingDay = z.output<typeof workingDaySchema>;

export const workingHoursSchema = z.object({ days: z.array(workingDaySchema).max(7) });

/** Saf doğrulama: gün tekrarı yok, bitiş > başlangıç, molalar saat içinde ve çakışmasız (sıralanır). */
export function validateWorkingDays(days: WorkingDay[]): WorkingDay[] {
  const seen = new Set<number>();
  return days.map((d) => {
    if (seen.has(d.weekday)) throw new ValidationError(`Gün ${d.weekday} birden fazla`, "days");
    seen.add(d.weekday);
    if (d.endMin <= d.startMin) throw new ValidationError("Bitiş başlangıçtan sonra olmalı", "endMin");
    if (d.endMin - d.startMin > 1440) throw new ValidationError("Vardiya 24 saati aşamaz", "endMin");
    const breaks = [...d.breaks].sort((a, b) => a[0] - b[0]);
    let prevEnd = d.startMin;
    for (const [s, e] of breaks) {
      if (e <= s) throw new ValidationError("Mola bitişi başlangıçtan sonra olmalı", "breaks");
      if (s < d.startMin || e > d.endMin) throw new ValidationError("Mola çalışma saatleri içinde olmalı", "breaks");
      if (s < prevEnd) throw new ValidationError("Molalar çakışamaz", "breaks");
      prevEnd = e;
    }
    return { ...d, breaks };
  });
}
