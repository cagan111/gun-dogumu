import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { createLoginToken, setPasswordLink } from "./login-token";
import { logger } from "./logger";
import { normalizeEmail } from "./login";

/**
 * İlk açılışta SUPERADMIN_EMAIL için şifresiz superadmin oluşturur ve tek kullanımlık şifre bağlantısını loga yazar.
 * Idempotent: kullanıcı varsa dokunmaz; yalnız şifresi hâlâ yoksa ve geçerli bağlantısı kalmadıysa yeni bağlantı üretir.
 */
export async function ensureSuperadmin(env: Record<string, string | undefined> = process.env): Promise<"created" | "relinked" | "exists" | "skipped"> {
  const raw = env.SUPERADMIN_EMAIL?.trim();
  if (!raw) return "skipped";
  const email = normalizeEmail(raw);
  let user = await prisma.user.findUnique({ where: { email } });
  let result: "created" | "relinked" = "created";
  if (!user) {
    try {
      user = await prisma.user.create({ data: { email, name: "Süper Yönetici", role: "superadmin", tenantId: null } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "exists"; // başka örnek oluşturdu
      throw e;
    }
  } else {
    if (user.role !== "superadmin" || user.passwordHash) return "exists";
    const pending = await prisma.loginToken.count({
      where: { userId: user.id, purpose: "set_password", usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (pending > 0) return "exists";
    result = "relinked";
  }
  const token = await createLoginToken(user.id, "set_password");
  logger.warn({ email, link: setPasswordLink(token) }, "SÜPER-ADMİN şifre belirleme bağlantısı (24 saat, tek kullanımlık)");
  return result;
}
