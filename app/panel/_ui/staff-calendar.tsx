"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Field } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { api, ApiError, errorMessage } from "@/lib/client-api";
import { calendarLinkUrl } from "@/lib/calendar-link";
import { useI18n } from "@/lib/i18n/client";
import { usePanel } from "./ctx";
import type { Staff } from "./types";

type Action = "rotate" | "revoke";
export function StaffCalendar({ staff, onClose }: { staff: Staff; onClose: () => void }) {
  const { t } = useI18n();
  const { isOwner, tenant } = usePanel();
  const [url, setUrl] = useState<string | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(false), request = useRef<AbortController | null>(null), generation = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; request.current?.abort(); };
  }, []);
  const canRotate = staff.active && tenant.status !== "suspended";

  async function mutate(op: Action) {
    if (request.current || !isOwner || (op === "rotate" && !canRotate)) return;
    const controller = new AbortController(); request.current = controller; generation.current++;
    setBusy(true); setUrl(null); setErr(null); setNotice(null);
    try {
      const endpoint = `/api/panel/staff/${encodeURIComponent(staff.id)}/calendar`;
      const response = await api<{ path?: unknown; revoked?: boolean }>(endpoint, { method: op === "rotate" ? "POST" : "DELETE", ...(op === "rotate" ? { body: {} } : {}), signal: controller.signal });
      if (!mounted.current || controller.signal.aborted) return;
      if (op === "rotate") {
        const next = calendarLinkUrl(response.path, window.location.origin);
        if (!next) throw new Error("invalid_calendar_response");
        setUrl(next);
      } else {
        if (response.revoked !== true) throw new Error("invalid_calendar_response");
        setNotice(t("ical.revoked"));
      }
      setAction(null);
    } catch (error) {
      if (!mounted.current || controller.signal.aborted) return;
      setErr(error instanceof ApiError && error.status > 0 && error.status < 500 ? errorMessage(error, t) : t("ical.uncertain"));
    } finally {
      if (request.current === controller) request.current = null;
      if (mounted.current) setBusy(false);
    }
  }
  async function copy() {
    if (!url) return;
    const version = generation.current;
    setErr(null); setNotice(null);
    try {
      await navigator.clipboard.writeText(url);
      if (mounted.current && version === generation.current) setNotice(t("ical.copied"));
    } catch { if (mounted.current && version === generation.current) setErr(t("ical.copyError")); }
  }
  if (!isOwner) return null;
  return <Sheet open onClose={() => { if (!request.current) onClose(); }} title={t("ical.title", { name: staff.name })}>
    <div className="space-y-4" aria-busy={busy}>
      <p className="text-sm text-slate-700">{t("ical.scope")}</p>
      <Alert tone="info">{t("ical.private")}</Alert>
      {busy ? <p role="status" className="text-sm text-slate-800">{t("ical.pending")}</p> : null}
      {err ? <Alert>{err}</Alert> : null}
      {notice ? <p role="status" className="text-sm text-slate-800">{notice}</p> : null}
      {url ? <div className="space-y-3">
        <Field label={t("ical.link")} hint={t("ical.once")} value={url} readOnly autoFocus autoComplete="off" spellCheck={false} onFocus={event => event.currentTarget.select()} />
        <Button variant="secondary" onClick={copy}>{t("ical.copy")}</Button>
      </div> : null}
      {action ? <div className="space-y-3">
        <p className="text-sm text-slate-800">{t(action === "rotate" ? "ical.rotateWarning" : "ical.revokeWarning")}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => { setAction(null); setErr(null); }}>{t("common.cancel")}</Button>
          <Button variant={action === "revoke" ? "danger" : "primary"} disabled={busy} onClick={() => mutate(action)}>{busy ? t("common.loading2") : t(action === "rotate" ? "ical.rotateConfirm" : "ical.revokeConfirm")}</Button>
        </div>
      </div> : <div className="space-y-3">
        {!canRotate ? <p className="text-sm text-slate-700">{t("ical.unavailable")}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button disabled={!canRotate || busy} onClick={() => { setAction("rotate"); setErr(null); setNotice(null); }}>{t("ical.rotate")}</Button>
          <Button variant="danger" disabled={busy} onClick={() => { setAction("revoke"); setErr(null); setNotice(null); }}>{t("ical.revoke")}</Button>
        </div>
      </div>}
    </div>
  </Sheet>;
}
