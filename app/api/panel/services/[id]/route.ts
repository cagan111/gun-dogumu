export const dynamic = "force-dynamic";
import { panelRoute } from "@/lib/panel-auth";
import { parseJson } from "@/lib/http";
import { getService, updateService, deleteService, servicePatchSchema } from "@/lib/panel/catalog";

export const GET = panelRoute((ctx, _r, p) => getService(ctx, p.id as string));
export const PATCH = panelRoute(async (ctx, req, p) => {
  const b = await parseJson(req, servicePatchSchema);
  if (!b.ok) return b.response;
  return updateService(ctx, p.id as string, b.data);
});
export const DELETE = panelRoute((ctx, _r, p) => deleteService(ctx, p.id as string));
