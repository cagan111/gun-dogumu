"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/field";
import { Badge, Card, SelectField } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client-api";
import { useI18n } from "@/lib/i18n/client";
import type { Key } from "@/lib/i18n/shared";
import { useLoader } from "../../panel/_ui/util";
import { fmtDate } from "./common";

interface Req { id: string; tenantId: string; size: number; status: "open" | "fulfilled" | "rejected"; createdAt: string; tenant: { name: string; slug: string } }

export function SmsRequestsView() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [status, setStatus] = useState("open");
  const q = useLoader(() => api<{ total: number; requests: Req[] }>(`/api/admin/sms-requests?pageSize=100${status ? `&status=${status}` : ""}`), [status]);
  const [act, setAct] = useState<{ r: Req; action: "fulfil" | "reject" } | null>(null);
  const [busy, setBusy] = useState(false);

  async function resolve() {
    if (!act) return;
    setBusy(true);
    try {
      await api(`/api/admin/sms-requests/${act.r.id}`, { method: "POST", body: { action: act.action } });
      toast(t("common.saved"), "success");
      q.reload();
    } catch (e) { toast(errorMessage(e, t), "error"); } finally { setBusy(false); setAct(null); }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <h2 className="flex-1 text-xl font-extrabold">{t("adm.nav.sms")}</h2>
        <SelectField label={t("adm.status")} value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
          <option value="">{t("common.all")}</option>
          {(["open", "fulfilled", "rejected"] as const).map((s) => <option key={s} value={s}>{t(`sms.st.${s}` as Key)}</option>)}
        </SelectField>
      </div>
      {q.error ? <Alert className="mt-3">{errorMessage(q.error, t)}</Alert> : null}
      {!q.loading && (q.data?.requests.length ?? 0) === 0 ? <p className="mt-4 text-slate-600">{t("common.empty")}</p> : null}
      <ul className="mt-3 space-y-2">
        {(q.data?.requests ?? []).map((r) => (
          <li key={r.id}>
            <Card as="div" className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1">
                <Link href={`/admin/salon/${r.tenantId}`} className="font-bold text-brand underline">{r.tenant.name}</Link>
                <p className="text-sm text-slate-600">{r.size} SMS · {fmtDate(r.createdAt, locale, true)}</p>
              </div>
              <Badge tone={r.status === "open" ? "amber" : r.status === "fulfilled" ? "green" : "slate"}>{t(`sms.st.${r.status}` as Key)}</Badge>
              {r.status === "open" ? (
                <div className="flex gap-2">
                  <Button onClick={() => setAct({ r, action: "fulfil" })} aria-label={`${t("adm.fulfil")}: ${r.tenant.name}`}>{t("adm.fulfil")}</Button>
                  <Button variant="danger" onClick={() => setAct({ r, action: "reject" })} aria-label={`${t("adm.reject")}: ${r.tenant.name}`}>{t("adm.reject")}</Button>
                </div>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
      <ConfirmDialog open={!!act} danger={act?.action === "reject"} title={act ? t(act.action === "fulfil" ? "adm.fulfilTitle" : "adm.rejectTitle", { name: act.r.tenant.name, n: act.r.size }) : ""}
        body={act ? t(act.action === "fulfil" ? "adm.fulfilBody" : "adm.rejectBody") : undefined} confirmLabel={act ? t(act.action === "fulfil" ? "adm.fulfil" : "adm.reject") : ""} busy={busy} onConfirm={resolve} onCancel={() => setAct(null)} />
    </div>
  );
}
