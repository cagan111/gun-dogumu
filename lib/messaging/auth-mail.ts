/** Giriş / şifre belirleme bağlantılarını e-posta sağlayıcısıyla gönderir. Mock e-posta bağlantıyı loga yazar (gerçek e-posta sağlayıcı yok). */
import { brand } from "@/config/brand";
import { getEmailProvider } from "./registry";

export type AuthMailKind = "magic_link" | "set_password";

export async function sendAuthEmail(to: string, kind: AuthMailKind, link: string) {
  const subject = kind === "magic_link" ? `${brand.name} giriş bağlantınız` : `${brand.name} şifre belirleme bağlantınız`;
  const text = kind === "magic_link"
    ? `Giriş yapmak için bağlantıya tıklayın (15 dk geçerli, tek kullanımlık): ${link}`
    : `Şifrenizi belirlemek için bağlantıya tıklayın (24 saat geçerli, tek kullanımlık): ${link}`;
  return getEmailProvider().send(to, subject, text);
}
