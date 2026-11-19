/**
 * Mesaj gönderimi: segment sayısı kadar kredi düşümü MessageLog satırıyla AYNI transaction'da yapılır;
 * sağlayıcı hatasında iade edilir. Kredi yetmezse WhatsApp (Salon+ ve yapılandırılmışsa) → e-posta → atla.
 */
import { normalizePhone } from "../phone";
import { checkSmsPolicy, lockSmsRecipient, SmsPolicyBlocked } from "./sms-policy";
import { Prisma, type Channel, type MessageStatus } from "@prisma/client";
import { prisma, withTenant } from "../db";
import { InsufficientCreditsError, ValidationError } from "../errors";
import { debitTx, getBalance, lockTenant, type DebitReason } from "../ledger";
import { logger } from "../logger";
import { hasFeature } from "../plan";
import { getEmailProvider, getSmsProvider, getWhatsAppProvider, whatsappConfigured } from "./registry";
import { smsSegments } from "./segments";
import { asLocale, renderTemplate, templateSubject, type TemplateName, type TemplateVars } from "./templates";
import type { ProviderDeps } from "./types";
import { messageLease, startDispatch, settleMessage, PROVIDER_TIMEOUT_MS } from "./recovery";
export { reconcileQueuedMessages } from "./recovery";

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
  /** Internal fault-injection seam. Never populated from an HTTP request. */
  hooks?: { afterReserved?: () => Promise<void>; afterDispatch?: () => Promise<void> };
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

/** Bound even custom providers; a timed-out/ambiguous dispatch is never replayed. */
async function dispatch(fn: () => Promise<{ ok: boolean; providerId?: string; error?: string }>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([fn(), new Promise<{ ok: boolean; error: string }>((resolve) => {
      timer = setTimeout(() => resolve({ ok: false, error: "delivery_unknown" }), PROVIDER_TIMEOUT_MS);
    })]);
    return !result.ok && result.error && (/^network:/.test(result.error) || /^(?:netgsm|iletimerkezi|generic|whatsapp):(?:5\d\d|408):/.test(result.error)) ? { ok: false, error: "delivery_unknown" } : result;
  } catch { return { ok: false, error: "delivery_unknown" }; }
  finally { if (timer) clearTimeout(timer); }
}
async function finish(input: Pick<SendInput, "tenantId" | "now">, id: string, owner: string, status: MessageStatus, res: { providerId?: string; error?: string }) {
  return settleMessage(input.tenantId, id, owner, status, res, input.now ?? new Date());
}

