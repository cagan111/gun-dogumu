import { randomInt } from "node:crypto";
import { prisma, withTenant } from "./db";
import { OtpError, RateLimitedError } from "./errors";
import { sendMessage } from "./messaging/send";
import { asLocale, renderTemplate } from "./messaging/templates";
import { logger } from "./logger";
import { lockTenant } from "./ledger";
import { smsSegments } from "./messaging/segments";
import { normalizePhone } from "./phone";
import { HOUR, rateLimit } from "./ratelimit";
import { getAuthSecret, safeEqualHex, sha256Hex } from "./secret";
import { BookingError, InvalidPhoneError } from "./booking";

export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_REQUESTS_PER_HOUR = 5;
export const OTP_RESEND_WAIT_MS = 60_000;
/** UTC günü başına salonun OTP bütçesi; başarısız girişimler de rezervasyonu tüketir. */
export const OTP_DAILY_SEGMENT_CAP = 30;

/** TR/EN arasında ayar değişse de ayrılan bütçe gönderimi kapsasın. */
export function otpReservedSegments(): number {
  return Math.max(...(["tr", "en"] as const).map((locale) => smsSegments(renderTemplate("otp", locale, { code: "000000" })).segments));
}

// ---- saf kısım ----

export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** sha256(kod + pepper). Pepper NEXTAUTH_SECRET'tan gelir; DB sızsa bile 6 haneli kod sözlükle çözülemez. */
export function hashOtp(code: string, pepper: string): string {
  return sha256Hex(code + pepper);
}

export interface OtpRow { codeHash: string; expiresAt: Date; attempts: number; usedAt: Date | null }
export type OtpVerdict = "ok" | "wrong" | "expired" | "used" | "locked";

/** Satır + girilen koddan karar üretir (yan etkisiz). Deneme sayacı çağıran tarafından artırılır. */
export function evaluateOtp(row: OtpRow, code: string, pepper: string, now: Date): OtpVerdict {
  if (row.usedAt) return "used";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  if (row.attempts >= OTP_MAX_ATTEMPTS) return "locked";
  return safeEqualHex(hashOtp(code, pepper), row.codeHash) ? "ok" : "wrong";
}

// ---- gönderim ----

/** OTP gönderilemedi (kredi yok / sağlayıcı hatası) — yalnız üretimde fırlatılır (503). */
export class OtpDeliveryError extends BookingError {
  constructor() { super("sms_unavailable", "Doğrulama kodu şu an gönderilemedi, lütfen salonla iletişime geçin"); }
}

/**
 * OTP'yi SMS ile gönderir. Kredi salondan düşer (reason notification, 1 segment).
 * Kredi yoksa / gönderim başarısızsa: üretimde OtpDeliveryError (503); geliştirmede kod loga yazılıp devam edilir.
 * MessageLog'a kodun kendisi YAZILMAZ (maskelenir).
 */
export async function sendOtp(tenantId: string, phone: string, code: string): Promise<void> {
  const dev = process.env.NODE_ENV !== "production";
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { locale: true } });
  const locale = asLocale(t?.locale);
  const outcome = await sendMessage({
    tenantId, to: phone, text: renderTemplate("otp", locale, { code }), logContent: renderTemplate("otp", locale, { code: "******" }),
    template: "otp", reason: "notification", fallback: { whatsapp: false },
  });
  if (outcome.status === "sent") return;
  if (!dev) {
    logger.warn({ tenantId, status: outcome.status, reason: outcome.reason }, "OTP gönderilemedi");
    throw new OtpDeliveryError();
  }
  logger.warn({ tenantId, phone, code, status: outcome.status }, "OTP gönderilemedi; geliştirmede kod loga yazıldı");
}

// ---- servis ----

