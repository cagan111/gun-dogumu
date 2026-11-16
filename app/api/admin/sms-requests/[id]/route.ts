export const dynamic = "force-dynamic";
import { adminRoute } from "@/lib/panel-auth";
import { parseJson } from "@/lib/http";
import { resolveSmsRequest, smsRequestResolveSchema } from "@/lib/admin/service";

/** { action: "fulfil" | "reject", note? } */
export const POST = adminRoute(async (ctx, req, p) => {
  const b = await parseJson(req, smsRequestResolveSchema);
  if (!b.ok) return b.response;
  return resolveSmsRequest(ctx.user, p.id as string, b.data);
});
