/** Internal review sender gates. Callers hold the canonical Tenant lock. */
import type { ReviewInvitation } from "@prisma/client";
import type { LedgerTx } from "../ledger";
import { normalizePhone } from "../phone";
import { isGoogleReviewUrl } from "../review-link";
import { isQuietHour } from "./schedule";
import { REVIEW_DELAY_MS } from "./review-intent";

export const reviewKey = (appointmentId: string) => `review:${appointmentId}`;
export function renderReviewInvitation(salon: string, locale: string, url: string) {
  return locale === "en" ? `${salon}: Would you like to share your experience? ${url}` : `${salon}: Deneyiminizi paylaşmak ister misiniz? ${url}`;
}
export class ReviewClaimDuplicate extends Error {}
export async function reviewGate(tx: LedgerTx, tenantId: string, intent: ReviewInvitation, now: Date) {
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
  const appointment = await tx.appointment.findFirst({ where: { id: intent.appointmentId } });
  const customer = await tx.customer.findFirst({ where: { id: intent.customerId } });
  let reason: string | null = null;
  if (intent.tenantId !== tenantId || !tenant || !appointment || !customer || appointment.customerId !== customer.id) reason = "review_scope_invalid";
  else if (tenant.status === "suspended") reason = "tenant_suspended";
  else if (!tenant.reviewInviteEnabled) reason = "settings_disabled";
  else if (tenant.reviewInviteUrl !== intent.reviewUrl || !isGoogleReviewUrl(intent.reviewUrl)) reason = "url_changed";
  else if (appointment.status !== "completed" || !appointment.completedAt || +appointment.completedAt !== +intent.completedAt) reason = "appointment_changed";
  else if (!customer.marketingConsent || !customer.marketingConsentAt) reason = "consent_withdrawn";
  else if (customer.phone !== intent.recipient || normalizePhone(intent.recipient) !== intent.recipient) reason = "recipient_changed";
  else if (+now >= +intent.expiresAt) reason = "expired";
  else if (+now < Math.max(+intent.dueAt, +appointment.endsAt + REVIEW_DELAY_MS)) reason = "not_due";
  else if (isQuietHour(now, tenant.timeZone, tenant.quietStartHour, tenant.quietEndHour)) reason = "quiet_hours";
  return { reason, tenant, customer };
}
export async function skipReview(tx: LedgerTx, id: string, reason: string) {
  await tx.reviewInvitation.updateMany({ where: { id, status: { in: ["pending", "processing"] } }, data: { status: "skipped", finishedReason: reason } });
}
export async function finishReviewMessage(tx: LedgerTx, messageId: string, reason: string) {
  await tx.reviewInvitation.updateMany({ where: { messageId, status: "processing" }, data: { status: "finished", finishedReason: reason.slice(0,64) } });
}