/** OTP ister. Müşteri yoksa da aynı yanıt verilir (numara sızdırılmaz) ama kod üretilmez/gönderilmez. */
export async function requestOtp(
  tenantId: string,
  rawPhone: string,
  opts: { now?: Date; send?: typeof sendOtp } = {},
): Promise<{ sent: true }> {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new InvalidPhoneError();
  const rl = await rateLimit(`otp:req:${tenantId}:${phone}`, OTP_REQUESTS_PER_HOUR, HOUR);
  if (!rl.ok) throw new RateLimitedError(rl.retryAfterSec);

  const now = opts.now ?? new Date();
  const db = withTenant(tenantId);
  const customer = await db.customer.findFirst({ where: { phone }, select: { id: true } });
  if (!customer) return { sent: true };

  const code = generateOtpCode();
  const reserved = await db.$transaction(async (tx) => {
    // Bütçe + bekleme süresi çoklu web süreçlerinde de aynı kilit altında.
    // Tenant kilidi alt tablo INSERT'lerinden önce alınmalı (FK deadlock önlemi).
    await lockTenant(tx, tenantId);
    const latest = await tx.otp.findFirst({ where: { phone }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { createdAt: true } });
    if (latest && now.getTime() - latest.createdAt.getTime() < OTP_RESEND_WAIT_MS) return false;
    const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const budget = await tx.otp.aggregate({ where: { createdAt: { gte: dayStart, lt: dayEnd } }, _sum: { reservedSegments: true } });
    const segments = otpReservedSegments();
    // Eski kayıtlardaki 0 rezervasyon ilk gün tavanı delmesin; güncel en yüksek
    // OTP maliyetiyle sayılır (eski başarısız girişimler de muhafazakâr sayılır).
    const legacyCount = await tx.otp.count({ where: { createdAt: { gte: dayStart, lt: dayEnd }, reservedSegments: 0 } });
    if ((budget._sum.reservedSegments ?? 0) + legacyCount * segments + segments > OTP_DAILY_SEGMENT_CAP) return false;
    await tx.otp.updateMany({ where: { phone, usedAt: null }, data: { usedAt: now } });
    await tx.otp.create({
      data: { tenantId, phone, codeHash: hashOtp(code, getAuthSecret()), expiresAt: new Date(now.getTime() + OTP_TTL_MS), createdAt: now, reservedSegments: segments },
    });
    return true;
  });
  if (!reserved) return { sent: true };
  try {
    await (opts.send ?? sendOtp)(tenantId, phone, code);
  } catch {
    // Sağlayıcı/kredi sonucu kayıtlı müşteri varlığını HTTP yanıtından sızdırmamalı.
    // Ham hata, telefon, kod veya mesaj gövdesi telemetriye eklenmez.
    logger.warn({ tenantId, reason: "delivery_failed" }, "OTP isteği teslim edilemedi");
  }
  return { sent: true };
}

/** OTP doğrular (en çok 5 deneme). Başarıda `{ phone }` döner; çerezi çağıran kurar. */
export async function verifyOtp(
  tenantId: string,
  rawPhone: string,
  code: string,
  now: Date = new Date(),
): Promise<{ phone: string }> {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new InvalidPhoneError();
  const db = withTenant(tenantId);
  const row = await db.otp.findFirst({ where: { phone, usedAt: null }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  if (!row) throw new OtpError("otp_invalid", "Kod geçersiz");
  if (row.expiresAt.getTime() <= now.getTime()) throw new OtpError("otp_expired", "Kodun süresi doldu");

  // Deneme sayacını atomik artır; sınır aşıldıysa güncelleme 0 satır etkiler
  const bumped = await db.otp.updateMany({
    where: { id: row.id, usedAt: null, attempts: { lt: OTP_MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (bumped.count === 0) throw new OtpError("otp_locked", "Çok fazla hatalı deneme, yeni kod isteyin");

  const verdict = evaluateOtp({ ...row, attempts: row.attempts }, code, getAuthSecret(), now);
  if (verdict !== "ok") throw new OtpError("otp_invalid", "Kod hatalı");

  const used = await db.otp.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
  if (used.count === 0) throw new OtpError("otp_invalid", "Kod geçersiz");
  return { phone };
}

/** Müşterinin gelecekteki aktif randevuları (iptal token'larıyla). */
export async function upcomingForCustomer(tenantId: string, phone: string, now: Date = new Date()) {
  const db = withTenant(tenantId);
  const rows = await db.appointment.findMany({
    where: { customer: { phone }, status: { in: ["pending", "confirmed"] }, startsAt: { gte: now } },
    orderBy: { startsAt: "asc" },
    take: 50,
    include: { service: { select: { nameTr: true, nameEn: true } }, staff: { select: { name: true } } },
  });
  return rows.map((a) => ({
    id: a.id,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    status: a.status,
    service: { nameTr: a.service.nameTr, nameEn: a.service.nameEn },
    staffName: a.staff.name,
    priceTry: Number(a.priceTry),
    cancelUrl: `/r/${a.cancelToken}`,
    cancelToken: a.cancelToken,
  }));
}

