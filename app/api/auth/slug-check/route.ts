import { NextResponse } from "next/server";
import { clientIp, enforceRateLimit, handle } from "@/lib/http";
import { MINUTE } from "@/lib/ratelimit";
import { checkSlug } from "@/lib/signup";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(async () => {
    await enforceRateLimit(`slug:${clientIp(req)}`, 60, MINUTE);
    const slug = (new URL(req.url).searchParams.get("slug") ?? "").trim();
    return NextResponse.json(await checkSlug(slug));
  });
}
