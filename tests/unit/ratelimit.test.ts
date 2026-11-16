import { describe, expect, it } from "vitest";
import { MemoryRateLimiter } from "@/lib/ratelimit";

describe("MemoryRateLimiter", () => {
  it("limite kadar izin verir, sonrasını reddeder", async () => {
    const t = 1_000_000;
    const rl = new MemoryRateLimiter(() => t);
    for (let i = 0; i < 3; i++) expect((await rl.hit("k", 3, 60_000)).ok).toBe(true);
    const r = await rl.hit("k", 3, 60_000);
    expect(r.ok).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.retryAfterSec).toBe(60);
  });
  it("kayan pencere: eski istekler düşünce yeniden izin verir", async () => {
    let t = 0;
    const rl = new MemoryRateLimiter(() => t);
    await rl.hit("k", 2, 10_000); // t=0
    t = 6_000;
    await rl.hit("k", 2, 10_000); // t=6s
    expect((await rl.hit("k", 2, 10_000)).ok).toBe(false);
    t = 10_001; // ilk istek pencereden çıktı
    const r = await rl.hit("k", 2, 10_000);
    expect(r.ok).toBe(true);
    expect((await rl.hit("k", 2, 10_000)).ok).toBe(false);
  });
  it("retryAfter en eski isteğe göre hesaplanır", async () => {
    let t = 0;
    const rl = new MemoryRateLimiter(() => t);
    await rl.hit("k", 1, 10_000);
    t = 4_000;
    expect((await rl.hit("k", 1, 10_000)).retryAfterSec).toBe(6);
  });
  it("anahtarlar bağımsızdır; reddedilen istek sayılmaz", async () => {
    let t = 0;
    const rl = new MemoryRateLimiter(() => t);
    await rl.hit("a", 1, 1000);
    expect((await rl.hit("b", 1, 1000)).ok).toBe(true);
    for (let i = 0; i < 5; i++) await rl.hit("a", 1, 1000); // reddedilir
    t = 1001;
    expect((await rl.hit("a", 1, 1000)).ok).toBe(true);
  });
});
