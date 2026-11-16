import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node", env: { JOBS_QUEUE: "none", SMS_PROVIDER: "mock", ALLOW_REAL_SMS: "false" } },
  resolve: { alias: { "@": path.resolve(__dirname) } },
});
