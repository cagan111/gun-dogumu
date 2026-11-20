import { z } from "zod";
import { panelRoute } from "@/lib/panel-auth";
import { parseJson } from "@/lib/http";
import { rotateCalendarFeed, revokeCalendarFeed } from "@/lib/calendar-feed";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
export const POST = panelRoute(async (ctx, req, p) => {
  if (req.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") return new Response(null, { status: 415, headers });
  const body = await parseJson(req, z.object({}).strict());
  if (!body.ok) return body.response;
  return Response.json(await rotateCalendarFeed(ctx, p.id!), { headers });
});
export const DELETE = panelRoute(async (ctx, _req, p) => Response.json(await revokeCalendarFeed(ctx, p.id!), { headers }), { allowSuspendedWrite: true });
