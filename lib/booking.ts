import { lockTenantKey } from "./db";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma, type TenantDb } from "./db";
import { computeAvailability, type StaffAvailabilityInput } from "./availability";
import { appointmentChanged } from "./appointment-hook";
import { normalizePhone } from "./phone";
import { addDays, dayRangeUtc, utcToLocal } from "./time";

export class BookingError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = new.target.name; }
}
/** İstenen slot başka bir randevu tarafından alınmış (çift rezervasyon). */
export class SlotTakenError extends BookingError {
  constructor() { super("slot_taken", "Bu saat az önce doldu"); }
}
/** Slot çalışma saati / izin / en erken-en geç kuralı nedeniyle uygun değil. */
export class SlotUnavailableError extends BookingError {
  constructor() { super("slot_unavailable", "Seçilen saat uygun değil"); }
}
export class NotFoundError extends BookingError {
  constructor(what: string) { super("not_found", `${what} bulunamadı`); }
}
export class InvalidPhoneError extends BookingError {
  constructor() { super("invalid_phone", "Geçersiz telefon numarası"); }
}
export class CancelWindowError extends BookingError {
  constructor(public hoursBefore: number) { super("cancel_window", `Randevuya ${hoursBefore} saatten az kaldığı için iptal edilemez`); }
}
export class AlreadyClosedError extends BookingError {
  constructor() { super("already_closed", "Randevu zaten iptal edilmiş veya tamamlanmış"); }
}

export interface CreateAppointmentInput {
  tenantId: string;
  serviceId: string;
  /** Personel id'si ya da "any" (fark etmez). */
  staffId: string | "any";
  startsAt: Date;
  customer: { name: string; phone: string; email?: string | null; locale?: string; marketingConsent?: boolean; kvkkAccepted?: boolean };
  source?: "online" | "panel" | "walk_in";
  note?: string | null;
  now?: Date;
  /** Panel: en erken/en geç kuralı ve geçmiş saat atlanır, 5 dk ızgara kullanılır; çalışma saati, mola, izin ve çakışma kuralları ASLA atlanmaz. */
  bypassLeadRules?: boolean;
}

/** Postgres exclusion violation (23P01) mı? Prisma bunu P2010/P2004/bilinmeyen hata olarak sarabilir. */
export function isOverlapError(e: unknown): boolean {
  const seen = new Set<unknown>();
  const walk = (x: unknown): boolean => {
    if (!x || typeof x !== "object" || seen.has(x)) return false;
    seen.add(x);
    const o = x as { code?: unknown; message?: unknown; meta?: unknown; cause?: unknown };
    if (o.code === "23P01") return true;
    if (typeof o.message === "string" && (o.message.includes("appointment_no_overlap") || o.message.includes("23P01"))) return true;
    return walk(o.meta) || walk(o.cause);
  };
  return walk(e);
}

function parseBreaks(json: unknown): [number, number][] {
  if (!Array.isArray(json)) return [];
  const out: [number, number][] = [];
  for (const b of json) {
    if (Array.isArray(b) && typeof b[0] === "number" && typeof b[1] === "number") out.push([b[0], b[1]]);
  }
  return out;
}

export function newCancelToken(): string {
  return randomBytes(24).toString("base64url");
}

