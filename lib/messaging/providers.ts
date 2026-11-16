/**
 * Mesaj sağlayıcıları. Gerçek sağlayıcılar yalnız ALLOW_REAL_SMS=true iken ağa çıkar;
 * aksi halde send() reddeder (`real_sms_disabled`) ve kayıt defteri zaten Mock'a düşer.
 * İstek biçimleri sağlayıcıların herkese açık HTTP API'lerine dayanır; emin olunmayan yerler yapılandırılabilir
 * bırakıldı (bkz. docs/DECISIONS.md).
 */
import { logger } from "../logger";
import { DEFAULT_SEGMENT_PROFILE, smsSegments } from "./segments";
import type { EmailProvider, MessageProvider, ProviderDeps, SendOpts, SendResult } from "./types";

export const realAllowed = (env: ProviderDeps["env"]) => env.ALLOW_REAL_SMS === "true";
const refused = (): SendResult => ({ ok: false, error: "real_sms_disabled", cost: 0 });

/** Telefon: "+90533…" → "90533…" (Netgsm / İletiMerkezi / WhatsApp rakam bekler). */
export const digitsOnly = (phone: string) => phone.replace(/[^\d]/g, "");

/** Ağ hatası/zaman aşımı sağlayıcı çağrısını düşürmesin. */
async function safe(fn: () => Promise<SendResult>): Promise<SendResult> {
  try {
    return await fn();
  } catch (e) {
    return { ok: false, error: `network:${e instanceof Error ? e.message : String(e)}`.slice(0, 200), cost: 0 };
  }
}

export class MockProvider implements MessageProvider {
  readonly name: string;
  private counter = { n: 0 };
  constructor(public channel: "sms" | "whatsapp" = "sms") { this.name = channel === "sms" ? "mock" : "mock-whatsapp"; }
  /** Testler için gönderilenler. */
  static sent: { channel: string; to: string; text: string; opts?: SendOpts }[] = [];
  async send(to: string, text: string, opts?: SendOpts): Promise<SendResult> {
    const seg = smsSegments(text).segments;
    MockProvider.sent.push({ channel: this.channel, to, text, opts });
    if (MockProvider.sent.length > 500) MockProvider.sent.shift();
    logger.info({ provider: this.name, to, segments: seg, ...(process.env.NODE_ENV === "production" ? {} : { text }) }, "MOCK mesaj (gerçekte gönderilmedi)");
    return { ok: true, providerId: `mock-${++this.counter.n}`, cost: this.channel === "sms" ? seg : 0 };
  }
}

export class NetgsmProvider implements MessageProvider {
  readonly name = "netgsm";
  readonly channel = "sms" as const;
  readonly segmentProfile = DEFAULT_SEGMENT_PROFILE;
  constructor(private d: ProviderDeps) {}
  static configured(env: ProviderDeps["env"]) { return Boolean(env.NETGSM_USERCODE && env.NETGSM_PASSWORD && env.NETGSM_HEADER); }

  /** Netgsm XML API: POST https://api.netgsm.com.tr/sms/send/xml. Yanıt "00 <bulkId>" (00/01/02 başarı), diğer kodlar hata. */
  send(to: string, text: string, opts?: SendOpts): Promise<SendResult> {
    if (!realAllowed(this.d.env)) return Promise.resolve(refused());
    return safe(async () => {
      const e = this.d.env;
      const header = opts?.sender || e.NETGSM_HEADER || "";
      const xml = `<?xml version="1.0" encoding="UTF-8"?><mainbody><header><company dil="TR">Netgsm</company><usercode>${xmlEsc(e.NETGSM_USERCODE ?? "")}</usercode><password>${xmlEsc(e.NETGSM_PASSWORD ?? "")}</password><type>1:n</type><msgheader>${xmlEsc(header)}</msgheader></header><body><msg><![CDATA[${text.replace(/]]>/g, "]]]]><![CDATA[>")}]]></msg><no>${digitsOnly(to)}</no></body></mainbody>`;
      const r = await this.d.fetch(e.NETGSM_URL || "https://api.netgsm.com.tr/sms/send/xml", { method: "POST", headers: { "Content-Type": "application/xml" }, body: xml });
      const body = (await r.text()).trim();
      const [code, id] = body.split(/\s+/);
      if (r.ok && (code === "00" || code === "01" || code === "02")) return { ok: true, providerId: id, cost: smsSegments(text).segments };
      return { ok: false, error: `netgsm:${r.status}:${body.slice(0, 80)}`, cost: 0 };
    });
  }
}

