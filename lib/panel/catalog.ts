import { servicePriceText } from "../service-terms";
import { writeAudit } from "../audit";
import { lockTenantRow } from "../db";
import { z } from "zod";
import { PlanLimitError, ValidationError } from "../errors";
import { NotFoundError } from "../booking";
import { validateWorkingDays, workingHoursSchema } from "../hours";
import { assertOwner, assertWritable, type PanelCtx } from "../panel-auth";
import { auditPanel } from "./audit";
import { planOf } from "../plan";

const httpsUrl = z.string().trim().url().max(500).refine((u) => u.startsWith("https://"), "https_only");
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const id = z.string().min(1).max(64);

/* ───────────── Hizmetler ───────────── */

const serviceBuffer = z.number().int().min(0).max(240);
const serviceActive = z.boolean();
const serviceOrder = z.number().int().min(0).max(10_000);
const serviceStaffIds = z.array(id).max(200);
export const serviceSchema = z.object({
  nameTr: z.string().trim().min(1).max(100),
  nameEn: z.string().trim().max(100).nullish(),
  durationMin: z.number().int().min(5).max(600),
  priceTry: z.number().min(0).max(100_000).refine(v => { try { servicePriceText(v); return true; } catch { return false; } }, "invalid_price_precision"),
  bufferMin: serviceBuffer.default(0),
  active: serviceActive.default(true),
  sortOrder: serviceOrder.default(0),
  staffIds: serviceStaffIds.default([]),
});
// Zod 4 applies defaults inside optional fields: PATCH must override those wrappers.
export const servicePatchSchema = serviceSchema.partial().extend({
  bufferMin: serviceBuffer.optional(), active: serviceActive.optional(),
  sortOrder: serviceOrder.optional(), staffIds: serviceStaffIds.optional(),
});

function outService<T extends { priceTry: unknown; staff: { staffId: string }[] }>(s: T) {
  const { priceTry, staff, ...rest } = s;
  return { ...rest, priceTry: Number(priceTry), staffIds: staff.map((l) => l.staffId) };
}

export async function listServices(ctx: PanelCtx) {
  const rows = await ctx.db.service.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: { staff: true } });
  return rows.map((r) => outService(r));
}

async function assertStaffIds(db: Pick<PanelCtx["db"], "staff">, ids: string[]) {
  if (ids.length === 0) return;
  const n = await db.staff.count({ where: { id: { in: ids } } });
  if (n !== new Set(ids).size) throw new NotFoundError("Personel");
}

export async function createService(ctx: PanelCtx, input: z.output<typeof serviceSchema>) {
  assertOwner(ctx);
  assertWritable(ctx);
  input = serviceSchema.parse(input);
  const { staffIds, ...data } = input;
  const row = await ctx.db.$transaction(async (tx) => {
    await lockTenantRow(tx, ctx.tenantId);
    const tenant = await tx.tenant.findUnique({ where: { id: ctx.tenantId }, select: { status: true } });
    if (!tenant) throw new NotFoundError("Salon");
    assertWritable({ tenantStatus: tenant.status });
    await assertStaffIds(tx, staffIds);
    const s = await tx.service.create({ data: { ...data, nameEn: data.nameEn ?? null, priceTry: servicePriceText(data.priceTry) } as never });
    if (staffIds.length) await tx.serviceStaff.createMany({ data: [...new Set(staffIds)].map((staffId) => ({ serviceId: s.id, staffId })) as never });
    await writeAudit(tx, { actorId: ctx.user.id, actorRole: ctx.user.role, tenantId: ctx.tenantId, action: "service.create", details: { id: s.id } });
    return s;
  });
  return getService(ctx, row.id);
}

export async function getService(ctx: PanelCtx, sid: string) {
  const s = await ctx.db.service.findFirst({ where: { id: sid }, include: { staff: true } });
  if (!s) throw new NotFoundError("Hizmet");
  return outService(s);
}

