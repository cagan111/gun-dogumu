import { NextResponse } from "next/server";
import { clientIp, enforceRateLimit, handle, parseJson } from "@/lib/http";
import { bookPublic, publicBookingSchema } from "@/lib/public";
import { HOUR } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** Randevu oluştur. IP başına saatte 10. */
export function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    await enforceRateLimit(`book:${clientIp(req)}`, 10, HOUR);
    const body = await parseJson(req, publicBookingSchema);
    if (!body.ok) return body.response;
    return NextResponse.json(await bookPublic((await params).slug, body.data), { status: 201 });
  });
}
