export const dynamic = "force-dynamic";
import { panelRoute } from "@/lib/panel-auth";
import { parseJson } from "@/lib/http";
import { getWorkingHours, setWorkingHours, workingHoursSchema } from "@/lib/panel/catalog";

export const GET = panelRoute((ctx, _r, p) => getWorkingHours(ctx, p.id as string));
/** { days: [{ weekday 0–6, startMin, endMin, breaks: [[s,e]] }] } — listede olmayan gün kapalı. */
export const PUT = panelRoute(async (ctx, req, p) => {
  const b = await parseJson(req, workingHoursSchema);
  if (!b.ok) return b.response;
  return setWorkingHours(ctx, p.id as string, b.data);
});
