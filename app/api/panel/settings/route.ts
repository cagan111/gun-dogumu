export const dynamic = "force-dynamic";
import { panelRoute } from "@/lib/panel-auth";
import { parseJson } from "@/lib/http";
import { getSettings, updateSettings, settingsSchema } from "@/lib/panel/settings";

export const GET = panelRoute((ctx) => getSettings(ctx));
/** Yalnız owner (staff → 403). */
export const PATCH = panelRoute(async (ctx, req) => {
  const b = await parseJson(req, settingsSchema);
  if (!b.ok) return b.response;
  return updateSettings(ctx, b.data);
});
