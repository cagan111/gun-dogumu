import { afterAll, describe, expect, it } from "vitest";
try { process.loadEnvFile(".env"); } catch { /* optional */ }
import { prisma } from "@/lib/db";
import { cancelByToken } from "@/lib/booking";
const ids: string[] = [];
const now = new Date("2026-11-19T12:00:00Z");
async function fixture() {
  const t = await prisma.tenant.create({ data: { slug: `cancel-race-${crypto.randomUUID()}`, name: "Cancel fixture", city: "Girne", cancelHoursBefore: 2 } }); ids.push(t.id);
  const staff = await prisma.staff.create({ data: { tenantId: t.id, name: "Staff" } });
  const service = await prisma.service.create({ data: { tenantId: t.id, nameTr: "Cut", durationMin: 30, priceTry: "100" } });
  const c = await prisma.customer.create({ data: { tenantId: t.id, name: "Fixture", phone: "+905331234567" } });
  const startsAt = new Date(+now + 4 * 3600_000), end = new Date(+startsAt + 1800_000);
  return prisma.appointment.create({ data: { tenantId: t.id, staffId: staff.id, serviceId: service.id, customerId: c.id, startsAt, endsAt: end, blockedUntil: end, priceTry: "100", cancelToken: crypto.randomUUID(), status: "confirmed" } });
}
function moveAfterRead(id: string, startsAt: Date) {
  let armed = true;
  return prisma.$extends({ query: { appointment: { async findUnique({ args, query }) {
    const snapshot = await query(args);
    if (armed && args.where.cancelToken) {
      armed = false;
      await prisma.appointment.update({ where: { id }, data: { startsAt, endsAt: new Date(+startsAt + 1800_000), blockedUntil: new Date(+startsAt + 1800_000) } });
    }
    return snapshot;
  } } } }) as unknown as typeof prisma;
}
afterAll(async () => { await prisma.tenant.deleteMany({ where: { id: { in: ids } } }); });
describe.skipIf(!process.env.DATABASE_URL)("T115 cancellation/move race (real PostgreSQL)", () => {
  it("stale cancellable read cannot cancel an appointment moved inside deadline", async () => {
    const a = await fixture(); const moved = new Date(+now + 30 * 60_000);
    await expect(cancelByToken(a.cancelToken, now, moveAfterRead(a.id, moved))).rejects.toMatchObject({ code: "conflict" });
    expect(await prisma.appointment.findUnique({ where: { id: a.id } })).toMatchObject({ status: "confirmed", startsAt: moved, cancelledAt: null });
    await expect(cancelByToken(a.cancelToken, now)).rejects.toMatchObject({ code: "cancel_window" });
  });
  it("even an allowed new slot requires a fresh cancellation decision", async () => {
    const a = await fixture(); const moved = new Date(+now + 8 * 3600_000);
    await expect(cancelByToken(a.cancelToken, now, moveAfterRead(a.id, moved))).rejects.toMatchObject({ code: "conflict" });
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("confirmed");
    expect(await cancelByToken(a.cancelToken, now)).toMatchObject({ status: "cancelled_by_customer" });
    await expect(cancelByToken(a.cancelToken, now)).rejects.toMatchObject({ code: "already_closed" });
  });
  it("parallel cancellations still have only one winner", async () => {
    const a = await fixture();
    const result = await Promise.allSettled([cancelByToken(a.cancelToken, now), cancelByToken(a.cancelToken, now)]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = result.find((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected?.reason).toMatchObject({ code: "already_closed" });
  });
  it("a stricter cancellation policy changed after read also invalidates the decision", async () => {
    const a = await fixture(); let armed = true;
    const client = prisma.$extends({ query: { appointment: { async findUnique({ args, query }) {
      const snapshot = await query(args);
      if (armed && args.where.cancelToken) { armed = false; await prisma.tenant.update({ where: { id: a.tenantId }, data: { cancelHoursBefore: 24 } }); }
      return snapshot;
    } } } }) as unknown as typeof prisma;
    await expect(cancelByToken(a.cancelToken, now, client)).rejects.toMatchObject({ code: "conflict" });
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("confirmed");
    await expect(cancelByToken(a.cancelToken, now)).rejects.toMatchObject({ code: "cancel_window" });
  });

});
