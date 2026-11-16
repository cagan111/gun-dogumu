export const dynamic = "force-dynamic";
import { adminRoute } from "@/lib/panel-auth";
import { parseJson } from "@/lib/http";
import { changePlan, planChangeSchema } from "@/lib/admin/service";

export const POST = adminRoute(async (ctx, req, p) => {
  const b = await parseJson(req, planChangeSchema);
  if (!b.ok) return b.response;
  return changePlan(ctx.user, p.id as string, b.data);
});
