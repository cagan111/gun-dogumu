export const dynamic = "force-dynamic";
import { panelRoute, created, queryOf } from "@/lib/panel-auth";
import { parseJson, parseWith } from "@/lib/http";
import { listQuerySchema, listAppointments, createSchema, createPanelAppointment } from "@/lib/panel/appointments";

/** GET ?from=YYYY-MM-DD&to=YYYY-MM-DD[&staffId=] — salon saat diliminde, to dahil. */
export const GET = panelRoute(async (ctx, req) => {
  const q = parseWith(listQuerySchema, queryOf(req));
  if (!q.ok) return q.response;
  return listAppointments(ctx, q.data);
});

/** Panelden randevu (source panel | walk_in). */
export const POST = panelRoute(async (ctx, req) => {
  const b = await parseJson(req, createSchema);
  if (!b.ok) return b.response;
  return created(await createPanelAppointment(ctx, b.data));
});
