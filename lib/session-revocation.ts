import { prisma } from "./db";
interface VersionToken { userId?: unknown; tokenVersion?: unknown; role?: unknown; tenantId?: unknown }
function validVersion(token: VersionToken): token is VersionToken & { userId: string; tokenVersion: number } {
  return typeof token.userId === "string" && !!token.userId && Number.isSafeInteger(token.tokenVersion) && (token.tokenVersion as number) >= 0;
}
/** Every server auth/session read revalidates against DB. No positive-result cache. */
export async function sessionTokenCurrent(token: VersionToken): Promise<boolean> {
  if (!validVersion(token)) return false;
  const u = await prisma.user.findUnique({ where: { id: token.userId }, select: { tokenVersion: true, role: true, tenantId: true } });
  return !!u && u.tokenVersion === token.tokenVersion && u.role === token.role && u.tenantId === token.tenantId;
}
/** Logout revokes all sessions of this generation; stale logout cannot revoke a new one. */
export async function revokeSessionToken(token: VersionToken): Promise<void> {
  if (!validVersion(token)) return;
  await prisma.user.updateMany({ where: { id: token.userId, tokenVersion: token.tokenVersion }, data: { tokenVersion: { increment: 1 } } });
}
