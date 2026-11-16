/** Hatırlatma planlama (saf) + randevu değişince tek giriş noktası `onAppointmentChanged`. */
import { getQueue, JOB, type JobQueue } from "../../jobs/queue";
import { prisma } from "../db";

export const ACTIVE_STATUSES = ["pending", "confirmed"] as const;
export const reminderKey = (appointmentId: string, offsetMin: number, startsAt: Date) => `rem:${appointmentId}:${offsetMin}:${startsAt.toISOString()}`;
export const confirmationKey = (appointmentId: string) => `conf:${appointmentId}`;
export const changedKey = (appointmentId: string, startsAt: Date) => `chg:${appointmentId}:${startsAt.toISOString()}`;
export const cancelledKey = (appointmentId: string) => `cxl:${appointmentId}`;

export interface PlannedReminder { offsetMin: number; runAt: Date; key: string }

/** Saf: hangi hatırlatmalar planlanmalı? Aktif olmayan randevu ve zamanı geçmiş ofsetler elenir. */
export function planReminders(
  appt: { id: string; startsAt: Date; status: string },
  tenant: { reminderOffsets: number[] },
  now: Date,
): PlannedReminder[] {
  if (!(ACTIVE_STATUSES as readonly string[]).includes(appt.status)) return [];
  if (appt.startsAt.getTime() <= now.getTime()) return [];
  const seen = new Set<number>();
  const out: PlannedReminder[] = [];
  for (const offsetMin of tenant.reminderOffsets) {
    if (!Number.isInteger(offsetMin) || offsetMin <= 0 || seen.has(offsetMin)) continue;
    seen.add(offsetMin);
    const runAt = new Date(appt.startsAt.getTime() - offsetMin * 60_000);
    if (runAt.getTime() <= now.getTime()) continue; // zamanı geçmiş hatırlatma gönderilmez
    out.push({ offsetMin, runAt, key: reminderKey(appt.id, offsetMin, appt.startsAt) });
  }
  return out.sort((a, b) => a.runAt.getTime() - b.runAt.getTime());
}

/** Saf: sessiz saatte mi? start > end ise gece yarısını aşar (22 → 8). start === end → sessiz saat yok. */
export function isQuietHour(now: Date, timeZone: string, startHour: number, endHour: number): boolean {
  if (startHour === endHour) return false;
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(now));
  return startHour < endHour ? h >= startHour && h < endHour : h >= startHour || h < endHour;
}

import type { AppointmentEvent as ChangeEvent } from "../appointment-hook";

/**
 * Randevu oluşturulunca/taşınınca/iptal edilince/durumu değişince çağrılır.
 * Hatırlatmaları (yeniden) planlar; eski startsAt'li işler anahtarı başka olduğundan ve işleyici kontrol ettiğinden etkisizdir.
 */
export async function onAppointmentChanged(appointmentId: string, event?: ChangeEvent, opts: { now?: Date; queue?: JobQueue } = {}) {
  const now = opts.now ?? new Date();
  const q = opts.queue ?? (await getQueue());
  const a = await prisma.appointment.findUnique({ where: { id: appointmentId }, include: { tenant: { select: { reminderOffsets: true } } } });
  if (!a) return { planned: 0 };
  const base = { appointmentId: a.id, tenantId: a.tenantId };
  if (event === "created") await q.enqueue(JOB.confirmation, { ...base, startsAt: a.startsAt.toISOString() }, { singletonKey: confirmationKey(a.id) });
  if (event === "moved") await q.enqueue(JOB.notice, { ...base, template: "changed_by_salon", startsAt: a.startsAt.toISOString() }, { singletonKey: changedKey(a.id, a.startsAt) });
  if (event === "cancelled_by_salon") await q.enqueue(JOB.notice, { ...base, template: "cancellation", startsAt: a.startsAt.toISOString() }, { singletonKey: cancelledKey(a.id) });
  const plan = planReminders(a, a.tenant, now);
  for (const p of plan) {
    await q.enqueue(JOB.reminder, { ...base, offsetMin: p.offsetMin, startsAt: a.startsAt.toISOString(), key: p.key }, { startAfter: p.runAt, singletonKey: p.key });
  }
  return { planned: plan.length };
}
