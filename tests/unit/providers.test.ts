import { describe, expect, it, vi } from "vitest";
import { getEmailProvider, getSmsProvider, getWhatsAppProvider, whatsappConfigured } from "@/lib/messaging/registry";
import { GenericHttpSmsProvider, IletiMerkeziProvider, MockProvider, NetgsmProvider, WhatsAppCloudProvider } from "@/lib/messaging/providers";
import type { FetchLike } from "@/lib/messaging/types";

type Call = { url: string; init?: { method?: string; headers?: Record<string, string>; body?: string } };
function fakeFetch(status: number, body: string) {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => { calls.push({ url, init }); return { ok: status >= 200 && status < 300, status, text: async () => body }; };
  return { fetch, calls };
}
const real = { ALLOW_REAL_SMS: "true" };
const netgsmEnv = { ...real, NETGSM_USERCODE: "u", NETGSM_PASSWORD: "p", NETGSM_HEADER: "SALON" };

describe("kapı: ALLOW_REAL_SMS", () => {
  it("gerçek sağlayıcılar kapı kapalıyken ağa ÇIKMAZ ve reddeder", async () => {
    const { fetch, calls } = fakeFetch(200, "00 1");
    const env = { NETGSM_USERCODE: "u", NETGSM_PASSWORD: "p", NETGSM_HEADER: "H", ILETIMERKEZI_KEY: "k", ILETIMERKEZI_HASH: "h", ILETIMERKEZI_SENDER: "S", GENERIC_SMS_URL: "https://x", GENERIC_SMS_PARAMS: "a={to}", WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1" };
    for (const P of [NetgsmProvider, IletiMerkeziProvider, GenericHttpSmsProvider, WhatsAppCloudProvider]) {
      const r = await new P({ env, fetch }).send("+905331112233", "merhaba");
      expect(r).toMatchObject({ ok: false, error: "real_sms_disabled" });
    }
    expect(calls).toHaveLength(0);
  });
  it("ALLOW_REAL_SMS=false/boş dışındaki değerler de kapıyı açmaz", async () => {
    const { fetch, calls } = fakeFetch(200, "00 1");
    for (const v of ["false", "1", "TRUE", "yes", ""]) {
      const r = await new NetgsmProvider({ env: { ...netgsmEnv, ALLOW_REAL_SMS: v }, fetch }).send("+905331112233", "x");
      expect(r.ok).toBe(false);
    }
    expect(calls).toHaveLength(0);
  });
});

describe("registry", () => {
  it("varsayılan mock", () => {
    expect(getSmsProvider(null, { env: {} }).name).toBe("mock");
    expect(getSmsProvider(undefined, { env: { SMS_PROVIDER: "mock" } }).name).toBe("mock");
  });
  it("gerçek sağlayıcı seçili ama kapı kapalı → mock", () => {
    expect(getSmsProvider(null, { env: { SMS_PROVIDER: "netgsm", ...netgsmEnv, ALLOW_REAL_SMS: "false" } }).name).toBe("mock");
    expect(getSmsProvider("netgsm", { env: { ...netgsmEnv, ALLOW_REAL_SMS: undefined } }).name).toBe("mock");
  });
  it("kapı açık + yapılandırma tamam → gerçek; tenant ayarı env'i ezer", () => {
    expect(getSmsProvider(null, { env: { SMS_PROVIDER: "netgsm", ...netgsmEnv } }).name).toBe("netgsm");
    expect(getSmsProvider("iletimerkezi", { env: { SMS_PROVIDER: "netgsm", ...real, ILETIMERKEZI_KEY: "k", ILETIMERKEZI_HASH: "h", ILETIMERKEZI_SENDER: "S" } }).name).toBe("iletimerkezi");
    expect(getSmsProvider("generic_http", { env: { ...real, GENERIC_SMS_URL: "https://x", GENERIC_SMS_PARAMS: "a={to}" } }).name).toBe("generic_http");
  });
  it("yapılandırma eksik ya da bilinmeyen ad → mock", () => {
    expect(getSmsProvider("netgsm", { env: real }).name).toBe("mock");
    expect(getSmsProvider("yok", { env: real }).name).toBe("mock");
  });
  it("WhatsApp: yapılandırma ve kapı", () => {
    const env = { WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1" };
    expect(whatsappConfigured({ env })).toBe(true);
    expect(whatsappConfigured({ env: {} })).toBe(false);
    expect(getWhatsAppProvider({ env }).name).toBe("mock-whatsapp");
    expect(getWhatsAppProvider({ env: { ...env, ...real } }).name).toBe("whatsapp_cloud");
  });
  it("e-posta sağlayıcısı mock ve loglar, ağa çıkmaz", async () => {
    const r = await getEmailProvider().send("a@b.c", "konu", "metin");
    expect(r.ok).toBe(true);
  });
});

describe("MockProvider", () => {
  it("ok döner, segmenti cost olarak bildirir", async () => {
    const r = await new MockProvider("sms").send("+90533", "a".repeat(161));
    expect(r).toMatchObject({ ok: true, cost: 2 });
    expect((await new MockProvider("whatsapp").send("+90533", "x")).cost).toBe(0);
  });
});

describe("Netgsm", () => {
  it("XML isteği biçimi ve başarı yanıtı", async () => {
    const { fetch, calls } = fakeFetch(200, "00 123456789");
    const r = await new NetgsmProvider({ env: netgsmEnv, fetch }).send("+905331112233", "Merhaba <dünya> & ]]>", { sender: "BENIM" });
    expect(r).toMatchObject({ ok: true, providerId: "123456789", cost: 1 });
    const c = calls[0]!;
    expect(c.url).toBe("https://api.netgsm.com.tr/sms/send/xml");
    expect(c.init?.method).toBe("POST");
    expect(c.init?.body).toContain("<no>905331112233</no>");
    expect(c.init?.body).toContain("<msgheader>BENIM</msgheader>");
    expect(c.init?.body).toContain("<usercode>u</usercode>");
    expect(c.init?.body).toContain("<![CDATA[Merhaba <dünya> & ]]]]><![CDATA[>]]>");
  });
  it("hata kodu ve HTTP hatası ok=false", async () => {
    expect((await new NetgsmProvider({ env: netgsmEnv, fetch: fakeFetch(200, "30").fetch }).send("+905331112233", "x")).ok).toBe(false);
    expect((await new NetgsmProvider({ env: netgsmEnv, fetch: fakeFetch(500, "00 1").fetch }).send("+905331112233", "x")).ok).toBe(false);
  });
  it("ağ istisnası ok=false olur, fırlatmaz", async () => {
    const fetch = vi.fn(async () => { throw new Error("ECONNRESET"); });
    const r = await new NetgsmProvider({ env: netgsmEnv, fetch }).send("+905331112233", "x");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("ECONNRESET");
  });
});

describe("İleti Merkezi", () => {
  const env = { ...real, ILETIMERKEZI_KEY: "k", ILETIMERKEZI_HASH: "h", ILETIMERKEZI_SENDER: "SALON" };
  it("JSON biçimi ve başarı", async () => {
    const { fetch, calls } = fakeFetch(200, JSON.stringify({ response: { status: { code: 200, message: "ok" }, order: { id: 555 } } }));
    const r = await new IletiMerkeziProvider({ env, fetch }).send("+905331112233", "selam");
    expect(r).toMatchObject({ ok: true, providerId: "555" });
    const body = JSON.parse(calls[0]!.init!.body!);
    expect(calls[0]!.url).toBe("https://api.iletimerkezi.com/v1/send-sms/json");
    expect(body.request.authentication).toEqual({ key: "k", hash: "h" });
    expect(body.request.order.sender).toBe("SALON");
    expect(body.request.order.message).toEqual({ text: "selam", receipents: { number: ["905331112233"] } });
  });
  it("kod 200 değilse hata", async () => {
    const { fetch } = fakeFetch(200, JSON.stringify({ response: { status: { code: 401, message: "yetki" } } }));
    expect(await new IletiMerkeziProvider({ env, fetch }).send("+905331112233", "x")).toMatchObject({ ok: false });
  });
});

describe("GenericHttpSms", () => {
  it("POST form: yer tutucular URL-encode, Bearer token", async () => {
    const { fetch, calls } = fakeFetch(200, JSON.stringify({ id: "m1" }));
    const env = { ...real, GENERIC_SMS_URL: "https://sms.example.cy/send", GENERIC_SMS_METHOD: "POST", GENERIC_SMS_TOKEN: "tok", GENERIC_SMS_PARAMS: "to={to}&msg={text}&from={sender}" };
    const r = await new GenericHttpSmsProvider({ env, fetch }).send("+905331112233", "çok & güzel", { sender: "SALON" });
    expect(r).toMatchObject({ ok: true, providerId: "m1" });
    expect(calls[0]!.init?.method).toBe("POST");
    expect(calls[0]!.init?.headers?.Authorization).toBe("Bearer tok");
    expect(calls[0]!.init?.headers?.["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(calls[0]!.init?.body).toBe(`to=905331112233&msg=${encodeURIComponent("çok & güzel")}&from=SALON`);
  });
  it("GET: sorgu dizgesine eklenir; özel token başlığı ham", async () => {
    const { fetch, calls } = fakeFetch(200, "OK");
    const env = { ...real, GENERIC_SMS_URL: "https://sms.example.cy/api?v=1", GENERIC_SMS_METHOD: "get", GENERIC_SMS_TOKEN: "tok", GENERIC_SMS_TOKEN_HEADER: "X-Api-Key", GENERIC_SMS_PARAMS: "n={to}&t={text}" };
    await new GenericHttpSmsProvider({ env, fetch }).send("+905331112233", "a b");
    expect(calls[0]!.url).toBe("https://sms.example.cy/api?v=1&n=905331112233&t=a%20b");
    expect(calls[0]!.init?.method).toBe("GET");
    expect(calls[0]!.init?.body).toBeUndefined();
    expect(calls[0]!.init?.headers?.["X-Api-Key"]).toBe("tok");
  });
  it("JSON şablon: değerler JSON-escape", async () => {
    const { fetch, calls } = fakeFetch(200, "{}");
    const env = { ...real, GENERIC_SMS_URL: "https://x/y", GENERIC_SMS_PARAMS: '{"to":"{to}","text":"{text}"}' };
    await new GenericHttpSmsProvider({ env, fetch }).send("+905331112233", 'tırnak " ve \n satır');
    expect(calls[0]!.init?.headers?.["Content-Type"]).toBe("application/json");
    expect(JSON.parse(calls[0]!.init!.body!)).toEqual({ to: "905331112233", text: 'tırnak " ve \n satır' });
  });
  it("GENERIC_SMS_OK_REGEX gövdeyi kontrol eder", async () => {
    const env = { ...real, GENERIC_SMS_URL: "https://x/y", GENERIC_SMS_PARAMS: "a={to}", GENERIC_SMS_OK_REGEX: "^OK" };
    expect((await new GenericHttpSmsProvider({ env, fetch: fakeFetch(200, "OK 1").fetch }).send("+90533", "x")).ok).toBe(true);
    expect((await new GenericHttpSmsProvider({ env, fetch: fakeFetch(200, "ERR").fetch }).send("+90533", "x")).ok).toBe(false);
  });
});

describe("WhatsApp Cloud", () => {
  const env = { ...real, WHATSAPP_TOKEN: "tok", WHATSAPP_PHONE_NUMBER_ID: "999" };
  it("şablon mesajı biçimi", async () => {
    const { fetch, calls } = fakeFetch(200, JSON.stringify({ messages: [{ id: "wamid.1" }] }));
    const r = await new WhatsAppCloudProvider({ env, fetch }).send("+905331112233", "Randevunuz var");
    expect(r).toMatchObject({ ok: true, providerId: "wamid.1", cost: 0 });
    expect(calls[0]!.url).toBe("https://graph.facebook.com/v21.0/999/messages");
    expect(calls[0]!.init?.headers?.Authorization).toBe("Bearer tok");
    expect(JSON.parse(calls[0]!.init!.body!)).toEqual({
      messaging_product: "whatsapp", to: "905331112233", type: "template",
      template: { name: "kr_notification", language: { code: "tr" }, components: [{ type: "body", parameters: [{ type: "text", text: "Randevunuz var" }] }] },
    });
  });
  it("hata gövdesi", async () => {
    const { fetch } = fakeFetch(400, JSON.stringify({ error: { message: "template not approved" } }));
    const r = await new WhatsAppCloudProvider({ env, fetch }).send("+905331112233", "x");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("template not approved");
  });
});
