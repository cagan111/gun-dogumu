import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

it.each(["true", "false"])("üretim seed'i SEED_DEMO=%s iken DB erişiminden önce reddedilir", (flag) => {
  const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "production", SEED_DEMO: flag,
      DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/seed_must_not_connect?connect_timeout=1" },
    encoding: "utf8", timeout: 15000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("SEED_PRODUCTION_DISABLED");
  expect(result.stdout).not.toContain("Demo salonlar");
});
