import { baseQuoteTerms, makeServiceQuote, serviceQuoteSchema, type ServiceQuote } from "./service-quote";
import { z } from "zod";
import { prisma, withTenant } from "./db";
import { computeAvailability, type StaffAvailabilityInput } from "./availability";
import { createAppointment, NotFoundError, BookingError } from "./booking";
import { SuspendedError } from "./errors";
import { phoneSchema } from "./phone";
import { addDays, dayRangeUtc, isValidDate, utcToLocal } from "./time";

/** Slug ile salonu bulur; yoksa 404, askıdaysa SuspendedError (423). */
export async function resolveTenant(slug: string, opts: { allowSuspended?: boolean } = {}) {
  const t = await prisma.tenant.findUnique({ where: { slug } });
  if (!t) throw new NotFoundError("Salon");
  if (t.status === "suspended" && !opts.allowSuspended) throw new SuspendedError();
  return t;
}

/** Müşteri sayfası için salon bilgisi. Askıdaysa yalnız temel bilgi + suspended bayrağı döner. */
export async function getSalonInfo(slug: string) {
  const t = await resolveTenant(slug, { allowSuspended: true });
  const base = { name: t.name, slug: t.slug, logoUrl: t.logoUrl, coverUrl: t.coverUrl, brandColor: t.brandColor };
  if (t.status === "suspended") return { suspended: true as const, ...base };
  return {
    suspended: false as const,
    ...base,
    city: t.city,
    address: t.address,
    phone: t.phone,
    timeZone: t.timeZone,
    locale: t.locale,
    cancelHoursBefore: t.cancelHoursBefore,
    minLeadMinutes: t.minLeadMinutes,
    maxAdvanceDays: t.maxAdvanceDays,
  };
}

export async function listPublicServices(slug: string) {
  const t = await resolveTenant(slug);
  const db = withTenant(t.id);
  const [services, links] = await Promise.all([
    db.service.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    db.serviceStaff.findMany({ where: { staff: { active: true } }, select: { serviceId: true, staffId: true } }),
  ]);
  return services.map((s) => ({
    id: s.id,
    nameTr: s.nameTr,
    nameEn: s.nameEn,
    durationMin: s.durationMin,
    priceTry: Number(s.priceTry),
    staffIds: links.filter((l) => l.serviceId === s.id).map((l) => l.staffId),
  }));
}

export async function listPublicStaff(slug: string) {
  const t = await resolveTenant(slug);
  const staff = await withTenant(t.id).staff.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  return staff.map((s) => ({ id: s.id, name: s.name, photoUrl: s.photoUrl }));
}

function parseBreaks(json: unknown): [number, number][] {
  if (!Array.isArray(json)) return [];
  const out: [number, number][] = [];
  for (const b of json) if (Array.isArray(b) && typeof b[0] === "number" && typeof b[1] === "number") out.push([b[0], b[1]]);
  return out;
}

