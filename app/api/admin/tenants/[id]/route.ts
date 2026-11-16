export const dynamic = "force-dynamic";
import { adminRoute } from "@/lib/panel-auth";
import { getTenantDetail } from "@/lib/admin/service";

export const GET = adminRoute((_c, _r, p) => getTenantDetail(p.id as string));
