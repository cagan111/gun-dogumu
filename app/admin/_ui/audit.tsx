"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/field";
import { Card, SelectField } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/client-api";
import { useI18n } from "@/lib/i18n/client";
import { fmtDate, type TenantRow } from "./common";

interface Entry { id: string; actorId: string | null; actorRole: string | null; tenantId: string | null; action: string; details: unknown; createdAt: string }
const PREFIXES = ["payment", "sms", "tenant", "subscription", "plan_prices", "service", "staff", "settings", "campaign", "working_hours", "time_off"];

export function AuditView() {
  const { t, locale } = useI18n();
  const [tenantId, setTenantId] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => { api<{ tenants: TenantRow[] }>("/api/admin/tenants?pageSize=100").then((r) => setTenants(r.tenants), () => {}); }, []);
  useEffect(() => { setPage(1); }, [tenantId, action]);
  useEffect(() => {
    let live = true;
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (tenantId) qs.set("tenantId", tenantId);
    if (action) qs.set("action", action);
    api<{ total: number; entries: Entry[] }>(`/api/admin/audit?${qs}`).then(
      (r) => { if (!live) return; setRows((p) => (page === 1 ? r.entries : [...p, ...r.entries])); setTotal(r.total); setErr(null); setLoading(false); },
      (e) => { if (live) { setErr(e); setLoading(false); } },
    );
    return () => { live = false; };
  }, [tenantId, action, page]);

  const name = (id: string | null) => (id ? tenants.find((x) => x.id === id)?.name ?? id.slice(0, 8) : "—");
  return (
    <div>
      <h2 className="text-xl font-extrabold">{t("adm.nav.audit")}</h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <SelectField label={t("adm.tenant")} value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
          <option value="">{t("common.all")}</option>
          {tenants.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </SelectField>
        <SelectField label={t("adm.action")} value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">{t("common.all")}</option>
          {PREFIXES.map((p) => <option key={p} value={p}>{p}</option>)}
        </SelectField>
      </div>
      {err ? <Alert className="mt-3">{errorMessage(err, t)}</Alert> : null}
      <p className="mt-3 text-sm text-slate-600" aria-live="polite">{t("adm.total", { n: total })}</p>
      <ul className="mt-2 space-y-2" data-testid="audit-list">
        {rows.map((e) => (
          <li key={e.id}>
            <Card as="div" className="text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-mono font-bold">{e.action}</span>
                <time className="text-xs text-slate-600" dateTime={e.createdAt}>{fmtDate(e.createdAt, locale, true)}</time>
              </div>
              <p className="text-slate-600">{e.actorRole ?? "system"} · {e.tenantId ? <Link className="text-brand underline" href={`/admin/salon/${e.tenantId}`}>{name(e.tenantId)}</Link> : "—"}</p>
              {e.details ? <p className="mt-1 break-all font-mono text-xs text-slate-700">{JSON.stringify(e.details)}</p> : null}
            </Card>
          </li>
        ))}
      </ul>
      {!loading && rows.length === 0 && !err ? <p className="mt-4 text-slate-600">{t("common.empty")}</p> : null}
      {rows.length < total ? <div className="mt-4 flex justify-center"><Button variant="secondary" disabled={loading} onClick={() => setPage((p) => p + 1)}>{t("common.more")}</Button></div> : null}
    </div>
  );
}
