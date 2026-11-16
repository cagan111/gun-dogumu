/** `pnpm worker`: pg-boss işleyicilerini ve günlük zamanlamaları başlatır. */
import { logger } from "../lib/logger";
import { JOB } from "./queue";

try { process.loadEnvFile(".env"); } catch { /* .env yok: ortamdan okunur */ }

async function main() {
  const { getBoss, stopBoss } = await import("./boss");
  const h = await import("./handlers");
  const boss = await getBoss("worker");

  const wrap = <T>(name: string, fn: (data: T) => Promise<unknown>) => async (jobs: { data: T }[]) => {
    for (const j of jobs) {
      try { logger.info({ job: name, result: await fn(j.data) }, "iş tamam"); }
      catch (err) { logger.error({ err, job: name }, "iş hatası"); throw err; }
    }
  };
  await boss.work(JOB.confirmation, wrap(JOB.confirmation, (d: Parameters<typeof h.handleSendConfirmation>[0]) => h.handleSendConfirmation(d)));
  await boss.work(JOB.reminder, wrap(JOB.reminder, (d: Parameters<typeof h.handleSendReminder>[0]) => h.handleSendReminder(d)));
  await boss.work(JOB.notice, wrap(JOB.notice, (d: Parameters<typeof h.handleSendNotice>[0]) => h.handleSendNotice(d)));
  await boss.work(JOB.subscriptionTick, wrap(JOB.subscriptionTick, () => h.handleSubscriptionTick()));
  await boss.work(JOB.monthlyCredits, wrap(JOB.monthlyCredits, () => h.handleMonthlyCredits()));
  // günlük, idempotent (tekrar çalışması zararsız)
  await boss.schedule(JOB.subscriptionTick, "10 3 * * *", {}, { tz: "Asia/Famagusta" });
  await boss.schedule(JOB.monthlyCredits, "20 3 * * *", {}, { tz: "Asia/Famagusta" });
  logger.info("worker hazır");

  const stop = async () => { await stopBoss(); process.exit(0); };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

main().catch((err) => { logger.error({ err }, "worker başlatılamadı"); process.exit(1); });
