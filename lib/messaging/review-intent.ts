import type { Appointment } from "@prisma/client";
import type { LedgerTx } from "../ledger";
import { normalizePhone } from "../phone";
import { isGoogleReviewUrl } from "../review-link";

export const REVIEW_DELAY_MS = 2 * 60 * 60000;
export const REVIEW_WAIT_MS = 24 * 60 * 60000;
/** Caller holds the tenant lock; this function never sends or reserves credits. */
export async function prepareReviewInvitation(tx: LedgerTx, tenantId: string, appointment: Pick<Appointment, "id" | "tenantId" | "customerId" | "endsAt" | "completedAt">) {
  if (appointment.tenantId !== tenantId) throw new Error("review_tenant_mismatch");
  if (!appointment.completedAt) return;
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { status: true, reviewInviteEnabled: true, reviewInviteUrl: true } });
  if (!tenant || tenant.status === "suspended" || !tenant.reviewInviteEnabled || !tenant.reviewInviteUrl || !isGoogleReviewUrl(tenant.reviewInviteUrl)) return;
  const customer = await tx.customer.findFirst({ where: { id: appointment.customerId }, select: { id: true, phone: true, marketingConsent: true, marketingConsentAt: true } });
  if (!customer?.marketingConsent || !customer.marketingConsentAt || normalizePhone(customer.phone) !== customer.phone) return;
  const dueAt = new Date(Math.max(+appointment.completedAt, +appointment.endsAt) + REVIEW_DELAY_MS);
  await tx.reviewInvitation.upsert({
    where: { appointmentId: appointment.id },
    create: { tenantId, appointmentId: appointment.id, customerId: customer.id, recipient: customer.phone, reviewUrl: tenant.reviewInviteUrl, completedAt: appointment.completedAt, dueAt, expiresAt: new Date(+dueAt + REVIEW_WAIT_MS) },
    update: {}, // A terminal/skipped intent is never re-armed by status/config changes.
  });
}
export async function skipPendingReviewInvitations(tx: LedgerTx, filter: { appointmentId?: string; customerId?: string }, reason: "appointment_changed" | "consent_withdrawn" | "settings_disabled" | "url_changed") {
  return tx.reviewInvitation.updateMany({ where: { ...filter, status: "pending" }, data: { status: "skipped", finishedReason: reason } });
}
