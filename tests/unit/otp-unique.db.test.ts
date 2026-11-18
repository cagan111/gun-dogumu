import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

try { process.loadEnvFile(".env"); } catch { /* optional */ }
const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("OTP tek kullanılmamış kayıt kısıtı (gerçek PostgreSQL)", () => {
  let db: typeof import("@/lib/db");
  const tenantIds: string[] = [];
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let n = 0;

  beforeAll(async () => { db = await import("@/lib/db"); });

  async function salon() {
    const tenant = await db.prisma.tenant.create({ data: { slug: `otp-unique-${uid}-${++n}`, name: "OTP unique test", city: "Girne" } });
    tenantIds.push(tenant.id);
    return tenant.id;
  }

  function otpRow(tenantId: string, phone: string) {
    return {
      tenantId, phone, codeHash: "test-hash", expiresAt: new Date(Date.now() + 300_000),
      createdAt: new Date(), reservedSegments: 1,
    };
  }

  afterAll(async () => {
    if (!db) return;
    await db.prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await db.prisma.$disconnect();
  });

  it("paralel insertlerde aynı salon ve telefon için yalnız bir kullanılmamış OTP kabul eder", async () => {
    const tenantId = await salon();
    const phone = "+905331234567";
    const results = await Promise.allSettled([
      db.prisma.otp.create({ data: otpRow(tenantId, phone) }),
      db.prisma.otp.create({ data: otpRow(tenantId, phone) }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({ code: "P2002" });
    expect(await db.prisma.otp.count({ where: { tenantId, phone, usedAt: null } })).toBe(1);
  });

  it("aynı telefonun farklı salonlarda birer kullanılmamış OTP'si olabilir", async () => {
    const tenantA = await salon();
    const tenantB = await salon();
    const phone = "+905331234567";

    await expect(Promise.all([
      db.prisma.otp.create({ data: otpRow(tenantA, phone) }),
      db.prisma.otp.create({ data: otpRow(tenantB, phone) }),
    ])).resolves.toHaveLength(2);
    expect(await db.prisma.otp.count({ where: { tenantId: { in: [tenantA, tenantB] }, phone, usedAt: null } })).toBe(2);
  });
  it("migration retires legacy duplicates deterministically before adding index", async () => {
    await db.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('CREATE TEMP TABLE "OtpMigrationFixture" (LIKE "Otp" INCLUDING DEFAULTS) ON COMMIT DROP');
      await tx.$executeRawUnsafe(`INSERT INTO "OtpMigrationFixture" (id,"tenantId",phone,"codeHash","expiresAt","createdAt") VALUES
        ('older','t','p','fixture',now(), '2026-11-17'),
        ('tie-a','t','p','fixture',now(), '2026-11-18'),
        ('tie-z','t','p','fixture',now(), '2026-11-18')`);
      const sql = readFileSync("prisma/migrations/20261118191500_otp_unique_unused/migration.sql", "utf8")
        .replaceAll('"Otp"', '"OtpMigrationFixture"').replace(/^BEGIN;|^COMMIT;/gm, "");
      for (const stmt of sql.split(";").map((x) => x.trim()).filter(Boolean)) await tx.$executeRawUnsafe(stmt);
      const rows = await tx.$queryRawUnsafe<{ id: string }[]>('SELECT id FROM "OtpMigrationFixture" WHERE "usedAt" IS NULL');
      expect(rows).toEqual([{ id: "tie-z" }]);
    });
  });

});
