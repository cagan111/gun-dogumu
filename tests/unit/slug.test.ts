import { describe, expect, it } from "vitest";
import { RESERVED_SLUGS, slugProblem, slugSchema } from "@/lib/slug";

describe("slug doğrulama", () => {
  it("geçerli slug'lar", () => {
    for (const s of ["usta-berber", "abc", "glow-kuafor-girne", "a1b2c3", "x".repeat(40)]) expect(slugProblem(s)).toBeNull();
  });
  it("biçim hataları", () => {
    for (const s of ["ab", "x".repeat(41), "Usta", "usta berber", "usta_berber", "ığdır", "-abc", "abc-", ""]) expect(slugProblem(s)).toBe("format");
  });
  it("rezerve kelimeler engellenir", () => {
    expect(RESERVED_SLUGS).toEqual(expect.arrayContaining(["admin", "panel", "api", "giris", "kayit", "r", "randevularim", "fiyatlar", "gizlilik", "kosullar"]));
    for (const s of ["admin", "panel", "api", "giris", "kayit", "randevularim", "fiyatlar", "gizlilik", "kosullar"]) expect(slugProblem(s)).toBe("reserved");
  });
  it("zod şeması", () => {
    expect(slugSchema.safeParse("guzel-salon").success).toBe(true);
    expect(slugSchema.safeParse("admin").success).toBe(false);
    expect(slugSchema.safeParse("Büyük").success).toBe(false);
  });
});
