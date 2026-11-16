"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Field } from "@/components/ui/field";
import { Card } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client-api";
import { useI18n } from "@/lib/i18n/client";
import type { Key } from "@/lib/i18n/shared";
import { useLoader } from "../../panel/_ui/util";
import { PLAN_IDS } from "./common";

interface Prices { prices: Record<string, number>; defaults: Record<string, number> }

export function PricesView() {
  const { t } = useI18n();
  const toast = useToast();
  const q = useLoader(() => api<Prices>("/api/admin/plan-prices"), []);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (q.data) setVals(Object.fromEntries(PLAN_IDS.map((p) => [p, String(q.data!.prices[p] ?? "")]))); }, [q.data]);

  const valid = PLAN_IDS.every((p) => { const n = Number(vals[p]); return vals[p] !== "" && Number.isFinite(n) && n >= 0; });

  async function save() {
    setBusy(true);
    try {
      await api("/api/admin/plan-prices", { method: "PATCH", body: { prices: Object.fromEntries(PLAN_IDS.map((p) => [p, Number(vals[p])])) } });
      toast(t("common.saved"), "success");
      q.reload();
    } catch (e) { toast(errorMessage(e, t), "error"); } finally { setBusy(false); setConfirm(false); }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h2 className="text-xl font-extrabold">{t("adm.nav.prices")}</h2>
      <p className="mt-1 text-sm text-slate-600">{t("adm.pricesNote")}</p>
      {q.error ? <Alert className="mt-3">{errorMessage(q.error, t)}</Alert> : null}
      <Card className="mt-3">
        <form noValidate className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) setConfirm(true); }}>
          {PLAN_IDS.map((p) => (
            <Field key={p} label={`${t(`adm.plan.${p}` as Key)} (TL / ${t("adm.month")})`} type="number" inputMode="decimal" min={0} step="any" value={vals[p] ?? ""} onChange={(e) => setVals({ ...vals, [p]: e.target.value })} hint={q.data ? t("adm.default", { n: q.data.defaults[p] ?? 0 }) : undefined} />
          ))}
          <Button type="submit" disabled={!valid || busy}>{t("common.save")}</Button>
        </form>
      </Card>
      <ConfirmDialog open={confirm} danger={false} title={t("adm.pricesTitle")} body={t("adm.pricesBody")} confirmLabel={t("common.save")} busy={busy} onConfirm={save} onCancel={() => setConfirm(false)} />
    </div>
  );
}
