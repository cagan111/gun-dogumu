import { describe, expect, it } from "vitest";
import { addMonthsUtc } from "@/lib/billing/payments";
import { getPaymentProvider, ManualPaymentProvider } from "@/lib/billing/payment-provider";
import { applyDebit } from "@/lib/ledger";
import { getPlanPrice } from "@/lib/plan-price";

describe("applyDebit (saf bakiye matematiği)", () => {
  it("yeterli bakiye düşer", () => {
    expect(applyDebit(10, 3)).toBe(7);
    expect(applyDebit(5, 5)).toBe(0);
  });
  it("yetersizse null; allowNegative ile eksiye düşer", () => {
    expect(applyDebit(2, 3)).toBeNull();
    expect(applyDebit(0, 1)).toBeNull();
    expect(applyDebit(2, 5, true)).toBe(-3);
  });
});

describe("addMonthsUtc", () => {
  it("ay sonu sıkıştırma ve yıl aşımı", () => {
    expect(addMonthsUtc(new Date("2026-01-31T10:00:00Z"), 1).toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(addMonthsUtc(new Date("2028-01-31T10:00:00Z"), 1).toISOString()).toBe("2028-02-29T10:00:00.000Z");
    expect(addMonthsUtc(new Date("2026-11-15T00:00:00Z"), 3).toISOString()).toBe("2027-02-15T00:00:00.000Z");
    expect(addMonthsUtc(new Date("2026-03-10T00:00:00Z"), 12).toISOString()).toBe("2027-03-10T00:00:00.000Z");
  });
});

describe("PaymentProvider", () => {
  it("manuel anında paid döner", async () => {
    const r = await new ManualPaymentProvider().charge();
    expect(r).toEqual({ method: "manual", status: "paid", providerRef: null });
  });
  it("iyzico/paytr yapılandırılmadı hatası verir", async () => {
    const req = { tenantId: "t", amountTry: 1, months: 1 };
    await expect(getPaymentProvider("iyzico").charge(req)).rejects.toMatchObject({ code: "not_configured" });
    await expect(getPaymentProvider("paytr").charge(req)).rejects.toMatchObject({ code: "not_configured" });
  });
  it("getPlanPrice DB satırı yoksa config fiyatına düşer (sahte istemci)", async () => {
    const fake = { planPrice: { findUnique: async () => null } } as never;
    expect(await getPlanPrice("pro", fake)).toBe(1250);
    expect(await getPlanPrice("yok", fake)).toBe(0);
    const over = { planPrice: { findUnique: async () => ({ priceTry: "1300.00" }) } } as never;
    expect(await getPlanPrice("pro", over)).toBe(1300);
  });
});
