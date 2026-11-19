import { createHash } from "node:crypto";
import { z } from "zod";
import { writeAudit } from "../audit";
import { NotFoundError } from "../booking";
import { withTenant } from "../db";
import { ConflictError, ValidationError } from "../errors";
import { logger } from "../logger";
import { grantMonthlyCreditsFor } from "../messaging/credits";
import { isPlanId } from "../plan";
import { getPaymentProvider } from "./payment-provider";

/** UTC takvim ayı ekler; hedef ayda gün yoksa ayın son gününe sıkıştırır (31 Ocak + 1 ay = 28/29 Şubat). */
export function addMonthsUtc(d: Date, months: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), lastDay), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()));
}

export const paymentSchema = z.object({
  idempotencyKey: z.string().uuid(),
  tenantId: z.string().min(1).max(64),
  amountTry: z.number().positive().max(1_000_000).multipleOf(0.01),
  months: z.number().int().min(1).max(12),
  plan: z.string().refine(isPlanId, "invalid_plan").optional(),
  note: z.string().trim().max(500).optional(),
});

/**
 * Manuel ödeme: Payment kaydı + abonelik uzatma (max(now, mevcut bitiş) + ay), status=active,
 * pastDueSince temizlenir, istenirse plan değişir. Aynı transaction'da AuditLog.
 */
export async function recordManualPayment(actor: { id: string }, input: z.output<typeof paymentSchema>, now: Date = new Date()) {
  // Validate direct callers as well as HTTP. Persist the original result for lost-response retries.
  input = paymentSchema.parse(input);
  const requestHash = createHash("sha256").update(JSON.stringify({ actor: actor.id, amount: input.amountTry.toFixed(2), months: input.months, plan: input.plan ?? null, note: input.note ?? null })).digest("hex");
  const db = withTenant(input.tenantId);
  let replayed = false;
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id = ${input.tenantId} FOR UPDATE`;
    const existing = await tx.payment.findFirst({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.requestHash !== requestHash || !existing.appliedPlan || !existing.appliedEndsAt) throw new ConflictError("idempotencyKey", "İşlem anahtarı farklı bir ödeme için kullanıldı");
      replayed = true;
      return { paymentId: existing.id, status: "active" as const, plan: existing.appliedPlan, subscriptionEndsAt: existing.appliedEndsAt };
    }
    const t = await tx.tenant.findUnique({ where: { id: input.tenantId } });
    if (!t) throw new NotFoundError("Salon");
    const charge = await getPaymentProvider("manual").charge({ tenantId: input.tenantId, amountTry: input.amountTry, months: input.months, plan: input.plan, note: input.note, actorId: actor.id });
    if (charge.status !== "paid") throw new ValidationError("Ödeme tamamlanmadı");
    const base = t.subscriptionEndsAt && t.subscriptionEndsAt > now ? t.subscriptionEndsAt : now;
    const endsAt = addMonthsUtc(base, input.months);
    const payment = await tx.payment.create({
      data: { idempotencyKey: input.idempotencyKey, requestHash, appliedPlan: input.plan ?? t.plan, appliedEndsAt: endsAt, amountTry: input.amountTry.toFixed(2), method: charge.method, note: input.note ?? null, createdBy: actor.id } as never,
    });
    await tx.tenant.update({
      where: { id: t.id },
      data: { subscriptionEndsAt: endsAt, status: "active", pastDueSince: null, ...(input.plan ? { plan: input.plan } : {}) },
    });
    await writeAudit(tx, {
      actorId: actor.id, actorRole: "superadmin", tenantId: t.id, action: "payment.record",
      details: { paymentId: payment.id, amountTry: input.amountTry, months: input.months, plan: input.plan ?? t.plan, subscriptionEndsAt: endsAt.toISOString(), prevStatus: t.status, note: input.note ?? null },
    });
    return { paymentId: payment.id, status: "active" as const, plan: input.plan ?? t.plan, subscriptionEndsAt: endsAt };
  });
  // Yeni dönem için plan aylık SMS kredisi (bu ay verilmediyse); hata ödemeyi bozmaz, günlük iş telafi eder
  try {
    if (!replayed) await grantMonthlyCreditsFor(input.tenantId, now);
  } catch (err) {
    logger.error({ err, tenantId: input.tenantId }, "ödeme sonrası aylık kredi verilemedi");
  }
  return result;
}
