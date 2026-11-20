import { createHash, randomBytes } from "node:crypto";
import { prisma, lockTenantRow } from "./db";
import { assertOwner, assertWritable, type PanelCtx } from "./panel-auth";
import { NotFoundError } from "./booking";
import { writeAudit } from "./audit";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const DAY = 86400000;
export async function rotateCalendarFeed(ctx: PanelCtx, staffId: string) {
  assertOwner(ctx); assertWritable(ctx);
  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction(async tx => {
    await lockTenantRow(tx, ctx.tenantId);
    const staff = await tx.staff.findFirst({ where: { id: staffId, tenantId: ctx.tenantId, active: true }, select: { id: true } });
    if (!staff) throw new NotFoundError("Personel");
    await tx.staffCalendarFeed.upsert({ where: { staffId }, create: { staffId, tokenHash: hash(token) }, update: { tokenHash: hash(token), createdAt: new Date() } });
    await writeAudit(tx, { actorId: ctx.user.id, actorRole: ctx.user.role, tenantId: ctx.tenantId, action: "calendar.rotate", details: { staffId } });
  });
  return { path: `/api/calendar/${token}` };
}
/** Revocation remains available to an owner while suspended. */
export async function revokeCalendarFeed(ctx: PanelCtx, staffId: string) {
  assertOwner(ctx);
  await prisma.$transaction(async tx => {
    await lockTenantRow(tx, ctx.tenantId);
    if (!await tx.staff.findFirst({ where: { id: staffId, tenantId: ctx.tenantId }, select: { id: true } })) throw new NotFoundError("Personel");
    const removed = await tx.staffCalendarFeed.deleteMany({ where: { staffId } });
    if (removed.count) await writeAudit(tx, { actorId: ctx.user.id, actorRole: ctx.user.role, tenantId: ctx.tenantId, action: "calendar.revoke", details: { staffId } });
  });
  return { revoked: true };
}

type Event = { id: string; startsAt: Date; endsAt: Date; updatedAt: Date; status: string };
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
export function renderCalendar(events: Event[], locale: string): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//KibrisRandevu//Calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const e of events) lines.push("BEGIN:VEVENT", `UID:${hash(e.id).slice(0, 32)}@kibrisrandevu`, `DTSTAMP:${stamp(e.updatedAt)}`, `LAST-MODIFIED:${stamp(e.updatedAt)}`, `DTSTART:${stamp(e.startsAt)}`, `DTEND:${stamp(e.endsAt)}`, `SUMMARY:${locale === "en" ? "Appointment" : "Randevu"}`, `STATUS:${e.status.startsWith("cancelled_") ? "CANCELLED" : e.status === "pending" ? "TENTATIVE" : "CONFIRMED"}`, "END:VEVENT");
  return [...lines, "END:VCALENDAR", ""].join("\r\n");
}
export async function readCalendarFeed(token: string, now = new Date()): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return prisma.$transaction(async tx => {
    const feed = await tx.staffCalendarFeed.findUnique({ where: { tokenHash: hash(token) }, select: { staffId: true, staff: { select: { tenantId: true } } } });
    if (!feed) return null;
    await lockTenantRow(tx, feed.staff.tenantId);
    // Revalidate after the shared tenant lock so completed rotation/revocation wins.
    const current = await tx.staffCalendarFeed.findUnique({ where: { tokenHash: hash(token) }, select: { staff: { select: { id: true, tenantId: true, active: true, tenant: { select: { status: true, locale: true } } } } } });
    if (!current || !current.staff.active || current.staff.tenant.status === "suspended") return null;
    const staff = current.staff;
    const events = await tx.appointment.findMany({ where: { tenantId: staff.tenantId, staffId: staff.id, startsAt: { gte: new Date(+now - 14 * DAY), lt: new Date(+now + 90 * DAY) } }, select: { id: true, startsAt: true, endsAt: true, updatedAt: true, status: true }, orderBy: [{ startsAt: "asc" }, { id: "asc" }], take: 1001 });
    if (events.length > 1000) throw new Error("calendar_capacity");
    return renderCalendar(events, staff.tenant.locale);
  });
}
