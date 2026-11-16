import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readCustomerCookie } from "@/lib/customer-session";
import { UnauthorizedError } from "@/lib/errors";
import { clientIp, enforceRateLimit, handle } from "@/lib/http";
import { upcomingForCustomer } from "@/lib/otp";
import { resolveTenant } from "@/lib/public";
import { MINUTE } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** OTP çerezi olan müşterinin yaklaşan randevuları (iptal bağlantılarıyla). */
export function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    await enforceRateLimit(`pub:${clientIp(req)}`, 120, MINUTE);
    const slug = (await params).slug;
    const t = await resolveTenant(slug);
    const phone = readCustomerCookie(req, slug, t.id);
    if (!phone) throw new UnauthorizedError();
    return NextResponse.json({ appointments: await upcomingForCustomer(t.id, phone) });
  });
}