export class IletiMerkeziProvider implements MessageProvider {
  readonly name = "iletimerkezi";
  readonly channel = "sms" as const;
  readonly segmentProfile = DEFAULT_SEGMENT_PROFILE;
  constructor(private d: ProviderDeps) {}
  static configured(env: ProviderDeps["env"]) { return Boolean(env.ILETIMERKEZI_KEY && env.ILETIMERKEZI_HASH && env.ILETIMERKEZI_SENDER); }

  /** İleti Merkezi JSON API: POST https://api.iletimerkezi.com/v1/send-sms/json; başarı `response.status.code === 200`. */
  send(to: string, text: string, opts?: SendOpts): Promise<SendResult> {
    if (!realAllowed(this.d.env)) return Promise.resolve(refused());
    return safe(async () => {
      const e = this.d.env;
      const payload = {
        request: {
          authentication: { key: e.ILETIMERKEZI_KEY, hash: e.ILETIMERKEZI_HASH },
          order: { sender: opts?.sender || e.ILETIMERKEZI_SENDER, sendDateTime: [], message: { text, receipents: { number: [digitsOnly(to)] } } },
        },
      };
      const r = await this.d.fetch(e.ILETIMERKEZI_URL || "https://api.iletimerkezi.com/v1/send-sms/json", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload),
      });
      const raw = await r.text();
      const j = parseJson(raw) as { response?: { status?: { code?: number | string; message?: string }; order?: { id?: string | number } } } | null;
      const code = Number(j?.response?.status?.code);
      if (r.ok && code === 200) return { ok: true, providerId: j?.response?.order?.id != null ? String(j.response.order.id) : undefined, cost: smsSegments(text).segments };
      return { ok: false, error: `iletimerkezi:${r.status}:${j?.response?.status?.message ?? raw.slice(0, 80)}`, cost: 0 };
    });
  }
}

/**
 * Yapılandırmayla bağlanan genel HTTP SMS (KKTC Turkcell/Telsim toplu SMS HTTP API'si vb.).
 *  GENERIC_SMS_URL, GENERIC_SMS_METHOD (GET|POST), GENERIC_SMS_TOKEN (varsayılan `Authorization: Bearer`),
 *  GENERIC_SMS_TOKEN_HEADER (örn. X-Api-Key → ham token), GENERIC_SMS_PARAMS: şablon, `{to} {text} {sender} {token}` yer tutucuları.
 *  `{` ile başlıyorsa JSON gövde, aksi halde form (`a={to}&b={text}`; GET'te sorgu dizgesi). GENERIC_SMS_OK_REGEX: gövdede başarı ifadesi (yoksa HTTP 2xx).
 */
export class GenericHttpSmsProvider implements MessageProvider {
  readonly name = "generic_http";
  readonly channel = "sms" as const;
  readonly segmentProfile = DEFAULT_SEGMENT_PROFILE;
  constructor(private d: ProviderDeps) {}
  static configured(env: ProviderDeps["env"]) { return Boolean(env.GENERIC_SMS_URL && env.GENERIC_SMS_PARAMS); }

