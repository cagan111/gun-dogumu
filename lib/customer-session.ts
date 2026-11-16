import type { NextRequest, NextResponse } from "next/server";
import { getAuthSecret } from "./auth-secret";
import { CUSTOMER_COOKIE_TTL_MS, customerCookieName, signPayload, verifyPayload } from "./signed-cookie";

export function setCustomerCookie(res: NextResponse, slug: string, tenantId: string, phone: string, now: number = Date.now()) {
  const value = signPayload({ t: tenantId, p: phone, exp: now + CUSTOMER_COOKIE_TTL_MS }, getAuthSecret());
  res.cookies.set(customerCookieName(slug), value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || (process.env.NEXTAUTH_URL ?? "").startsWith("https:"),
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(CUSTOMER_COOKIE_TTL_MS / 1000),
  });
}

/** Çerez geçerli ve bu salona aitse telefonu döner. */
export function readCustomerCookie(req: NextRequest, slug: string, tenantId: string): string | null {
  const p = verifyPayload(req.cookies.get(customerCookieName(slug))?.value, getAuthSecret());
  return p && p.t === tenantId ? p.p : null;
}