export const slotsQuerySchema = z.object({
  serviceId: z.string().min(1).max(64),
  staffId: z.string().min(1).max(64).default("any"),
  date: z.string().refine(isValidDate, "invalid_date"),
});

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Bir gün için boş slotlar (salonun yerel tarihi). */
export async function getSlots(slug: string, q: z.infer<typeof slotsQuerySchema>, now: Date = new Date()) {
  const t = await resolveTenant(slug);
  const db = withTenant(t.id);
  const service = await db.service.findFirst({ where: { id: q.serviceId, active: true } });
  if (!service) throw new NotFoundError("Hizmet");
  const links = await db.serviceStaff.findMany({ where: { serviceId: service.id, staff: { active: true } } });
  const eligible = links.map((l) => l.staffId);
  if (q.staffId !== "any" && !eligible.includes(q.staffId)) throw new NotFoundError("Personel");
  const staffRows = await db.staff.findMany({
    where: { id: { in: q.staffId === "any" ? eligible : [q.staffId] }, active: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  if (staffRows.length === 0) return { date: q.date, timeZone: t.timeZone, slots: [] as { startsAt: string; time: string; staffIds: string[]; offers: ServiceQuote[] }[] };
  const quoteTerms = new Map<string, NonNullable<ReturnType<typeof baseQuoteTerms>>>();
  for (const person of staffRows) {
    const terms = baseQuoteTerms(service, person, links.find(l => l.staffId === person.id)!);
    if (!terms) throw new BookingError("conflict", "Personel koşulları henüz etkin değil");
    quoteTerms.set(person.id, terms);
  }
  const ids = staffRows.map((s) => s.id);

  const winFrom = dayRangeUtc(addDays(q.date, -1), t.timeZone).start;
  const winTo = dayRangeUtc(addDays(q.date, 1), t.timeZone).end;
  const [hours, timeOff, busy] = await Promise.all([
    db.workingHours.findMany({ where: { staffId: { in: ids } } }),
    db.timeOff.findMany({ where: { staffId: { in: ids }, startsAt: { lt: winTo }, endsAt: { gt: winFrom } } }),
    db.appointment.findMany({
      where: { staffId: { in: ids }, status: { in: ["pending", "confirmed"] }, startsAt: { lt: winTo }, blockedUntil: { gt: winFrom } },
      select: { staffId: true, startsAt: true, blockedUntil: true },
    }),
  ]);
  const staff: StaffAvailabilityInput[] = ids.map((id) => ({
    id,
    workingHours: hours.filter((h) => h.staffId === id).map((h) => ({ weekday: h.weekday, startMin: h.startMin, endMin: h.endMin, breaks: parseBreaks(h.breaks) })),
    timeOff: timeOff.filter((x) => x.staffId === id).map((x) => ({ startsAt: x.startsAt, endsAt: x.endsAt })),
  }));
  const slots = computeAvailability({
    tenant: { timeZone: t.timeZone, slotMinutes: t.slotMinutes, minLeadMinutes: t.minLeadMinutes, maxAdvanceDays: t.maxAdvanceDays },
    service: { durationMin: service.durationMin, bufferMin: service.bufferMin },
    staff, busy, date: q.date, now,
  });
  return {
    date: q.date,
    timeZone: t.timeZone,
    slots: slots.map((s) => ({ startsAt: s.start.toISOString(), time: hhmm(utcToLocal(s.start, t.timeZone).minutes), staffIds: s.staffIds, offers: s.staffIds.map(id => makeServiceQuote(service.id, id, s.start, quoteTerms.get(id)!)) })),
  };
}

export const publicBookingSchema = z.object({
  quote: serviceQuoteSchema.optional(),
  serviceId: z.string().min(1).max(64),
  staffId: z.string().min(1).max(64),
  startsAt: z.string().datetime({ offset: true }).transform((v) => new Date(v)),
  customer: z.object({
    name: z.string().trim().min(2).max(100),
    phone: phoneSchema,
    email: z.string().trim().email().max(200).optional(),
    locale: z.enum(["tr", "en"]).optional(),
  }),
  kvkkAccepted: z.literal(true),
  marketingConsent: z.boolean().default(false),
});
export type PublicBookingInput = z.output<typeof publicBookingSchema>;

/** Müşteri randevusu oluşturur (çift rezervasyonda SlotTakenError → 409). */
export async function bookPublic(slug: string, input: PublicBookingInput, now: Date = new Date()) {
  const t = await resolveTenant(slug);
  const appt = await createAppointment(withTenant(t.id), {
    tenantId: t.id,
    serviceId: input.serviceId,
    quote: input.quote,
    staffId: input.staffId,
    startsAt: input.startsAt,
    customer: { ...input.customer, marketingConsent: input.marketingConsent, kvkkAccepted: input.kvkkAccepted },
    source: "online",
    now,
  });
  return { id: appt.id, startsAt: appt.startsAt.toISOString(), cancelUrl: `/r/${appt.cancelToken}` };
}

