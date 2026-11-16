import type { Prisma } from "@prisma/client";

interface AuditClient { auditLog: { create(args: { data: Prisma.AuditLogUncheckedCreateInput }): Promise<unknown> } }

export interface AuditEntry {
  actorId?: string | null;
  actorRole?: string | null;
  tenantId?: string | null;
  action: string;
  details?: Prisma.InputJsonValue;
}

/** Denetim kaydı yazar. Mutasyonla aynı transaction istemcisiyle çağrılırsa atomik olur. */
export async function writeAudit(client: AuditClient, e: AuditEntry): Promise<void> {
  await client.auditLog.create({
    data: { actorId: e.actorId ?? null, actorRole: e.actorRole ?? null, tenantId: e.tenantId ?? null, action: e.action, details: e.details ?? undefined },
  });
}
