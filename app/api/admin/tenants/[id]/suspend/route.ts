export const dynamic = "force-dynamic";
import { adminRoute } from "@/lib/panel-auth";
import { suspendTenant } from "@/lib/admin/service";

export const POST = adminRoute((ctx, _r, p) => suspendTenant(ctx.user, p.id as string));
