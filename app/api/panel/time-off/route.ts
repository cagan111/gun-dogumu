export const dynamic = "force-dynamic";
import { panelRoute, created, queryOf } from "@/lib/panel-auth";
import { parseJson } from "@/lib/http";
import { listTimeOff, createTimeOff, timeOffSchema } from "@/lib/panel/catalog";

export const GET = panelRoute((ctx, req) => listTimeOff(ctx, { staffId: queryOf(req).staffId }));
export const POST = panelRoute(async (ctx, req) => {
  const b = await parseJson(req, timeOffSchema);
  if (!b.ok) return b.response;
  return created(await createTimeOff(ctx, b.data));
});
