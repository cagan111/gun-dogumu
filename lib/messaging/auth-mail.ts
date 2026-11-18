/** Kimlik doğrulama bağlantıları mock sağlayıcıya veya uygulama loguna verilmez. */
import { logger } from "@/lib/logger";
import { brand } from "@/config/brand";
import { getEmailProvider } from "./registry";

export type AuthMailKind = "magic_link" | "set_password";

/** Gerçek e-posta adaptörü bağlanana kadar üretimde magic-link kapalıdır. */
export function canSendMagicLink(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== "production" || getEmailProvider().name !== "mock-email";
}

export async function sendAuthEmail(to: string, kind: AuthMailKind, link: string) {
  const provider = getEmailProvider();
  if (provider.name === "mock-email") {
    logger.info({ provider: provider.name, kind }, "kimlik e-postası gönderilmedi: sağlayıcı yapılandırılmamış");
    return { ok: false, error: "email_not_configured" };
  }
  const subject = kind === "magic_link" ? `${brand.name} giriş bağlantınız` : `${brand.name} şifre belirleme bağlantınız`;
  const text = kind === "magic_link"
    ? `Giriş yapmak için bağlantıya tıklayın (15 dk geçerli, tek kullanımlık): ${link}`
    : `Şifrenizi belirlemek için bağlantıya tıklayın (24 saat geçerli, tek kullanımlık): ${link}`;
  return provider.send(to, subject, text);
}
