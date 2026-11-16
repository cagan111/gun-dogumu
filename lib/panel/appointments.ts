import { z } from "zod";
import { computeAvailability, type StaffAvailabilityInput } from "../availability";
import { AlreadyClosedError, createAppointment, isOverlapError, NotFoundError, SlotTakenError, SlotUnavailableError } from "../booking";
import { ConflictError, ValidationError } from "../errors";
import { type PanelCtx } from "../panel-auth";
import { phoneSchema } from "../phone";
import { addDays, dayRangeUtc, isValidDate, utcToLocal } from "../time";

const ACTIVE = ["pending", "confirmed"] as const;
const MAX_RANGE_DAYS = 62;

export const listQuerySchema = z.object({
  from: z.string().refine(isValidDate, "invalid_date"),
  to: z.string().refine(isValidDate, "invalid_date"),
  staffId: z.string().min(1).max(64).optional(),
});

/** Yerel tarih aralığındaki (to dahil) randevular; salon saat diliminde. */
export async function listAppointments(ctx: PanelCtx, q: z.infer<typeof listQuerySchema>) {
  if (q.to < q.from) throw new ValidationError("to, from'dan önce olamaz", "to");
  let last = q.from;
  for (let i = 0; i < MAX_RANGE_DAYS && last < q.to; i++) last = addDays(last, 1);
  if (last < q.to) throw new ValidationError(`En fazla ${MAX_RANGE_DAYS} günlük aralık`, "to");
  const tz = await tenantTz(ctx);
  const rows = await ctx.db.appointment.findMany({
    where: { startsAt: { gte: dayRangeUtc(q.from, tz).start, lt: dayRangeUtc(q.to, tz).end }, ...(q.staffId ? { staffId: q.staffId } : {}) },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    include: { service: { select: { nameTr: true, nameEn: true } }, staff: { select: { name: true, color: true } }, customer: { select: { id: true, name: true, phone: true, noShowCount: true } } },
  });
  return { timeZone: tz, appointments: rows.map(serialize) };
}

async function tenantTz(ctx: PanelCtx): Promise<string> {
  const t = await ctx.db.tenant.findUnique({ where: { id: ctx.tenantId }, select: { timeZone: true } });
  if (!t) throw new NotFoundError("Salon");
  return t.timeZone;
}

function serialize<T extends { priceTry: unknown; cancelToken: string }>(a: T) {
  const { priceTry, cancelToken, ...rest } = a;
  void cancelToken; // iptal bağlantısı müşteriye aittir, panele sızdırılmaz
  return { ...rest, priceTry: Number(priceTry) };
}

export async function getAppointment(ctx: PanelCtx, id: string) {
  const a = await ctx.db.appointment.findFirst({
    where: { id },
    include: {
      service: { select: { nameTr: true, nameEn: true } },
      staff: { select: { name: true, color: true } },
      customer: { select: { id: true, name: true, phone: true, noShowCount: true } },
    },
  });
  if (!a) throw new NotFoundError("Randevu");
  return serialize(a);
}

export const createSchema = z.object({
  serviceId: z.string().min(1).max(64),
  staffId: z.string().min(1).max(64).default("any"),
  startsAt: z.string().datetime({ offset: true }).transform((v) => new Date(v)),
  source: z.enum(["panel", "walk_in"]).default("panel"),
  note: z.string().trim().max(500).optional(),
  customer: z.object({
    name: z.string().trim().min(2).max(100),
    phone: phoneSchema,
    email: z.string().trim().email().max(200).optional(),
  }),
});

/** Panelden randevu: en erken/en geç kuralı atlanır; çalışma saati, izin ve çakışma kuralı atlanmaz. */
export async function createPanelAppointment(ctx: PanelCtx, input: z.output<typeof createSchema>, now: Date = new Date()) {
  const a = await createAppointment(ctx.db, {
    tenantId: ctx.tenantId, serviceId: input.serviceId, staffId: input.staffId, startsAt: input.startsAt,
    customer: input.customer, source: input.source, note: input.note ?? null, now, bypassLeadRules: true,
  });
  return getAppointment(ctx, a.id);
}

export const moveSchema = z.object({
  startsAt: z.string().datetime({ offset: true }).transform((v) => new Date(v)),
  staffId: z.string().min(1).max(64).optional(),
});

