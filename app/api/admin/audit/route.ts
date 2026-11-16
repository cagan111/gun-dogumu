export const dynamic = "force-dynamic";
import { adminRoute, queryOf } from "@/lib/panel-auth";
import { parseWith } from "@/lib/http";
import { listAudit, auditListSchema } from "@/lib/admin/service";

export const GET = adminRoute((_c, req) => {
  const q = parseWith(auditListSchema, queryOf(req));
  return q.ok ? listAudit(q.data) : q.response;
});
