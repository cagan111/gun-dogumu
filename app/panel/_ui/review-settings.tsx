"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Field } from "@/components/ui/field";
import { Card } from "@/components/ui/form";
import { api, ApiError, errorMessage } from "@/lib/client-api";
import { useI18n } from "@/lib/i18n/client";
import { isGoogleReviewUrl } from "@/lib/review-link";
import { usePanel } from "./ctx";

type ReviewSettingsData = { reviewInviteEnabled: boolean; reviewInviteUrl: string | null; status: string };
/** Separate, explicit owner opt-in. Other settings saves never carry these fields. */
export function ReviewSettings() {
  const { t } = useI18n(), { tenant } = usePanel();
  const [data, setData] = useState<ReviewSettingsData | null>(null);
  const [enabled, setEnabled] = useState(false), [url, setUrl] = useState("");
  const [error, setError] = useState<{ cause: unknown; uncertain: boolean } | null>(null), [fieldError, setFieldError] = useState<"required" | "invalid" | null>(null);
  const [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [reload, setReload] = useState(0);
  const alive = useRef(false), request = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    const load = new AbortController();
    setError(null);
    api<ReviewSettingsData>("/api/panel/settings", { signal: load.signal }).then(d => {
      if (!load.signal.aborted) { setData(d); setEnabled(d.reviewInviteEnabled); setUrl(d.reviewInviteUrl ?? ""); }
    }).catch(e => { if (!load.signal.aborted) setError({ cause: e, uncertain: false }); });
    return () => { alive.current = false; load.abort(); request.current?.abort(); };
  }, [reload]);
  const readOnly = tenant.status === "suspended" || data?.status === "suspended";
  function edit() { setSaved(false); setFieldError(null); setError(null); }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!data || readOnly || request.current) return;
    const value = url.trim();
    setSaved(false); setError(null);
    if (!value && enabled) { setFieldError("required"); return; }
    if (value && !isGoogleReviewUrl(value)) { setFieldError("invalid"); return; }
    setFieldError(null);
    const controller = new AbortController(); request.current = controller; setBusy(true);
    try {
      const result = await api<ReviewSettingsData>("/api/panel/settings", { method: "PATCH", body: { reviewInviteEnabled: enabled, reviewInviteUrl: value || null }, signal: controller.signal });
      if (alive.current && !controller.signal.aborted) { setData(result); setEnabled(result.reviewInviteEnabled); setUrl(result.reviewInviteUrl ?? ""); setSaved(true); }
    } catch (e) {
      if (alive.current && !controller.signal.aborted) {
        if (e instanceof ApiError && e.code === "validation") setFieldError("invalid");
        else setError({ cause: e, uncertain: e instanceof ApiError && e.code === "network" });
      }
    } finally { if (request.current === controller) request.current = null; if (alive.current) setBusy(false); }
  }
  return <Card className="space-y-3">
    <h3 className="font-bold">{t("review.title")}</h3>
    <p className="text-sm text-sand">{t("review.explain")}</p>
    <p className="text-sm text-sand">{t("review.cost")}</p>
    {error ? <Alert>{error.uncertain ? t("review.uncertain") : errorMessage(error.cause, t)}</Alert> : null}
    {!data ? error ? <Button onClick={() => setReload(n => n + 1)}>{t("review.retry")}</Button> : <p role="status">{t("common.loading")}</p> :
      <form aria-label={t("review.title")} aria-busy={busy} onSubmit={save} noValidate>
        {readOnly ? <p className="mb-3 text-sm text-sand">{t("err.suspended")}</p> : null}
        <fieldset disabled={busy || readOnly} className="space-y-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
            <input type="checkbox" className="h-5 w-5 shrink-0 accent-[rgb(var(--brand))]" checked={enabled} onChange={e => { edit(); setEnabled(e.target.checked); }} />
            <span>{t("review.enable")}</span>
          </label>
          <Field label={t("review.url")} hint={t("review.urlHint")} type="url" inputMode="url" maxLength={500} autoComplete="off" value={url} onChange={e => { edit(); setUrl(e.target.value); }} error={fieldError ? t(fieldError === "required" ? "review.required" : "review.invalid") : null} />
          <p className="text-xs text-sand">{t("review.disableHint")}</p>
          <Button type="submit" className="w-full sm:w-auto">{busy ? t("review.saving") : t("review.save")}</Button>
        </fieldset>
        {saved ? <p role="status" className="mt-3 text-sm">{t("review.saved")}</p> : null}
      </form>}
  </Card>;
}
