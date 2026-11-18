import { describe, expect, it } from "vitest";
import { brandVars, DEFAULT_BRAND } from "@/lib/brand-color";
describe("salon marka rengi", () => {
  it("boş veya geçersiz renkte sıcak varsayılanı kullanır", () => {
    expect(DEFAULT_BRAND).toBe("#C9A96E");
    for (const value of [null, undefined, "invalid"]) expect(brandVars(value)["--brand"]).toBe("201 169 110");
  });
  it("salonun kendi rengini ve okunur ön planını korur", () => {
    expect(brandVars("#2563eb")["--brand"]).toBe("37 99 235");
    expect(brandVars("#ffffff")["--brand-fg"]).toBe("15 23 42");
  });
});
