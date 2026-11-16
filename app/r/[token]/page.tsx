import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SalonHeader } from "@/components/salon-header";
import { buttonClass } from "@/components/ui/button";
import { NotFoundError } from "@/lib/booking";
import { getAppointmentByToken } from "@/lib/cancel";
import { formatPrice, formatWhen } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { CancelPanel } from "./cancel-panel";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ token: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("r.title"), robots: { index: false, follow: false } };
}

export default async function AppointmentPage({ params }: Props) {
  const { token } = await params;
  const { t, locale } = await getT();
  let a: Awaited<ReturnType<typeof getAppointmentByToken>>;
  try {
    a = await getAppointmentByToken(token);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const svc = locale === "en" && a.service.nameEn ? a.service.nameEn : a.service.nameTr;
  const rows: [string, string][] = [
    [t("r.service"), svc],
    [t("r.staff"), a.staffName],
    [t("r.when"), formatWhen(a.startsAt, locale, a.salon.timeZone)],
    [t("r.price"), formatPrice(a.priceTry, locale)],
  ];
  if (a.salon.address) rows.push([t("r.address"), a.salon.address]);
  if (a.salon.phone) rows.push([t("r.phone"), a.salon.phone]);
  const active = a.status === "pending" || a.status === "confirmed";

  return (
    <div className="min-h-screen bg-slate-50">
      <SalonHeader name={a.salon.name} slug={a.salon.slug} compact />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-extrabold">{t("r.title")}</h2>
          <p data-testid="status" className="mt-1 inline-block rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-800">{t(`r.status.${a.status}` as const)}</p>
          <dl className="mt-4 divide-y divide-slate-100 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5">
                <dt className="text-slate-600">{k}</dt>
                <dd className="text-right font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          {active ? (
            <CancelPanel token={token} cancellable={a.cancellable} hours={a.cancelHoursBefore} phone={a.salon.phone} />
          ) : (
            <p className="mt-4 text-sm text-slate-700">{a.status.startsWith("cancelled") ? "" : t("r.closedInfo")}</p>
          )}
        </div>
        <Link href={`/${a.salon.slug}`} className={buttonClass("secondary", "mt-4 w-full")}>{t("r.bookAgain")}</Link>
      </main>
    </div>
  );
}
