import { logger } from "../logger";
import { GenericHttpSmsProvider, IletiMerkeziProvider, MockEmailProvider, MockProvider, NetgsmProvider, realAllowed, WhatsAppCloudProvider } from "./providers";
import type { EmailProvider, MessageProvider, ProviderDeps } from "./types";

export const SMS_PROVIDER_NAMES = ["mock", "netgsm", "iletimerkezi", "generic_http"] as const;

export function defaultDeps(): ProviderDeps {
  return { env: process.env, fetch: (url, init) => fetch(url, init as RequestInit) };
}

const mockSms = new MockProvider("sms");
const mockWa = new MockProvider("whatsapp");
const mockEmail = new MockEmailProvider();

/**
 * SMS sağlayıcısı: tenant.smsProvider || SMS_PROVIDER || mock.
 * Gerçek sağlayıcı yalnız ALLOW_REAL_SMS=true ve yapılandırma tamamsa; aksi halde uyarı loglanıp Mock'a düşer.
 */
export function getSmsProvider(tenantProvider: string | null | undefined, deps: Partial<ProviderDeps> = {}): MessageProvider {
  const d = { ...defaultDeps(), ...deps };
  const want = (tenantProvider || d.env.SMS_PROVIDER || "mock").toLowerCase();
  if (want === "mock") return mockSms;
  if (!realAllowed(d.env)) {
    logger.warn({ want }, "gerçek SMS sağlayıcısı istendi ama ALLOW_REAL_SMS!=true; Mock kullanılıyor");
    return mockSms;
  }
  const make: Record<string, [boolean, () => MessageProvider]> = {
    netgsm: [NetgsmProvider.configured(d.env), () => new NetgsmProvider(d)],
    iletimerkezi: [IletiMerkeziProvider.configured(d.env), () => new IletiMerkeziProvider(d)],
    generic_http: [GenericHttpSmsProvider.configured(d.env), () => new GenericHttpSmsProvider(d)],
  };
  const entry = make[want];
  if (!entry) { logger.warn({ want }, "bilinmeyen SMS sağlayıcısı; Mock kullanılıyor"); return mockSms; }
  if (!entry[0]) { logger.warn({ want }, "SMS sağlayıcısı yapılandırması eksik; Mock kullanılıyor"); return mockSms; }
  return entry[1]();
}

/** WhatsApp yapılandırılmış mı (kimlik bilgileri tanımlı)? Kapı kapalıysa getWhatsAppProvider yine de Mock verir. */
export function whatsappConfigured(deps: Partial<ProviderDeps> = {}): boolean {
  return WhatsAppCloudProvider.configured({ ...defaultDeps(), ...deps }.env);
}

export function getWhatsAppProvider(deps: Partial<ProviderDeps> = {}): MessageProvider {
  const d = { ...defaultDeps(), ...deps };
  if (realAllowed(d.env) && WhatsAppCloudProvider.configured(d.env)) return new WhatsAppCloudProvider(d);
  if (WhatsAppCloudProvider.configured(d.env)) logger.warn("WhatsApp istendi ama ALLOW_REAL_SMS!=true; Mock kullanılıyor");
  return mockWa;
}

export function getEmailProvider(): EmailProvider {
  return mockEmail;
}
