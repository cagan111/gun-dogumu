export const dynamic = "force-dynamic";
import { adminRoute, created } from "@/lib/panel-auth";
import { parseJson } from "@/lib/http";
import { paymentSchema, recordManualPayment } from "@/lib/billing/payments";

/** Manuel ödeme → Payment + abonelik uzatma + AuditLog. */
export const POST = adminRoute(async (ctx, req) => {
  const b = await parseJson(req, paymentSchema);
  if (!b.ok) return b.response;
  return created(await recordManualPayment(ctx.user, b.data));
});
