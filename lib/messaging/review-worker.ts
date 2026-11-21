/** Durable table is the queue of intent. No completion→enqueue transition is required. */
import { prisma, withTenant } from "../db";
import { lockTenant } from "../ledger";
import { sendMessage } from "./send";
import { renderReviewInvitation, reviewKey } from "./review-dispatch";

export async function recoverReviewInvitations(opts: { tenantId?: string; limit?: number; now?: Date } = {}) {
  const began = Date.now(), base = opts.now ?? new Date();
  const clock = () => new Date(+base + Date.now() - began);
  const limit = Number.isFinite(opts.limit) ? Math.max(1, Math.min(100, Math.floor(opts.limit!))) : 25;
  // Deliberately system-scoped discovery; all reads/writes/claims below bind the discovered tenant.
  const rows = await prisma.reviewInvitation.findMany({ where: { status: "pending", dueAt: { lte: clock() }, ...(opts.tenantId ? { tenantId: opts.tenantId } : {}) }, orderBy: [{ updatedAt: "asc" }, { id: "asc" }], take: limit, select: { id: true, tenantId: true, appointmentId: true, customerId: true, recipient: true, reviewUrl: true } });
  const result = { checked: rows.length, sent: 0, errors: 0 };
  for (const row of rows) {
    const db = withTenant(row.tenantId);
    try {
      const [tenant, customer] = await Promise.all([
        db.tenant.findUnique({ where: { id: row.tenantId }, select: { name: true } }),
        db.customer.findFirst({ where: { id: row.customerId }, select: { locale: true } }),
      ]);
      const outcome = await sendMessage({ tenantId: row.tenantId, appointmentId: row.appointmentId, reviewInvitationId: row.id, to: row.recipient, text: renderReviewInvitation(tenant?.name ?? "", customer?.locale ?? "tr", row.reviewUrl), template: "review_invite", reason: "notification", idempotencyKey: reviewKey(row.appointmentId), now: clock() });
      if (outcome.status === "sent") result.sent++;
      // Atomically claimed rows are already processing/terminal. Never replay existing attempts.
      if (outcome.status === "duplicate") await db.$transaction(async tx => {
        await lockTenant(tx, row.tenantId);
        await tx.reviewInvitation.updateMany({ where: { id: row.id, status: "pending" }, data: { status: "skipped", finishedReason: "existing_attempt" } });
      });
    } catch {
      // A row-local failure must not starve other salons. Do not log payload/URL/phone/SQL.
      result.errors++;
    }
    // Fair bounded scanning: quiet/not-due/config-race failures move behind untouched pending rows.
    // Never changes dueAt/expiry or resurrects a claimed/terminal invitation.
    await db.reviewInvitation.updateMany({ where: { id: row.id, status: "pending" }, data: { updatedAt: clock() } });
  }
  return result;
}
