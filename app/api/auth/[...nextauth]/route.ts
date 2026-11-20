import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { confirmLogoutResponse } from "@/lib/logout-confirmation";
export const runtime = "nodejs";
export const GET = handlers.GET;
export function POST(req: NextRequest) { return confirmLogoutResponse(() => handlers.POST(req)); }
