export const dynamic = "force-dynamic";
import { adminRoute } from "@/lib/panel-auth";
import { revenueSummary } from "@/lib/admin/service";

export const GET = adminRoute(() => revenueSummary());
