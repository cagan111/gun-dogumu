export const dynamic = "force-dynamic";
import { adminRoute } from "@/lib/panel-auth";
import { unsuspendTenant } from "@/lib/admin/service";

export const POST = adminRoute((ctx, _r, p) => unsuspendTenant(ctx.user, p.id as string));
