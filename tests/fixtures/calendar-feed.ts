import { prisma } from "../../lib/db";
import bcrypt from "bcryptjs";
export async function createCalendarFixture() {
  const id = crypto.randomUUID(), email = `ical-${id}@example.test`;
  const t = await prisma.tenant.create({ data: { slug: `ical-http-${id}`, name: "Calendar fixture", city: "Girne", status: "active" } });
  try {
    const user = await prisma.user.create({ data: { tenantId: t.id, role: "owner", name: "Fixture", email, passwordHash: await bcrypt.hash("CalendarFixture123!", 10) } });
    const staff = await prisma.staff.create({ data: { tenantId: t.id, name: "Fixture staff" } });
    const svc = await prisma.service.create({ data: { tenantId: t.id, nameTr: "Private service", durationMin: 30, priceTry: "100" } });
    const customer = await prisma.customer.create({ data: { tenantId: t.id, name: "PRIVATE_HTTP_CUSTOMER", phone: "+905331234567", notes: "PRIVATE_HTTP_NOTES" } });
    await prisma.appointment.create({ data: { tenantId: t.id, staffId: staff.id, serviceId: svc.id, customerId: customer.id, startsAt: new Date(), endsAt: new Date(Date.now()+1800000), blockedUntil: new Date(Date.now()+1800000), priceTry: "100", cancelToken: crypto.randomUUID() } });
    return { tenantId: t.id, userId: user.id, staffId: staff.id, email };
  } catch (error) { await prisma.tenant.delete({ where: { id: t.id } }); throw error; }
}
export async function cleanupCalendarFixture(f: { tenantId: string; email: string }) {
  // Only delete a matching owned fixture; never sweep demo/e2e prefixes.
  if (!f.email.startsWith("ical-")) throw new Error("fixture mismatch");
  const owner = await prisma.user.findFirst({ where: { tenantId: f.tenantId, email: f.email, role: "owner" } });
  if (!owner) throw new Error("fixture mismatch");
  await prisma.tenant.delete({ where: { id: f.tenantId } });
}
