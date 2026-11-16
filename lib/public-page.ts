import { NotFoundError } from "./booking";
import { getSalonInfo } from "./public";

export type SalonLoad =
  | { kind: "ok"; salon: Extract<Awaited<ReturnType<typeof getSalonInfo>>, { suspended: false }> }
  | { kind: "closed"; salon: Extract<Awaited<ReturnType<typeof getSalonInfo>>, { suspended: true }> }
  | { kind: "notfound" };

/** Sunucu sayfaları için salon yükleyici: 404 → notfound, askıda → closed. */
export async function loadSalon(slug: string): Promise<SalonLoad> {
  try {
    const salon = await getSalonInfo(slug);
    return salon.suspended ? { kind: "closed", salon } : { kind: "ok", salon };
  } catch (e) {
    if (e instanceof NotFoundError) return { kind: "notfound" };
    throw e;
  }
}
