export const dynamic = "force-dynamic";
import { panelRoute, created } from "@/lib/panel-auth";
import { parseJson } from "@/lib/http";
import { listStaff, createStaff, staffSchema } from "@/lib/panel/catalog";

export const GET = panelRoute((ctx) => listStaff(ctx));
/** Plan personel limiti aşılırsa 402 plan_limit. */
export const POST = panelRoute(async (ctx, req) => {
  const b = await parseJson(req, staffSchema);
  if (!b.ok) return b.response;
  return created(await createStaff(ctx, b.data));
});
