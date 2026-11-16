import { prisma, withTenant } from "./db";
import { cancelByToken, NotFoundError } from "./booking";

/** Token ile randevu özeti. Token global benzersizdir; tenant bulunduktan sonra sorgu withTenant ile yapılır. */
export async function getAppointmentByToken(token: string, now: Date = new Date()) {
  if (!token || token.length < 16 || token.length > 100) throw new NotFoundError("Randevu");
  const ref = await prisma.appointment.findUnique({ where: { cancelToken: token }, select: { id: true, tenantId: true } });
  if (!ref) throw new NotFoundError("Randevu");
  const db = withTenant(ref.tenantId);
  const a = await db.appointment.findFirst({
    where: { id: ref.id },
    include: { service: true, staff: { select: { name: true } }, customer: { select: { name: true } } },
  });
  const t = await prisma.tenant.findUnique({ where: { id: ref.tenantId } });
  if (!a || !t) throw new NotFoundError("Randevu");
  const active = a.status === "pending" || a.status === "confirmed";
  const deadline = new Date(a.startsAt.getTime() - t.cancelHoursBefore * 3_600_000);
  return {
    id: a.id,
    status: a.status,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    service: { nameTr: a.service.nameTr, nameEn: a.service.nameEn, durationMin: a.service.durationMin },
    priceTry: Number(a.priceTry),
    staffName: a.staff.name,
    customerName: a.customer.name,
    salon: { name: t.name, slug: t.slug, phone: t.phone, address: t.address, timeZone: t.timeZone },
    cancelHoursBefore: t.cancelHoursBefore,
    cancelDeadline: deadline.toISOString(),
    cancellable: active && now.getTime() <= deadline.getTime(),
  };
}

export async function cancelAppointment(token: string, now: Date = new Date()) {
  const a = await cancelByToken(token, now);
  return { id: a.id, status: a.status, cancelledAt: a.cancelledAt?.toISOString() ?? null };
}