export async function updateService(ctx: PanelCtx, sid: string, input: z.output<typeof servicePatchSchema>) {
  assertOwner(ctx);
  assertWritable(ctx);
  input = servicePatchSchema.parse(input);
  const { staffIds, priceTry, ...rest } = input;
  await ctx.db.$transaction(async (tx) => {
    await lockTenantRow(tx, ctx.tenantId);
    const tenant = await tx.tenant.findUnique({ where: { id: ctx.tenantId }, select: { status: true } });
    if (!tenant) throw new NotFoundError("Salon");
    assertWritable({ tenantStatus: tenant.status });
    if (!(await tx.service.findFirst({ where: { id: sid }, select: { id: true } }))) throw new NotFoundError("Hizmet");
    if (staffIds !== undefined) await assertStaffIds(tx, staffIds);
    await tx.service.updateMany({ where: { id: sid }, data: { ...rest, ...(priceTry !== undefined ? { priceTry: servicePriceText(priceTry) } : {}) } });
    if (staffIds !== undefined) {
      const keep = [...new Set(staffIds)];
      const current = await tx.serviceStaff.findMany({ where: { serviceId: sid }, select: { staffId: true } });
      await tx.serviceStaff.deleteMany({ where: { serviceId: sid, ...(keep.length ? { staffId: { notIn: keep } } : {}) } });
      const added = keep.filter(staffId => !current.some(l => l.staffId === staffId));
      if (added.length) await tx.serviceStaff.createMany({ data: added.map(staffId => ({ serviceId: sid, staffId })) as never });
    }
    await writeAudit(tx, { actorId: ctx.user.id, actorRole: ctx.user.role, tenantId: ctx.tenantId, action: "service.update", details: { id: sid, fields: Object.keys(input) } });
  });
  return getService(ctx, sid);
}

/** Randevusu olan hizmet silinmez, pasifleştirilir (geçmiş bozulmasın). */
export async function deleteService(ctx: PanelCtx, sid: string) {
  assertOwner(ctx);
  assertWritable(ctx);
  const cur = await ctx.db.service.findFirst({ where: { id: sid } });
  if (!cur) throw new NotFoundError("Hizmet");
  if ((await ctx.db.appointment.count({ where: { serviceId: sid } })) > 0) {
    await ctx.db.service.updateMany({ where: { id: sid }, data: { active: false } });
    await auditPanel(ctx, "service.archive", { id: sid });
    return { deleted: false, archived: true };
  }
  await ctx.db.service.deleteMany({ where: { id: sid } });
  await auditPanel(ctx, "service.delete", { id: sid });
  return { deleted: true, archived: false };
}

/* ───────────── Personel ───────────── */

export const staffSchema = z.object({
  name: z.string().trim().min(1).max(100),
  photoUrl: httpsUrl.nullish(),
  color: hex.default("#2563eb"),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});
export const staffPatchSchema = staffSchema.partial();

export async function listStaff(ctx: PanelCtx) {
  return ctx.db.staff.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
}

/** Plan personel limiti: tenant satırı kilitlenir, aktif personel sayısı maxStaff'a ulaştıysa plan_limit (402). */
async function assertStaffRoom(ctx: PanelCtx, tx: Parameters<Parameters<PanelCtx["db"]["$transaction"]>[0]>[0], excludeId?: string) {
  await lockTenantRow(tx, ctx.tenantId);
  const t = await tx.tenant.findUnique({ where: { id: ctx.tenantId }, select: { plan: true } });
  const max = planOf(t?.plan ?? "baslangic").maxStaff;
  if (max === null) return;
  const n = await tx.staff.count({ where: { active: true, ...(excludeId ? { id: { not: excludeId } } : {}) } });
  if (n >= max) throw new PlanLimitError(max);
}

export async function createStaff(ctx: PanelCtx, input: z.output<typeof staffSchema>) {
  assertOwner(ctx);
  assertWritable(ctx);
  const row = await ctx.db.$transaction(async (tx) => {
    if (input.active) await assertStaffRoom(ctx, tx);
    return tx.staff.create({ data: { ...input, photoUrl: input.photoUrl ?? null } as never });
  });
  await auditPanel(ctx, "staff.create", { id: row.id });
  return row;
}

export async function updateStaff(ctx: PanelCtx, sid: string, input: z.output<typeof staffPatchSchema>) {
  assertOwner(ctx);
  assertWritable(ctx);
  const row = await ctx.db.$transaction(async (tx) => {
    const cur = await tx.staff.findFirst({ where: { id: sid } });
    if (!cur) throw new NotFoundError("Personel");
    if (input.active === true && !cur.active) await assertStaffRoom(ctx, tx, sid);
    await tx.staff.updateMany({ where: { id: sid }, data: input });
    return tx.staff.findFirstOrThrow({ where: { id: sid } });
  });
  await auditPanel(ctx, "staff.update", { id: sid, fields: Object.keys(input) });
  return row;
}

