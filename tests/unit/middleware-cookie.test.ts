import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { middleware } from "@/middleware";
const secret = "middleware-test-fixture-only-not-a-secret";
beforeEach(() => vi.stubEnv("NEXTAUTH_SECRET", secret));
afterEach(() => vi.unstubAllEnvs());
async function request(secure: boolean, role: string, path = "/panel") {
  const name = `${secure ? "__Secure-" : ""}authjs.session-token`;
  const token = await encode({ secret, salt: name, token: { sub: "fixture-user", role }, maxAge: 60 });
  return new NextRequest(`${secure ? "https" : "http"}://localhost${path}`, { headers: { cookie: `${name}=${token}` } });
}
describe("T141 actual Auth.js encrypted cookie + middleware", () => {
  it("HTTPS secure-prefixed owner session reaches panel", async () => {
    const response = await middleware(await request(true, "owner"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
  it("HTTP development session still reaches panel", async () => {
    expect((await middleware(await request(false, "owner"))).headers.get("x-middleware-next")).toBe("1");
  });
  it("HTTPS secure cookie preserves admin role boundary", async () => {
    expect((await middleware(await request(true, "superadmin", "/admin"))).headers.get("x-middleware-next")).toBe("1");
    expect((await middleware(await request(true, "staff", "/admin"))).headers.get("location")).toContain("/giris");
  });
});
