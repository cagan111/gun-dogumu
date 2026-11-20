import { describe, expect, it } from "vitest";
import { confirmLogoutResponse, markLogoutFailure } from "@/lib/logout-confirmation";
describe("logout persistence confirmation", () => {
  it("discards cookie-clearing headers when the swallowed event failed", async () => {
    const r = await confirmLogoutResponse(async () => { markLogoutFailure(); return new Response(null, { headers: { "Set-Cookie": "fixture=; Max-Age=0", Location: "/" } }); });
    expect(r.status).toBe(503); expect(r.headers.get("set-cookie")).toBeNull(); expect(r.headers.get("location")).toBeNull();
    expect(await r.json()).toEqual({ error: { code: "session_revocation_unavailable" } });
  });
  it("preserves Auth.js success and CSRF rejection responses", async () => {
    for (const status of [200, 400]) { const original = new Response(null, { status }); expect(await confirmLogoutResponse(async () => original)).toBe(original); }
  });
  it("does not contaminate a parallel request", async () => {
    let ready!: () => void; const gate = new Promise<void>(r => { ready = r; });
    let release!: () => void; const finish = new Promise<void>(r => { release = r; });
    const failed = confirmLogoutResponse(async () => { markLogoutFailure(); ready(); await finish; return new Response(); });
    await gate; const ok = await confirmLogoutResponse(async () => new Response());
    expect(ok.status).toBe(200); release(); expect((await failed).status).toBe(503);
  });
});
