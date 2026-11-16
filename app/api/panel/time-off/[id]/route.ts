export const dynamic = "force-dynamic";
import { panelRoute } from "@/lib/panel-auth";
import { parseJson } from "@/lib/http";
import { updateTimeOff, deleteTimeOff, timeOffPatchSchema } from "@/lib/panel/catalog";

export const PATCH = panelRoute(async (ctx, req, p) => {
  const b = await parseJson(req, timeOffPatchSchema);
  if (!b.ok) return b.response;
  return updateTimeOff(ctx, p.id as string, b.data);
});
export const DELETE = panelRoute((ctx, _r, p) => deleteTimeOff(ctx, p.id as string));
