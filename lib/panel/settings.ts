import { z } from "zod";
import { appointmentChanged } from "../appointment-hook";
import { SMS_PACKAGES } from "@/config/plans";
import { NotFoundError } from "../booking";
import { ConflictError } from "../errors";
import * as ledger from "../ledger";
import { assertOwner, assertWritable, type PanelCtx } from "../panel-auth";
import { auditPanel } from "./audit";
import { isValidTimeZone } from "../time";

const httpsUrl = z.string().trim().max(500).url().refine((u) => u.startsWith("https://"), "https_only");

export const settingsSchema = z
  .object({
    smsSenderName: z.string().regex(/^[A-Za-z0-9 .-]{1,11}$/, "invalid_sender").nullable(),
    reminderOffsets: z
      .array(z.number().int().min(30).max(10_080))
      .min(1)
      .max(3)
      .refine((a) => new Set(a).size === a.length, "duplicate_offsets"),
    cancelHoursBefore: z.number().int().min(0).max(720),
    slotMinutes: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(30), z.literal(60)]),
    minLeadMinutes: z.number().int().min(0).max(10_080),
    maxAdvanceDays: z.number().int().min(1).max(365),
    brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "invalid_color").nullable(),
    logoUrl: httpsUrl.nullable(),
    coverUrl: httpsUrl.nullable(),
    locale: z.enum(["tr", "en"]),
    timeZone: z.string().max(64).refine(isValidTimeZone, "invalid_timezone"),
  })
  .partial()
  .strict()
  .refine((o) => Object.keys(o).length > 0, "empty");
export type SettingsInput = z.output<typeof settingsSchema>;

const PUBLIC_FIELDS = {
  smsSenderName: true, reminderOffsets: true, cancelHoursBefore: true, slotMinutes: true, minLeadMinutes: true,
  maxAdvanceDays: true, brandColor: true, logoUrl: true, coverUrl: true, locale: true, timeZone: true, plan: true, name: true, status: true,
} as const;

export async function getSettings(ctx: PanelCtx) {
  const t = await ctx.db.tenant.findUnique({ where: { id: ctx.tenantId }, select: PUBLIC_FIELDS });
  if (!t) throw new NotFoundError("Salon");
  return t;
}

export async function updateSettings(ctx: PanelCtx, input: SettingsInput) {
  assertOwner(ctx);
  assertWritable(ctx);
  const data = { ...input };
  if (data.reminderOffsets) data.reminderOffsets = [...data.reminderOffsets].sort((a, b) => b - a);
  await ctx.db.tenant.update({ where: { id: ctx.tenantId }, data });
  await auditPanel(ctx, "settings.update", { fields: Object.keys(data) });
  if (data.reminderOffsets) {
    // Hatırlatma zamanları değişti: gelecekteki randevuların planı yenilenir (eski anahtarlar işleyicide zaten geçersiz sayılmaz; yeni ofsetler eklenir)
    const ids = await ctx.db.appointment.findMany({ where: { status: { in: ["pending", "confirmed"] }, startsAt: { gt: new Date() } }, select: { id: true }, take: 2000 });
    for (const a of ids) await appointmentChanged(a.id);
  }
  return getSettings(ctx);
}

/* ───────────── SMS ───────────── */

export async function getSmsBalance(ctx: PanelCtx) {
  return { balance: await ledger.getBalance(ctx.db) };
}

export const smsRequestSchema = z.object({ size: z.number().int().refine((n) => (SMS_PACKAGES as readonly number[]).includes(n), "invalid_package") });

/** Paket talebi (owner). Zaten açık aynı boyutta talep varsa yenisi açılmaz (409). */
export async function createSmsRequest(ctx: PanelCtx, input: z.output<typeof smsRequestSchema>) {
  assertOwner(ctx);
  assertWritable(ctx);
  const open = await ctx.db.smsPackageRequest.findFirst({ where: { status: "open", size: input.size } });
  if (open) throw new ConflictError("size", "Bu paket için bekleyen talebiniz var");
  return ctx.db.smsPackageRequest.create({ data: { size: input.size } as never });
}

export async function listSmsRequests(ctx: PanelCtx) {
  return ctx.db.smsPackageRequest.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
}
