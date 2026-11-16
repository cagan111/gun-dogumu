import { NextResponse } from "next/server";
import { z } from "zod";
import { InvalidTokenError } from "@/lib/errors";
import { clientIp, enforceRateLimit, handle, parseJson } from "@/lib/http";
import { prisma } from "@/lib/db";
import { consumeLoginToken } from "@/lib/login-token";
import { hashPassword } from "@/lib/login";
import { HOUR } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
const schema = z.object({ token: z.string().min(20).max(200), password: z.string().min(8).max(72) });

/** Tek kullanımlık bağlantıyla şifre belirler (süper-admin ilk kurulum / şifre sıfırlama). */
export function POST(req: Request) {
  return handle(async () => {
    await enforceRateLimit(`setpw:${clientIp(req)}`, 10, HOUR);
    const body = await parseJson(req, schema);
    if (!body.ok) return body.response;
    const userId = await consumeLoginToken(body.data.token, "set_password");
    if (!userId) throw new InvalidTokenError();
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(body.data.password) } });
    return NextResponse.json({ ok: true });
  });
}
