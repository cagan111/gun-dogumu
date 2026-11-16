import { Prisma } from "@prisma/client";
import { z } from "zod";
import { PLANS } from "@/config/plans";
import { writeAudit } from "../audit";
import { NotFoundError } from "../booking";
import { prisma, withTenant } from "../db";
import { ConflictError, ValidationError } from "../errors";
import { creditTx, getBalance } from "../ledger";
import { getAllPlanPrices } from "../plan-price";
import { isPlanId } from "../plan";
import { dayRangeUtc, utcToLocal } from "../time";

type Actor = { id: string };

const page = {
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
};

/* ───────────── Salonlar ───────────── */

export const tenantListSchema = z.object({
  ...page,
  status: z.enum(["trial", "active", "past_due", "suspended"]).optional(),
  plan: z.string().refine(isPlanId, "invalid_plan").optional(),
  q: z.string().trim().max(100).optional(),
});

async function balances(ids: string[]): Promise<Map<string, number>> {
  // Süper-admin tenant'lar arası okur; bakiye = delta toplamı (lib/ledger.ts ile aynı tanım)
  const rows = await prisma.smsLedger.groupBy({ by: ["tenantId"], where: { tenantId: { in: ids } }, _sum: { delta: true } });
  return new Map(rows.map((r) => [r.tenantId, r._sum.delta ?? 0]));
}

