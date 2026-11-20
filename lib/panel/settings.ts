import { z } from "zod";
import { isGoogleReviewUrl } from "../review-link";
import { writeAudit } from "../audit";
import { approvedSmsSender } from "../messaging/sender-policy";
import { getSmsProvider } from "../messaging/registry";
import { ValidationError } from "../errors";
import { isValidSmsSender } from "../sms-sender";
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
    reviewInviteEnabled: z.boolean(),
    reviewInviteUrl: z.string().trim().refine(isGoogleReviewUrl, "invalid_review_url").nullable(),
    smsAllowedCallingCodes: z.array(z.string().regex(/^[1-9]\d{0,2}$/)).max(30).refine((a) => new Set(a).size === a.length, "duplicate_codes"),
    smsDailySegmentLimit: z.number().int().min(1).max(2000),
    smsSenderName: z.string().refine(isValidSmsSender, "invalid_sender").nullable(),
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
  reviewInviteEnabled: true, reviewInviteUrl: true,
  smsAllowedCallingCodes: true, smsDailySegmentLimit: true, smsSenderName: true, reminderOffsets: true, cancelHoursBefore: true, slotMinutes: true, minLeadMinutes: true,
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
  if (typeof input.smsSenderName === "string") {
    const tenant = await ctx.db.tenant.findUnique({ where: { id: ctx.tenantId }, select: { smsProvider: true } });
    if (!tenant) throw new NotFoundError("Salon");
    if (!approvedSmsSender(ctx.tenantId, getSmsProvider(tenant.smsProvider).name, input.smsSenderName)) {
      throw new ValidationError("SMS başlığı operatör tarafından onaylanmalı", "smsSenderName");
    }
  }
  const data = { ...input };
  if (data.reminderOffsets) data.reminderOffsets = [...data.reminderOffsets].sort((a, b) => b - a);
  const reviewChanged = data.reviewInviteEnabled !== undefined || data.reviewInviteUrl !== undefined;
  if (reviewChanged) {
    await ctx.db.$transaction(async tx => {
      await ledger.lockTenant(tx, ctx.tenantId);
      const current = await tx.tenant.findUnique({ where: { id: ctx.tenantId }, select: { reviewInviteEnabled: true, reviewInviteUrl: true, status: true } });
      if (!current) throw new NotFoundError("Salon");
      assertWritable({ tenantStatus: current.status });
      const enabled = data.reviewInviteEnabled ?? current.reviewInviteEnabled;
      const url = data.reviewInviteUrl !== undefined ? data.reviewInviteUrl : current.reviewInviteUrl;
      if (enabled && (!url || !isGoogleReviewUrl(url))) throw new ValidationError("Yorum daveti için geçerli Google yorum bağlantısı gerekli", "reviewInviteUrl");
      await tx.tenant.update({ where: { id: ctx.tenantId }, data });
      await writeAudit(tx, { actorId: ctx.user.id, actorRole: ctx.user.role, tenantId: ctx.tenantId, action: "settings.update", details: { fields: Object.keys(data) } });
    });
  } else {
    await ctx.db.tenant.update({ where: { id: ctx.tenantId }, data });
    await auditPanel(ctx, "settings.update", { fields: Object.keys(data) });
  }
  if (data.reminderOffsets) {
    // Hatırlatma zamanları değişti: gelecekteki randevuların planı yenilenir (eski anahtarlar işleyicide zaten geçersiz sayılmaz; yeni ofsetler eklenir)
    const ids = await ctx.db.appointment.findMany({ where: { status: { in: ["pending", "confirmed"] }, startsAt: { gt: new Date() } }, select: { id: true }, take: 2000 });
    for (const a of ids) await appointmentChanged(a.id);
  }
  return getSettings(ctx);
}

/* ───────────── SMS ───────────── */

export async function getSmsBalance(ctx: PanelCtx) {
  return ctx.db.$transaction(async (tx) => {
    await ledger.lockTenant(tx, ctx.tenantId);
    const raw = await ledger.getBalance(tx, ctx.tenantId);
    const balance = await ledger.getAvailableBalance(tx, ctx.tenantId);
    return { balance, reserved: raw - balance };
  });
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
