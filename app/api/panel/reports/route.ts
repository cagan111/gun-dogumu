export const dynamic = "force-dynamic";
import { panelRoute, queryOf } from "@/lib/panel-auth";
import { parseWith } from "@/lib/http";
import { reportQuerySchema, monthlyReport } from "@/lib/panel/reports";

/** GET ?month=YYYY-MM (Pro+; Başlangıç → 402 plan_feature). */
export const GET = panelRoute((ctx, req) => {
  const q = parseWith(reportQuerySchema, queryOf(req));
  return q.ok ? monthlyReport(ctx, q.data.month) : q.response;
});