/** Randevusu olan personel silinmez, pasifleştirilir. */
export async function deleteStaff(ctx: PanelCtx, sid: string) {
  assertOwner(ctx);
  assertWritable(ctx);
  const cur = await ctx.db.staff.findFirst({ where: { id: sid } });
  if (!cur) throw new NotFoundError("Personel");
  if ((await ctx.db.appointment.count({ where: { staffId: sid } })) > 0) {
    await ctx.db.staff.updateMany({ where: { id: sid }, data: { active: false } });
    await auditPanel(ctx, "staff.archive", { id: sid });
    return { deleted: false, archived: true };
  }
  await ctx.db.staff.deleteMany({ where: { id: sid } });
  await auditPanel(ctx, "staff.delete", { id: sid });
  return { deleted: true, archived: false };
}

/* ───────────── Çalışma saatleri ───────────── */

export { workingHoursSchema };

export async function getWorkingHours(ctx: PanelCtx, staffId: string) {
  if (!(await ctx.db.staff.findFirst({ where: { id: staffId }, select: { id: true } }))) throw new NotFoundError("Personel");
  const rows = await ctx.db.workingHours.findMany({ where: { staffId }, orderBy: { weekday: "asc" } });
  return { staffId, days: rows.map((r) => ({ weekday: r.weekday, startMin: r.startMin, endMin: r.endMin, breaks: r.breaks })) };
}

/** 7 günün tamamını değiştirir; listede olmayan gün kapalıdır. */
export async function setWorkingHours(ctx: PanelCtx, staffId: string, input: z.output<typeof workingHoursSchema>) {
  assertOwner(ctx);
  assertWritable(ctx);
  if (!(await ctx.db.staff.findFirst({ where: { id: staffId }, select: { id: true } }))) throw new NotFoundError("Personel");
  const days = validateWorkingDays(input.days);
  await ctx.db.$transaction(async (tx) => {
    await tx.workingHours.deleteMany({ where: { staffId } });
    if (days.length) await tx.workingHours.createMany({ data: days.map((d) => ({ staffId, ...d })) as never });
  });
  await auditPanel(ctx, "working_hours.set", { staffId, days: days.length });
  return getWorkingHours(ctx, staffId);
}

/* ───────────── İzin ───────────── */

const iso = z.string().datetime({ offset: true }).transform((v) => new Date(v));
export const timeOffSchema = z.object({
  staffId: id,
  startsAt: iso,
  endsAt: iso,
  kind: z.enum(["leave", "holiday", "other"]).default("leave"),
  reason: z.string().trim().max(200).nullish(),
});
export const timeOffPatchSchema = timeOffSchema.partial().omit({ staffId: true });

export async function listTimeOff(ctx: PanelCtx, q: { staffId?: string } = {}) {
  return ctx.db.timeOff.findMany({ where: q.staffId ? { staffId: q.staffId } : {}, orderBy: { startsAt: "asc" } });
}

export async function createTimeOff(ctx: PanelCtx, input: z.output<typeof timeOffSchema>) {
  assertOwner(ctx);
  assertWritable(ctx);
  if (input.endsAt <= input.startsAt) throw new ValidationError("Bitiş başlangıçtan sonra olmalı", "endsAt");
  if (!(await ctx.db.staff.findFirst({ where: { id: input.staffId }, select: { id: true } }))) throw new NotFoundError("Personel");
  const row = await ctx.db.timeOff.create({ data: { ...input, reason: input.reason ?? null } as never });
  await auditPanel(ctx, "time_off.create", { id: row.id, staffId: input.staffId });
  return row;
}

export async function updateTimeOff(ctx: PanelCtx, tid: string, input: z.output<typeof timeOffPatchSchema>) {
  assertOwner(ctx);
  assertWritable(ctx);
  const cur = await ctx.db.timeOff.findFirst({ where: { id: tid } });
  if (!cur) throw new NotFoundError("İzin");
  const s = input.startsAt ?? cur.startsAt;
  const e = input.endsAt ?? cur.endsAt;
  if (e <= s) throw new ValidationError("Bitiş başlangıçtan sonra olmalı", "endsAt");
  await ctx.db.timeOff.updateMany({ where: { id: tid }, data: input });
  await auditPanel(ctx, "time_off.update", { id: tid });
  return ctx.db.timeOff.findFirstOrThrow({ where: { id: tid } });
}

export async function deleteTimeOff(ctx: PanelCtx, tid: string) {
  assertOwner(ctx);
  assertWritable(ctx);
  const r = await ctx.db.timeOff.deleteMany({ where: { id: tid } });
  if (r.count === 0) throw new NotFoundError("İzin");
  await auditPanel(ctx, "time_off.delete", { id: tid });
  return { deleted: true };
}

