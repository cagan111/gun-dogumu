export const dynamic = "force-dynamic";
import { assertOwner, assertWritable, panelRoute } from "@/lib/panel-auth";
import { parseJson } from "@/lib/http";
import { campaignSchema, sendCampaign } from "@/lib/messaging/campaign";
import { auditPanel } from "@/lib/panel/audit";

/** Kampanya SMS'i (Salon+, yalnız owner). Yalnız pazarlama izni olan müşterilere. */
export const POST = panelRoute(async (ctx, req) => {
  assertOwner(ctx);
  assertWritable(ctx);
  const b = await parseJson(req, campaignSchema);
  if (!b.ok) return b.response;
  const r = await sendCampaign(ctx.tenantId, b.data.text);
  await auditPanel(ctx, "campaign.send", { campaignId: r.campaignId, recipients: r.recipients, sent: r.sent });
  return r;
});
