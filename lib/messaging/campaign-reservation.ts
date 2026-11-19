import { ValidationError } from "../errors";
import type { LedgerTx } from "../ledger";
export class CampaignClaimDuplicate extends Error {}
/** Tenant lock held: move a hold into a real message debit in the SAME transaction. */
export async function consumeCampaignHold(tx: LedgerTx, tenantId: string, recipientId: string, input: { to: string; text: string; segments: number; provider: string; key: string | null }) {
  const r = await tx.campaignRecipient.findFirst({ where: { id: recipientId }, include: { campaign: true } });
  if (!r || r.campaign.tenantId !== tenantId) throw new ValidationError("Kampanya alıcısı bulunamadı");
  if (r.status !== "pending") throw new CampaignClaimDuplicate();
  const c = r.campaign;
  const expectedKey = `camp:${c.id}:${r.id}:${r.attempts + 1}`;
  if (input.key !== expectedKey) throw new CampaignClaimDuplicate();
  if (c.body !== input.text || c.segmentsPerMessage !== input.segments || c.provider !== input.provider || r.phone !== input.to) throw new ValidationError("Kampanya içeriği veya sağlayıcısı değişti");
  const customer = await tx.customer.findFirst({ where: { id: r.customerId, phone: r.phone, marketingConsent: true }, select: { id: true } });
  if (c.remainingReserved < c.segmentsPerMessage) throw new ValidationError("Kampanya rezervasyonu yetersiz");
  await tx.campaign.update({ where: { id: c.id }, data: { remainingReserved: { decrement: c.segmentsPerMessage } } });
  if (c.status !== "active" || !customer) {
    await tx.campaignRecipient.update({ where: { id: r.id }, data: { status: "skipped" } });
    return false;
  }
  await tx.campaignRecipient.update({ where: { id: r.id }, data: { status: "processing", attempts: { increment: 1 } } });
  return true;
}
