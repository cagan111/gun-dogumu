export const dynamic = "force-dynamic";
import { adminRoute, created } from "@/lib/panel-auth";
import { parseJson } from "@/lib/http";
import { addSmsCredits, smsCreditSchema } from "@/lib/admin/service";

export const POST = adminRoute(async (ctx, req) => {
  const b = await parseJson(req, smsCreditSchema);
  if (!b.ok) return b.response;
  return created(await addSmsCredits(ctx.user, b.data));
});
