import { prisma } from "../../lib/db";
import bcrypt from "bcryptjs";
export async function createCalendarFixture() {
  const id = crypto.randomUUID(), email = `ical-${id}@example.test`;
  const t = await prisma.tenant.create({ data: { slug: `ical-http-${id}`, name: "Calendar fixture", city: "Girne", status: "active" } });
  try {
    const user = await prisma.user.create({ data: { tenantId: t.id, role: "owner", name: "Fixture", email, passwordHash: await bcrypt.hash("CalendarFixture123!", 10) } });
    const staffEmail = `ical-staff-${id}@example.test`;
    const staffUser = await prisma.user.create({ data: { tenantId: t.id, role: "staff", name: "Staff fixture", email: staffEmail, passwordHash: user.passwordHash } });
    const staff = await prisma.staff.create({ data: { tenantId: t.id, name: "Fixture staff", userId: staffUser.id } });
    const svc = await prisma.service.create({ data: { tenantId: t.id, nameTr: "Private service", durationMin: 30, priceTry: "100" } });
    const customer = await prisma.customer.create({ data: { tenantId: t.id, name: "PRIVATE_HTTP_CUSTOMER", phone: "+905331234567", notes: "PRIVATE_HTTP_NOTES" } });
    const appointment = await prisma.appointment.create({ data: { tenantId: t.id, staffId: staff.id, serviceId: svc.id, customerId: customer.id, startsAt: new Date(), endsAt: new Date(Date.now()+1800000), blockedUntil: new Date(Date.now()+1800000), priceTry: "100", cancelToken: crypto.randomUUID() } });
    return { tenantId: t.id, userId: user.id, staffId: staff.id, appointmentId: appointment.id, email, staffEmail };
  } catch (error) { await prisma.tenant.delete({ where: { id: t.id } }); throw error; }
}
export async function cleanupCalendarFixture(f: { tenantId: string; email: string }) {
  // Only delete a matching owned fixture; never sweep demo/e2e prefixes.
  if (!f.email.startsWith("ical-")) throw new Error("fixture mismatch");
  const owner = await prisma.user.findFirst({ where: { tenantId: f.tenantId, email: f.email, role: "owner" } });
  if (!owner) throw new Error("fixture mismatch");
  await prisma.tenant.delete({ where: { id: f.tenantId } });
}

export async function setCalendarFixtureStatus(f: { tenantId: string; email: string }, status: "active" | "suspended") {
  if (!f.email.startsWith("ical-") || !await prisma.user.findFirst({ where: { tenantId: f.tenantId, email: f.email, role: "owner" } })) throw new Error("fixture mismatch");
  await prisma.tenant.update({ where: { id: f.tenantId }, data: { status } });
}

export async function setCalendarFixtureConsent(f: { tenantId: string; email: string; appointmentId: string }) {
  if (!f.email.startsWith("ical-") || !await prisma.user.findFirst({ where: { tenantId: f.tenantId, email: f.email, role: "owner" } })) throw new Error("fixture mismatch");
  const appointment = await prisma.appointment.findFirstOrThrow({ where: { id: f.appointmentId, tenantId: f.tenantId }, select: { customer: { select: { phone: true } } } });
  const { updateVerifiedConsent } = await import("../../lib/customer-consent");
  await updateVerifiedConsent(f.tenantId, appointment.customer.phone, true);
}
export async function inspectCalendarFixtureReview(f: { tenantId: string; email: string; appointmentId: string }) {
  if (!f.email.startsWith("ical-") || !await prisma.user.findFirst({ where: { tenantId: f.tenantId, email: f.email, role: "owner" } })) throw new Error("fixture mismatch");
  const rows = await prisma.reviewInvitation.findMany({ where: { tenantId: f.tenantId, appointmentId: f.appointmentId }, select: { id: true, status: true, finishedReason: true } });
  return { rows, messages: await prisma.messageLog.count({ where: { tenantId: f.tenantId } }), ledgerRows: await prisma.smsLedger.count({ where: { tenantId: f.tenantId } }) };
}
