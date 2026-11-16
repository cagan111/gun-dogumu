import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "./db";
import { consumeLoginToken, createLoginToken, magicLink } from "./login-token";
import { logger } from "./logger";
import { MINUTE, rateLimit } from "./ratelimit";

export const BCRYPT_ROUNDS = 10;
export const LOGIN_PER_EMAIL = { limit: 8, windowMs: 15 * MINUTE };
export const LOGIN_PER_IP = { limit: 30, windowMs: 15 * MINUTE };

export interface SessionUser { id: string; email: string; name: string; role: Role; tenantId: string | null }

// Kullanıcı yokken de bcrypt çalıştır (zamanlama farkıyla e-posta sızdırmamak için)
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", BCRYPT_ROUNDS);

export const hashPassword = (pw: string) => bcrypt.hash(pw, BCRYPT_ROUNDS);

export function normalizeEmail(e: string): string {
  return e.trim().toLowerCase();
}

const pick = (u: { id: string; email: string; name: string; role: Role; tenantId: string | null }): SessionUser => ({
  id: u.id, email: u.email, name: u.name, role: u.role, tenantId: u.tenantId,
});

/** E-posta + şifre doğrular. Hız sınırı e-posta ve IP başına; aşılırsa null (sessizce reddeder). */
export async function authenticatePassword(emailRaw: string, password: string, ip: string): Promise<SessionUser | null> {
  const email = normalizeEmail(emailRaw);
  if (!email || !password || password.length > 200) return null;
  const [byEmail, byIp] = await Promise.all([
    rateLimit(`login:email:${email}`, LOGIN_PER_EMAIL.limit, LOGIN_PER_EMAIL.windowMs),
    rateLimit(`login:ip:${ip}`, LOGIN_PER_IP.limit, LOGIN_PER_IP.windowMs),
  ]);
  if (!byEmail.ok || !byIp.ok) {
    logger.warn({ email, ip }, "giriş hız sınırına takıldı");
    return null;
  }
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.passwordHash || !ok) return null;
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return pick(user);
}

/** Sihirli bağlantı token'ını tüketip kullanıcıyı döndürür. */
export async function authenticateMagicToken(token: string, ip: string): Promise<SessionUser | null> {
  const rl = await rateLimit(`login:magic:${ip}`, LOGIN_PER_IP.limit, LOGIN_PER_IP.windowMs);
  if (!rl.ok) return null;
  const userId = await consumeLoginToken(token, "magic_link");
  if (!userId) return null;
  const user = await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  return pick(user);
}

/**
 * Sihirli bağlantı ister. E-posta sağlayıcı yok: bağlantı e-posta yerine loga yazılır (TODO_INSAN).
 * Kullanıcı olsun olmasın aynı sonuç döner (hesap sızdırılmaz).
 */
export async function requestMagicLink(emailRaw: string, ip: string): Promise<void> {
  const email = normalizeEmail(emailRaw);
  const [byEmail, byIp] = await Promise.all([
    rateLimit(`magic:email:${email}`, 3, 15 * MINUTE),
    rateLimit(`magic:ip:${ip}`, 10, 15 * MINUTE),
  ]);
  if (!byEmail.ok || !byIp.ok) return;
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return;
  const token = await createLoginToken(user.id, "magic_link");
  logger.warn({ email, link: magicLink(token) }, "sihirli giriş bağlantısı (e-posta sağlayıcı yok, yalnız log)");
}