/** Ücretsiz kanal kaydı (WhatsApp/e-posta/atlandı): kredi düşmez. Benzersiz anahtar çakışırsa null. */
async function logFree(input: SendInput, channel: Channel, recipient: string, provider: string, status: MessageStatus, key: string | null, error?: string) {
  const lease = messageLease(input.now ?? new Date());
  try {
    const row = await withTenant(input.tenantId).messageLog.create({
      data: { channel, recipient, template: input.template, content: input.logContent ?? input.text, provider, status, providerResult: error ?? null, ...(status === "queued" ? lease : {}), cost: 0, idempotencyKey: key, appointmentId: input.appointmentId ?? null } as never,
    });
    if (status === "queued") await input.hooks?.afterReserved?.();
    return { id: row.id, owner: lease.leaseOwner };
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

  const appointment = input.appointmentId ? await withTenant(tenantId).appointment.findFirst({ where: { id: input.appointmentId }, select: { id: true } }) : null;
  if (input.appointmentId && !appointment) throw new ValidationError("Randevu bulunamadı", "appointmentId");
  const restricted = input.template === "otp" || !!appointment || input.reason !== "campaign";
  if (restricted) {
    const phone = normalizePhone(input.to);
    if (!phone) return { status: "skipped", segments, reason: "sms_country_policy" };
    input = { ...input, to: phone };
  }

  // 1) kredi düşümü + MessageLog (queued) tek transaction
  const lease = messageLease(input.now ?? new Date());
  let logId: string;
  try {
    logId = await withTenant(tenantId).$transaction(async (tx) => {
      // kilit sırası: önce tenant FOR UPDATE, sonra MessageLog INSERT (FK KEY SHARE) — tersi eşzamanlı gönderimde 40P01
      // Recipient lock first across salons; then canonical tenant/FK lock order.
      if (restricted) await lockSmsRecipient(tx, input.to);
      await lockTenant(tx, tenantId);
      if (restricted) await checkSmsPolicy(tx, tenantId, input.to, segments, input.now ?? new Date());
      const log = await tx.messageLog.create({
        data: { channel: "sms", recipient: input.to, template: input.template, content: input.logContent ?? input.text, provider: sms.name, status: "queued", ...lease, cost: segments, smsSafetySegments: restricted ? segments : 0, createdAt: input.now ?? new Date(), idempotencyKey: key, appointmentId: input.appointmentId ?? null } as never,
      });
      await debitTx(tx, tenantId, segments, { reason: input.reason, messageId: log.id, note: input.template });
      return log.id;
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { status: "duplicate", segments: 0 };
    if (e instanceof SmsPolicyBlocked) return { status: "skipped", segments, reason: e.reason };
    if (e instanceof InsufficientCreditsError) return fallback(input, tenant.plan, segments);
    throw e;
  }

  await input.hooks?.afterReserved?.();
  // Dispatch marker fences workers whose reservation was already recovered.
  if (!(await startDispatch(tenantId, logId, lease.leaseOwner, input.now ?? new Date()))) return { status: "failed", messageId: logId, segments, reason: "lease_lost" };
  const res = await dispatch(() => sms.send(input.to, input.text, { sender: tenant.smsSenderName }));
  await input.hooks?.afterDispatch?.();
  const won = await finish(input, logId, lease.leaseOwner, res.ok ? "sent" : "failed", res);
  if (!won) return { status: "failed", channel: "sms", messageId: logId, segments, reason: "lease_lost" };
  if (!res.ok) logger.warn({ tenantId, provider: sms.name }, "SMS gönderilemedi, kredi iade edildi");
  return { status: res.ok ? "sent" : "failed", channel: "sms", messageId: logId, segments, ...(res.ok ? {} : { reason: res.error }) };
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
    if (!(await startDispatch(tenantId, id.id, id.owner, input.now ?? new Date()))) return { status: "failed", segments, reason: "lease_lost" };
    const r = await dispatch(() => wa.send(input.to, input.text, { params: [input.text] }));
    await input.hooks?.afterDispatch?.();
    if (!(await finish(input, id.id, id.owner, r.ok ? "sent" : "failed", r))) return { status: "failed", segments, reason: "lease_lost" };
    if (r.ok) return { status: "sent", channel: "whatsapp", messageId: id.id, segments };
    if (r.error === "delivery_unknown") return { status: "failed", segments, reason: r.error };
  }
  if (fb.email) {
    const em = getEmailProvider();
    const id = await logFree(input, "email", fb.email, em.name, "queued", nextKey("skip"));
    if (id === null) return { status: "duplicate", segments: 0 };
    if (!(await startDispatch(tenantId, id.id, id.owner, input.now ?? new Date()))) return { status: "failed", segments, reason: "lease_lost" };
    const r = await dispatch(() => em.send(fb.email!, fb.subject ?? "KıbrısRandevu", input.text));
    await input.hooks?.afterDispatch?.();
    if (!(await finish(input, id.id, id.owner, r.ok ? "sent" : "failed", r))) return { status: "failed", segments, reason: "lease_lost" };
    if (r.ok) return { status: "sent", channel: "email", messageId: id.id, segments };
    if (r.error === "delivery_unknown") return { status: "failed", segments, reason: r.error };
  }
  const id = await logFree(input, "sms", input.to, "none", "skipped", keyLeft, "insufficient_credits");
  return { status: "skipped", channel: "sms", messageId: id?.id, segments, reason: "insufficient_credits" };
}

/** Salon sahibinin e-postası (ilk owner). */
export async function ownerEmail(tenantId: string): Promise<string | null> {
  const u = await prisma.user.findFirst({ where: { tenantId, role: "owner" }, orderBy: { createdAt: "asc" }, select: { email: true } });
  return u?.email ?? null;
}

/** Salona e-posta bildirimi (MessageLog'lu, anahtarla tekrarsız). Kredi düşmez. */
export async function sendTenantEmail(tenantId: string, template: TemplateName, vars: TemplateVars, key: string, opts: { now?: Date } = {}): Promise<"sent" | "duplicate" | "no_recipient" | "failed"> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, locale: true } });
  const to = await ownerEmail(tenantId);
  if (!t || !to) return "no_recipient";
  const locale = asLocale(t.locale);
  const text = renderTemplate(template, locale, { salon: t.name, ...vars });
  const em = getEmailProvider();
  const input = { tenantId, to, text, template, reason: "notification" as const, now: opts.now };
  const id = await logFree(input, "email", to, em.name, "queued", key);
  if (id === null) return "duplicate";
  if (!(await startDispatch(tenantId, id.id, id.owner, opts.now ?? new Date()))) return "failed";
  const r = await dispatch(() => em.send(to, templateSubject(template, locale), text));
  if (!(await finish(input, id.id, id.owner, r.ok ? "sent" : "failed", r))) return "failed";
  return r.ok ? "sent" : "failed";
}

/** Günde en çok bir kez (UTC gün anahtarı) low_credit e-postası. */
export async function notifyLowCredit(tenantId: string, now: Date, _deps?: Partial<ProviderDeps>) {
  void _deps;
  const day = now.toISOString().slice(0, 10);
  const balance = await getBalance(withTenant(tenantId));
  return sendTenantEmail(tenantId, "low_credit", { balance }, `low:${tenantId}:${day}`);
}
