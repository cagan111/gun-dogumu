export const dynamic = "force-dynamic";
import { panelRoute } from "@/lib/panel-auth";
import { parseJson } from "@/lib/http";
import { getCustomer, updateCustomerNotes, notesSchema } from "@/lib/panel/customers";

export const GET = panelRoute((ctx, _r, p) => getCustomer(ctx, p.id as string));
/** Not güncelle (Pro+; Başlangıç → 402 plan_feature). */
export const PATCH = panelRoute(async (ctx, req, p) => {
  const b = await parseJson(req, notesSchema);
  if (!b.ok) return b.response;
  return updateCustomerNotes(ctx, p.id as string, b.data);
});
