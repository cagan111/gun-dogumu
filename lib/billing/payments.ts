import { z } from "zod";
import { writeAudit } from "../audit";
import { NotFoundError } from "../booking";
import { withTenant } from "../db";
import { ValidationError } from "../errors";
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
  tenantId: z.string().min(1).max(64),
  amountTry: z.number().positive().max(1_000_000),
  months: z.number().int().min(1).max(12),
  plan: z.string().refine(isPlanId, "invalid_plan").optional(),
  note: z.string().trim().max(500).optional(),
});

/**
 * Manuel ödeme: Payment kaydı + abonelik uzatma (max(now, mevcut bitiş) + ay), status=active,
 * pastDueSince temizlenir, istenirse plan değişir. Aynı transaction'da AuditLog.
 */
export async function recordManualPayment(actor: { id: string }, input: z.output<typeof paymentSchema>, now: Date = new Date()) {
  const provider = getPaymentProvider("manual");
  const charge = await provider.charge({ tenantId: input.tenantId, amountTry: input.amountTry, months: input.months, plan: input.plan, note: input.note, actorId: actor.id });
  const db = withTenant(input.tenantId);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id = ${input.tenantId} FOR UPDATE`;
    const t = await tx.tenant.findUnique({ where: { id: input.tenantId } });
    if (!t) throw new NotFoundError("Salon");
    if (charge.status !== "paid") throw new ValidationError("Ödeme tamamlanmadı");
    const base = t.subscriptionEndsAt && t.subscriptionEndsAt > now ? t.subscriptionEndsAt : now;
    const endsAt = addMonthsUtc(base, input.months);
    const payment = await tx.payment.create({
      data: { amountTry: input.amountTry.toFixed(2), method: charge.method, note: input.note ?? null, createdBy: actor.id } as never,
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
}
