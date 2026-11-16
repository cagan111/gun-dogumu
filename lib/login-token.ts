import { randomBytes } from "node:crypto";
import type { LoginTokenPurpose } from "@prisma/client";
import { prisma } from "./db";
import { sha256Hex } from "./secret";

export const LOGIN_TOKEN_TTL_MS: Record<LoginTokenPurpose, number> = {
  magic_link: 15 * 60_000,
  set_password: 24 * 3_600_000,
};

/** Tek kullanımlık token üretir; yalnız SHA-256 özeti saklanır, ham değer çağırana döner. */
export async function createLoginToken(userId: string, purpose: LoginTokenPurpose, now: Date = new Date()): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await prisma.loginToken.create({
    data: { userId, purpose, tokenHash: sha256Hex(raw), expiresAt: new Date(now.getTime() + LOGIN_TOKEN_TTL_MS[purpose]) },
  });
  return raw;
}

/** Token'ı atomik olarak tüketir; geçerliyse userId, değilse null. */
export async function consumeLoginToken(raw: string, purpose: LoginTokenPurpose, now: Date = new Date()): Promise<string | null> {
  if (!raw || raw.length < 20 || raw.length > 200) return null;
  const hash = sha256Hex(raw);
  const res = await prisma.loginToken.updateMany({
    where: { tokenHash: hash, purpose, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (res.count !== 1) return null;
  const row = await prisma.loginToken.findUnique({ where: { tokenHash: hash }, select: { userId: true } });
  return row?.userId ?? null;
}

export function appBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || (process.env.APP_DOMAIN ? `https://${process.env.APP_DOMAIN}` : "http://localhost:3000")).replace(/\/$/, "");
}
export const setPasswordLink = (token: string) => `${appBaseUrl()}/sifre-belirle?token=${token}`;
export const magicLink = (token: string) => `${appBaseUrl()}/giris/sihirli?token=${token}`;