async function attempt(db: TenantDb, input: CreateAppointmentInput) {
  const now = input.now ?? new Date();
  const phone = normalizePhone(input.customer.phone);
  if (!phone) throw new InvalidPhoneError();

  return db.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: input.tenantId } });
    if (!tenant) throw new NotFoundError("Salon");
    const tz = tenant.timeZone;

    // Hizmet ve personel bu salona ait olmalı (tx, tenantId ile kapsanmıştır)
    const service = await tx.service.findFirst({ where: { id: input.serviceId, active: true } });
    if (!service) throw new NotFoundError("Hizmet");
    const links = await tx.serviceStaff.findMany({ where: { serviceId: service.id, staff: { active: true } } });
    const eligibleIds = links.map((l) => l.staffId);
    if (input.staffId !== "any" && !eligibleIds.includes(input.staffId)) throw new NotFoundError("Personel");
    const staffRows = await tx.staff.findMany({
      where: { id: { in: input.staffId === "any" ? eligibleIds : [input.staffId] }, active: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    if (staffRows.length === 0) throw new NotFoundError("Personel");
    const staffIds = staffRows.map((s) => s.id);

    // Aynı telefondaki eşzamanlı rezervasyonları sıraya sok (müşteri upsert yarışı + deterministik kontrol)
    await lockTenantKey(tx, input.tenantId, phone);

    const local = utcToLocal(input.startsAt, tz);
    const range = dayRangeUtc(local.date, tz);
    const winFrom = dayRangeUtc(addDays(local.date, -1), tz).start;
    const winTo = dayRangeUtc(addDays(local.date, 1), tz).end;
    const [hours, timeOff, busyRows] = await Promise.all([
      tx.workingHours.findMany({ where: { staffId: { in: staffIds } } }),
      tx.timeOff.findMany({ where: { staffId: { in: staffIds }, startsAt: { lt: winTo }, endsAt: { gt: winFrom } } }),
      tx.appointment.findMany({
        where: { staffId: { in: staffIds }, status: { in: ["pending", "confirmed"] }, startsAt: { lt: winTo }, blockedUntil: { gt: winFrom } },
        select: { staffId: true, startsAt: true, blockedUntil: true },
      }),
    ]);
    const staff: StaffAvailabilityInput[] = staffIds.map((id) => ({
      id,
      workingHours: hours.filter((h) => h.staffId === id).map((h) => ({ weekday: h.weekday, startMin: h.startMin, endMin: h.endMin, breaks: parseBreaks(h.breaks) })),
      timeOff: timeOff.filter((t) => t.staffId === id).map((t) => ({ startsAt: t.startsAt, endsAt: t.endsAt })),
    }));
    const bypass = input.bypassLeadRules === true;
    const base = {
      tenant: bypass
        ? { timeZone: tz, slotMinutes: Math.min(5, tenant.slotMinutes), minLeadMinutes: 0, maxAdvanceDays: 0 }
        : { timeZone: tz, slotMinutes: tenant.slotMinutes, minLeadMinutes: tenant.minLeadMinutes, maxAdvanceDays: tenant.maxAdvanceDays },
      service: { durationMin: service.durationMin, bufferMin: service.bufferMin },
      // bypass: "şimdi" = o yerel günün başı → o gün geçmiş/ileri sayılmaz
      staff, date: local.date, now: bypass ? range.start : now,
    };
    const t = input.startsAt.getTime();
    const free = computeAvailability({ ...base, busy: busyRows }).find((s) => s.start.getTime() === t);
    if (!free) {
      // Meşgul randevular olmasaydı uygun muydu? Evetse slot dolmuştur, hayırsa kural dışıdır.
      const wouldFit = computeAvailability({ ...base, busy: [] }).some((s) => s.start.getTime() === t);
      throw wouldFit ? new SlotTakenError() : new SlotUnavailableError();
    }

    // "Fark etmez": o gün en az randevusu olan personel (eşitlikte sıra/sortOrder)
    let chosen = free.staffIds[0] as string;
    if (input.staffId === "any" && free.staffIds.length > 1) {
      const counts = new Map(free.staffIds.map((id) => [id, 0]));
      for (const b of busyRows) {
        if (b.startsAt >= range.start && b.startsAt < range.end && counts.has(b.staffId)) counts.set(b.staffId, (counts.get(b.staffId) ?? 0) + 1);
      }
      chosen = [...free.staffIds].sort((a, b) => (counts.get(a) ?? 0) - (counts.get(b) ?? 0) || staffIds.indexOf(a) - staffIds.indexOf(b))[0] as string;
    } else if (input.staffId !== "any") {
      chosen = input.staffId;
    }

    const c = input.customer;
    const consent = c.marketingConsent === true;
    const kvkk = c.kvkkAccepted === true;
    const customer = await tx.customer.upsert({
      where: { tenantId_phone: { tenantId: input.tenantId, phone } },
      create: { name: c.name.trim(), phone, email: c.email ?? null, locale: c.locale ?? tenant.locale, marketingConsent: consent, marketingConsentAt: consent ? now : null, kvkkAcceptedAt: kvkk ? now : null } as Prisma.CustomerUncheckedCreateInput,
      update: { name: c.name.trim(), ...(c.email ? { email: c.email } : {}), ...(consent ? { marketingConsent: true, marketingConsentAt: now } : {}), ...(kvkk ? { kvkkAcceptedAt: now } : {}) },
    });

    const endsAt = new Date(t + service.durationMin * 60_000);
    return tx.appointment.create({
      data: {
        staffId: chosen, serviceId: service.id, customerId: customer.id,
        startsAt: input.startsAt, endsAt, blockedUntil: new Date(endsAt.getTime() + service.bufferMin * 60_000),
        status: "confirmed", source: input.source ?? "online", note: input.note ?? null,
        cancelToken: newCancelToken(), priceTry: service.priceTry,
      } as Prisma.AppointmentUncheckedCreateInput,
    });
  });
}

