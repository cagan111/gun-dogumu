import { reviewGate, reviewKey, skipReview, finishReviewMessage } from "./review-dispatch";
import { getSmsProvider } from "./registry";
import { approvedSmsSender } from "./sender-policy";
import type { ProviderDeps } from "./types";
/** A queued reservation is owned for two minutes. Recovery never replays message content. */
import { randomUUID } from "node:crypto";
import type { MessageStatus } from "@prisma/client";
import { prisma, withTenant } from "../db";
import { lockTenant, refundTx } from "../ledger";
export const MESSAGE_LEASE_MS = 120_000;
export const PROVIDER_TIMEOUT_MS = 30_000;
export function messageLease(now: Date) {
  return { leaseOwner: randomUUID(), leaseUntil: new Date(+now + MESSAGE_LEASE_MS) };
}
export async function startDispatch(tenantId: string, id: string, owner: string, now: Date, review?: { sender: string | null; deps?: Partial<ProviderDeps> }): Promise<boolean> {
  const began = Date.now();
  return withTenant(tenantId).$transaction(async tx => {
    await lockTenant(tx, tenantId);
    if (review) now = new Date(+now + Date.now() - began);
    const where = { id, status: "queued" as const, leaseOwner: owner, leaseUntil: { gt: now }, dispatchStartedAt: null };
    const row = await tx.messageLog.findFirst({ where });
    if (!row) return false;
    if (row.template === "review_invite") {
      const intent = await tx.reviewInvitation.findFirst({ where: { messageId: id } });
      const gate = intent ? await reviewGate(tx, tenantId, intent, now) : null;
      const tenant = gate?.tenant;
      let reason = !intent || intent.status !== "processing" ? intent?.finishedReason ?? "review_not_processing" : gate?.reason;
      if (!reason && (row.channel !== "sms" || row.appointmentId !== intent!.appointmentId || row.recipient !== intent!.recipient || row.idempotencyKey !== reviewKey(intent!.appointmentId))) reason = "review_scope_invalid";
      if (!reason && (!review || !tenant || tenant.smsSenderName !== review.sender || getSmsProvider(tenant.smsProvider, review.deps).name !== row.provider || !approvedSmsSender(tenantId, row.provider, tenant.smsSenderName, review.deps?.env ?? process.env))) reason = "sms_sender_not_approved";
      if (reason) {
        const cancelled = await tx.messageLog.updateMany({ where, data: { status: "failed", providerResult: reason, cost: 0, leaseOwner: null, leaseUntil: null } });
        if (cancelled.count === 1) {
          if (row.cost > 0) await refundTx(tx, tenantId, row.cost, { messageId: id, note: "yorum daveti iptal" });
          if (intent) await skipReview(tx, intent.id, reason);
        }
        return false;
      }
    }
    if (row.channel === "sms" && row.template === "campaign") {
      const recipient = await tx.campaignRecipient.findFirst({ where: { messageId: id }, include: { campaign: true } });
      const customer = await tx.customer.findFirst({ where: { ...(recipient ? { id: recipient.customerId } : {}), phone: row.recipient, marketingConsent: true } });
      const cancelledCampaign = recipient && recipient.campaign.status !== "active";
      if (!customer || cancelledCampaign) {
        const cancelled = await tx.messageLog.updateMany({ where, data: { status: "failed", providerResult: cancelledCampaign ? "campaign_cancelled" : "consent_withdrawn", cost: 0, leaseOwner: null, leaseUntil: null } });
        if (cancelled.count === 1) {
          if (row.cost > 0) await refundTx(tx, tenantId, row.cost, { messageId: id, note: cancelledCampaign ? "kampanya iptal edildi" : "izin geri çekildi" });
          await tx.campaignRecipient.updateMany({ where: { messageId: id, status: "processing" }, data: { status: "skipped" } });
        }
        return false;
      }
    }
    return (await tx.messageLog.updateMany({ where, data: { dispatchStartedAt: now } })).count === 1;
  });
}
/** Winner of the fenced transition owns the refund; late workers cannot overwrite it. */
export async function settleMessage(tenantId: string, id: string, owner: string, status: MessageStatus, result: { providerId?: string; error?: string }, now: Date): Promise<boolean> {
  return withTenant(tenantId).$transaction(async (tx) => {
    await lockTenant(tx, tenantId);
    const row = await tx.messageLog.findFirst({ where: { id, status: "queued", leaseOwner: owner, leaseUntil: { gt: now } } });
    if (!row) return false;
    const r = await tx.messageLog.updateMany({
      where: { id, status: "queued", leaseOwner: owner, leaseUntil: { gt: now } },
      data: { status, providerId: result.providerId ?? null, providerResult: result.error ?? null, leaseOwner: null, leaseUntil: null, ...(status === "failed" ? { cost: 0 } : {}) },
    });
    if (r.count !== 1) return false;
    if (status === "failed" && row.channel === "sms" && row.cost > 0) await refundTx(tx, tenantId, row.cost, { messageId: id, note: `iade:${row.template}` });
    if (row.template === "review_invite") await finishReviewMessage(tx, id, status === "sent" ? "sent" : result.error ?? "failed");
    return true;
  });
}
/** Bounded cross-tenant system sweep. Old ownerless queued rows are delivery-unknown. */
export async function reconcileQueuedMessages(now: Date = new Date(), limit = 100, tenantId?: string): Promise<number> {
  const expired = { OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] };
  const rows = await prisma.messageLog.findMany({ where: { status: "queued", ...expired, ...(tenantId ? { tenantId } : {}) }, orderBy: [{ leaseUntil: "asc" }, { id: "asc" }], take: Math.max(1, Math.min(500, limit)) });
  let recovered = 0;
  for (const row of rows) {
    recovered += await withTenant(row.tenantId).$transaction(async (tx) => {
      await lockTenant(tx, row.tenantId);
      const current = await tx.messageLog.findFirst({ where: { id: row.id, status: "queued", ...expired } });
      if (!current) return 0;
      const unknown = !current.leaseOwner || !!current.dispatchStartedAt;
      const r = await tx.messageLog.updateMany({ where: { id: current.id, status: "queued", leaseOwner: current.leaseOwner, ...expired }, data: {
        status: "failed", providerResult: unknown ? "delivery_unknown" : "interrupted_before_dispatch", cost: 0, leaseOwner: null, leaseUntil: null,
      } });
      if (r.count !== 1) return 0;
      if (current.channel === "sms" && current.cost > 0) await refundTx(tx, row.tenantId, current.cost, { messageId: current.id, note: "kesinti uzlaştırma" });
      if (current.template === "review_invite") await finishReviewMessage(tx, current.id, unknown ? "delivery_unknown" : "interrupted_before_dispatch");
      return 1;
    });
  }
  return recovered;
}
