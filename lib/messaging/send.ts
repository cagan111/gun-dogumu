/**
 * Mesaj gönderimi: segment sayısı kadar kredi düşümü MessageLog satırıyla AYNI transaction'da yapılır;
 * sağlayıcı hatasında iade edilir. Kredi yetmezse WhatsApp (Salon+ ve yapılandırılmışsa) → e-posta → atla.
 */
import { Prisma, type Channel, type MessageStatus } from "@prisma/client";
import { prisma, withTenant } from "../db";
import { InsufficientCreditsError, ValidationError } from "../errors";
import { debitTx, getBalance, refundTx, type DebitReason } from "../ledger";
import { logger } from "../logger";
import { hasFeature } from "../plan";
import { getEmailProvider, getSmsProvider, getWhatsAppProvider, whatsappConfigured } from "./registry";
import { smsSegments } from "./segments";
import { asLocale, renderTemplate, templateSubject, type TemplateName, type TemplateVars } from "./templates";
import type { ProviderDeps } from "./types";

export interface SendInput {
  tenantId: string;
  to: string;
  text: string;
  /** MessageLog.content için (örn. OTP kodu maskeli); verilmezse text. */
  logContent?: string;
  template: string;
  reason: DebitReason;
  appointmentId?: string | null;
  idempotencyKey?: string | null;
  /** Kredi yetmezse: WhatsApp (varsayılan açık) ve/veya e-posta. */
  fallback?: { whatsapp?: boolean; email?: string | null; subject?: string };
  deps?: Partial<ProviderDeps>;
  now?: Date;
}
export type SendOutcome = {
  status: "sent" | "failed" | "skipped" | "duplicate";
  channel?: Channel;
  messageId?: string;
  segments: number;
  reason?: string;
};

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

async function finish(tenantId: string, id: string, status: MessageStatus, res: { providerId?: string; error?: string }) {
  await withTenant(tenantId).messageLog.updateMany({ where: { id }, data: { status, providerId: res.providerId ?? null, providerResult: res.error ?? null } });
}

/** Ücretsiz kanal kaydı (WhatsApp/e-posta/atlandı): kredi düşmez. Benzersiz anahtar çakışırsa null. */
async function logFree(input: SendInput, channel: Channel, recipient: string, provider: string, status: MessageStatus, key: string | null, error?: string) {
  try {
    const row = await withTenant(input.tenantId).messageLog.create({
      data: { channel, recipient, template: input.template, content: input.logContent ?? input.text, provider, status, providerResult: error ?? null, cost: 0, idempotencyKey: key, appointmentId: input.appointmentId ?? null } as never,
    });
    return row.id;
  } catch (e) {
    if (isUniqueViolation(e)) return null;
    throw e;
  }
}

