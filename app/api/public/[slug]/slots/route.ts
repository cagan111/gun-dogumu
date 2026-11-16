import { NextResponse } from "next/server";
import { clientIp, enforceRateLimit, handle, parseWith } from "@/lib/http";
import { getSlots, slotsQuerySchema } from "@/lib/public";
import { MINUTE } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** GET ?serviceId&staffId|any&date=YYYY-MM-DD */
export function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    await enforceRateLimit(`pub:${clientIp(req)}`, 120, MINUTE);
    const sp = new URL(req.url).searchParams;
    const q = parseWith(slotsQuerySchema, {
      serviceId: sp.get("serviceId") ?? undefined,
      staffId: sp.get("staffId") ?? undefined,
      date: sp.get("date") ?? undefined,
    });
    if (!q.ok) return q.response;
    return NextResponse.json(await getSlots((await params).slug, q.data));
  });
}
