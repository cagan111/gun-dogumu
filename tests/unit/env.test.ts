import { describe, expect, it, vi } from "vitest";
import { assertEnv, envProblems } from "@/lib/env";

const log = () => ({ error: vi.fn(), warn: vi.fn() });

describe("açılış ortam doğrulaması", () => {
  it("tam yapılandırma sorunsuz", () => {
    expect(envProblems({ DATABASE_URL: "postgresql://x", NEXTAUTH_SECRET: "a".repeat(32) })).toEqual([]);
  });
  it("üretimde NEXTAUTH_SECRET yoksa hata loglanır ve çıkılır", () => {
    const l = log(); const exit = vi.fn();
    const p = assertEnv(l, { NODE_ENV: "production", DATABASE_URL: "postgresql://x" }, exit);
    expect(p.map((x) => x.key)).toEqual(["NEXTAUTH_SECRET"]);
    expect(l.error).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(1);
  });
  it("kısa sır reddedilir; geliştirmede yalnız uyarı", () => {
    const l = log(); const exit = vi.fn();
    assertEnv(l, { NODE_ENV: "development", DATABASE_URL: "x", NEXTAUTH_SECRET: "kisa" }, exit);
    expect(l.warn).toHaveBeenCalledOnce();
    expect(exit).not.toHaveBeenCalled();
  });
});

describe("T-119 gerçek pino yöntem bağlamı", () => {
  it.each(["development", "production"])("%s eksik/kısa sırda çökmez, sır değerini loglamaz", async (mode) => {
    const { default: pino } = await import("pino");
    for (const secret of [undefined, "short-secret"]) {
      const lines: string[] = [];
      const real = pino({}, { write: (line: string) => { lines.push(line); } });
      const exit = vi.fn();
      expect(() => assertEnv(real, { NODE_ENV: mode, DATABASE_URL: "test-db", NEXTAUTH_SECRET: secret }, exit)).not.toThrow();
      const logs = lines.map((line) => JSON.parse(line) as { level: number; key: string });
      expect(logs).toHaveLength(1); expect(logs[0]?.level).toBe(mode === "production" ? 50 : 40);
      expect(logs[0]?.key).toBe("NEXTAUTH_SECRET");
      if (secret) expect(lines.join("")).not.toContain(secret);
      if (mode === "production") expect(exit).toHaveBeenCalledWith(1); else expect(exit).not.toHaveBeenCalled();
    }
  });
});
