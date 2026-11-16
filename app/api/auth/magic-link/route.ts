import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, handle, parseJson } from "@/lib/http";
import { requestMagicLink } from "@/lib/login";

export const dynamic = "force-dynamic";
const schema = z.object({ email: z.string().trim().email().max(200) });

/** Sihirli giriş bağlantısı ister. Hesap var/yok fark etmeksizin 200 (şimdilik bağlantı loga yazılır). */
export function POST(req: Request) {
  return handle(async () => {
    const body = await parseJson(req, schema);
    if (!body.ok) return body.response;
    await requestMagicLink(body.data.email, clientIp(req));
    return NextResponse.json({ ok: true });
  });
}
