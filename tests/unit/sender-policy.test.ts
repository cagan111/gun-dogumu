import { expect, it } from "vitest";
import { approvedSmsSender } from "@/lib/messaging/sender-policy";
const config = { SMS_APPROVED_SENDERS_JSON: JSON.stringify({ one: { mock: ["Salon"] }, two: { netgsm: ["Other"] } }) };
it("approval binds exact tenant/provider/case and revoked config denies", () => {
  expect(approvedSmsSender("one", "mock", "Salon", config)).toBe(true);
  for (const [tenant, provider, sender] of [["two", "mock", "Salon"], ["one", "netgsm", "Salon"], ["one", "mock", "salon"], ["__proto__", "mock", "Salon"], ["one", "constructor", "Salon"]] as const) {
    expect(approvedSmsSender(tenant, provider, sender, config)).toBe(false);
  }
  expect(approvedSmsSender("one", "mock", "Salon", {})).toBe(false);
});
it("malformed, invalid, oversized approval data fail closed; null keeps operator defaults", () => {
  for (const raw of ["{", "null", "[]", JSON.stringify({ one: { mock: ["123"] } }), JSON.stringify({ one: { unknown: ["Salon"] } }), " ".repeat(65537)]) {
    expect(approvedSmsSender("one", "mock", "Salon", { SMS_APPROVED_SENDERS_JSON: raw })).toBe(false);
  }
  expect(approvedSmsSender("one", "mock", null, {})).toBe(true);
  expect(approvedSmsSender("one", "mock", "123", config)).toBe(false);
});
