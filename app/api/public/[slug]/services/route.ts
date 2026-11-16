import { NextResponse } from "next/server";
import { clientIp, enforceRateLimit, handle } from "@/lib/http";
import { listPublicServices } from "@/lib/public";
import { MINUTE } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    await enforceRateLimit(`pub:${clientIp(req)}`, 120, MINUTE);
    return NextResponse.json({ services: await listPublicServices((await params).slug) });
  });
}
