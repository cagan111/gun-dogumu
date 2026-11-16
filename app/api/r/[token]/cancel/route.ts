import { NextResponse } from "next/server";
import { cancelAppointment } from "@/lib/cancel";
import { clientIp, enforceRateLimit, handle } from "@/lib/http";
import { MINUTE } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** Randevuyu iptal eder (salonun X saat kuralı: ihlalde 403, kapalı randevuda 409). */
export function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    await enforceRateLimit(`tok:${clientIp(req)}`, 30, MINUTE);
    return NextResponse.json(await cancelAppointment((await params).token));
  });
}
