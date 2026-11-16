export const dynamic = "force-dynamic";
import { adminRoute, queryOf } from "@/lib/panel-auth";
import { parseWith } from "@/lib/http";
import { listSmsRequests, smsRequestListSchema } from "@/lib/admin/service";

export const GET = adminRoute((_c, req) => {
  const q = parseWith(smsRequestListSchema, queryOf(req));
  return q.ok ? listSmsRequests(q.data) : q.response;
});
