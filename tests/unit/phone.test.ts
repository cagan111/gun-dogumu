import { describe, expect, it } from "vitest";
import { isKktcMobile, normalizePhone, phoneSchema } from "@/lib/phone";

describe("normalizePhone", () => {
  it("KKTC cep önekleri (533/542/548/539) E.164'e çevrilir", () => {
    expect(normalizePhone("0533 123 45 67")).toBe("+905331234567");
    expect(normalizePhone("542 123 45 67")).toBe("+905421234567");
    expect(normalizePhone("+90 548 123 45 67")).toBe("+905481234567");
    expect(normalizePhone("(0539) 123-4567")).toBe("+905391234567");
    for (const n of ["+905331234567", "+905421234567", "+905481234567", "+905391234567"]) expect(isKktcMobile(n)).toBe(true);
    expect(isKktcMobile("+905551234567")).toBe(false);
  });
  it("KKTC sabit hat (+90 392)", () => {
    expect(normalizePhone("0392 228 12 34")).toBe("+903922281234");
  });
  it("Türkiye, UK ve diğer uluslararası numaralar", () => {
    expect(normalizePhone("0555 123 45 67")).toBe("+905551234567");
    expect(normalizePhone("+44 7911 123456")).toBe("+447911123456");
    expect(normalizePhone("0044 7911 123456")).toBe("+447911123456");
    expect(normalizePhone("+49 151 23456789")).toBe("+4915123456789");
    expect(normalizePhone("+1 202 555 0123")).toBe("+12025550123");
  });
  it("geçersiz girdiyi reddeder", () => {
    for (const bad of ["", "   ", "abc", "123", "0533 123", "+90 533 123 45 678 99", "+999 1234", "5331234567x", "0000000000"]) {
      expect(normalizePhone(bad), bad).toBeNull();
    }
  });
  it("varsayılan ülke değiştirilebilir", () => {
    expect(normalizePhone("07911 123456", "GB")).toBe("+447911123456");
  });
  it("zod şeması dönüştürür / hata verir", () => {
    expect(phoneSchema.parse("0533 123 45 67")).toBe("+905331234567");
    expect(phoneSchema.safeParse("xyz").success).toBe(false);
  });
});
