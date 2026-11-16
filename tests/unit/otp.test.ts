import { describe, expect, it } from "vitest";
import { evaluateOtp, generateOtpCode, hashOtp, OTP_MAX_ATTEMPTS, OTP_TTL_MS } from "@/lib/otp";
import { signPayload, verifyPayload } from "@/lib/signed-cookie";

const pepper = "pepper";
const now = new Date("2026-11-20T10:00:00Z");
const row = (over: Partial<Parameters<typeof evaluateOtp>[0]> = {}) => ({
  codeHash: hashOtp("123456", pepper), expiresAt: new Date(now.getTime() + OTP_TTL_MS), attempts: 0, usedAt: null, ...over,
});

describe("OTP saf kısım", () => {
  it("kod 6 haneli sayıdır", () => {
    for (let i = 0; i < 200; i++) expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });
  it("hash deterministik, pepper'a bağlı, kodu içermez", () => {
    expect(hashOtp("123456", pepper)).toBe(hashOtp("123456", pepper));
    expect(hashOtp("123456", pepper)).not.toBe(hashOtp("123456", "baska"));
    expect(hashOtp("123456", pepper)).toMatch(/^[0-9a-f]{64}$/);
  });
  it("doğru kod ok, yanlış wrong", () => {
    expect(evaluateOtp(row(), "123456", pepper, now)).toBe("ok");
    expect(evaluateOtp(row(), "000000", pepper, now)).toBe("wrong");
  });
  it("süre: 5 dk, sınırda geçersiz", () => {
    expect(OTP_TTL_MS).toBe(300_000);
    expect(evaluateOtp(row({ expiresAt: new Date(now.getTime() + 1) }), "123456", pepper, now)).toBe("ok");
    expect(evaluateOtp(row({ expiresAt: now }), "123456", pepper, now)).toBe("expired");
  });
  it("5 hatalı denemeden sonra kilit, kullanılmış kod reddedilir", () => {
    expect(evaluateOtp(row({ attempts: OTP_MAX_ATTEMPTS }), "123456", pepper, now)).toBe("locked");
    expect(evaluateOtp(row({ attempts: OTP_MAX_ATTEMPTS - 1 }), "123456", pepper, now)).toBe("ok");
    expect(evaluateOtp(row({ usedAt: now }), "123456", pepper, now)).toBe("used");
  });
});

describe("imzalı çerez", () => {
  const p = { t: "tenant1", p: "+905331112233", exp: now.getTime() + 30 * 60_000 };
  it("imzala/doğrula", () => {
    expect(verifyPayload(signPayload(p, "s"), "s", now.getTime())).toEqual(p);
  });
  it("yanlış sır, değiştirilmiş yük, süre dolumu reddedilir", () => {
    const v = signPayload(p, "s");
    expect(verifyPayload(v, "x", now.getTime())).toBeNull();
    const [body, sig] = v.split(".") as [string, string];
    const evil = Buffer.from(JSON.stringify({ ...p, p: "+905550000000" })).toString("base64url");
    expect(verifyPayload(`${evil}.${sig}`, "s", now.getTime())).toBeNull();
    expect(verifyPayload(`${body}.deadbeef`, "s", now.getTime())).toBeNull();
    expect(verifyPayload(v, "s", p.exp)).toBeNull();
    expect(verifyPayload(undefined, "s")).toBeNull();
    expect(verifyPayload("çöp", "s")).toBeNull();
  });
});
