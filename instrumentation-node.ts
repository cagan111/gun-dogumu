import { ensureSuperadmin } from "./lib/bootstrap";
import { assertEnv } from "./lib/env";
import { logger } from "./lib/logger";

/** Yalnız Node çalışma zamanında: ilk açılış işleri. Hata sunucuyu düşürmez. */
export async function bootstrapNode() {
  // `next build` sırasında sır beklenmez
  if (process.env.NEXT_PHASE !== "phase-production-build") assertEnv(logger);
  try {
    await ensureSuperadmin();
  } catch (err) {
    logger.error({ err }, "ensureSuperadmin başarısız (veritabanı hazır değil mi?)");
  }
}
