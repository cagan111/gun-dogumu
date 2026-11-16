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
