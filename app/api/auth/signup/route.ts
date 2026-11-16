import { NextResponse } from "next/server";
import { clientIp, enforceRateLimit, handle, parseJson } from "@/lib/http";
import { HOUR } from "@/lib/ratelimit";
import { signupSalon, signupSchema } from "@/lib/signup";

export const dynamic = "force-dynamic";

/** Salon + owner kaydı (14 gün deneme). Çakışmada 409 { error: { code: "conflict", field: "slug" | "email" } }. */
export function POST(req: Request) {
  return handle(async () => {
    await enforceRateLimit(`signup:${clientIp(req)}`, 5, HOUR);
    const body = await parseJson(req, signupSchema);
    if (!body.ok) return body.response;
    const r = await signupSalon(body.data);
    return NextResponse.json({ ok: true, slug: r.slug, trialEndsAt: r.trialEndsAt }, { status: 201 });
  });
}
