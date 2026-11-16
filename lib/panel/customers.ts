import { z } from "zod";
import { NotFoundError } from "../booking";
import { ValidationError } from "../errors";
import { assertOwner, assertWritable, type PanelCtx } from "../panel-auth";
import { assertFeature, hasFeature } from "../plan";

export const customerQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

async function planOfTenant(ctx: PanelCtx): Promise<string> {
  const t = await ctx.db.tenant.findUnique({ where: { id: ctx.tenantId }, select: { plan: true } });
  return t?.plan ?? "baslangic";
}

/** İsim veya telefon (rakam parçası) araması, sayfalı. */
/**
 * Yetki kararı (staff): müşteri listesi/ayrıntısı/notları ve raporlar YALNIZ owner'a açıktır.
 * Personel yalnızca randevu oluştururken müşteriyi bulmak için ad/telefon araması yapabilir:
 * en az 3 karakterlik sorgu zorunlu (listeleme/tarama yok), en çok 8 sonuç, sayfalama yok,
 * ve yalnız {id, name, phone} döner (e-posta, gelmedi sayısı, izin, not yok).
 */
export const STAFF_SEARCH_MIN = 3;
export const STAFF_SEARCH_MAX = 8;

export async function searchCustomers(ctx: PanelCtx, q: z.output<typeof customerQuerySchema>) {
  const term = q.q ?? "";
  if (ctx.user.role !== "owner") {
    if (term.length < STAFF_SEARCH_MIN) throw new ValidationError(`En az ${STAFF_SEARCH_MIN} karakter girin`, "q");
    const digits = term.replace(/[^\d+]/g, "");
    const or: object[] = [{ name: { contains: term, mode: "insensitive" } }];
    if (digits.length >= STAFF_SEARCH_MIN) or.push({ phone: { contains: digits } });
    const rows = await ctx.db.customer.findMany({ where: { OR: or }, orderBy: [{ name: "asc" }, { id: "asc" }], take: STAFF_SEARCH_MAX, select: { id: true, name: true, phone: true } });
    return { page: 1, pageSize: STAFF_SEARCH_MAX, total: rows.length, customers: rows };
  }
  const digits = term.replace(/[^\d+]/g, "");
  const or: object[] = [];
  if (term) or.push({ name: { contains: term, mode: "insensitive" } });
  if (digits.length >= 3) or.push({ phone: { contains: digits } });
  const where = term ? { OR: or.length ? or : [{ name: { contains: term, mode: "insensitive" as const } }] } : {};
  const [total, rows] = await Promise.all([
    ctx.db.customer.count({ where }),
    ctx.db.customer.findMany({ where, orderBy: [{ name: "asc" }, { id: "asc" }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  return {
    page: q.page, pageSize: q.pageSize, total,
    customers: rows.map((c) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email, noShowCount: c.noShowCount, marketingConsent: c.marketingConsent, createdAt: c.createdAt })),
  };
}

export async function getCustomer(ctx: PanelCtx, id: string, now: Date = new Date()) {
  assertOwner(ctx);
  const c = await ctx.db.customer.findFirst({ where: { id } });
  if (!c) throw new NotFoundError("Müşteri");
  const include = { service: { select: { nameTr: true, nameEn: true } }, staff: { select: { name: true } } };
  const [upcoming, past] = await Promise.all([
    ctx.db.appointment.findMany({ where: { customerId: id, startsAt: { gte: now }, status: { in: ["pending", "confirmed"] } }, orderBy: { startsAt: "asc" }, take: 50, include }),
    ctx.db.appointment.findMany({ where: { customerId: id, OR: [{ startsAt: { lt: now } }, { status: { notIn: ["pending", "confirmed"] } }] }, orderBy: { startsAt: "desc" }, take: 50, include }),
  ]);
  const notesEnabled = hasFeature(await planOfTenant(ctx), "customerNotes");
  const slim = (a: (typeof upcoming)[number]) => ({
    id: a.id, startsAt: a.startsAt, endsAt: a.endsAt, status: a.status, source: a.source, priceTry: Number(a.priceTry),
    service: a.service, staffName: a.staff.name,
  });
  return {
    id: c.id, name: c.name, phone: c.phone, email: c.email, locale: c.locale, noShowCount: c.noShowCount,
    marketingConsent: c.marketingConsent, kvkkAcceptedAt: c.kvkkAcceptedAt, createdAt: c.createdAt,
    notesEnabled, notes: notesEnabled ? c.notes : null,
    upcoming: upcoming.map(slim), past: past.map(slim),
  };
}

export const notesSchema = z.object({ notes: z.string().trim().max(2000).nullable() });

/** Müşteri notu: Pro+ (`customerNotes`). Başlangıç planında plan_feature (402). Yalnız owner. */
export async function updateCustomerNotes(ctx: PanelCtx, id: string, input: z.output<typeof notesSchema>) {
  assertOwner(ctx);
  assertWritable(ctx);
  assertFeature(await planOfTenant(ctx), "customerNotes");
  const r = await ctx.db.customer.updateMany({ where: { id }, data: { notes: input.notes && input.notes.length ? input.notes : null } });
  if (r.count === 0) throw new NotFoundError("Müşteri");
  return getCustomer(ctx, id);
}
