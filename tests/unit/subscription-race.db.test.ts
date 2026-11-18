import { afterAll, describe, expect, it } from "vitest";
try { process.loadEnvFile(".env"); } catch { /* optional */ }
import { prisma } from "@/lib/db";
import { applySubscriptionTick } from "@/lib/billing/subscription";
import { recordManualPayment } from "@/lib/billing/payments";
const ids: string[] = [];
const now = new Date("2026-11-18T12:00:00Z");
async function salon(data: { status: "active" | "trial"; subscriptionEndsAt?: Date; trialEndsAt?: Date }) {
  const t = await prisma.tenant.create({ data: { slug: `tick-race-${crypto.randomUUID()}`, name: "Tick race", city: "Girne", ...data } }); ids.push(t.id); return t.id;
}
afterAll(async () => { await prisma.auditLog.deleteMany({ where: { tenantId: { in: ids } } }); await prisma.tenant.deleteMany({ where: { id: { in: ids } } }); });
function paidAfterScan(tenantId: string) {
  let armed = true;
  return prisma.$extends({ query: { tenant: { async findMany({ args, query }) {
    const rows = await query(args);
    if (armed) { armed = false; await recordManualPayment({ id: "fixture-admin" }, { tenantId, amountTry: 100, months: 1 }, now); }
    return rows;
  } } } }) as unknown as typeof prisma;
}
describe.skipIf(!process.env.DATABASE_URL)("T114 subscription/payment races (real PostgreSQL)", () => {
  it("payment after active scan cannot be overwritten by stale expiry", async () => {
    const id = await salon({ status: "active", subscriptionEndsAt: new Date(+now - 60_000) });
    const tick = await applySubscriptionTick(now, { client: paidAfterScan(id), tenantIds: [id] });
    expect(await prisma.tenant.findUnique({ where: { id } })).toMatchObject({ status: "active", pastDueSince: null });
    expect(tick.transitions).toEqual([]); expect(tick.notices).toEqual([]);
    expect(await prisma.auditLog.count({ where: { tenantId: id, action: "subscription.notice.past_due" } })).toBe(0);
  });
  it("payment after trial scan prevents stale trial-ending warning", async () => {
    const id = await salon({ status: "trial", trialEndsAt: new Date(+now + 86_400_000) });
    const tick = await applySubscriptionTick(now, { client: paidAfterScan(id), tenantIds: [id] });
    expect(tick.notices).toEqual([]);
    expect(await prisma.tenant.findUnique({ where: { id } })).toMatchObject({ status: "active" });
    expect(await prisma.auditLog.count({ where: { tenantId: id, action: "subscription.notice.trial_ending" } })).toBe(0);
  });
  it("parallel ticks serialize transition and notice audits", async () => {
    const id = await salon({ status: "active", subscriptionEndsAt: new Date(+now - 60_000) });
    const ticks = await Promise.all([applySubscriptionTick(now, { tenantIds: [id] }), applySubscriptionTick(now, { tenantIds: [id] })]);
    expect(ticks.flatMap((t) => t.transitions)).toHaveLength(1);
    expect(ticks.flatMap((t) => t.notices)).toHaveLength(1);
    expect(await prisma.auditLog.count({ where: { tenantId: id, action: "subscription.status_changed" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { tenantId: id, action: "subscription.notice.past_due" } })).toBe(1);
  });
});
