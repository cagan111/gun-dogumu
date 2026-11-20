import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

it.each([false, true])("yedek izinleri ve yalnız kendi geçici dosyasını temizleme (failure=%s)", (failure) => {
  const root = mkdtempSync(join(tmpdir(), "kr-backup-"));
  try {
    const dir = join(root, "backups"), bin = join(root, "bin");
    mkdirSync(dir); chmodSync(dir, 0o755); mkdirSync(bin);
    const old = join(dir, "randevu-legacy.dump"), foreign = join(dir, "other.part");
    writeFileSync(old, "fixture"); chmodSync(old, 0o644); writeFileSync(foreign, "foreign");
    const script = readFileSync("scripts/backup-loop.sh", "utf8").replaceAll("/backups", dir).replace('sleep "$EVERY"', "break");
    writeFileSync(join(root, "run.sh"), script);
    writeFileSync(join(bin, "pg_dump"), '#!/bin/sh\nwhile [ "$1" != "-f" ]; do shift; done\nshift\nprintf fixture > "$1"\nstat -c %a "$1" > "$MODE_FILE"\nexit "$DUMP_EXIT"\n', { mode: 0o700 });
    const run = spawnSync("sh", ["-c", 'umask 022; exec sh "$RUN_FILE"'], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, RUN_FILE: join(root, "run.sh"), MODE_FILE: join(root, "mode"), DUMP_EXIT: failure ? "1" : "0" },
      encoding: "utf8", timeout: 5000,
    });
    expect(run.error).toBeUndefined(); expect(run.status).toBe(0);
    expect(statSync(dir).mode & 0o777).toBe(0o700);
    expect(statSync(old).mode & 0o777).toBe(0o600);
    expect(readFileSync(join(root, "mode"), "utf8").trim()).toBe("600");
    expect(readFileSync(foreign, "utf8")).toBe("foreign");
    const created = readdirSync(dir).filter(n => n.endsWith(".dump") && n !== "randevu-legacy.dump");
    expect(created).toHaveLength(failure ? 0 : 1);
    for (const file of created) expect(statSync(join(dir, file)).mode & 0o777).toBe(0o600);
    expect(readdirSync(dir).filter(n => n.endsWith(".part"))).toEqual(["other.part"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