/** Randevu oluşturur. Çift rezervasyonu DB exclusion constraint'i garanti eder → SlotTakenError. */
export async function createAppointment(db: TenantDb, input: CreateAppointmentInput) {
  // "Fark etmez"de yarışı kaybeden, başka boş personel olabileceği için yeniden denenir
  const tries = input.staffId === "any" ? 3 : 1;
  for (let i = 1; ; i++) {
    try {
      const a = await attempt(db, input);
      await appointmentChanged(a.id, "created");
      return a;
    } catch (e) {
      const taken = e instanceof SlotTakenError || isOverlapError(e);
      if (!taken) throw e;
      if (i >= tries) throw e instanceof SlotTakenError ? e : new SlotTakenError();
    }
  }
}

/** Müşteri iptal bağlantısı: tenant.cancelHoursBefore kuralını uygular. Token tenant'tan bağımsızdır (global benzersiz). */
export async function cancelByToken(token: string, now: Date = new Date(), client: typeof prisma = prisma) {
  if (!token || token.length < 16) throw new NotFoundError("Randevu");
  const appt = await client.appointment.findUnique({ where: { cancelToken: token }, include: { tenant: { select: { cancelHoursBefore: true } } } });
  if (!appt) throw new NotFoundError("Randevu");
  if (appt.status !== "pending" && appt.status !== "confirmed") throw new AlreadyClosedError();
  const hours = appt.tenant.cancelHoursBefore;
  if (appt.startsAt.getTime() - now.getTime() < hours * 3_600_000) throw new CancelWindowError(hours);
  const res = await client.appointment.updateMany({
    where: { id: appt.id, tenantId: appt.tenantId, cancelToken: token, startsAt: appt.startsAt, tenant: { cancelHoursBefore: hours }, status: { in: ["pending", "confirmed"] } },
    data: { status: "cancelled_by_customer", cancelledAt: now },
  });
  if (res.count === 0) {
    // Do not apply a stale decision to a different start time, even if still cancellable.
    const current = await client.appointment.findUnique({ where: { cancelToken: token }, select: { status: true } });
    if (!current) throw new NotFoundError("Randevu");
    if (current.status === "pending" || current.status === "confirmed") throw new BookingError("conflict", "Randevu değişti; bilgileri yenileyip tekrar deneyin");
    throw new AlreadyClosedError();
  }
  await appointmentChanged(appt.id, "cancelled_by_customer");
  return client.appointment.findUniqueOrThrow({ where: { id: appt.id } });
}
