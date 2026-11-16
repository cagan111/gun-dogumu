"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Field } from "@/components/ui/field";
import { Badge, Card, SelectField } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client-api";
import { useI18n } from "@/lib/i18n/client";
import type { Key } from "@/lib/i18n/shared";
import { money, useLoader } from "../../panel/_ui/util";
import { fmtDate, PLAN_IDS, STATUS_TONE } from "./common";

interface Detail {
  tenant: { id: string; name: string; slug: string; city: string | null; plan: string; status: "trial" | "active" | "past_due" | "suspended"; trialEndsAt: string | null; subscriptionEndsAt: string | null; phone: string | null; createdAt: string };
  users: { id: string; email: string; name: string | null; role: string; lastLoginAt: string | null }[];
  smsBalance: number; staffCount: number; serviceCount: number; appointmentCount: number;
  payments: { id: string; amountTry: number; method: string; note: string | null; createdAt: string }[];
  smsRequests: { id: string; size: number; status: string; createdAt: string }[];
}

type Confirm = null | "suspend" | "unsuspend" | "plan" | "payment" | "credit";

export function TenantDetailView({ id }: { id: string }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const q = useLoader(() => api<Detail>(`/api/admin/tenants/${id}`), [id]);
  const d = q.data;
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  // formlar
  const [amount, setAmount] = useState("");
  const [months, setMonths] = useState("1");
  const [payPlan, setPayPlan] = useState("");
  const [note, setNote] = useState("");
  const [credit, setCredit] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [newPlan, setNewPlan] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>, after?: () => void) {
    setBusy(true); setErr(null);
    try { await fn(); toast(t("common.saved"), "success"); after?.(); q.reload(); } catch (e) { setErr(errorMessage(e, t)); toast(errorMessage(e, t), "error"); } finally { setBusy(false); setConfirm(null); }
  }

  const amountNum = Number(amount.replace(",", "."));
  const creditNum = Number(credit);
  const payValid = Number.isFinite(amountNum) && amountNum > 0 && Number.isInteger(Number(months)) && Number(months) >= 1 && Number(months) <= 12;
  const creditValid = Number.isInteger(creditNum) && creditNum >= 1;

  if (q.error) return <Alert>{errorMessage(q.error, t)}</Alert>;
  if (!d) return <p className="text-slate-600">{t("common.loading")}</p>;
  const tn = d.tenant;
  const plan = newPlan || tn.plan;

  return (
    <div className="space-y-4">
      <Link href="/admin" className="inline-flex min-h-11 items-center font-semibold text-brand underline">← {t("adm.nav.tenants")}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-extrabold">{tn.name}</h2>
        <Badge tone={STATUS_TONE[tn.status]}>{t(`adm.st.${tn.status}` as Key)}</Badge>
        <Badge>{t(`adm.plan.${tn.plan}` as Key)}</Badge>
        <a href={`/${tn.slug}`} target="_blank" rel="noreferrer" className="text-sm text-brand underline">/{tn.slug}</a>
      </div>
      {err ? <Alert>{err}</Alert> : null}

      <Card aria-labelledby="sum-h">
        <h3 id="sum-h" className="font-bold">{t("adm.summary")}</h3>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-4">
          <div><dt className="text-slate-600">{t("adm.trialEnds")}</dt><dd className="font-semibold">{fmtDate(tn.trialEndsAt, locale)}</dd></div>
          <div><dt className="text-slate-600">{t("adm.subEnds")}</dt><dd className="font-semibold" data-testid="sub-ends">{fmtDate(tn.subscriptionEndsAt, locale)}</dd></div>
          <div><dt className="text-slate-600">{t("adm.col.sms")}</dt><dd className="font-semibold" data-testid="sms-balance">{d.smsBalance}</dd></div>
          <div><dt className="text-slate-600">{t("adm.created")}</dt><dd className="font-semibold">{fmtDate(tn.createdAt, locale)}</dd></div>
          <div><dt className="text-slate-600">{t("adm.staffCount")}</dt><dd className="font-semibold">{d.staffCount}</dd></div>
          <div><dt className="text-slate-600">{t("adm.serviceCount")}</dt><dd className="font-semibold">{d.serviceCount}</dd></div>
          <div><dt className="text-slate-600">{t("adm.apptCount")}</dt><dd className="font-semibold">{d.appointmentCount}</dd></div>
          <div><dt className="text-slate-600">{t("adm.city")}</dt><dd className="font-semibold">{tn.city ?? "—"}</dd></div>
        </dl>
        <ul className="mt-3 text-sm text-slate-700">
          {d.users.map((u) => <li key={u.id}>{u.email} · {u.role} · {t("adm.col.login")}: {fmtDate(u.lastLoginAt, locale)}</li>)}
        </ul>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card aria-labelledby="pay-h">
          <h3 id="pay-h" className="font-bold">{t("adm.manualPay")}</h3>
          <form className="mt-2 space-y-3" noValidate onSubmit={(e) => { e.preventDefault(); if (payValid) setConfirm("payment"); }}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("adm.amount")} type="number" inputMode="decimal" min={0} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              <Field label={t("adm.months")} type="number" inputMode="numeric" min={1} max={12} value={months} onChange={(e) => setMonths(e.target.value)} required />
            </div>
            <SelectField label={t("adm.payPlan")} value={payPlan} onChange={(e) => setPayPlan(e.target.value)}>
              <option value="">{t("adm.keepPlan")}</option>
              {PLAN_IDS.map((p) => <option key={p} value={p}>{t(`adm.plan.${p}` as Key)}</option>)}
            </SelectField>
            <Field label={t("adm.note")} optional={t("common.optional")} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
            <Button type="submit" disabled={!payValid || busy}>{t("adm.recordPay")}</Button>
          </form>
        </Card>

        <Card aria-labelledby="cr-h">
          <h3 id="cr-h" className="font-bold">{t("adm.addCredit")}</h3>
          <form className="mt-2 space-y-3" noValidate onSubmit={(e) => { e.preventDefault(); if (creditValid) setConfirm("credit"); }}>
            <Field label={t("adm.creditAmount")} type="number" inputMode="numeric" min={1} step={1} value={credit} onChange={(e) => setCredit(e.target.value)} required />
            <Field label={t("adm.note")} optional={t("common.optional")} value={creditNote} onChange={(e) => setCreditNote(e.target.value)} maxLength={500} />
            <Button type="submit" disabled={!creditValid || busy}>{t("adm.credit")}</Button>
          </form>
          <hr className="my-4 border-slate-200" />
          <h3 className="font-bold">{t("adm.changePlan")}</h3>
          <div className="mt-2 flex items-end gap-2">
            <SelectField label={t("adm.plan")} value={plan} onChange={(e) => setNewPlan(e.target.value)} className="flex-1">
              {PLAN_IDS.map((p) => <option key={p} value={p}>{t(`adm.plan.${p}` as Key)}</option>)}
            </SelectField>
            <Button variant="secondary" disabled={plan === tn.plan || busy} onClick={() => setConfirm("plan")}>{t("adm.apply")}</Button>
          </div>
        </Card>
      </div>

      <Card aria-labelledby="sus-h">
        <h3 id="sus-h" className="font-bold">{t("adm.suspension")}</h3>
        <p className="mt-1 text-sm text-slate-600">{tn.status === "suspended" ? t("adm.suspendedNote") : t("adm.suspendNote")}</p>
        <div className="mt-2">
          {tn.status === "suspended"
            ? <Button disabled={busy} onClick={() => setConfirm("unsuspend")}>{t("adm.unsuspend")}</Button>
            : <Button variant="danger" disabled={busy} onClick={() => setConfirm("suspend")}>{t("adm.suspend")}</Button>}
        </div>
      </Card>

      <Card aria-labelledby="ph-h">
        <h3 id="ph-h" className="font-bold">{t("adm.recentPayments")}</h3>
        {d.payments.length === 0 ? <p className="mt-1 text-sm text-slate-600">{t("common.empty")}</p> : (
          <ul className="mt-1 divide-y divide-slate-200 text-sm" data-testid="payments">
            {d.payments.map((p) => <li key={p.id} className="flex flex-wrap justify-between gap-2 py-1.5"><span>{fmtDate(p.createdAt, locale, true)} · {p.method}{p.note ? ` · ${p.note}` : ""}</span><span className="font-semibold tabular-nums">{money(p.amountTry, locale)}</span></li>)}
          </ul>
        )}
      </Card>

      <ConfirmDialog open={confirm === "suspend"} title={t("adm.suspendTitle", { name: tn.name })} body={t("adm.suspendBody")} confirmLabel={t("adm.suspend")} busy={busy} onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => api(`/api/admin/tenants/${id}/suspend`, { method: "POST" }))} />
      <ConfirmDialog open={confirm === "unsuspend"} danger={false} title={t("adm.unsuspendTitle", { name: tn.name })} confirmLabel={t("adm.unsuspend")} busy={busy} onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => api(`/api/admin/tenants/${id}/unsuspend`, { method: "POST" }))} />
      <ConfirmDialog open={confirm === "plan"} danger={false} title={t("adm.planTitle")} body={t("adm.planBody", { from: t(`adm.plan.${tn.plan}` as Key), to: t(`adm.plan.${plan}` as Key) })} confirmLabel={t("adm.apply")} busy={busy} onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => api(`/api/admin/tenants/${id}/plan`, { method: "POST", body: { plan } }), () => setNewPlan(""))} />
      <ConfirmDialog open={confirm === "payment"} danger={false} title={t("adm.payTitle")} body={t("adm.payBody", { amount: money(amountNum, locale), months })} confirmLabel={t("adm.recordPay")} busy={busy} onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => api("/api/admin/payments", { method: "POST", body: { tenantId: id, amountTry: amountNum, months: Number(months), plan: payPlan || undefined, note: note.trim() || undefined } }), () => { setAmount(""); setNote(""); setPayPlan(""); })} />
      <ConfirmDialog open={confirm === "credit"} danger={false} title={t("adm.creditTitle")} body={t("adm.creditBody", { n: creditNum })} confirmLabel={t("adm.credit")} busy={busy} onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => api("/api/admin/sms-credits", { method: "POST", body: { tenantId: id, amount: creditNum, note: creditNote.trim() || undefined } }), () => { setCredit(""); setCreditNote(""); })} />
    </div>
  );
}
