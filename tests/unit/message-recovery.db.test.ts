import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
try { process.loadEnvFile(".env"); } catch { /* optional */ }
import { prisma, withTenant } from "@/lib/db";
import { credit, getBalance } from "@/lib/ledger";
import * as send from "@/lib/messaging/send";
import { MockProvider } from "@/lib/messaging/providers";
const ids: string[] = [];
const now = new Date("2026-11-18T15:00:00Z");
const expired = new Date(+now + 180_000);
async function salon() {
  const t = await prisma.tenant.create({ data: { slug: `recovery-${crypto.randomUUID()}`, name: "Recovery fixture", city: "Girne" } });
  ids.push(t.id); await credit(t.id, 10); return t.id;
}
let recipientN = 0;
const recipients = new Map<string, string>();
const recipient = (id: string) => { if (!recipients.has(id)) recipients.set(id, `+90533555${String(++recipientN).padStart(4, "0")}`); return recipients.get(id)!; };
const input = (tenantId: string, key = crypto.randomUUID()) => ({ tenantId, to: recipient(tenantId), text: "Test", template: "otp", logContent: "******", reason: "notification" as const, idempotencyKey: key, now });
const crash = async () => { throw new Error("injected_worker_exit"); };
beforeAll(() => { MockProvider.sent.length = 0; });
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { await prisma.tenant.deleteMany({ where: { id: { in: ids } } }); });
describe.skipIf(!process.env.DATABASE_URL)("T112 worker recovery (real PostgreSQL)", () => {
  it("reserve crash refunds once under concurrent sweepers; no plaintext OTP replay", async () => {
    const id = await salon(); const message = input(id); const provider = vi.spyOn(MockProvider.prototype, "send");
    await expect(send.sendMessage({ ...message, hooks: { afterReserved: crash } })).rejects.toThrow("injected_worker_exit");
    expect(await getBalance(withTenant(id))).toBe(9); expect(provider).not.toHaveBeenCalled();
    await Promise.all([send.reconcileQueuedMessages(expired), send.reconcileQueuedMessages(expired)]);
    expect(await getBalance(withTenant(id))).toBe(10);
    expect(await prisma.smsLedger.count({ where: { tenantId: id, reason: "refund" } })).toBe(1);
    expect(await send.sendMessage(message)).toMatchObject({ status: "duplicate" });
    expect(provider).not.toHaveBeenCalled();
    expect(await prisma.messageLog.findFirst({ where: { tenantId: id } })).toMatchObject({ status: "failed", content: "******", providerResult: "interrupted_before_dispatch", cost: 0 });
  });
  it("accepted then crashed is unknown: one provider call, one refund, no resend", async () => {
    const id = await salon(); const message = input(id); const provider = vi.spyOn(MockProvider.prototype, "send");
    await expect(send.sendMessage({ ...message, hooks: { afterDispatch: crash } })).rejects.toThrow("injected_worker_exit");
    await send.reconcileQueuedMessages(expired); await send.sendMessage(message);
    expect(provider).toHaveBeenCalledTimes(1); expect(await getBalance(withTenant(id))).toBe(10);
    expect(await prisma.messageLog.findFirst({ where: { tenantId: id } })).toMatchObject({ status: "failed", providerResult: "delivery_unknown" });
  });
  it("live lease untouched; late success cannot overwrite recovery or charge again", async () => {
    const id = await salon(); let release!: () => void; let entered!: () => void;
    const started = new Promise<void>((r) => { entered = r; }); const gate = new Promise<void>((r) => { release = r; });
    vi.spyOn(MockProvider.prototype, "send").mockImplementation(async () => { entered(); await gate; return { ok: true, providerId: "late", cost: 1 }; });
    const pending = send.sendMessage(input(id)); await started;
    expect(await send.reconcileQueuedMessages(now)).toBe(0);
    await send.reconcileQueuedMessages(expired); release();
    expect(await pending).toMatchObject({ status: "failed", reason: "lease_lost" });
    expect(await getBalance(withTenant(id))).toBe(10);
    expect(await prisma.messageLog.findFirst({ where: { tenantId: id } })).toMatchObject({ status: "failed", providerResult: "delivery_unknown" });
  });
  it("expired before dispatch does not call provider; foreign key cannot settle another tenant", async () => {
    const id = await salon(); const other = await salon(); const message = input(id);
    const provider = vi.spyOn(MockProvider.prototype, "send");
    const outcome = await send.sendMessage({ ...message, hooks: { afterReserved: async () => { await send.reconcileQueuedMessages(expired); } } });
    expect(outcome).toMatchObject({ status: "failed", reason: "lease_lost" });
    expect(provider).not.toHaveBeenCalled();
    expect(await send.sendMessage({ ...message, tenantId: other })).toMatchObject({ status: "duplicate" });
    expect(await getBalance(withTenant(other))).toBe(10);
    expect(await prisma.messageLog.count({ where: { tenantId: other } })).toBe(0);
  });
  it("late provider failure cannot refund a second time", async () => {
    const id = await salon(); let release!: () => void; let entered!: () => void;
    const started = new Promise<void>((r) => { entered = r; }); const gate = new Promise<void>((r) => { release = r; });
    vi.spyOn(MockProvider.prototype, "send").mockImplementation(async () => { entered(); await gate; return { ok: false, error: "fixture_rejected", cost: 0 }; });
    const pending = send.sendMessage(input(id)); await started;
    await send.reconcileQueuedMessages(expired); release(); await pending;
    expect(await getBalance(withTenant(id))).toBe(10);
    expect(await prisma.smsLedger.count({ where: { tenantId: id, reason: "refund" } })).toBe(1);
  });
  it.each(["network:response lost", "whatsapp:503:unavailable", "throw"])("uncertain WhatsApp %s stops fallback to customer email", async (failure) => {
    const id = await salon(); await prisma.tenant.update({ where: { id }, data: { plan: "salon_plus" } });
    const { debit } = await import("@/lib/ledger"); await debit(id, 10, { reason: "notification" });
    const provider = vi.spyOn(MockProvider.prototype, "send");
    if (failure === "throw") provider.mockRejectedValue(new Error("fixture transport"));
    else provider.mockResolvedValue({ ok: false, error: failure, cost: 0 });
    const outcome = await send.sendMessage({ ...input(id), deps: { env: { WHATSAPP_TOKEN: "fixture", WHATSAPP_PHONE_NUMBER_ID: "fixture" } }, fallback: { email: "customer@example.test" } });
    expect(outcome).toMatchObject({ status: "failed", reason: "delivery_unknown" });
    expect(await prisma.messageLog.count({ where: { tenantId: id, template: "otp", channel: "email" } })).toBe(0);
    expect(await getBalance(withTenant(id))).toBe(0);
  });
  it("free WhatsApp reservation crash closes without refund or content replay", async () => {
    const id = await salon(); await prisma.tenant.update({ where: { id }, data: { plan: "salon_plus" } });
    const { debit } = await import("@/lib/ledger"); await debit(id, 10, { reason: "notification" });
    const provider = vi.spyOn(MockProvider.prototype, "send");
    await expect(send.sendMessage({ ...input(id), deps: { env: { WHATSAPP_TOKEN: "fixture", WHATSAPP_PHONE_NUMBER_ID: "fixture" } }, hooks: { afterReserved: crash } })).rejects.toThrow("injected_worker_exit");
    await send.reconcileQueuedMessages(expired);
    expect(provider).not.toHaveBeenCalled(); expect(await getBalance(withTenant(id))).toBe(0);
    expect(await prisma.smsLedger.count({ where: { tenantId: id, reason: "refund" } })).toBe(0);
    expect(await prisma.messageLog.findFirst({ where: { tenantId: id, channel: "whatsapp" } })).toMatchObject({ status: "failed", content: "******" });
  });
  it("legacy queued SMS refunded conservatively; free email closes without credit", async () => {
    const id = await salon();
    // Simulates a pre-migration debit and its queued record.
    const { debit } = await import("@/lib/ledger"); await debit(id, 2, { reason: "notification" });
    await prisma.messageLog.createMany({ data: [
      { tenantId: id, channel: "sms", recipient: "fixture", template: "otp", content: "******", provider: "mock", cost: 2, status: "queued" },
      { tenantId: id, channel: "email", recipient: "fixture@example.test", template: "notice", content: "fixture", provider: "mock-email", cost: 0, status: "queued" },
    ] });
    await send.reconcileQueuedMessages(expired);
    expect(await getBalance(withTenant(id))).toBe(10);
    expect(await prisma.messageLog.count({ where: { tenantId: id, status: "failed", providerResult: "delivery_unknown" } })).toBe(2);
  });
});
