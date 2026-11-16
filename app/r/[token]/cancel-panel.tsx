"use client";
import { useState } from "react";
import { Alert, Spinner } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

export function CancelPanel({ token, cancellable, hours, phone }: { token: string; cancellable: boolean; hours: number; phone: string | null }) {
  const t = useT();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function cancel() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/r/${token}/cancel`, { method: "POST" });
      if (res.ok) { setDone(true); return; }
      const j = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
      setErr(j.error?.code === "cancel_window" ? (phone ? t("r.tooLate", { phone }) : t("r.tooLateNoPhone")) : res.status === 429 ? t("common.rateLimited") : t("common.genericError"));
      setAsking(false);
    } catch {
      setErr(t("common.genericError"));
    } finally {
      setBusy(false);
    }
  }

  if (done) return <Alert tone="success" className="mt-4">{t("r.cancelled")}</Alert>;
  if (!cancellable) return <Alert tone="info" className="mt-4">{phone ? t("r.tooLate", { phone }) : t("r.tooLateNoPhone")}</Alert>;

  return (
    <div className="mt-5">
      {err ? <Alert className="mb-3">{err}</Alert> : null}
      {asking ? (
        <div role="alertdialog" aria-label={t("r.cancel")} className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-900">{t("r.cancelAsk")}</p>
          <div className="mt-3 flex gap-3">
            <Button variant="danger" onClick={cancel} disabled={busy} data-testid="cancel-confirm">{busy ? <><Spinner />{t("r.cancelling")}</> : t("r.cancelYes")}</Button>
            <Button variant="secondary" onClick={() => setAsking(false)} disabled={busy}>{t("r.cancelNo")}</Button>
          </div>
        </div>
      ) : (
        <>
          <Button variant="danger" className="w-full" onClick={() => setAsking(true)} data-testid="cancel-button">{t("r.cancel")}</Button>
          <p className="mt-2 text-center text-xs text-slate-600">{t("r.deadlineInfo", { h: hours })}</p>
        </>
      )}
    </div>
  );
}
