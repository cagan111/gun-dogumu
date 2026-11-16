export const dynamic = "force-dynamic";
import { panelRoute, created } from "@/lib/panel-auth";
import { parseJson } from "@/lib/http";
import { listSmsRequests, createSmsRequest, smsRequestSchema } from "@/lib/panel/settings";

export const GET = panelRoute((ctx) => listSmsRequests(ctx));
/** { size: 500 | 1000 | 5000 } — yalnız owner. */
export const POST = panelRoute(async (ctx, req) => {
  const b = await parseJson(req, smsRequestSchema);
  if (!b.ok) return b.response;
  return created(await createSmsRequest(ctx, b.data));
});
