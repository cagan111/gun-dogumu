import { NextResponse } from "next/server";
import { clientIp, enforceRateLimit, handle } from "@/lib/http";
import { getSalonInfo } from "@/lib/public";
import { MINUTE } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };

/** Salon bilgisi. Askıdaysa 423 + { suspended: true }. */
export function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    await enforceRateLimit(`pub:${clientIp(req)}`, 120, MINUTE);
    const info = await getSalonInfo((await params).slug);
    if (info.suspended) {
      return NextResponse.json(
        { error: { code: "suspended", message: "Bu salon geçici olarak kapalı", suspended: true }, salon: info },
        { status: 423 },
      );
    }
    return NextResponse.json(info);
  });
}
