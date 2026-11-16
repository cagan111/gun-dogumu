export const dynamic = "force-dynamic";
import { panelRoute, queryOf } from "@/lib/panel-auth";
import { parseWith } from "@/lib/http";
import { customerQuerySchema, searchCustomers } from "@/lib/panel/customers";

/** GET ?q=&page=&pageSize= */
export const GET = panelRoute((ctx, req) => {
  const q = parseWith(customerQuerySchema, queryOf(req));
  return q.ok ? searchCustomers(ctx, q.data) : q.response;
});
