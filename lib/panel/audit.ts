import { writeAudit } from "../audit";
import { prisma } from "../db";
import type { PanelCtx } from "../panel-auth";

/** Panel mutasyonu denetim kaydı: actor = kullanıcı id'si, tenantId = salon. */
export async function auditPanel(ctx: Pick<PanelCtx, "user" | "tenantId">, action: string, details: Record<string, string | number | boolean | null | string[]> = {}) {
  await writeAudit(prisma, { actorId: ctx.user.id, actorRole: ctx.user.role, tenantId: ctx.tenantId, action, details });
}
