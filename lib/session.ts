import type { Role } from "@prisma/client";
import { prisma, withTenant } from "./db";
import { ForbiddenError, UnauthorizedError } from "./errors";

export interface SessionLike {
  user?: { id?: string | null; role?: string | null; tenantId?: string | null } | null;
}

/**
 * Oturumdan tenant kullanıcısını çözer. JWT bayatlamış olabilir; kullanıcı DB'den doğrulanır
 * (silinmiş, rolü/tenant'ı değişmiş ya da superadmin ise reddedilir). Tenant kapsamlı `db` döner.
 */
export async function resolveTenantUser(session: SessionLike | null) {
  const id = session?.user?.id;
  if (!id) throw new UnauthorizedError();
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || !u.tenantId || (u.role !== "owner" && u.role !== "staff")) throw new UnauthorizedError();
  if (session?.user?.tenantId && session.user.tenantId !== u.tenantId) throw new UnauthorizedError();
  return {
    user: { id: u.id, email: u.email, name: u.name, role: u.role as Role },
    tenantId: u.tenantId,
    db: withTenant(u.tenantId),
  };
}

export async function resolveSuperadmin(session: SessionLike | null) {
  const id = session?.user?.id;
  if (!id) throw new UnauthorizedError();
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) throw new UnauthorizedError();
  if (u.role !== "superadmin") throw new ForbiddenError();
  return { user: { id: u.id, email: u.email, name: u.name, role: u.role as Role } };
}

/** Panel API'leri için: owner/staff oturumu yoksa 401 fırlatır. */
export async function requireTenantUser() {
  const { auth } = await import("@/auth");
  return resolveTenantUser(await auth());
}

/** Süper-admin API'leri için: oturum yoksa 401, rol yetmezse 403. */
export async function requireSuperadmin() {
  const { auth } = await import("@/auth");
  return resolveSuperadmin(await auth());
}
