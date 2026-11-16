export const dynamic = "force-dynamic";
import { panelRoute, created } from "@/lib/panel-auth";
import { parseJson } from "@/lib/http";
import { listServices, createService, serviceSchema } from "@/lib/panel/catalog";

export const GET = panelRoute((ctx) => listServices(ctx));
export const POST = panelRoute(async (ctx, req) => {
  const b = await parseJson(req, serviceSchema);
  if (!b.ok) return b.response;
  return created(await createService(ctx, b.data));
});
