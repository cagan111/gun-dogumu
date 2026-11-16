import { ensureSuperadmin } from "./lib/bootstrap";
import { logger } from "./lib/logger";

/** Yalnız Node çalışma zamanında: ilk açılış işleri. Hata sunucuyu düşürmez. */
export async function bootstrapNode() {
  try {
    await ensureSuperadmin();
  } catch (err) {
    logger.error({ err }, "ensureSuperadmin başarısız (veritabanı hazır değil mi?)");
  }
}
