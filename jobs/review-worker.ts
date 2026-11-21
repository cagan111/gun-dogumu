import type PgBoss from "pg-boss";
import { JOB } from "./queue";
import { recoverReviewInvitations } from "../lib/messaging/review-worker";
import { logger } from "../lib/logger";

/** Shared by the real worker and isolated pg-boss lifecycle tests. No recipient job payload. */
export async function startReviewWorker(boss: PgBoss, sweep: () => Promise<unknown> = recoverReviewInvitations) {
  await boss.work(JOB.reviewRecovery, { pollingIntervalSeconds: 1 }, async () => {
    const result = await sweep();
    logger.info({ job: JOB.reviewRecovery, result }, "yorum daveti taraması");
  });
  await boss.schedule(JOB.reviewRecovery, "* * * * *", {}, { tz: "Asia/Famagusta" });
  await sweep(); // Repair committed intents even when no scheduled job survived an outage.
}
