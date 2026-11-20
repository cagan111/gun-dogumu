/** pg-boss tekil örneği (şema `pgboss`). Web sürecinde yalnız gönderir (supervise/schedule kapalı); worker tam çalışır. */
import PgBoss from "pg-boss";
import { logger } from "../lib/logger";
import { JOB, type EnqueueOpts, type JobName, type JobQueue } from "./queue";

const g = globalThis as unknown as { __boss?: Promise<PgBoss> };

export function getBoss(mode: "web" | "worker" = "web"): Promise<PgBoss> {
  if (!g.__boss) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL gerekli");
    const boss = new PgBoss({
      connectionString: url,
      schema: "pgboss",
      max: mode === "worker" ? 5 : 2,
      ...(mode === "web" ? { supervise: false, schedule: false, migrate: true } : {}),
    });
    boss.on("error", (err) => logger.error({ err }, "pg-boss hatası"));
    g.__boss = boss.start().then(async () => {
      for (const name of Object.values(JOB)) await boss.createQueue(name);
      return boss;
    });
    g.__boss.catch(() => { g.__boss = undefined; });
  }
  return g.__boss;
}

export async function stopBoss(): Promise<void> {
  if (!g.__boss) return;
  const b = await g.__boss;
  g.__boss = undefined;
  await b.stop({ graceful: true });
}

export class PgBossQueue implements JobQueue {
  async enqueue(name: JobName, data: Record<string, unknown>, opts: EnqueueOpts = {}): Promise<string | null> {
    const boss = await getBoss("web");
    return boss.send(name, data, {
      ...(opts.startAfter ? { startAfter: opts.startAfter } : {}),
      ...(opts.singletonKey ? { singletonKey: opts.singletonKey } : {}),
      retryLimit: name === JOB.otpRequest ? 0 : 3, retryDelay: 60, retryBackoff: true,
      ...(name === JOB.otpRequest ? { expireInSeconds: 60, retentionSeconds: 60 } : {}),
    });
  }
}
