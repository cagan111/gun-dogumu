import { NextResponse } from "next/server";
import { getAppointmentByToken } from "@/lib/cancel";
import { clientIp, enforceRateLimit, handle } from "@/lib/http";
import { MINUTE } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** Randevu özeti + hâlâ iptal edilebilir mi. */
export function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    await enforceRateLimit(`tok:${clientIp(req)}`, 60, MINUTE);
    return NextResponse.json(await getAppointmentByToken((await params).token));
  });
}
