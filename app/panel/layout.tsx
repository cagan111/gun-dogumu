import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { brandVars } from "@/lib/brand-color";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { hasFeature, planOf } from "@/lib/plan";
import { PanelShell } from "./_ui/shell";

export const dynamic = "force-dynamic";

/** Salon paneli kabuğu: yalnız kendi salonunun (owner/staff) verisi; oturum JWT'sindeki tenantId'ye bağlı. */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const u = session?.user;
  if (!u?.id || !u.tenantId || (u.role !== "owner" && u.role !== "staff")) redirect("/giris?next=/panel");
  const tenant = await prisma.tenant.findUnique({
    where: { id: u.tenantId },
    select: { name: true, slug: true, plan: true, status: true, timeZone: true, slotMinutes: true, brandColor: true, trialEndsAt: true, subscriptionEndsAt: true },
  });
  if (!tenant) redirect("/giris");
  const locale = await getLocale();
  const end = tenant.status === "trial" ? tenant.trialEndsAt : tenant.subscriptionEndsAt;
  const daysLeft = end ? Math.ceil((end.getTime() - Date.now()) / 86_400_000) : null;
  const plan = planOf(tenant.plan);
  return (
    <div style={brandVars(tenant.brandColor) as React.CSSProperties}>
      <PanelShell
        info={{
          role: u.role,
          userName: u.name ?? "",
          tenant: {
            name: tenant.name, slug: tenant.slug, plan: tenant.plan, planName: plan.name[locale], status: tenant.status,
            timeZone: tenant.timeZone, slotMinutes: tenant.slotMinutes, daysLeft,
            features: { reports: hasFeature(tenant.plan, "reports"), customerNotes: hasFeature(tenant.plan, "customerNotes"), campaigns: hasFeature(tenant.plan, "campaigns") },
          },
        }}
      >
        {children}
      </PanelShell>
    </div>
  );
}
