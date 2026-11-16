/** Aylık plan SMS kredisi: aktif/deneme her salona takvim ayında bir kez (UTC ayı). */
import { prisma, withTenant } from "../db";
import { creditTx } from "../ledger";
import { logger } from "../logger";
import { planOf } from "../plan";

export const monthKey = (d: Date) => d.toISOString().slice(0, 7);

/** Tek salon için: bu ay verilmediyse verir. Dönüş: verilen miktar (0 = zaten verilmişti / plan 0). */
export async function grantMonthlyCreditsFor(tenantId: string, now: Date): Promise<number> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true, status: true } });
  if (!t || (t.status !== "active" && t.status !== "trial")) return 0;
  const amount = planOf(t.plan).monthlySms;
  if (amount <= 0) return 0;
  const key = monthKey(now);
  const monthStart = new Date(`${key}-01T00:00:00.000Z`);
  return withTenant(tenantId).$transaction(async (tx) => {
    // aynı salon için eşzamanlı çağrıları sıraya sok
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"monthly:" + tenantId}))::text`;
    const already = await tx.smsLedger.findFirst({
      where: { reason: "plan_monthly", OR: [{ note: { startsWith: `monthly:${key}` } }, { createdAt: { gte: monthStart } }] },
      select: { id: true },
    });
    if (already) return 0;
    await creditTx(tx, tenantId, amount, "plan_monthly", `monthly:${key}`);
    return amount;
  });
}

export async function grantMonthlyCredits(now: Date = new Date(), opts: { tenantIds?: string[] } = {}) {
  const tenants = await prisma.tenant.findMany({
    where: { status: { in: ["active", "trial"] }, ...(opts.tenantIds ? { id: { in: opts.tenantIds } } : {}) },
    select: { id: true },
  });
  let granted = 0, credited = 0;
  for (const t of tenants) {
    try {
      const n = await grantMonthlyCreditsFor(t.id, now);
      if (n > 0) { granted++; credited += n; }
    } catch (err) {
      logger.error({ err, tenantId: t.id }, "aylık kredi verilemedi");
    }
  }
  return { checked: tenants.length, granted, credited };
}
