import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
try { process.loadEnvFile(".env"); } catch { /* optional */ }
import { prisma, withTenant } from "@/lib/db";
import { credit, getBalance } from "@/lib/ledger";
import { sendMessage } from "@/lib/messaging/send";
import { MockProvider, MockEmailProvider } from "@/lib/messaging/providers";
const ids: string[] = []; let n = 0;
const now = new Date(); const prefix = `${Date.now()}`.slice(-5);
const phone = () => `+90533${prefix}${String(++n).padStart(2, "0")}`;
async function salon() {
  const t = await prisma.tenant.create({ data: { slug: `sms-policy-${crypto.randomUUID()}`, name: "Policy fixture", city: "Girne" } }); ids.push(t.id); await credit(t.id, 100);
  const staff = await prisma.staff.create({ data: { tenantId: t.id, name: "Staff" } });
  const svc = await prisma.service.create({ data: { tenantId: t.id, nameTr: "Cut", durationMin: 30, priceTry: "100" } });
  return { id: t.id, staff: staff.id, svc: svc.id };
}
async function appt(t: Awaited<ReturnType<typeof salon>>, to: string, source: "online" | "panel" = "online") {
  const customer = await prisma.customer.upsert({ where: { tenantId_phone: { tenantId: t.id, phone: to } }, create: { tenantId: t.id, phone: to, name: "Fixture" }, update: {} });
  const start = new Date(+now + (++n) * 3600_000);
  return prisma.appointment.create({ data: { tenantId: t.id, staffId: t.staff, serviceId: t.svc, customerId: customer.id, startsAt: start, endsAt: new Date(+start + 1800_000), blockedUntil: new Date(+start + 1800_000), priceTry: "100", cancelToken: crypto.randomUUID(), source } });
}
const input = (tenantId: string, to: string, appointmentId?: string) => ({ tenantId, to, appointmentId, text: "Fixture", template: appointmentId ? "confirmation" : "otp", reason: "notification" as const, idempotencyKey: crypto.randomUUID(), now });
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { await prisma.tenant.deleteMany({ where: { id: { in: ids } } }); });
describe.skipIf(!process.env.DATABASE_URL)("T142 anonymous SMS policy (real DB)", () => {
  it("legacy sender requires exact tenant/provider approval before debit/log/provider", async () => {
    const t = await salon();
    await prisma.tenant.update({ where: { id: t.id }, data: { smsSenderName: "BANKA" } });
    const sms = vi.spyOn(MockProvider.prototype, "send");
    for (const approvals of [undefined, "{bad", "{}", JSON.stringify({ other: { mock: ["BANKA"] } }), JSON.stringify({ [t.id]: { netgsm: ["BANKA"] } }), JSON.stringify({ [t.id]: { mock: ["Banka"] } })]) {
      const outcome = await sendMessage({ ...input(t.id, phone()), deps: { env: { SMS_PROVIDER: "mock", ALLOW_REAL_SMS: "false", SMS_APPROVED_SENDERS_JSON: approvals } } });
      expect(outcome).toMatchObject({ status: "skipped", reason: "sms_sender_not_approved" });
      expect(await getBalance(withTenant(t.id))).toBe(100);
      expect(await prisma.messageLog.count({ where: { tenantId: t.id } })).toBe(0);
      expect(sms).not.toHaveBeenCalled();
    }
    const approved = JSON.stringify({ [t.id]: { mock: ["BANKA"] } });
    expect(await sendMessage({ ...input(t.id, phone()), deps: { env: { SMS_PROVIDER: "mock", ALLOW_REAL_SMS: "false", SMS_APPROVED_SENDERS_JSON: approved } } })).toMatchObject({ status: "sent" });
    expect(sms).toHaveBeenCalledTimes(1);
    expect(await getBalance(withTenant(t.id))).toBe(99);
  });
  it("default country policy blocks foreign SMS before debit/provider and all fallbacks", async () => {
    const t = await salon(); const to = "+447911123456", a = await appt(t, to);
    const sms = vi.spyOn(MockProvider.prototype, "send"); const email = vi.spyOn(MockEmailProvider.prototype, "send");
    expect(await sendMessage({ ...input(t.id, to, a.id), fallback: { email: "fixture@example.test" } })).toMatchObject({ status: "skipped", reason: "sms_country_policy" });
    expect(sms).not.toHaveBeenCalled(); expect(email).not.toHaveBeenCalled(); expect(await getBalance(withTenant(t.id))).toBe(100);
  });
  it("phone daily segment budget is atomic across salons and weighted by segments", async () => {
    const one = await salon(), two = await salon(), to = phone();
    const a = await appt(one, to), b = await appt(two, to); const sms = vi.spyOn(MockProvider.prototype, "send");
    const outcomes = await Promise.all(Array.from({ length: 4 }, (_, i) => sendMessage({ ...input(i % 2 ? one.id : two.id, to, i % 2 ? a.id : b.id), text: "a".repeat(161) })));
    expect(outcomes.filter((o) => o.status === "sent")).toHaveLength(3);
    expect(outcomes.filter((o) => o.reason === "sms_phone_daily_limit")).toHaveLength(1); expect(sms).toHaveBeenCalledTimes(3);
  });
  it("tenant daily budget serializes different recipients", async () => {
    const t = await salon(); await prisma.tenant.update({ where: { id: t.id }, data: { smsDailySegmentLimit: 2 } });
    const numbers = [phone(), phone(), phone()]; const rows = await Promise.all(numbers.map((p) => appt(t, p)));
    const outcomes = await Promise.all(rows.map((a, i) => sendMessage(input(t.id, numbers[i]!, a.id))));
    expect(outcomes.filter((o) => o.status === "sent")).toHaveLength(2);
    expect(outcomes.filter((o) => o.reason === "sms_tenant_daily_limit")).toHaveLength(1);
    expect(await getBalance(withTenant(t.id))).toBe(98);
  });
  it("owner country opt-in is evaluated at dispatch; OTP shares policy", async () => {
    const t = await salon(), to = "+447911123457"; const a = await appt(t, to);
    expect(await sendMessage(input(t.id, to, a.id))).toMatchObject({ status: "skipped" });
    await prisma.tenant.update({ where: { id: t.id }, data: { smsAllowedCallingCodes: ["90", "44"] } });
    expect(await sendMessage(input(t.id, to, a.id))).toMatchObject({ status: "sent" });
    await prisma.tenant.update({ where: { id: t.id }, data: { smsAllowedCallingCodes: [] } });
    expect(await sendMessage(input(t.id, to))).toMatchObject({ status: "skipped", reason: "sms_country_policy" });
  });
  it("failed/refunded attempts keep consuming safety budget and next UTC day resets it", async () => {
    const t = await salon(), to = phone(), a = await appt(t, to);
    const sms = vi.spyOn(MockProvider.prototype, "send").mockResolvedValue({ ok: false, error: "network:fixture", cost: 0 });
    for (let i = 0; i < 6; i++) expect(await sendMessage(input(t.id, to, a.id))).toMatchObject({ status: "failed" });
    expect(await getBalance(withTenant(t.id))).toBe(100);
    expect(await sendMessage(input(t.id, to, a.id))).toMatchObject({ status: "skipped", reason: "sms_phone_daily_limit" });
    expect(sms).toHaveBeenCalledTimes(6);
    expect(await sendMessage({ ...input(t.id, to, a.id), now: new Date(+now + 86_400_000) })).toMatchObject({ status: "failed" });
    expect(sms).toHaveBeenCalledTimes(7);
  });
  it("foreign public booking remains available while confirmation SMS is suppressed", async () => {
    const t = await salon(); const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: t.id } });
    await prisma.serviceStaff.create({ data: { tenantId: t.id, serviceId: t.svc, staffId: t.staff } });
    await prisma.workingHours.createMany({ data: Array.from({ length: 7 }, (_, weekday) => ({ tenantId: t.id, staffId: t.staff, weekday, startMin: 0, endMin: 1440 })) });
    const { getSlots, bookPublic, publicBookingSchema } = await import("@/lib/public");
    const { addDays, utcToLocal } = await import("@/lib/time");
    const slots = await getSlots(tenant.slug, { serviceId: t.svc, staffId: t.staff, date: addDays(utcToLocal(now, tenant.timeZone).date, 1) }, now);
    const booked = await bookPublic(tenant.slug, publicBookingSchema.parse({ serviceId: t.svc, staffId: t.staff, startsAt: slots.slots[0]!.startsAt, customer: { name: "Foreign fixture", phone: "+447911123458" }, kvkkAccepted: true }), now);
    expect(booked.id).toBeTruthy();
    const { handleSendConfirmation } = await import("@/jobs/handlers");
    const sms = vi.spyOn(MockProvider.prototype, "send");
    expect(await handleSendConfirmation({ appointmentId: booked.id }, { now })).toMatchObject({ status: "skipped", outcome: { reason: "sms_country_policy" } });
    expect(sms).not.toHaveBeenCalled();
  });
  it("panel-created appointment cannot bypass country policy; owner can opt in", async () => {
    const t = await salon(), to = "+447911123459", a = await appt(t, to, "panel");
    expect(await sendMessage(input(t.id, to, a.id))).toMatchObject({ status: "skipped", reason: "sms_country_policy" });
    await prisma.tenant.update({ where: { id: t.id }, data: { smsAllowedCallingCodes: ["90", "44"] } });
    expect(await sendMessage(input(t.id, to, a.id))).toMatchObject({ status: "sent" });
  });

});