export async function sendMessage(input: SendInput): Promise<SendOutcome> {
  const { tenantId } = input;
  const key = input.idempotencyKey ?? null;
  if (key && (await prisma.messageLog.findUnique({ where: { idempotencyKey: key }, select: { id: true } }))) {
    return { status: "duplicate", segments: 0 };
  }
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true, smsProvider: true, smsSenderName: true } });
  if (!tenant) throw new ValidationError("Salon bulunamadı", "tenantId");
  const sms = getSmsProvider(tenant.smsProvider, input.deps);
  const segments = smsSegments(input.text, sms.segmentProfile).segments;
  if (segments === 0) throw new ValidationError("Boş mesaj", "text");

  // 1) kredi düşümü + MessageLog (queued) tek transaction
  let logId: string;
  try {
    logId = await withTenant(tenantId).$transaction(async (tx) => {
      const log = await tx.messageLog.create({
        data: { channel: "sms", recipient: input.to, template: input.template, content: input.logContent ?? input.text, provider: sms.name, status: "queued", cost: segments, idempotencyKey: key, appointmentId: input.appointmentId ?? null } as never,
      });
      await debitTx(tx, tenantId, segments, { reason: input.reason, messageId: log.id, note: input.template });
      return log.id;
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { status: "duplicate", segments: 0 };
    if (e instanceof InsufficientCreditsError) return fallback(input, tenant.plan, segments);
    throw e;
  }

  // 2) gönderim (ağ çağrısı transaction dışında)
  let res: { ok: boolean; providerId?: string; error?: string };
  try {
    res = await sms.send(input.to, input.text, { sender: tenant.smsSenderName });
  } catch (e) {
    res = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (res.ok) {
    await finish(tenantId, logId, "sent", res);
    return { status: "sent", channel: "sms", messageId: logId, segments };
  }
  // 3) başarısız: iade + kayıt
  await withTenant(tenantId).$transaction(async (tx) => {
    await refundTx(tx, tenantId, segments, { messageId: logId, note: `iade:${input.template}` });
    await tx.messageLog.updateMany({ where: { id: logId }, data: { status: "failed", providerResult: res.error ?? "error", cost: 0 } });
  });
  logger.warn({ tenantId, provider: sms.name, error: res.error }, "SMS gönderilemedi, kredi iade edildi");
  return { status: "failed", channel: "sms", messageId: logId, segments, reason: res.error };
}

async function fallback(input: SendInput, plan: string, segments: number): Promise<SendOutcome> {
  const { tenantId } = input;
  const key = input.idempotencyKey ?? null;
  await notifyLowCredit(tenantId, input.now ?? new Date(), input.deps).catch((e) => logger.error({ err: e }, "low_credit bildirimi başarısız"));

  const fb = input.fallback ?? {};
  let keyLeft = key;
  const nextKey = (suffix: string) => { const k = keyLeft; keyLeft = key ? `${key}:${suffix}` : null; return k; };

  if (fb.whatsapp !== false && hasFeature(plan, "whatsapp") && whatsappConfigured(input.deps)) {
    const wa = getWhatsAppProvider(input.deps);
    const id = await logFree(input, "whatsapp", input.to, wa.name, "queued", nextKey("email"));
    if (id === null) return { status: "duplicate", segments: 0 };
    const r = await wa.send(input.to, input.text, { params: [input.text] }).catch((e) => ({ ok: false, providerId: undefined, error: String(e) }));
    await finish(tenantId, id, r.ok ? "sent" : "failed", r);
    if (r.ok) return { status: "sent", channel: "whatsapp", messageId: id, segments };
  }
  if (fb.email) {
    const em = getEmailProvider();
    const id = await logFree(input, "email", fb.email, em.name, "queued", nextKey("skip"));
    if (id === null) return { status: "duplicate", segments: 0 };
    const r = await em.send(fb.email, fb.subject ?? "KıbrısRandevu", input.text).catch((e) => ({ ok: false, providerId: undefined, error: String(e) }));
    await finish(tenantId, id, r.ok ? "sent" : "failed", r);
    if (r.ok) return { status: "sent", channel: "email", messageId: id, segments };
  }
  const id = await logFree(input, "sms", input.to, "none", "skipped", keyLeft, "insufficient_credits");
  return { status: "skipped", channel: "sms", messageId: id ?? undefined, segments, reason: "insufficient_credits" };
}

/** Salon sahibinin e-postası (ilk owner). */
export async function ownerEmail(tenantId: string): Promise<string | null> {
  const u = await prisma.user.findFirst({ where: { tenantId, role: "owner" }, orderBy: { createdAt: "asc" }, select: { email: true } });
  return u?.email ?? null;
}

/** Salona e-posta bildirimi (MessageLog'lu, anahtarla tekrarsız). Kredi düşmez. */
export async function sendTenantEmail(tenantId: string, template: TemplateName, vars: TemplateVars, key: string, opts: { now?: Date } = {}): Promise<"sent" | "duplicate" | "no_recipient" | "failed"> {
  void opts;
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, locale: true } });
  const to = await ownerEmail(tenantId);
  if (!t || !to) return "no_recipient";
  const locale = asLocale(t.locale);
  const text = renderTemplate(template, locale, { salon: t.name, ...vars });
  const em = getEmailProvider();
  const input = { tenantId, to, text, template, reason: "notification" as const };
  const id = await logFree(input, "email", to, em.name, "queued", key);
  if (id === null) return "duplicate";
  const r = await em.send(to, templateSubject(template, locale), text).catch((e) => ({ ok: false, providerId: undefined, error: String(e) }));
  await finish(tenantId, id, r.ok ? "sent" : "failed", r);
  return r.ok ? "sent" : "failed";
}

/** Günde en çok bir kez (UTC gün anahtarı) low_credit e-postası. */
export async function notifyLowCredit(tenantId: string, now: Date, _deps?: Partial<ProviderDeps>) {
  void _deps;
  const day = now.toISOString().slice(0, 10);
  const balance = await getBalance(withTenant(tenantId));
  return sendTenantEmail(tenantId, "low_credit", { balance }, `low:${tenantId}:${day}`);
}
