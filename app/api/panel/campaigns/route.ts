export const dynamic = "force-dynamic";
import { z } from "zod";
import { assertOwner, assertWritable, panelRoute } from "@/lib/panel-auth";
import { parseJson } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { campaignSchema, sendCampaign, campaignStatus, cancelCampaign } from "@/lib/messaging/campaign";
import { auditPanel } from "@/lib/panel/audit";
import { getQueue, JOB } from "@/jobs/queue";
import { logger } from "@/lib/logger";
function key(req: Request) {
  const value = new URL(req.url).searchParams.get("idempotencyKey");
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success) throw new ValidationError("Geçersiz işlem anahtarı", "idempotencyKey");
  return parsed.data;
}
export const POST = panelRoute(async (ctx, req) => {
  assertOwner(ctx); assertWritable(ctx);
  const b = await parseJson(req, campaignSchema); if (!b.ok) return b.response;
  const r = await sendCampaign(ctx.tenantId, b.data.text, new Date(), undefined, { idempotencyKey: b.data.idempotencyKey, maxRecipients: 0 });
  // Periodic recovery also covers a crash between commit and enqueue.
  try { await (await getQueue()).enqueue(JOB.campaign, { tenantId: ctx.tenantId, campaignId: r.campaignId }, { singletonKey: r.campaignId }); }
  catch { logger.warn({ campaignId: r.campaignId }, "kampanya kalıcı, iş kuyruğu yeniden denenecek"); }
  await auditPanel(ctx, "campaign.prepare", { campaignId: r.campaignId, recipients: r.recipients });
  return r;
});
export const GET = panelRoute(async (ctx, req) => { assertOwner(ctx); return campaignStatus(ctx.tenantId, key(req)); });
// Releasing a hold remains possible when a plan expires or salon is suspended.
export const DELETE = panelRoute(async (ctx, req) => { assertOwner(ctx); const r = await cancelCampaign(ctx.tenantId, key(req)); await auditPanel(ctx, "campaign.cancel", { campaignId: r.campaignId }); return r; }, { allowSuspendedWrite: true });
