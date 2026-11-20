import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/db";
import { getSlots } from "../../lib/public";
import { addDays, utcToLocal } from "../../lib/time";

export interface PanelCalendarFixture {
  tenantId: string;
  customerId: string;
  appointmentIds: string[];
}

/** Creates fresh confirmed appointments in the demo salon using its real availability. */
export async function createPanelCalendarFixture(slug: string): Promise<PanelCalendarFixture> {
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, timeZone: true } });
  if (!tenant) throw new Error("Panel calendar fixture tenant not found");

  const service = await prisma.service.findFirst({
    where: { tenantId: tenant.id, active: true, staff: { some: { staff: { active: true } } } },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  if (!service) throw new Error("Panel calendar fixture service not found");

  let phone = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    phone = `+90533${randomInt(0, 10_000_000).toString().padStart(7, "0")}`;
    if (!(await prisma.customer.findUnique({ where: { tenantId_phone: { tenantId: tenant.id, phone } }, select: { id: true } }))) break;
    phone = "";
  }
  if (!phone) throw new Error("Could not allocate fixture phone");

  const customerId = randomUUID();
  const appointmentIds: string[] = [];
  const fixture = { tenantId: tenant.id, customerId, appointmentIds };
  try {
    await prisma.customer.create({
      data: { id: customerId, tenantId: tenant.id, name: `Panel Calendar ${randomUUID()}`, phone, locale: "tr" },
    });

    const now = new Date();
    const localToday = utcToLocal(now, tenant.timeZone).date;
    const usedDates = new Set<string>();
    for (let day = 1; day <= 19 && appointmentIds.length < 3; day++) {
      const date = addDays(localToday, day);
      const slots = await getSlots(slug, { serviceId: service.id, staffId: "any", date }, new Date());
      const available = slots.slots.find((slot) => slot.staffIds.length > 0);
      if (!available || usedDates.has(date)) continue;

      const startsAt = new Date(available.startsAt);
      const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);
      const blockedUntil = new Date(endsAt.getTime() + service.bufferMin * 60_000);
      const id = randomUUID();
      // Include the reserved id before the write so a lost DB response can still be cleaned up.
      appointmentIds.push(id);
      await prisma.appointment.create({
        data: {
          id,
          tenantId: tenant.id,
          customerId,
          serviceId: service.id,
          staffId: available.staffIds[0]!,
          startsAt,
          endsAt,
          blockedUntil,
          status: "confirmed",
          source: "panel",
          cancelToken: randomBytes(24).toString("base64url"),
          priceTry: service.priceTry,
        },
      });
      usedDates.add(date);
    }

    if (appointmentIds.length !== 3) throw new Error(`Only ${appointmentIds.length} available fixture dates found in next 19 days`);
    return fixture;
  } catch (error) {
    await cleanupPanelCalendarFixture(fixture);
    throw error;
  }
}

/** Removes only this fixture's appointment jobs, appointments, and customer. */
export async function cleanupPanelCalendarFixture(fixture: PanelCalendarFixture): Promise<void> {
  const ids = [...new Set(fixture.appointmentIds)];
  try {
    if (ids.length > 0) {
      const table = await prisma.$queryRaw<{ exists: boolean }[]>(Prisma.sql`SELECT to_regclass('pgboss.job') IS NOT NULL AS exists`);
      if (table[0]?.exists) await prisma.$executeRaw(Prisma.sql`DELETE FROM pgboss.job WHERE data->>'appointmentId' IN (${Prisma.join(ids)})`);
    }
  } finally {
    try {
      if (ids.length > 0) await prisma.appointment.deleteMany({ where: { id: { in: ids }, tenantId: fixture.tenantId, customerId: fixture.customerId } });
    } finally {
      await prisma.customer.deleteMany({ where: { id: fixture.customerId, tenantId: fixture.tenantId } });
    }
  }
}
