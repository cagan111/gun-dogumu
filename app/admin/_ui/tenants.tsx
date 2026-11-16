"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Field } from "@/components/ui/field";
import { Badge, Card, SelectField } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/client-api";
import { useI18n } from "@/lib/i18n/client";
import type { Key } from "@/lib/i18n/shared";
import { money, useLoader } from "../../panel/_ui/util";
import { fmtDate, PLAN_IDS, STATUS_TONE, type TenantRow } from "./common";

interface Revenue { mrrTry: number; counts: Record<string, number>; smsSoldThisMonth: number; paymentsThisMonthTry: number }

export function TenantsView() {
  const { t, locale } = useI18n();
  const rev = useLoader(() => api<Revenue>("/api/admin/revenue"), []);
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => { const h = setTimeout(() => { setTerm(q.trim()); setPage(1); }, 300); return () => clearTimeout(h); }, [q]);
  useEffect(() => { setPage(1); }, [status, plan]);
  useEffect(() => {
    let live = true;
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), pageSize: "25" });
    if (term) qs.set("q", term); if (status) qs.set("status", status); if (plan) qs.set("plan", plan);
    api<{ total: number; tenants: TenantRow[] }>(`/api/admin/tenants?${qs}`).then(
      (r) => { if (!live) return; setRows((p) => (page === 1 ? r.tenants : [...p, ...r.tenants])); setTotal(r.total); setErr(null); setLoading(false); },
      (e) => { if (live) { setErr(e); setLoading(false); } },
    );
    return () => { live = false; };
  }, [term, status, plan, page]);

  const c = rev.data?.counts ?? {};
  return (
    <div>
      <section aria-label={t("adm.revenue")} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card as="div"><p className="text-xs text-slate-600">{t("adm.mrr")}</p><p className="text-2xl font-extrabold tabular-nums" data-testid="mrr">{money(rev.data?.mrrTry ?? 0, locale)}</p></Card>
        <Card as="div"><p className="text-xs text-slate-600">{t("adm.payments")}</p><p className="text-2xl font-extrabold tabular-nums">{money(rev.data?.paymentsThisMonthTry ?? 0, locale)}</p></Card>
        <Card as="div"><p className="text-xs text-slate-600">{t("adm.smsSold")}</p><p className="text-2xl font-extrabold tabular-nums">{rev.data?.smsSoldThisMonth ?? 0}</p></Card>
        <Card as="div">
          <p className="text-xs text-slate-600">{t("adm.byStatus")}</p>
          <p className="mt-1 flex flex-wrap gap-1">{(["trial", "active", "past_due", "suspended"] as const).map((s) => <Badge key={s} tone={STATUS_TONE[s]}>{t(`adm.st.${s}` as Key)} {c[s] ?? 0}</Badge>)}</p>
        </Card>
      </section>

      <h2 className="mt-6 text-xl font-extrabold">{t("adm.nav.tenants")}</h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_10rem_10rem]">
        <Field label={t("common.search")} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("adm.searchPh")} autoComplete="off" />
        <SelectField label={t("adm.status")} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t("common.all")}</option>
          {(["trial", "active", "past_due", "suspended"] as const).map((s) => <option key={s} value={s}>{t(`adm.st.${s}` as Key)}</option>)}
        </SelectField>
        <SelectField label={t("adm.plan")} value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="">{t("common.all")}</option>
          {PLAN_IDS.map((p) => <option key={p} value={p}>{t(`adm.plan.${p}` as Key)}</option>)}
        </SelectField>
      </div>
      {err ? <Alert className="mt-3">{errorMessage(err, t)}</Alert> : null}
      <p className="mt-3 text-sm text-slate-600" aria-live="polite">{t("adm.total", { n: total })}</p>

      <div className="mt-2 hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm" data-testid="tenants-table">
          <caption className="sr-only">{t("adm.nav.tenants")}</caption>
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>{(["adm.col.salon", "adm.status", "adm.plan", "adm.col.ends", "adm.col.sms", "adm.col.login"] as Key[]).map((k) => <th key={k} scope="col" className="px-3 py-2 font-semibold">{t(k)}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2"><Link href={`/admin/salon/${r.id}`} className="font-bold text-brand underline">{r.name}</Link><div className="text-xs text-slate-600">/{r.slug}</div></td>
                <td className="px-3 py-2"><Badge tone={STATUS_TONE[r.status]}>{t(`adm.st.${r.status}` as Key)}</Badge></td>
                <td className="px-3 py-2">{t(`adm.plan.${r.plan}` as Key)}</td>
                <td className="px-3 py-2 tabular-nums">{fmtDate(r.status === "trial" ? r.trialEndsAt : r.subscriptionEndsAt, locale)}</td>
                <td className="px-3 py-2 tabular-nums">{r.smsBalance}</td>
                <td className="px-3 py-2 tabular-nums">{fmtDate(r.lastLoginAt, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-2 space-y-2 md:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/admin/salon/${r.id}`} className="block">
              <Card as="div" className="hover:bg-slate-50">
                <div className="flex items-start justify-between gap-2"><p className="min-w-0 truncate font-bold">{r.name}</p><Badge tone={STATUS_TONE[r.status]}>{t(`adm.st.${r.status}` as Key)}</Badge></div>
                <p className="text-xs text-slate-600">/{r.slug} · {t(`adm.plan.${r.plan}` as Key)}</p>
                <p className="mt-1 text-sm text-slate-700">{t("adm.col.ends")}: {fmtDate(r.status === "trial" ? r.trialEndsAt : r.subscriptionEndsAt, locale)} · SMS {r.smsBalance}</p>
                <p className="text-xs text-slate-600">{t("adm.col.login")}: {fmtDate(r.lastLoginAt, locale)}</p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
      {!loading && rows.length === 0 && !err ? <p className="mt-4 text-slate-600">{t("common.empty")}</p> : null}
      {rows.length < total ? <div className="mt-4 flex justify-center"><Button variant="secondary" disabled={loading} onClick={() => setPage((p) => p + 1)}>{t("common.more")}</Button></div> : null}
    </div>
  );
}