export async function listTenants(q: z.output<typeof tenantListSchema>) {
  const where: Prisma.TenantWhereInput = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.plan ? { plan: q.plan } : {}),
    ...(q.q ? { OR: [{ name: { contains: q.q, mode: "insensitive" } }, { slug: { contains: q.q, mode: "insensitive" } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.tenant.count({ where }),
    prisma.tenant.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  const bal = await balances(rows.map((r) => r.id));
  return {
    page: q.page, pageSize: q.pageSize, total,
    tenants: rows.map((t) => ({
      id: t.id, slug: t.slug, name: t.name, city: t.city, plan: t.plan, status: t.status,
      trialEndsAt: t.trialEndsAt, subscriptionEndsAt: t.subscriptionEndsAt, pastDueSince: t.pastDueSince,
      smsBalance: bal.get(t.id) ?? 0, lastLoginAt: t.lastLoginAt, createdAt: t.createdAt,
    })),
  };
}

export async function getTenantDetail(tenantId: string) {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, include: { users: { select: { id: true, email: true, name: true, role: true, lastLoginAt: true } } } });
  if (!t) throw new NotFoundError("Salon");
  const db = withTenant(tenantId);
  const [smsBalance, staffCount, serviceCount, appointmentCount, payments, requests] = await Promise.all([
    getBalance(db), db.staff.count({ where: { active: true } }), db.service.count({ where: { active: true } }), db.appointment.count(),
    db.payment.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    db.smsPackageRequest.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const { users, ...tenant } = t;
  return {
    tenant, users, smsBalance, staffCount, serviceCount, appointmentCount,
    payments: payments.map((p) => ({ ...p, amountTry: Number(p.amountTry) })),
    smsRequests: requests,
  };
}

export const planChangeSchema = z.object({ plan: z.string().refine(isPlanId, "invalid_plan") });

export async function changePlan(actor: Actor, tenantId: string, input: z.output<typeof planChangeSchema>) {
  return prisma.$transaction(async (tx) => {
    const t = await tx.tenant.findUnique({ where: { id: tenantId } });
    if (!t) throw new NotFoundError("Salon");
    await tx.tenant.update({ where: { id: tenantId }, data: { plan: input.plan } });
    await writeAudit(tx, { actorId: actor.id, actorRole: "superadmin", tenantId, action: "tenant.plan_changed", details: { from: t.plan, to: input.plan } });
    return { tenantId, plan: input.plan };
  });
}

export async function suspendTenant(actor: Actor, tenantId: string, note?: string) {
  return prisma.$transaction(async (tx) => {
    const t = await tx.tenant.findUnique({ where: { id: tenantId } });
    if (!t) throw new NotFoundError("Salon");
    if (t.status === "suspended") throw new ConflictError("status", "Salon zaten askıda");
    await tx.tenant.update({ where: { id: tenantId }, data: { status: "suspended" } });
    await writeAudit(tx, { actorId: actor.id, actorRole: "superadmin", tenantId, action: "tenant.suspended", details: { from: t.status, note: note ?? null } });
    return { tenantId, status: "suspended" as const };
  });
}

/** Askıdan çıkarır: ücretli dönem sürüyorsa active, deneme sürüyorsa trial, yoksa past_due (yeni 7 gün). */
export async function unsuspendTenant(actor: Actor, tenantId: string, now: Date = new Date(), note?: string) {
  return prisma.$transaction(async (tx) => {
    const t = await tx.tenant.findUnique({ where: { id: tenantId } });
    if (!t) throw new NotFoundError("Salon");
    if (t.status !== "suspended") throw new ConflictError("status", "Salon askıda değil");
    const status = t.subscriptionEndsAt && t.subscriptionEndsAt > now ? "active" : t.trialEndsAt && t.trialEndsAt > now ? "trial" : "past_due";
    await tx.tenant.update({ where: { id: tenantId }, data: { status, pastDueSince: status === "past_due" ? now : null } });
    await writeAudit(tx, { actorId: actor.id, actorRole: "superadmin", tenantId, action: "tenant.unsuspended", details: { to: status, note: note ?? null } });
    return { tenantId, status };
  });
}

/* ───────────── SMS kredisi ───────────── */

export const smsCreditSchema = z.object({
  tenantId: z.string().min(1).max(64),
  amount: z.number().int().min(1).max(1_000_000),
  note: z.string().trim().max(500).optional(),
  requestId: z.string().min(1).max(64).optional(),
});

/** Kredi yükler (package_purchase). requestId verilirse açık ve boyutu eşleşen talep karşılanır. */
export async function addSmsCredits(actor: Actor, input: z.output<typeof smsCreditSchema>) {
  const db = withTenant(input.tenantId);
  return db.$transaction(async (tx) => {
    if (!(await tx.tenant.findUnique({ where: { id: input.tenantId }, select: { id: true } }))) throw new NotFoundError("Salon");
    if (input.requestId) {
      const req = await tx.smsPackageRequest.findFirst({ where: { id: input.requestId } });
      if (!req) throw new NotFoundError("Talep");
      if (req.status !== "open") throw new ConflictError("requestId", "Talep zaten kapatılmış");
      if (req.size !== input.amount) throw new ValidationError("Miktar talep edilen paketle eşleşmiyor", "amount");
      await tx.smsPackageRequest.updateMany({ where: { id: req.id, status: "open" }, data: { status: "fulfilled" } });
    }
    const r = await creditTx(tx, input.tenantId, input.amount, "package_purchase", input.note ?? (input.requestId ? `Paket talebi ${input.requestId}` : null));
    await writeAudit(tx, { actorId: actor.id, actorRole: "superadmin", tenantId: input.tenantId, action: "sms.credit", details: { amount: input.amount, requestId: input.requestId ?? null, balance: r.balance, note: input.note ?? null } });
    return { tenantId: input.tenantId, ledgerId: r.id, balance: r.balance };
  });
}

export const smsRequestListSchema = z.object({ ...page, status: z.enum(["open", "fulfilled", "rejected"]).optional(), tenantId: z.string().max(64).optional() });

export async function listSmsRequests(q: z.output<typeof smsRequestListSchema>) {
  const where: Prisma.SmsPackageRequestWhereInput = { ...(q.status ? { status: q.status } : {}), ...(q.tenantId ? { tenantId: q.tenantId } : {}) };
  const [total, rows] = await Promise.all([
    prisma.smsPackageRequest.count({ where }),
    prisma.smsPackageRequest.findMany({ where, orderBy: { createdAt: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { tenant: { select: { name: true, slug: true } } } }),
  ]);
  return { page: q.page, pageSize: q.pageSize, total, requests: rows };
}

export const smsRequestResolveSchema = z.object({ action: z.enum(["fulfil", "reject"]), note: z.string().trim().max(500).optional() });

/** Talebi karşılar (kredi yükler) ya da reddeder. */
export async function resolveSmsRequest(actor: Actor, requestId: string, input: z.output<typeof smsRequestResolveSchema>) {
  const ref = await prisma.smsPackageRequest.findUnique({ where: { id: requestId } });
  if (!ref) throw new NotFoundError("Talep");
  if (input.action === "fulfil") return addSmsCredits(actor, { tenantId: ref.tenantId, amount: ref.size, requestId, note: input.note });
  return withTenant(ref.tenantId).$transaction(async (tx) => {
    const r = await tx.smsPackageRequest.updateMany({ where: { id: requestId, status: "open" }, data: { status: "rejected" } });
    if (r.count === 0) throw new ConflictError("requestId", "Talep zaten kapatılmış");
    await writeAudit(tx, { actorId: actor.id, actorRole: "superadmin", tenantId: ref.tenantId, action: "sms.request_rejected", details: { requestId, note: input.note ?? null } });
    return { requestId, status: "rejected" as const };
  });
}

/* ───────────── Plan fiyatları ───────────── */

export const planPricesSchema = z
  .object({ prices: z.record(z.string().refine(isPlanId, "invalid_plan"), z.number().min(0).max(1_000_000).nullable()) })
  .refine((o) => Object.keys(o.prices).length > 0, "empty");

export async function getPlanPrices() {
  const prices = await getAllPlanPrices();
  return { prices, defaults: Object.fromEntries(Object.values(PLANS).map((p) => [p.id, p.priceTry])) };
}

/** Fiyatı ezer; null değer ezmeyi kaldırır (config'e döner). */
export async function updatePlanPrices(actor: Actor, input: z.output<typeof planPricesSchema>) {
  await prisma.$transaction(async (tx) => {
    for (const [planId, price] of Object.entries(input.prices)) {
      if (price === null) await tx.planPrice.deleteMany({ where: { planId } });
      else await tx.planPrice.upsert({ where: { planId }, create: { planId, priceTry: price.toFixed(2) }, update: { priceTry: price.toFixed(2) } });
    }
    await writeAudit(tx, { actorId: actor.id, actorRole: "superadmin", action: "plan_prices.updated", details: input.prices as Prisma.InputJsonObject });
  });
  return getPlanPrices();
}

/* ───────────── Gelir özeti ───────────── */

/** MRR = aktif salonların GÜNCEL plan fiyatları toplamı; durum sayıları; bu ay satılan SMS ve alınan ödeme. */
export async function revenueSummary(now: Date = new Date(), timeZone = "Asia/Famagusta") {
  const local = utcToLocal(now, timeZone).date;
  const monthStart = dayRangeUtc(`${local.slice(0, 7)}-01`, timeZone).start;
  const [byStatus, activeByPlan, prices, sms, pay] = await Promise.all([
    prisma.tenant.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.tenant.groupBy({ by: ["plan"], where: { status: "active" }, _count: { _all: true } }),
    getAllPlanPrices(),
    prisma.smsLedger.aggregate({ where: { reason: "package_purchase", createdAt: { gte: monthStart, lte: now } }, _sum: { delta: true } }),
    prisma.payment.aggregate({ where: { createdAt: { gte: monthStart, lte: now } }, _sum: { amountTry: true } }),
  ]);
  const counts = { trial: 0, active: 0, past_due: 0, suspended: 0 };
  for (const r of byStatus) counts[r.status] = r._count._all;
  const mrrTry = activeByPlan.reduce((s, r) => s + (((prices as Record<string, number>)[r.plan] ?? 0) * r._count._all), 0);
  return { mrrTry, counts, smsSoldThisMonth: sms._sum.delta ?? 0, paymentsThisMonthTry: Number(pay._sum.amountTry ?? 0), monthStart };
}

/* ───────────── Denetim kaydı ───────────── */

export const auditListSchema = z.object({ ...page, tenantId: z.string().max(64).optional(), action: z.string().max(100).optional() });

export async function listAudit(q: z.output<typeof auditListSchema>) {
  const where: Prisma.AuditLogWhereInput = { ...(q.tenantId ? { tenantId: q.tenantId } : {}), ...(q.action ? { action: { startsWith: q.action } } : {}) };
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  return { page: q.page, pageSize: q.pageSize, total, entries: rows };
}
