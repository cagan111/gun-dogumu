export const dynamic = "force-dynamic";
import { adminRoute, queryOf } from "@/lib/panel-auth";
import { parseWith } from "@/lib/http";
import { listTenants, tenantListSchema } from "@/lib/admin/service";

export const GET = adminRoute((_c, req) => {
  const q = parseWith(tenantListSchema, queryOf(req));
  return q.ok ? listTenants(q.data) : q.response;
});
