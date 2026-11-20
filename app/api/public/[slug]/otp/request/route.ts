import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, enforceRateLimit, handle, parseJson } from "@/lib/http";
import { enqueueOtpRequest } from "@/lib/otp";
import { resolveTenant } from "@/lib/public";
import { HOUR } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
const schema = z.object({ phone: z.string().min(5).max(32) });

/** OTP iste. Telefon başına saatte 5 (requestOtp içinde), IP başına saatte 20. */
export function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    await enforceRateLimit(`otp:ip:${clientIp(req)}`, 20, HOUR);
    const body = await parseJson(req, schema);
    if (!body.ok) return body.response;
    const t = await resolveTenant((await params).slug);
    return NextResponse.json(await enqueueOtpRequest(t.id, body.data.phone));
  });
}
