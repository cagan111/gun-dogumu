export const dynamic = "force-dynamic";
import { panelRoute } from "@/lib/panel-auth";
import { parseJson } from "@/lib/http";
import { statusSchema, setAppointmentStatus } from "@/lib/panel/appointments";

/** { status: confirmed | completed | no_show | cancelled_by_salon } */
export const POST = panelRoute(async (ctx, req, p) => {
  const b = await parseJson(req, statusSchema);
  if (!b.ok) return b.response;
  return setAppointmentStatus(ctx, p.id as string, b.data.status);
});
