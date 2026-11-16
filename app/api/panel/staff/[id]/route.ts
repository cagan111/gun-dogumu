export const dynamic = "force-dynamic";
import { panelRoute } from "@/lib/panel-auth";
import { parseJson } from "@/lib/http";
import { updateStaff, deleteStaff, staffPatchSchema } from "@/lib/panel/catalog";

export const PATCH = panelRoute(async (ctx, req, p) => {
  const b = await parseJson(req, staffPatchSchema);
  if (!b.ok) return b.response;
  return updateStaff(ctx, p.id as string, b.data);
});
export const DELETE = panelRoute((ctx, _r, p) => deleteStaff(ctx, p.id as string));
