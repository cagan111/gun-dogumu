import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up", time: new Date().toISOString() });
  } catch (e) {
    logger.error({ err: e }, "health: db down");
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
