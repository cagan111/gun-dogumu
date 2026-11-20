import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, createCspNonce } from "@/lib/csp";
describe("CSP request nonce", () => {
  it("generates distinct 128-bit nonces and disallows script fallback in production", () => {
    const a=createCspNonce(), b=createCspNonce(); expect(a).not.toBe(b); expect(atob(a)).toHaveLength(16);
    const policy=contentSecurityPolicy(a); expect(policy).toContain(`'nonce-${a}'`); expect(policy).toContain("'strict-dynamic'"); expect(policy).not.toContain("'unsafe-eval'"); expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });
  it("rejects header injection and permits eval only in explicit development mode", () => {
    expect(()=>contentSecurityPolicy("attacker; script-src *")).toThrow();
    expect(contentSecurityPolicy(createCspNonce(),true)).toContain("'unsafe-eval'");
  });
});
