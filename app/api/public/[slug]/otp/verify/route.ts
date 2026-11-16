import { NextResponse } from "next/server";
import { z } from "zod";
import { setCustomerCookie } from "@/lib/customer-session";
import { clientIp, enforceRateLimit, handle, parseJson } from "@/lib/http";
import { verifyOtp } from "@/lib/otp";
import { resolveTenant } from "@/lib/public";
import { HOUR } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
const schema = z.object({ phone: z.string().min(5).max(32), code: z.string().regex(/^\d{6}$/) });

/** OTP doğrula; başarıda 30 dk geçerli imzalı çerez kurar. */
export function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    await enforceRateLimit(`otp:verify:${clientIp(req)}`, 30, HOUR);
    const body = await parseJson(req, schema);
    if (!body.ok) return body.response;
    const slug = (await params).slug;
    const t = await resolveTenant(slug);
    const { phone } = await verifyOtp(t.id, body.data.phone, body.data.code);
    const res = NextResponse.json({ ok: true });
    setCustomerCookie(res, slug, t.id, phone);
    return res;
  });
}