/** Randevuyu taşır: yeni saat/personel için müsaitlik (kendisi hariç) yeniden doğrulanır; çakışma → 409. */
export async function moveAppointment(ctx: PanelCtx, id: string, input: z.output<typeof moveSchema>) {
  const appt = await ctx.db.appointment.findFirst({ where: { id } });
  if (!appt) throw new NotFoundError("Randevu");
  if (!ACTIVE.includes(appt.status as (typeof ACTIVE)[number])) throw new AlreadyClosedError();
  const staffId = input.staffId ?? appt.staffId;
  const durMs = appt.endsAt.getTime() - appt.startsAt.getTime();
  const bufMs = appt.blockedUntil.getTime() - appt.endsAt.getTime();
  const tz = await tenantTz(ctx);

  const staff = await ctx.db.staff.findFirst({ where: { id: staffId, active: true } });
  if (!staff) throw new NotFoundError("Personel");
  if (staffId !== appt.staffId) {
    const link = await ctx.db.serviceStaff.findFirst({ where: { serviceId: appt.serviceId, staffId } });
    if (!link) throw new SlotUnavailableError();
  }

  const local = utcToLocal(input.startsAt, tz);
  const range = dayRangeUtc(local.date, tz);
  const winFrom = dayRangeUtc(addDays(local.date, -1), tz).start;
  const winTo = dayRangeUtc(addDays(local.date, 1), tz).end;
  const [hours, timeOff, busy] = await Promise.all([
    ctx.db.workingHours.findMany({ where: { staffId } }),
    ctx.db.timeOff.findMany({ where: { staffId, startsAt: { lt: winTo }, endsAt: { gt: winFrom } } }),
    ctx.db.appointment.findMany({
      where: { staffId, id: { not: id }, status: { in: [...ACTIVE] }, startsAt: { lt: winTo }, blockedUntil: { gt: winFrom } },
      select: { staffId: true, startsAt: true, blockedUntil: true },
    }),
  ]);
  const sa: StaffAvailabilityInput = {
    id: staffId,
    workingHours: hours.map((h) => ({ weekday: h.weekday, startMin: h.startMin, endMin: h.endMin, breaks: breaksOf(h.breaks) })),
    timeOff: timeOff.map((t) => ({ startsAt: t.startsAt, endsAt: t.endsAt })),
  };
  const base = {
    tenant: { timeZone: tz, slotMinutes: 5, minLeadMinutes: 0, maxAdvanceDays: 0 },
    service: { durationMin: Math.round(durMs / 60_000), bufferMin: Math.round(bufMs / 60_000) },
    staff: [sa], date: local.date, now: range.start,
  };
  const t = input.startsAt.getTime();
  if (!computeAvailability({ ...base, busy }).some((s) => s.start.getTime() === t)) {
    const fits = computeAvailability({ ...base, busy: [] }).some((s) => s.start.getTime() === t);
    throw fits ? new SlotTakenError() : new SlotUnavailableError();
  }
  const endsAt = new Date(t + durMs);
  try {
    const r = await ctx.db.appointment.updateMany({
      where: { id, status: { in: [...ACTIVE] } },
      data: { staffId, startsAt: input.startsAt, endsAt, blockedUntil: new Date(endsAt.getTime() + bufMs) },
    });
    if (r.count === 0) throw new AlreadyClosedError();
  } catch (e) {
    if (isOverlapError(e)) throw new SlotTakenError();
    throw e;
  }
  return getAppointment(ctx, id);
}

function breaksOf(json: unknown): [number, number][] {
  if (!Array.isArray(json)) return [];
  return json.filter((b): b is [number, number] => Array.isArray(b) && typeof b[0] === "number" && typeof b[1] === "number");
}

export const statusSchema = z.object({ status: z.enum(["confirmed", "completed", "no_show", "cancelled_by_salon"]) });

/** Durum değiştirir. no_show geçişleri Customer.noShowCount'u artırır/azaltır (atomik). */
export async function setAppointmentStatus(ctx: PanelCtx, id: string, status: z.output<typeof statusSchema>["status"], now: Date = new Date()) {
  try {
    await ctx.db.$transaction(async (tx) => {
      const a = await tx.appointment.findFirst({ where: { id } });
      if (!a) throw new NotFoundError("Randevu");
      if (a.status === status) return;
      if (a.status === "cancelled_by_customer") throw new AlreadyClosedError();
      const r = await tx.appointment.updateMany({
        where: { id, status: a.status },
        data: { status, cancelledAt: status === "cancelled_by_salon" ? now : null },
      });
      if (r.count === 0) throw new ConflictError("status", "Randevu eşzamanlı olarak değiştirildi");
      if (status === "no_show") {
        await tx.customer.updateMany({ where: { id: a.customerId }, data: { noShowCount: { increment: 1 } } });
      } else if (a.status === "no_show") {
        await tx.customer.updateMany({ where: { id: a.customerId, noShowCount: { gt: 0 } }, data: { noShowCount: { decrement: 1 } } });
      }
    });
  } catch (e) {
    if (isOverlapError(e)) throw new SlotTakenError(); // iptal/gelmedi → confirmed'a dönüşte slot başkasına geçmiş
    throw e;
  }
  return getAppointment(ctx, id);
}
