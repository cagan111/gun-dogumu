import { BookingError } from "./booking";

/** Hız sınırı aşıldı (429). */
export class RateLimitedError extends BookingError {
  constructor(public retryAfterSec: number) { super("rate_limited", "Çok fazla istek, lütfen biraz sonra tekrar deneyin"); }
}
/** Salon askıda (423) — sayfa "geçici olarak kapalı" gösterir. */
export class SuspendedError extends BookingError {
  constructor() { super("suspended", "Bu salon geçici olarak kapalı"); }
}
/** Benzersizlik çakışması: e-posta/slug (409). */
export class ConflictError extends BookingError {
  constructor(public field: string, message = "Bu değer zaten kullanımda") { super("conflict", message); }
}
export class UnauthorizedError extends BookingError {
  constructor() { super("unauthorized", "Oturum gerekli"); }
}
export class ForbiddenError extends BookingError {
  constructor() { super("forbidden", "Bu işlem için yetkiniz yok"); }
}
/** OTP / bağlantı kodu hatalı, süresi dolmuş ya da kullanılmış (400). */
export class OtpError extends BookingError {
  constructor(code: "otp_invalid" | "otp_expired" | "otp_locked", message: string) { super(code, message); }
}
export class InvalidTokenError extends BookingError {
  constructor() { super("invalid_token", "Bağlantı geçersiz veya süresi dolmuş"); }
}
/** Plan limiti aşıldı, örn. personel sayısı (402). */
export class PlanLimitError extends BookingError {
  constructor(public limit: number, message = "Planınızın limiti doldu, planı yükseltin") { super("plan_limit", message); }
}
/** Özellik planda yok, örn. müşteri notları / raporlar (402). */
export class PlanFeatureError extends BookingError {
  constructor(public feature: string) { super("plan_feature", "Bu özellik planınızda yok, planı yükseltin"); }
}
/** SMS kredisi yetersiz (402). */
export class InsufficientCreditsError extends BookingError {
  constructor(public balance: number, public needed: number) { super("insufficient_credits", "SMS kredisi yetersiz"); }
}
/** Ödeme sağlayıcısı yapılandırılmamış (501). */
export class PaymentNotConfiguredError extends BookingError {
  constructor(provider: string) { super("not_configured", `${provider} ödeme sağlayıcısı yapılandırılmadı`); }
}
/** İş kuralı doğrulama hatası (400). Şema doğrulaması dışındaki kontroller için. */
export class ValidationError extends BookingError {
  constructor(message: string, public field?: string) { super("validation", message); }
}
