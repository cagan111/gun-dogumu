export const dynamic = "force-dynamic";
import { panelRoute } from "@/lib/panel-auth";
import { parseJson } from "@/lib/http";
import { getAppointment, moveSchema, moveAppointment } from "@/lib/panel/appointments";

export const GET = panelRoute((ctx, _req, p) => getAppointment(ctx, p.id as string));

/** Taşı: { startsAt, staffId? } — müsaitlik yeniden doğrulanır, çakışma 409. */
export const PATCH = panelRoute(async (ctx, req, p) => {
  const b = await parseJson(req, moveSchema);
  if (!b.ok) return b.response;
  return moveAppointment(ctx, p.id as string, b.data);
});
