/**
 * Tenant kapsamı: tenant'a ait modellerde her sorguya tenantId eklenir.
 * Saf fonksiyon (scopeArgs) birim testlidir; withTenant() bunu Prisma extension olarak uygular.
 */
export const TENANT_MODELS = new Set([
  "Staff", "Service", "ServiceStaff", "WorkingHours", "TimeOff", "Customer", "Appointment",
  "SmsLedger", "MessageLog", "Invoice", "Payment", "SmsPackageRequest", "Otp",
]);

const WHERE_OPS = new Set([
  "findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy",
  "update", "updateMany", "delete", "deleteMany",
]);

type Args = Record<string, unknown> & { where?: Record<string, unknown>; data?: unknown; create?: Record<string, unknown> };

export function scopeArgs(model: string | undefined, operation: string, args: Args | undefined, tenantId: string): Args {
  const a: Args = { ...(args ?? {}) };
  if (!model || !TENANT_MODELS.has(model)) return a;
  if (!tenantId) throw new Error("tenantId gerekli");
  if (WHERE_OPS.has(operation)) a.where = { ...(a.where ?? {}), tenantId };
  if (operation === "create") a.data = { ...(a.data as object), tenantId };
  if (operation === "createMany" || operation === "createManyAndReturn") {
    const d = a.data;
    a.data = Array.isArray(d) ? d.map((x) => ({ ...x, tenantId })) : { ...(d as object), tenantId };
  }
  if (operation === "upsert") {
    a.where = { ...(a.where ?? {}), tenantId };
    a.create = { ...(a.create ?? {}), tenantId };
  }
  return a;
}
