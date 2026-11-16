export const dynamic = "force-dynamic";
import { adminRoute } from "@/lib/panel-auth";
import { parseJson } from "@/lib/http";
import { getPlanPrices, updatePlanPrices, planPricesSchema } from "@/lib/admin/service";

export const GET = adminRoute(() => getPlanPrices());
/** { prices: { pro: 1300, salon_plus: null } } — null ezmeyi kaldırır. */
export const PATCH = adminRoute(async (ctx, req) => {
  const b = await parseJson(req, planPricesSchema);
  if (!b.ok) return b.response;
  return updatePlanPrices(ctx.user, b.data);
});
