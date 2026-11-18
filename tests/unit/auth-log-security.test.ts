import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const s = vi.hoisted(() => ({ logs: [] as string[], send: vi.fn(), find: vi.fn(), create: vi.fn(), count: vi.fn(), consume: vi.fn(), token: vi.fn(), provider: "mock-email" }));
vi.mock("@/lib/logger", async () => {
  const { default: pino } = await import("pino");
  return { logger: pino({ level: "trace" }, { write: (line: string) => { s.logs.push(line); } }) };
});
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: s.find, create: s.create, update: vi.fn() }, loginToken: { count: s.count } } }));
vi.mock("@/lib/ratelimit", () => ({ MINUTE: 60000, rateLimit: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/login-token", () => ({ createLoginToken: s.token, consumeLoginToken: s.consume, magicLink: (token: string) => `https://example.test/giris/sihirli?token=${token}`, setPasswordLink: (token: string) => `https://example.test/sifre-belirle?token=${token}` }));
vi.mock("@/lib/messaging/registry", () => ({ getEmailProvider: () => ({ name: s.provider, send: s.send }) }));
import { authenticateMagicToken, requestMagicLink } from "@/lib/login";
import { sendAuthEmail } from "@/lib/messaging/auth-mail";
import { ensureSuperadmin } from "@/lib/bootstrap";
const token = "regression-only-not-a-real-token";
beforeEach(() => { vi.clearAllMocks(); s.logs.length = 0; s.provider = "mock-email"; s.find.mockResolvedValue({ id: "u", role: "owner", passwordHash: null }); s.token.mockResolvedValue(token); s.consume.mockResolvedValue(null); s.send.mockImplementation(async (_to: string, _subject: string, text: string) => { const { logger } = await import("@/lib/logger"); logger.info({ text }, "mock email"); return { ok: true }; }); });
afterEach(() => vi.unstubAllEnvs());
describe("T-110 giriş bağlantısı güvenliği", () => {
  it("üretimde mock sağlayıcıyla kayıtlı/kayıtsız istekte token üretmez ve tüketmez", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await requestMagicLink("owner@example.test", "test-ip");
    s.find.mockResolvedValue(null);
    await requestMagicLink("missing@example.test", "test-ip");
    expect(await authenticateMagicToken(token, "test-ip")).toBeNull();
    expect(s.token).not.toHaveBeenCalled(); expect(s.consume).not.toHaveBeenCalled(); expect(s.send).not.toHaveBeenCalled();
  });
  it.each(["development", "production"])("%s auth e-postası mock loguna URL/token yazmaz", async (env) => {
    vi.stubEnv("NODE_ENV", env);
    await sendAuthEmail("owner@example.test", "magic_link", `https://example.test/?token=${token}`);
    await sendAuthEmail("owner@example.test", "set_password", `https://example.test/?token=${token}`);
    expect(s.send).not.toHaveBeenCalled();
    expect(s.logs.join("\n")).not.toContain(token); expect(s.logs.join("\n")).not.toContain("https://");
  });
  it("gerçek sağlayıcı bağlantıyı alır ama uygulama loguna yazılmaz", async () => {
    vi.stubEnv("NODE_ENV", "production"); s.provider = "real-email"; s.send.mockResolvedValue({ ok: true });
    await requestMagicLink("owner@example.test", "test-ip");
    expect(s.token).toHaveBeenCalledOnce(); expect(s.send).toHaveBeenCalledOnce(); expect(s.send.mock.calls[0]?.[2]).toContain(token);
    expect(s.logs.join("\n")).not.toContain(token);
  });
  it("ilk superadmin bağlantısı tek açık log istisnasıdır; tekrar açılış loglamaz", async () => {
    vi.stubEnv("NODE_ENV", "production"); s.find.mockResolvedValue(null); s.create.mockResolvedValue({ id: "admin", role: "superadmin", passwordHash: null });
    expect(await ensureSuperadmin({ SUPERADMIN_EMAIL: "admin@example.test" })).toBe("created");
    s.find.mockResolvedValue({ id: "admin", role: "superadmin", passwordHash: null }); s.count.mockResolvedValue(1);
    expect(await ensureSuperadmin({ SUPERADMIN_EMAIL: "admin@example.test" })).toBe("exists");
    const secretLogs = s.logs.map((line) => JSON.parse(line) as { level: number; link?: string }).filter((line) => line.link?.includes(token));
    expect(secretLogs).toHaveLength(1); expect(secretLogs[0]?.level).toBe(40); expect(s.send).not.toHaveBeenCalled();
  });
});
