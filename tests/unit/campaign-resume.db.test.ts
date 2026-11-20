import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
try { process.loadEnvFile(".env"); } catch { /* optional */ }
import { prisma, withTenant } from "@/lib/db";
import * as ledger from "@/lib/ledger";
import * as campaigns from "@/lib/messaging/campaign";
import { MockProvider } from "@/lib/messaging/providers";
const ids: string[] = []; const now = new Date(); const later = new Date(+now + 180_000);
const crash = async () => { throw new Error("injected_worker_exit"); };
async function fixture(balance = 12) {
  const t = await prisma.tenant.create({ data: { slug: `campaign-resume-${crypto.randomUUID()}`, name: "Campaign fixture", city: "Girne", locale: "en", phone: "+905331110000", plan: "salon_plus", quietStartHour: 0, quietEndHour: 0 } }); ids.push(t.id);
  await ledger.credit(t.id, balance);
  for (let i = 1; i <= 2; i++) await prisma.customer.create({ data: { tenantId: t.id, phone: `+90533999000${i}`, name: "Fixture", marketingConsent: true } });
  return t.id;
}
const run = (id: string, key: string, opts: Parameters<typeof campaigns.sendCampaign>[4] = {}, clock = now) => campaigns.sendCampaign(id, "Campaign fixture", clock, undefined, { idempotencyKey: key, ...opts });
const available = (id: string) => ledger.getAvailableBalance(withTenant(id));
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { await prisma.tenant.deleteMany({ where: { id: { in: ids } } }); });
describe.skipIf(!process.env.DATABASE_URL)("T116 durable campaigns and reservations (real DB)", () => {
  it("unapproved legacy sender cancels pending campaign and releases hold without refund", async () => {
    const id = await fixture(), key = crypto.randomUUID();
    await run(id, key, { maxRecipients: 0 });
    await prisma.tenant.update({ where: { id }, data: { smsSenderName: "BANKA" } });
    const provider = vi.spyOn(MockProvider.prototype, "send");
    await run(id, key);
    expect(await available(id)).toBe(12);
    expect(await ledger.getBalance(withTenant(id))).toBe(12);
    expect((await prisma.campaign.findFirstOrThrow({ where: { tenantId: id } })).status).toBe("cancelled");
    expect(await prisma.messageLog.count({ where: { tenantId: id } })).toBe(0);
    expect(provider).not.toHaveBeenCalled();
  });
  it("same request key never replays a completed audience; changed payload conflicts", async () => {
    const id = await fixture(), key = crypto.randomUUID(); const provider = vi.spyOn(MockProvider.prototype, "send");
    const one = await run(id, key), two = await run(id, key);
    expect(two.campaignId).toBe(one.campaignId); expect(two.sent).toBe(2); expect(provider).toHaveBeenCalledTimes(2);
    await expect(campaigns.sendCampaign(id, "Different fixture", now, undefined, { idempotencyKey: key })).rejects.toMatchObject({ code: "conflict" });
  });
  it("prepare crash leaves durable reserved credits unavailable to other debits", async () => {
    const id = await fixture(), key = crypto.randomUUID();
    await expect(run(id, key, { hooks: { afterPrepared: crash } })).rejects.toThrow("injected_worker_exit");
    expect(await ledger.getBalance(withTenant(id))).toBe(12); expect(await available(id)).toBe(10);
    await expect(ledger.debit(id, 11, { reason: "notification" })).rejects.toMatchObject({ code: "insufficient_credits" });
    expect(await run(id, key)).toMatchObject({ recipients: 2, sent: 2, pending: 0 });
    expect(await available(id)).toBe(10);
  });
  it("partial delivery resumes remaining snapshot only, not newly opted-in customers", async () => {
    const id = await fixture(), key = crypto.randomUUID(); const provider = vi.spyOn(MockProvider.prototype, "send");
    await expect(run(id, key, { hooks: { afterRecipient: crash } })).rejects.toThrow("injected_worker_exit");
    expect(provider).toHaveBeenCalledTimes(1);
    await prisma.customer.create({ data: { tenantId: id, phone: "+905339990003", name: "Later fixture", marketingConsent: true } });
    expect(await run(id, key)).toMatchObject({ recipients: 2, sent: 2, pending: 0 });
    expect(provider).toHaveBeenCalledTimes(2); expect(await available(id)).toBe(10);
  });
  it("competing campaign preparations cannot over-reserve credits", async () => {
    const id = await fixture(3); const provider = vi.spyOn(MockProvider.prototype, "send");
    const results = await Promise.allSettled([run(id, crypto.randomUUID(), { maxRecipients: 0 }), run(id, crypto.randomUUID(), { maxRecipients: 0 })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r): r is PromiseRejectedResult => r.status === "rejected")?.reason).toMatchObject({ code: "insufficient_credits" });
    expect(await available(id)).toBe(1); expect(provider).not.toHaveBeenCalled();
  });
  it("current opt-out skips dispatch and cancellation releases remaining hold once", async () => {
    const id = await fixture(), key = crypto.randomUUID(); const provider = vi.spyOn(MockProvider.prototype, "send");
    await run(id, key, { maxRecipients: 0 });
    await prisma.customer.updateMany({ where: { tenantId: id }, data: { marketingConsent: false } });
    expect(await run(id, key)).toMatchObject({ sent: 0, skipped: 2, pending: 0 }); expect(await available(id)).toBe(12); expect(provider).not.toHaveBeenCalled();
    const second = crypto.randomUUID(); await prisma.customer.updateMany({ where: { tenantId: id }, data: { marketingConsent: true } });
    await run(id, second, { maxRecipients: 0 });
    await campaigns.cancelCampaign(id, second); await campaigns.cancelCampaign(id, second);
    expect(await available(id)).toBe(12); expect(await ledger.getBalance(withTenant(id))).toBe(12);
  });
  it("accepted-before-crash becomes unknown, never blindly resent", async () => {
    const id = await fixture(), key = crypto.randomUUID(); const provider = vi.spyOn(MockProvider.prototype, "send");
    await expect(run(id, key, { sendHooks: { afterDispatch: crash } })).rejects.toThrow("injected_worker_exit");
    expect(await run(id, key, {}, later)).toMatchObject({ sent: 1, unknown: 1, pending: 0 });
    expect(provider).toHaveBeenCalledTimes(2); expect(await available(id)).toBe(11);
  });
  it("known before-dispatch crash can resume safely after fenced recovery", async () => {
    const id = await fixture(), key = crypto.randomUUID(); const provider = vi.spyOn(MockProvider.prototype, "send");
    await expect(run(id, key, { sendHooks: { afterReserved: crash } })).rejects.toThrow("injected_worker_exit");
    expect(provider).not.toHaveBeenCalled();
    expect(await run(id, key, {}, later)).toMatchObject({ sent: 2, unknown: 0, pending: 0 });
    expect(provider).toHaveBeenCalledTimes(2); expect(await available(id)).toBe(10);
  });
  it("unkeyed sends are rejected rather than generating a fresh campaign on retry", async () => {
    const id = await fixture(); const provider = vi.spyOn(MockProvider.prototype, "send");
    await expect(campaigns.sendCampaign(id, "Unkeyed fixture", now)).rejects.toMatchObject({ code: "validation" });
    expect(provider).not.toHaveBeenCalled();
  });

  it("parallel retries of one key create one hold, and foreign tenant cannot read or cancel it", async () => {
    const id = await fixture(), other = await fixture(), key = crypto.randomUUID();
    const result = await Promise.all([run(id, key, { maxRecipients: 0 }), run(id, key, { maxRecipients: 0 })]);
    expect(result[0]!.campaignId).toBe(result[1]!.campaignId); expect(await available(id)).toBe(10);
    expect(await prisma.campaign.count({ where: { tenantId: id } })).toBe(1);
    await expect(campaigns.campaignStatus(other, key)).rejects.toMatchObject({ code: "not_found" });
    await expect(campaigns.cancelCampaign(other, key)).rejects.toMatchObject({ code: "not_found" });
    expect(await available(other)).toBe(12);
    const { sendMessage } = await import("@/lib/messaging/send");
    const recipient = await prisma.campaignRecipient.findFirstOrThrow({ where: { campaignId: result[0]!.campaignId } });
    const c = await prisma.campaign.findUniqueOrThrow({ where: { id: result[0]!.campaignId } });
    await expect(sendMessage({ tenantId: other, campaignRecipientId: recipient.id, to: recipient.phone, text: c.body, template: "campaign", reason: "campaign", idempotencyKey: "foreign-fixture" })).rejects.toMatchObject({ code: "validation" });
    expect(await available(id)).toBe(10); expect(await available(other)).toBe(12);
  });
  it("cancel during an in-flight send releases only unsent holds", async () => {
    const id = await fixture(), key = crypto.randomUUID(); let release!: () => void; let entered!: () => void;
    const gate = new Promise<void>((r) => { release = r; }); const started = new Promise<void>((r) => { entered = r; });
    const provider = vi.spyOn(MockProvider.prototype, "send").mockImplementation(async () => { entered(); await gate; return { ok: true, cost: 1 }; });
    const pending = run(id, key);
    try {
      await started; await campaigns.cancelCampaign(id, key); release();
      expect(await pending).toMatchObject({ sent: 1, skipped: 1, pending: 0 });
      expect(provider).toHaveBeenCalledTimes(1); expect(await available(id)).toBe(11);
      await campaigns.cancelCampaign(id, key); expect(await available(id)).toBe(11);
    } finally { release(); }
  });
  it("provider rejection refunds once and preserves canonical raw ledger snapshots", async () => {
    const id = await fixture(), key = crypto.randomUUID();
    vi.spyOn(MockProvider.prototype, "send").mockResolvedValue({ ok: false, error: "fixture_rejected", cost: 0 });
    expect(await run(id, key)).toMatchObject({ failed: 2, pending: 0, unknown: 0 });
    expect(await available(id)).toBe(12); expect(await ledger.getBalance(withTenant(id))).toBe(12);
    const entries = await prisma.smsLedger.findMany({ where: { tenantId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    let total = 0; for (const entry of entries) { total += entry.delta; expect(entry.balanceAfter).toBe(total); }
    expect(entries.filter((e) => e.reason === "refund")).toHaveLength(2);
  });

  it("concurrent dispatchers claim and debit each recipient only once", async () => {
    const id = await fixture(), key = crypto.randomUUID();
    const provider = vi.spyOn(MockProvider.prototype, "send").mockImplementation(async () => {
      await new Promise((resolve) => setImmediate(resolve)); return { ok: true, cost: 1 };
    });
    const results = await Promise.all([run(id, key), run(id, key)]);
    expect(results[0]!.campaignId).toBe(results[1]!.campaignId);
    expect(await campaigns.campaignStatus(id, key)).toMatchObject({ sent: 2, pending: 0 });
    expect(provider).toHaveBeenCalledTimes(2); expect(await available(id)).toBe(10);
    expect(await prisma.smsLedger.count({ where: { tenantId: id, reason: "campaign" } })).toBe(2);
  });

});