  send(to: string, text: string, opts?: SendOpts): Promise<SendResult> {
    if (!realAllowed(this.d.env)) return Promise.resolve(refused());
    return safe(async () => {
      const e = this.d.env;
      const method = (e.GENERIC_SMS_METHOD || "POST").toUpperCase() === "GET" ? "GET" : "POST";
      const tpl = (e.GENERIC_SMS_PARAMS ?? "").trim();
      const vals: Record<string, string> = { to: to.replace(/^\+/, ""), text, sender: opts?.sender ?? "", token: e.GENERIC_SMS_TOKEN ?? "" };
      const isJson = tpl.startsWith("{");
      const body = tpl.replace(/\{(to|text|sender|token)\}/g, (_m, k: string) => {
        const v = vals[k] ?? "";
        return isJson ? JSON.stringify(v).slice(1, -1) : encodeURIComponent(v);
      });
      const headers: Record<string, string> = {};
      if (e.GENERIC_SMS_TOKEN) headers[e.GENERIC_SMS_TOKEN_HEADER || "Authorization"] = e.GENERIC_SMS_TOKEN_HEADER ? e.GENERIC_SMS_TOKEN : `Bearer ${e.GENERIC_SMS_TOKEN}`;
      let url = e.GENERIC_SMS_URL ?? "";
      let init: { method: string; headers: Record<string, string>; body?: string };
      if (method === "GET") {
        url += (url.includes("?") ? "&" : "?") + body;
        init = { method, headers };
      } else {
        headers["Content-Type"] = isJson ? "application/json" : "application/x-www-form-urlencoded";
        init = { method, headers, body };
      }
      const r = await this.d.fetch(url, init);
      const raw = await r.text();
      const okBody = e.GENERIC_SMS_OK_REGEX ? new RegExp(e.GENERIC_SMS_OK_REGEX).test(raw) : true;
      if (r.ok && okBody) {
        const j = parseJson(raw) as { id?: unknown; messageId?: unknown } | null;
        const id = j?.id ?? j?.messageId;
        return { ok: true, providerId: id != null ? String(id) : undefined, cost: smsSegments(text).segments };
      }
      return { ok: false, error: `generic:${r.status}:${raw.slice(0, 80)}`, cost: 0 };
    });
  }
}

/**
 * WhatsApp Cloud API (Meta): POST https://graph.facebook.com/{ver}/{PHONE_NUMBER_ID}/messages, şablon mesajı.
 * İşletme başlatımlı mesaj yalnız onaylı şablonla gider: şablon adı WHATSAPP_TEMPLATE (varsayılan kr_notification),
 * dil WHATSAPP_LANG, gövde {{1}} = tam metin. Şablonun Meta'da bu biçimde onaylanması gerekir.
 */
export class WhatsAppCloudProvider implements MessageProvider {
  readonly name = "whatsapp_cloud";
  readonly channel = "whatsapp" as const;
  constructor(private d: ProviderDeps) {}
  static configured(env: ProviderDeps["env"]) { return Boolean(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID); }

  send(to: string, text: string, opts?: SendOpts): Promise<SendResult> {
    if (!realAllowed(this.d.env)) return Promise.resolve(refused());
    return safe(async () => {
      const e = this.d.env;
      const url = `https://graph.facebook.com/${e.WHATSAPP_API_VERSION || "v21.0"}/${e.WHATSAPP_PHONE_NUMBER_ID}/messages`;
      const payload = {
        messaging_product: "whatsapp",
        to: digitsOnly(to),
        type: "template",
        template: {
          name: opts?.template || e.WHATSAPP_TEMPLATE || "kr_notification",
          language: { code: opts?.lang || e.WHATSAPP_LANG || "tr" },
          components: [{ type: "body", parameters: (opts?.params ?? [text]).map((t) => ({ type: "text", text: t })) }],
        },
      };
      const r = await this.d.fetch(url, { method: "POST", headers: { Authorization: `Bearer ${e.WHATSAPP_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const raw = await r.text();
      const j = parseJson(raw) as { messages?: { id?: string }[]; error?: { message?: string } } | null;
      const id = j?.messages?.[0]?.id;
      if (r.ok && id) return { ok: true, providerId: id, cost: 0 };
      return { ok: false, error: `whatsapp:${r.status}:${j?.error?.message ?? raw.slice(0, 80)}`, cost: 0 };
    });
  }
}

/** E-posta: şimdilik yalnız loglayan Mock (gerçek e-posta sağlayıcı yok; TODO_INSAN). */
export class MockEmailProvider implements EmailProvider {
  readonly name = "mock-email";
  static sent: { to: string; subject: string; text: string }[] = [];
  async send(to: string, subject: string, text: string) {
    MockEmailProvider.sent.push({ to, subject, text });
    if (MockEmailProvider.sent.length > 500) MockEmailProvider.sent.shift();
    logger.info({ provider: this.name, to, subject, text }, "MOCK e-posta (gerçekte gönderilmedi)");
    return { ok: true, providerId: `mock-email-${MockEmailProvider.sent.length}` };
  }
}

function xmlEsc(s: string) { return s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`); }
function parseJson(s: string): unknown { try { return JSON.parse(s); } catch { return null; } }
