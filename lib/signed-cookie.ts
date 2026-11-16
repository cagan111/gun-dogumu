import { hmacHex, safeEqualHex } from "./secret";

/** İmzalı çerez değeri: base64url(JSON).HMAC-SHA256. Süresi yük içindeki `exp` (ms) ile sınırlıdır. */
export interface CustomerCookiePayload {
  /** tenantId */
  t: string;
  /** E.164 telefon */
  p: string;
  /** bitiş zamanı (epoch ms) */
  exp: number;
}

export const CUSTOMER_COOKIE_TTL_MS = 30 * 60_000;

export function customerCookieName(slug: string): string {
  return `kr_my_${slug}`;
}

export function signPayload(payload: CustomerCookiePayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${hmacHex(body, secret)}`;
}

export function verifyPayload(value: string | undefined, secret: string, now: number = Date.now()): CustomerCookiePayload | null {
  if (!value) return null;
  const i = value.lastIndexOf(".");
  if (i <= 0) return null;
  const body = value.slice(0, i);
  const sig = value.slice(i + 1);
  if (!safeEqualHex(sig, hmacHex(body, secret))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<CustomerCookiePayload>;
    if (typeof p.t !== "string" || typeof p.p !== "string" || typeof p.exp !== "number") return null;
    if (p.exp <= now) return null;
    return { t: p.t, p: p.p, exp: p.exp };
  } catch {
    return null;
  }
}
