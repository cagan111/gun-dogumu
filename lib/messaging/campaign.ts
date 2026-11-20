/** Durable audience snapshot + credit holds. Only pending safe recipients are dispatched. */
import { z } from "zod";
import { NotFoundError, BookingError } from "../booking";
import { prisma, withTenant } from "../db";
import { ConflictError, InsufficientCreditsError, SuspendedError, ValidationError } from "../errors";
import { getAvailableBalance, lockTenant } from "../ledger";
import { assertFeature } from "../plan";
import { getSmsProvider } from "./registry";
import { isQuietHour } from "./schedule";
import { smsSegments } from "./segments";
import { asLocale, withFooter } from "./templates";
import { sendMessage, type SendInput } from "./send";
import { reconcileQueuedMessages } from "./recovery";
import type { ProviderDeps } from "./types";
export class QuietHoursError extends BookingError {
  constructor() { super("quiet_hours", "Sessiz saatlerde kampanya gönderilemez"); }
}
export const campaignSchema = z.object({ text: z.string().trim().min(3).max(500), idempotencyKey: z.string().uuid() }).strict();
interface CampaignOptions {
  idempotencyKey?: string;
  maxRecipients?: number;
  hooks?: { afterPrepared?: () => Promise<void>; afterRecipient?: () => Promise<void> };
  sendHooks?: SendInput["hooks"];
}
function allowed(t: { status: string; plan: string; timeZone: string; quietStartHour: number; quietEndHour: number }, now: Date) {
  if (t.status === "suspended") throw new SuspendedError();
  assertFeature(t.plan, "campaigns");
  if (isQuietHour(now, t.timeZone, t.quietStartHour, t.quietEndHour)) throw new QuietHoursError();
}
export async function campaignStatus(tenantId: string, requestKey: string) {
  const db = withTenant(tenantId);
  const c = await db.campaign.findFirst({ where: { requestKey } });
  if (!c) throw new NotFoundError("Kampanya");
  const rows = await db.campaignRecipient.groupBy({ by: ["status"], where: { campaignId: c.id }, _count: true });
  const count = (status: string) => rows.find((r) => r.status === status)?._count ?? 0;
  return { campaignId: c.id, recipients: rows.reduce((n, r) => n + r._count, 0), segmentsPerMessage: c.segmentsPerMessage,
    sent: count("sent"), failed: count("failed"), skipped: count("skipped"), unknown: count("unknown"), pending: count("pending") + count("processing") };
}
/** No ledger refund: unspent holds were never debited. In-flight message debits stay T112-owned. */
export async function cancelCampaign(tenantId: string, requestKey: string) {
  const db = withTenant(tenantId);
  await db.$transaction(async (tx) => {
    await lockTenant(tx, tenantId);
    const c = await tx.campaign.findFirst({ where: { requestKey } });
    if (!c) throw new NotFoundError("Kampanya");
    if (c.status === "completed" || c.status === "cancelled") return;
    await tx.campaignRecipient.updateMany({ where: { campaignId: c.id, status: "pending" }, data: { status: "skipped" } });
    await tx.campaign.update({ where: { id: c.id }, data: { status: "cancelled", remainingReserved: 0 } });
  });
  return campaignStatus(tenantId, requestKey);
}
/** Repair recipient bookkeeping after a lost result; never infer delivery from duplicate status. */
async function reconcileRecipients(tenantId: string, campaignId: string) {
  await withTenant(tenantId).$transaction(async (tx) => {
    await lockTenant(tx, tenantId);
    const c = await tx.campaign.findUniqueOrThrow({ where: { id: campaignId } });
    const processing = await tx.campaignRecipient.findMany({ where: { campaignId, status: "processing" }, take: 100, orderBy: { id: "asc" } });
    for (const r of processing) {
      const message = r.messageId ? await tx.messageLog.findFirst({ where: { id: r.messageId } }) : null;
      if (message?.status === "queued") continue;
      let status = message?.status === "sent" ? "sent" : message?.providerResult === "delivery_unknown" || !message ? "unknown" : "failed";
      if (message?.providerResult === "interrupted_before_dispatch" && c.status === "active" && r.attempts < 3) {
        const available = await getAvailableBalance(tx, tenantId);
        if (available >= c.segmentsPerMessage) {
          await tx.campaign.update({ where: { id: c.id }, data: { remainingReserved: { increment: c.segmentsPerMessage } } });
          status = "pending";
        }
      }
      await tx.campaignRecipient.update({ where: { id: r.id }, data: { status, ...(status === "pending" ? { messageId: null } : {}) } });
    }
    const remaining = await tx.campaignRecipient.count({ where: { campaignId, status: { in: ["pending", "processing"] } } });
    if (!remaining && c.status === "active") await tx.campaign.update({ where: { id: c.id }, data: { status: "completed", remainingReserved: 0 } });
  });
}
async function prepare(tenantId: string, text: string, requestKey: string, now: Date, deps?: Partial<ProviderDeps>) {
  return withTenant(tenantId).$transaction(async (tx) => {
    await lockTenant(tx, tenantId);
    const existing = await tx.campaign.findFirst({ where: { requestKey } });
    if (existing) {
      if (existing.originalText !== text) throw new ConflictError("idempotencyKey", "Aynı işlem anahtarı farklı içerikle kullanılamaz");
      return existing;
    }
    const t = await tx.tenant.findUnique({ where: { id: tenantId } });
    if (!t) throw new ValidationError("Salon bulunamadı", "tenantId");
    allowed(t, now);
    const body = withFooter(text, asLocale(t.locale), t.phone);
    const provider = getSmsProvider(t.smsProvider, deps);
    const per = smsSegments(body, provider.segmentProfile).segments;
    const customers = await tx.customer.findMany({ where: { marketingConsent: true }, select: { id: true, phone: true }, orderBy: { id: "asc" }, take: 10001 });
    if (customers.length > 10000) throw new ValidationError("Kampanya alıcı sınırı aşıldı");
    const total = per * customers.length;
    const available = await getAvailableBalance(tx, tenantId);
    if (available < total) throw new InsufficientCreditsError(available, total);
    const c = await tx.campaign.create({ data: { requestKey, originalText: text, body, provider: provider.name, segmentsPerMessage: per, remainingReserved: total, status: total ? "active" : "completed" } as never });
    if (customers.length) await tx.campaignRecipient.createMany({ data: customers.map((customer) => ({ campaignId: c.id, customerId: customer.id, phone: customer.phone })) as never });
    return c;
  });
}
export async function sendCampaign(tenantId: string, text: string, now: Date = new Date(), deps?: Partial<ProviderDeps>, opts: CampaignOptions = {}) {
  const body = text.trim(); if (body.length < 3 || body.length > 500) throw new ValidationError("Metin 3–500 karakter olmalı", "text");
  const key = z.string().uuid().safeParse(opts.idempotencyKey);
  if (!key.success) throw new ValidationError("İşlem anahtarı gerekli", "idempotencyKey");
  const began = Date.now();
  const c = await prepare(tenantId, body, key.data, now, deps);
  await opts.hooks?.afterPrepared?.();
  await processCampaign(tenantId, c.id, new Date(+now + Date.now() - began), deps, opts);
  return campaignStatus(tenantId, c.requestKey);
}
export async function processCampaign(tenantId: string, campaignId: string, now = new Date(), deps?: Partial<ProviderDeps>, opts: CampaignOptions = {}) {
  const db = withTenant(tenantId);
  const began = Date.now();
  const clock = () => new Date(+now + Date.now() - began);
  await reconcileQueuedMessages(now, 100, tenantId);
  await reconcileRecipients(tenantId, campaignId);
  const c = await db.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  await db.campaign.update({ where: { id: c.id }, data: { updatedAt: now } });
  if (c.status !== "active") return;
  const t = await db.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  // Missing plan/status cannot leave an unsendable hold stranded forever.
  try { allowed(t, now); } catch (error) {
    if (error instanceof QuietHoursError) return;
    await cancelCampaign(tenantId, c.requestKey); return;
  }
  const provider = getSmsProvider(t.smsProvider, deps);
  if (provider.name !== c.provider || smsSegments(c.body, provider.segmentProfile).segments !== c.segmentsPerMessage) { await cancelCampaign(tenantId, c.requestKey); return; }
  const take = Math.max(0, Math.min(25, opts.maxRecipients ?? 25));
  if (!take) return;
  const rows = await db.campaignRecipient.findMany({ where: { campaignId, status: "pending" }, orderBy: { id: "asc" }, take });
  for (const r of rows) {
    const fresh = await db.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const at = clock();
    try { allowed(fresh, at); } catch { break; }
    const currentProvider = getSmsProvider(fresh.smsProvider, deps);
    if (currentProvider.name !== c.provider || smsSegments(c.body, currentProvider.segmentProfile).segments !== c.segmentsPerMessage) { await cancelCampaign(tenantId, c.requestKey); break; }
    const outcome = await sendMessage({ tenantId, to: r.phone, text: c.body, template: "campaign", reason: "campaign", campaignRecipientId: r.id,
      idempotencyKey: `camp:${c.id}:${r.id}:${r.attempts + 1}`, fallback: { whatsapp: false }, deps, now: at, hooks: opts.sendHooks });
    if (outcome.reason === "sms_sender_not_approved") { await cancelCampaign(tenantId, c.requestKey); break; }
    await reconcileRecipients(tenantId, campaignId);
    await opts.hooks?.afterRecipient?.();
  }
}
/** System worker: bounded scan also repairs prepare→enqueue crashes. */
export async function recoverCampaigns(now = new Date()) {
  const began = Date.now();
  const rows = await prisma.campaign.findMany({ where: { OR: [{ status: "active" }, { status: "cancelled", recipients: { some: { status: "processing" } } }] }, orderBy: { updatedAt: "asc" }, take: 2 });
  for (const c of rows) await processCampaign(c.tenantId, c.id, new Date(+now + Date.now() - began), undefined, { maxRecipients: 5 });
  return { checked: rows.length };
}
