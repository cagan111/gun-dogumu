import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { requestOtp, otpReservedSegments, OTP_TTL_MS } from "@/lib/otp";
try { process.loadEnvFile(".env"); } catch { /* optional */ }
const ids: string[] = [];
const now = new Date("2035-05-01T10:00:00Z");
async function fixture() {
  const t = await prisma.tenant.create({ data: { slug: `otp-fair-${crypto.randomUUID()}`, name: "Fixture", city: "Girne" } }); ids.push(t.id);
  const phone = "+905331234567", other = "+905421234567";
  await prisma.customer.createMany({ data: [phone, other].map(phone => ({ tenantId: t.id, phone, name: "Fixture" })) });
  return { id: t.id, phone, other };
}
describe.skipIf(!process.env.DATABASE_URL)("OTP customer fairness", () => {
  afterAll(async () => { await prisma.tenant.deleteMany({ where: { id: { in: ids } } }); });
  it("resend cannot invalidate or reset attempts on a usable code", async () => {
    const s = await fixture(), send = vi.fn().mockResolvedValue(undefined);
    await requestOtp(s.id, s.phone, { now, send });
    const before = await prisma.otp.findFirstOrThrow({ where: { tenantId: s.id } });
    await prisma.otp.update({ where: { id: before.id }, data: { attempts: 2 } });
    await Promise.all([61_000, 62_000].map(ms => requestOtp(s.id, s.phone, { now: new Date(+now + ms), send })));
    expect(send).toHaveBeenCalledOnce();
    expect(await prisma.otp.findUniqueOrThrow({ where: { id: before.id } })).toMatchObject({ codeHash: before.codeHash, usedAt: null, attempts: 2, expiresAt: before.expiresAt });
    expect(await prisma.otp.count({ where: { tenantId: s.id } })).toBe(1);
  });
  it("one phone exhausts its own share without preventing another customer's first OTP", async () => {
    const s = await fixture(), send = vi.fn().mockResolvedValue(undefined);
    for (let i = 0; i < 4; i++) await requestOtp(s.id, s.phone, { now: new Date(+now + i * (OTP_TTL_MS + 1)), send });
    expect(send).toHaveBeenCalledTimes(3);
    await requestOtp(s.id, s.other, { now: new Date(+now + 4 * OTP_TTL_MS), send });
    expect(send).toHaveBeenCalledTimes(4);
    expect((await prisma.otp.aggregate({ where: { tenantId: s.id, phone: s.phone }, _sum: { reservedSegments: true } }))._sum.reservedSegments).toBe(3 * otpReservedSegments());
  });
  it("spent and locked codes can refresh within remaining daily share", async () => {
    const s = await fixture(), send = vi.fn().mockResolvedValue(undefined);
    await requestOtp(s.id, s.phone, { now, send });
    await prisma.otp.updateMany({ where: { tenantId: s.id }, data: { usedAt: now } });
    await requestOtp(s.id, s.phone, { now: new Date(+now + 61_000), send });
    await prisma.otp.updateMany({ where: { tenantId: s.id, usedAt: null }, data: { attempts: 5 } });
    await requestOtp(s.id, s.phone, { now: new Date(+now + 122_000), send });
    expect(send).toHaveBeenCalledTimes(3);
  });
  it("legacy zero reservations consume phone share, and UTC next day resets it", async () => {
    const s = await fixture(), send = vi.fn().mockResolvedValue(undefined);
    await prisma.otp.createMany({ data: [0, 1, 2].map(i => ({ tenantId: s.id, phone: s.phone, codeHash: "fixture", createdAt: new Date(+now - (i + 1) * 600_000), expiresAt: now, usedAt: now, reservedSegments: 0 })) });
    await requestOtp(s.id, s.phone, { now, send }); expect(send).not.toHaveBeenCalled();
    await requestOtp(s.id, s.phone, { now: new Date("2035-05-02T00:00:00Z"), send }); expect(send).toHaveBeenCalledOnce();
  });
  it("concurrent requests cannot exceed final phone share", async () => {
    const s = await fixture(), send = vi.fn().mockResolvedValue(undefined);
    await prisma.otp.createMany({ data: [0, 1].map(i => ({ tenantId: s.id, phone: s.phone, codeHash: "fixture", createdAt: new Date(+now - (i + 1) * 600_000), expiresAt: now, usedAt: now, reservedSegments: otpReservedSegments() })) });
    await Promise.all([0, 1, 2].map(() => requestOtp(s.id, s.phone, { now, send })));
    expect(send).toHaveBeenCalledOnce(); expect(await prisma.otp.count({ where: { tenantId: s.id } })).toBe(3);
  });

});
