import { NextResponse } from "next/server";
import type { ZodTypeAny, z } from "zod";
import { BookingError } from "./booking";
import { RateLimitedError } from "./errors";
import { logger } from "./logger";
import { rateLimit } from "./ratelimit";

/** BookingError.code → HTTP durumu. */
export const STATUS_BY_CODE: Record<string, number> = {
  not_found: 404,
  slot_taken: 409,
  slot_unavailable: 422,
  cancel_window: 403,
  invalid_phone: 400,
  validation: 400,
  already_closed: 409,
  conflict: 409,
  suspended: 423,
  quiet_hours: 409,
  sms_unavailable: 503,
  rate_limited: 429,
  unauthorized: 401,
  forbidden: 403,
  otp_invalid: 400,
  otp_expired: 400,
  otp_locked: 429,
  invalid_token: 400,
  plan_limit: 402,
  plan_feature: 402,
  insufficient_credits: 402,
  not_configured: 501,
};

export function statusForCode(code: string): number {
  return STATUS_BY_CODE[code] ?? 400;
}

export function jsonError(status: number, code: string, message: string, extra: Record<string, unknown> = {}, headers?: HeadersInit) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status, headers });
}

/** Bilinen hataları uygun HTTP yanıtına çevirir; bilinmeyen hata 500 (ayrıntı sızdırılmaz). */
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof RateLimitedError) {
    return jsonError(429, e.code, e.message, { retryAfterSec: e.retryAfterSec }, { "Retry-After": String(e.retryAfterSec) });
  }
  if (e instanceof BookingError) {
    const extra: Record<string, unknown> = {};
    if (e.code === "suspended") extra.suspended = true;
    const field = (e as { field?: unknown }).field;
    if (typeof field === "string") extra.field = field;
    const feature = (e as { feature?: unknown }).feature;
    if (typeof feature === "string") extra.feature = feature;
    const limit = (e as { limit?: unknown }).limit;
    if (typeof limit === "number") extra.limit = limit;
    return jsonError(statusForCode(e.code), e.code, e.message, extra);
  }
  logger.error({ err: e }, "api: beklenmeyen hata");
  return jsonError(500, "internal", "Beklenmeyen bir hata oluştu");
}

/** Route handler'ı sarar: fırlatılan hataları JSON yanıta çevirir. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    return errorResponse(e);
  }
}

export type ParseResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/** Zod ile doğrular; hatada alan hatalarıyla 400 yanıtı döner. */
export function parseWith<S extends ZodTypeAny>(schema: S, input: unknown): ParseResult<z.output<S>> {
  const r = schema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  const flat = r.error.flatten();
  return {
    ok: false,
    response: jsonError(400, "validation", "Girdi geçersiz", { fieldErrors: flat.fieldErrors, formErrors: flat.formErrors }),
  };
}

/** İstek gövdesini JSON okuyup doğrular. */
export async function parseJson<S extends ZodTypeAny>(req: Request, schema: S): Promise<ParseResult<z.output<S>>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { ok: false, response: jsonError(400, "validation", "Geçersiz JSON") };
  }
  return parseWith(schema, body);
}

/** İstemci IP'si (Caddy/proxy arkasında x-forwarded-for'un ilk değeri). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

/** Hız sınırını uygular; aşılırsa RateLimitedError fırlatır. */
export async function enforceRateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  const r = await rateLimit(key, limit, windowMs);
  if (!r.ok) throw new RateLimitedError(r.retryAfterSec);
}
