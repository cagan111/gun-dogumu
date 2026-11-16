export const dynamic = "force-dynamic";
import { panelRoute } from "@/lib/panel-auth";
import { getSmsBalance } from "@/lib/panel/settings";

export const GET = panelRoute((ctx) => getSmsBalance(ctx));
