import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import * as revocation from "@/lib/session-revocation";
try { process.loadEnvFile(".env"); } catch { /* optional */ }
const ids: string[] = [];
async function fixture() { const u = await prisma.user.create({ data: { email: `revoke-${crypto.randomUUID()}@example.test`, name: "Fixture", role: "superadmin" } }); ids.push(u.id); return u; }
describe.skipIf(!process.env.DATABASE_URL)("server-side JWT revocation", () => {
  afterAll(async () => { await prisma.user.deleteMany({ where: { id: { in: ids } } }); });
  it("rejects legacy and stale JWT generations", async () => {
    const u = await fixture(), token = { userId: u.id, role: u.role, tenantId: null, tokenVersion: 0 };
    expect(await revocation.sessionTokenCurrent(token)).toBe(true);
    expect(await revocation.sessionTokenCurrent({ ...token, tokenVersion: undefined })).toBe(false);
    await revocation.revokeSessionToken(token);
    expect(await revocation.sessionTokenCurrent(token)).toBe(false);
    expect(await revocation.sessionTokenCurrent({ ...token, tokenVersion: 1 })).toBe(true);
  });
  it("old or parallel logout cannot revoke a later login generation", async () => {
    const u = await fixture(), old = { userId: u.id, tokenVersion: 0 };
    await Promise.all([revocation.revokeSessionToken(old), revocation.revokeSessionToken(old)]);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).tokenVersion).toBe(1);
    await revocation.revokeSessionToken(old);
    expect(await revocation.sessionTokenCurrent({ ...old, tokenVersion: 1, role: u.role, tenantId: null })).toBe(true);
  });
  it("role or tenant changes cannot retain the old authorization", async () => {
    const u = await fixture(), token = { userId: u.id, role: u.role, tenantId: null, tokenVersion: 0 };
    expect(await revocation.sessionTokenCurrent({ ...token, tenantId: "foreign" })).toBe(false);
    await prisma.user.update({ where: { id: u.id }, data: { role: "staff" } });
    expect(await revocation.sessionTokenCurrent(token)).toBe(false);
  });
});
