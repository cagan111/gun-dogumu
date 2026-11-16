import { z } from "zod";
import { NotFoundError } from "../booking";
import { ValidationError } from "../errors";
import type { PanelCtx } from "../panel-auth";
import { assertFeature } from "../plan";
import { dayRangeUtc } from "../time";

export const reportQuerySchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "invalid_month") });

/** Ayın [başlangıç, sonraki ay başı) aralığı, salon saat diliminde. */
export function monthRangeUtc(month: string, timeZone: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { start: dayRangeUtc(`${month}-01`, timeZone).start, end: dayRangeUtc(`${next}-01`, timeZone).start };
}

/** Pro+ raporu: durum dağılımı, ciro tahmini (tamamlanan + geçmiş onaylı), en çok hizmet/personel, gelmeme oranı. */
export async function monthlyReport(ctx: PanelCtx, month: string, now: Date = new Date()) {
  const t = await ctx.db.tenant.findUnique({ where: { id: ctx.tenantId }, select: { plan: true, timeZone: true } });
  if (!t) throw new NotFoundError("Salon");
  assertFeature(t.plan, "reports");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new ValidationError("Geçersiz ay", "month");
  const range = monthRangeUtc(month, t.timeZone);
  const inMonth = { startsAt: { gte: range.start, lt: range.end } };
  const counted = { ...inMonth, OR: [{ status: "completed" as const }, { status: "confirmed" as const, startsAt: { lt: now, gte: range.start } }] };

  const [byStatus, revenue, bySvc, byStaff] = await Promise.all([
    ctx.db.appointment.groupBy({ by: ["status"], where: inMonth, _count: { _all: true } }),
    ctx.db.appointment.aggregate({ where: counted, _sum: { priceTry: true }, _count: { _all: true } }),
    ctx.db.appointment.groupBy({ by: ["serviceId"], where: counted, _count: { _all: true }, _sum: { priceTry: true }, orderBy: { _count: { serviceId: "desc" } }, take: 5 }),
    ctx.db.appointment.groupBy({ by: ["staffId"], where: counted, _count: { _all: true }, _sum: { priceTry: true }, orderBy: { _count: { staffId: "desc" } }, take: 5 }),
  ]);
  const [services, staff] = await Promise.all([
    ctx.db.service.findMany({ where: { id: { in: bySvc.map((r) => r.serviceId) } }, select: { id: true, nameTr: true, nameEn: true } }),
    ctx.db.staff.findMany({ where: { id: { in: byStaff.map((r) => r.staffId) } }, select: { id: true, name: true } }),
  ]);
  const counts: Record<string, number> = { pending: 0, confirmed: 0, cancelled_by_customer: 0, cancelled_by_salon: 0, completed: 0, no_show: 0 };
  let total = 0;
  for (const r of byStatus) { counts[r.status] = r._count._all; total += r._count._all; }
  const attended = (counts.completed ?? 0) + (counts.no_show ?? 0);
  return {
    month, timeZone: t.timeZone, total, byStatus: counts,
    revenueTry: Number(revenue._sum.priceTry ?? 0), revenueAppointments: revenue._count._all,
    topServices: bySvc.map((r) => ({ serviceId: r.serviceId, name: services.find((s) => s.id === r.serviceId)?.nameTr ?? "", nameEn: services.find((s) => s.id === r.serviceId)?.nameEn ?? null, count: r._count._all, revenueTry: Number(r._sum.priceTry ?? 0) })),
    topStaff: byStaff.map((r) => ({ staffId: r.staffId, name: staff.find((s) => s.id === r.staffId)?.name ?? "", count: r._count._all, revenueTry: Number(r._sum.priceTry ?? 0) })),
    noShowRate: attended === 0 ? 0 : (counts.no_show ?? 0) / attended,
  };
}
