"use client";
import { useMemo, useState } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { Alert } from "@/components/ui/field";
import { Card } from "@/components/ui/form";
import { errorMessage, isCode } from "@/lib/client-api";
import { api } from "@/lib/client-api";
import { useI18n } from "@/lib/i18n/client";
import type { Key } from "@/lib/i18n/shared";
import { utcToLocal } from "@/lib/time";
import { usePanel } from "./ctx";
import { money, svcName, useLoader, type StatusTone } from "./util";

interface Report {
  month: string; total: number; byStatus: Record<string, number>; revenueTry: number; revenueAppointments: number;
  topServices: { serviceId: string; name: string; nameEn: string | null; count: number; revenueTry: number }[];
  topStaff: { staffId: string; name: string; count: number; revenueTry: number }[];
  noShowRate: number;
}

const BAR: Record<StatusTone, string> = { slate: "bg-[#8a7a68]", green: "bg-olive", amber: "bg-[#b08a3e]", red: "bg-clay", sky: "bg-[#7d8f5f]", violet: "bg-sea" };
// Durum çubukları sıcak palet: zeytin = olumlu, pirinç/kum = bekleyen, kil = olumsuz.
const STATUS_BAR: Record<string, string> = {
  completed: "bg-olive", confirmed: "bg-[#7d8f5f]", pending: "bg-[#b08a3e]",
  no_show: "bg-clay", cancelled_by_customer: "bg-[#c98f7e]", cancelled_by_salon: "bg-[#8a7a68]",
};
const STATUSES = ["completed", "confirmed", "pending", "no_show", "cancelled_by_customer", "cancelled_by_salon"] as const;

function Bar({ label, value, max, text, tone = "violet", barClass }: { label: string; value: number; max: number; text: string; tone?: StatusTone; barClass?: string }) {
  return (
    <li className="py-1.5" aria-label={`${label}: ${text}`}>
      <div className="flex justify-between gap-3 text-sm"><span className="min-w-0 truncate font-medium">{label}</span><span className="shrink-0 tabular-nums text-slate-800">{text}</span></div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-sand/60" role="presentation"><div className={`h-full rounded-full ${barClass ?? BAR[tone]}`} style={{ width: `${max > 0 ? Math.max((value / max) * 100, value > 0 ? 3 : 0) : 0}%` }} /></div>
    </li>
  );
}

export function ReportsView() {
  const { t, locale } = useI18n();
  const { tenant, isOwner } = usePanel();
  const [month, setMonth] = useState(() => utcToLocal(new Date(), tenant.timeZone).date.slice(0, 7));
  const q = useLoader(() => (isOwner && tenant.features.reports ? api<Report>(`/api/panel/reports?month=${month}`) : Promise.resolve(null)), [month, isOwner]);
  const r = q.data;
  const maxSvc = useMemo(() => Math.max(1, ...(r?.topServices.map((s) => s.count) ?? [])), [r]);
  const maxStaff = useMemo(() => Math.max(1, ...(r?.topStaff.map((s) => s.count) ?? [])), [r]);
  const maxStatus = useMemo(() => Math.max(1, ...Object.values(r?.byStatus ?? {})), [r]);
  const locked = !tenant.features.reports || isCode(q.error, "plan_feature");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end gap-3">
        <h2 className="flex-1 text-xl font-extrabold">{t("nav.reports")}</h2>
        <DatePicker mode="month" label={t("rep.month")} value={month} onChange={(v) => v && setMonth(v)} className="w-44" />
      </div>
      {!isOwner ? <Alert tone="info" className="mt-3">{t("ownerOnly")}</Alert> : null}
      {isOwner && locked ? <Alert tone="info" className="mt-3">{t("rep.pro")}</Alert> : null}
      {isOwner && !locked && q.error ? <Alert className="mt-3">{errorMessage(q.error, t)}</Alert> : null}
      {r ? (
        <div className={q.loading ? "opacity-60" : ""}>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card as="div"><p className="text-xs text-slate-600">{t("rep.total")}</p><p className="text-2xl font-extrabold tabular-nums">{r.total}</p></Card>
            <Card as="div"><p className="text-xs text-slate-600">{t("rep.revenue")}</p><p className="text-2xl font-extrabold tabular-nums">{money(r.revenueTry, locale)}</p><p className="text-xs text-slate-600">{t("rep.revenueNote", { n: r.revenueAppointments })}</p></Card>
            <Card as="div"><p className="text-xs text-slate-600">{t("rep.completed")}</p><p className="text-2xl font-extrabold tabular-nums">{r.byStatus.completed ?? 0}</p></Card>
            <Card as="div"><p className="text-xs text-slate-600">{t("rep.noShowRate")}</p><p className="text-2xl font-extrabold tabular-nums">{Math.round(r.noShowRate * 100)}%</p></Card>
          </div>
          <Card className="mt-4">
            <h3 className="font-bold">{t("rep.byStatus")}</h3>
            <ul className="mt-1">{STATUSES.map((s) => <Bar key={s} label={t(`st.${s}` as Key)} value={r.byStatus[s] ?? 0} max={maxStatus} text={`${r.byStatus[s] ?? 0}${r.total > 0 ? ` · ${Math.round(((r.byStatus[s] ?? 0) / r.total) * 100)}%` : ""}`} barClass={STATUS_BAR[s]} />)}</ul>
          </Card>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card>
              <h3 className="font-bold">{t("rep.topServices")}</h3>
              {r.topServices.length === 0 ? <p className="mt-1 text-sm text-slate-600">{t("common.empty")}</p> : (
                <ul className="mt-1">{r.topServices.map((s) => <Bar key={s.serviceId} label={svcName({ nameTr: s.name, nameEn: s.nameEn }, locale)} value={s.count} max={maxSvc} text={`${s.count} · ${money(s.revenueTry, locale)}`} />)}</ul>
              )}
            </Card>
            <Card>
              <h3 className="font-bold">{t("rep.topStaff")}</h3>
              {r.topStaff.length === 0 ? <p className="mt-1 text-sm text-slate-600">{t("common.empty")}</p> : (
                <ul className="mt-1">{r.topStaff.map((s) => <Bar key={s.staffId} label={s.name} value={s.count} max={maxStaff} text={`${s.count} · ${money(s.revenueTry, locale)}`} />)}</ul>
              )}
            </Card>
          </div>
          <p className="mt-3 text-xs text-slate-600">{t("rep.note")}</p>
        </div>
      ) : null}
    </div>
  );
}
