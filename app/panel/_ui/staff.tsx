"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Field } from "@/components/ui/field";
import { Badge, Card, CheckField, SelectField } from "@/components/ui/form";
import { ConfirmDialog, Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage } from "@/lib/client-api";
import { useI18n } from "@/lib/i18n/client";
import type { Key } from "@/lib/i18n/shared";
import { utcToLocal, zonedToUtc } from "@/lib/time";
import { usePanel } from "./ctx";
import type { Staff, TimeOff, WH } from "./types";
import { fmtDateTime, fmtMin, parseHM, useLoader, WEEK_ORDER, weekdayName } from "./util";

const COLORS = ["#2563eb", "#db2777", "#059669", "#d97706", "#7c3aed", "#0891b2", "#dc2626", "#4b5563"];

interface Draft { id?: string; name: string; color: string; photoUrl: string; active: boolean }

export function StaffView() {
  const { t } = useI18n();
  const toast = useToast();
  const { isOwner } = usePanel();
  const q = useLoader(async () => {
    const [staff, timeOff] = await Promise.all([api<Staff[]>("/api/panel/staff"), api<TimeOff[]>("/api/panel/time-off")]);
    return { staff, timeOff };
  }, []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [hoursFor, setHoursFor] = useState<Staff | null>(null);
  const [offOpen, setOffOpen] = useState(false);
  const [delOff, setDelOff] = useState<TimeOff | null>(null);
  const [delStaff, setDelStaff] = useState<Staff | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const staff = q.data?.staff ?? [];
  const timeOff = q.data?.timeOff ?? [];

  function open(s?: Staff) {
    setErr(null);
    setDraft(s ? { id: s.id, name: s.name, color: s.color, photoUrl: s.photoUrl ?? "", active: s.active } : { name: "", color: COLORS[staff.length % COLORS.length]!, photoUrl: "", active: true });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (!draft.name.trim()) { setErr(t("err.validation")); return; }
    if (draft.photoUrl.trim() && !draft.photoUrl.trim().startsWith("https://")) { setErr(t("set.errHttps")); return; }
    setBusy(true); setErr(null);
    const body = { name: draft.name.trim(), color: draft.color, photoUrl: draft.photoUrl.trim() || null, active: draft.active, sortOrder: draft.id ? undefined : staff.length };
    try {
      if (draft.id) await api(`/api/panel/staff/${draft.id}`, { method: "PATCH", body });
      else await api("/api/panel/staff", { method: "POST", body });
      toast(t("common.saved"), "success");
      setDraft(null);
      q.reload();
    } catch (e2) { setErr(errorMessage(e2, t)); } finally { setBusy(false); }
  }

  async function removeStaff() {
    if (!delStaff) return;
    setBusy(true);
    try {
      const r = await api<{ archived: boolean }>(`/api/panel/staff/${delStaff.id}`, { method: "DELETE" });
      toast(r.archived ? t("staff.archived") : t("common.saved"), "success");
      setDelStaff(null);
      q.reload();
    } catch (e) { toast(errorMessage(e, t), "error"); setDelStaff(null); } finally { setBusy(false); }
  }

  async function removeOff() {
    if (!delOff) return;
    setBusy(true);
    try {
      await api(`/api/panel/time-off/${delOff.id}`, { method: "DELETE" });
      setDelOff(null);
      q.reload();
    } catch (e) { toast(errorMessage(e, t), "error"); setDelOff(null); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <section aria-labelledby="staff-h">
        <div className="flex items-center gap-3">
          <h2 id="staff-h" className="flex-1 text-xl font-extrabold">{t("nav.staff")}</h2>
          {isOwner ? <Button onClick={() => open()}>+ {t("staff.add")}</Button> : null}
        </div>
        {!isOwner ? <Alert tone="info" className="mt-3">{t("ownerOnly")}</Alert> : null}
        {q.error ? <Alert className="mt-3">{errorMessage(q.error, t)}</Alert> : null}
        {!q.loading && staff.length === 0 && !q.error ? <p className="mt-6 text-slate-600">{t("staff.empty")}</p> : null}
        <ul className="mt-3 space-y-2">
          {staff.map((s) => (
            <li key={s.id}>
              <Card as="div" className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span aria-hidden className="h-8 w-8 shrink-0 rounded-full" style={{ background: s.color }} />
                <p className="min-w-0 flex-1 truncate font-bold">{s.name}</p>
                {!s.active ? <Badge>{t("svc.inactive")}</Badge> : null}
                {isOwner ? (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setHoursFor(s)}>{t("staff.hours")}</Button>
                    <Button variant="secondary" onClick={() => open(s)} aria-label={`${t("common.edit")}: ${s.name}`}>{t("common.edit")}</Button>
                    <Button variant="ghost" className="text-red-300" onClick={() => setDelStaff(s)} aria-label={`${t("common.delete")}: ${s.name}`}>{t("common.delete")}</Button>
                  </div>
                ) : <Button variant="secondary" onClick={() => setHoursFor(s)}>{t("staff.hours")}</Button>}
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="off-h">
        <div className="flex items-center gap-3">
          <h2 id="off-h" className="flex-1 text-xl font-extrabold">{t("off.title")}</h2>
          {isOwner && staff.length ? <Button variant="secondary" onClick={() => setOffOpen(true)}>+ {t("off.add")}</Button> : null}
        </div>
        {timeOff.length === 0 ? <p className="mt-3 text-slate-600">{t("off.empty")}</p> : null}
        <TimeOffList list={timeOff} staff={staff} canEdit={isOwner} onDelete={setDelOff} />
      </section>

      <Sheet open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? t("staff.edit") : t("staff.add")}>
        {draft ? (
          <form onSubmit={save} noValidate className="space-y-3">
            {err ? <Alert>{err}</Alert> : null}
            <Field label={t("staff.name")} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={100} required data-autofocus />
            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-800" id="color-l">{t("staff.color")}</p>
              <div role="radiogroup" aria-labelledby="color-l" className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={draft.color === c} aria-label={c} onClick={() => setDraft({ ...draft, color: c })}
                    className="h-10 w-10 rounded-full border-2" style={{ background: c, borderColor: draft.color === c ? "#F2EEE6" : "transparent", outline: draft.color === c ? "2px solid #0B0B0C" : undefined, outlineOffset: -4 }} />
                ))}
              </div>
            </div>
            <Field label={t("staff.photo")} optional={t("common.optional")} type="url" inputMode="url" placeholder="https://…" value={draft.photoUrl} onChange={(e) => setDraft({ ...draft, photoUrl: e.target.value })} />
            <CheckField label={t("staff.active")} hint={t("staff.activeHint")} checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setDraft(null)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={busy}>{t("common.save")}</Button>
            </div>
          </form>
        ) : null}
      </Sheet>

      <HoursSheet staff={hoursFor} canEdit={isOwner} onClose={() => setHoursFor(null)} />
      <TimeOffSheet open={offOpen} staff={staff.filter((s) => s.active)} onClose={() => setOffOpen(false)} onSaved={() => { setOffOpen(false); q.reload(); }} />
      <ConfirmDialog open={!!delOff} title={t("off.delTitle")} confirmLabel={t("common.delete")} busy={busy} onConfirm={removeOff} onCancel={() => setDelOff(null)} />
      <ConfirmDialog open={!!delStaff} title={t("staff.delTitle")} body={t("staff.delBody", { name: delStaff?.name ?? "" })} confirmLabel={t("common.delete")} busy={busy} onConfirm={removeStaff} onCancel={() => setDelStaff(null)} />
    </div>
  );
}

function TimeOffList({ list, staff, canEdit, onDelete }: { list: TimeOff[]; staff: Staff[]; canEdit: boolean; onDelete: (o: TimeOff) => void }) {
  const { t, locale } = useI18n();
  const { tenant } = usePanel();
  return (
    <ul className="mt-3 space-y-2">
      {list.map((o) => (
        <li key={o.id}>
          <Card as="div" className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{staff.find((s) => s.id === o.staffId)?.name ?? "—"} <Badge className="ml-1">{t(`off.${o.kind}` as Key)}</Badge></p>
              <p className="text-sm text-slate-600">{fmtDateTime(o.startsAt, locale, tenant.timeZone)} → {fmtDateTime(o.endsAt, locale, tenant.timeZone)}{o.reason ? ` · ${o.reason}` : ""}</p>
            </div>
            {canEdit ? <Button variant="ghost" className="text-red-300" onClick={() => onDelete(o)} aria-label={`${t("common.delete")}: ${fmtDateTime(o.startsAt, locale, tenant.timeZone)}`}>{t("common.delete")}</Button> : null}
          </Card>
        </li>
      ))}
    </ul>
  );
}

/* ───────────── İzin ekle ───────────── */

function TimeOffSheet({ open, staff, onClose, onSaved }: { open: boolean; staff: Staff[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const { tenant } = usePanel();
  const [staffId, setStaffId] = useState("");
  const [kind, setKind] = useState<"leave" | "holiday" | "other">("leave");
  const [s, setS] = useState("");
  const [e, setE] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const today = utcToLocal(new Date(), tenant.timeZone).date;
      setStaffId(staff[0]?.id ?? ""); setKind("leave"); setS(`${today}T09:00`); setE(`${today}T18:00`); setReason(""); setErr(null);
    }
  }

  const toUtc = (v: string) => {
    const [d, tm] = v.split("T");
    const m = parseHM(tm ?? "");
    return d && m !== null ? zonedToUtc(d, m, tenant.timeZone) : null;
  };

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const a = toUtc(s), b = toUtc(e);
    if (!staffId || !a || !b || b <= a) { setErr(t("off.errRange")); return; }
    setBusy(true); setErr(null);
    try {
      await api("/api/panel/time-off", { method: "POST", body: { staffId, kind, startsAt: a.toISOString(), endsAt: b.toISOString(), reason: reason.trim() || null } });
      onSaved();
    } catch (x) { setErr(errorMessage(x, t)); } finally { setBusy(false); }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("off.add")}>
      <form onSubmit={submit} noValidate className="space-y-3">
        {err ? <Alert>{err}</Alert> : null}
        <SelectField label={t("appt.staff")} value={staffId} onChange={(x) => setStaffId(x.target.value)}>
          {staff.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </SelectField>
        <SelectField label={t("off.kind")} value={kind} onChange={(x) => setKind(x.target.value as typeof kind)}>
          {(["leave", "holiday", "other"] as const).map((k) => <option key={k} value={k}>{t(`off.${k}` as Key)}</option>)}
        </SelectField>
        <Field label={t("off.from")} type="datetime-local" value={s} onChange={(x) => setS(x.target.value)} required />
        <Field label={t("off.to")} type="datetime-local" value={e} onChange={(x) => setE(x.target.value)} required />
        <Field label={t("off.reason")} optional={t("common.optional")} value={reason} onChange={(x) => setReason(x.target.value)} maxLength={200} />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" disabled={busy}>{t("common.save")}</Button>
        </div>
      </form>
    </Sheet>
  );
}

/* ───────────── Çalışma saatleri ───────────── */

interface Day { weekday: number; open: boolean; start: string; end: string; breaks: { s: string; e: string }[] }

function toDays(rows: WH[]): Day[] {
  return WEEK_ORDER.map((w) => {
    const r = rows.find((x) => x.weekday === w);
    return r
      ? { weekday: w, open: true, start: fmtMin(r.startMin), end: r.endMin >= 1440 ? "23:59" : fmtMin(r.endMin), breaks: r.breaks.map(([a, b]) => ({ s: fmtMin(a), e: fmtMin(b) })) }
      : { weekday: w, open: false, start: "09:00", end: "18:00", breaks: [] };
  });
}

function HoursSheet({ staff, canEdit, onClose }: { staff: Staff | null; canEdit: boolean; onClose: () => void }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [days, setDays] = useState<Day[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sid = staff?.id ?? null;
  useEffect(() => {
    setDays(null); setErr(null);
    if (!sid) return;
    let live = true;
    api<{ days: WH[] }>(`/api/panel/staff/${sid}/working-hours`).then((r) => { if (live) setDays(toDays(r.days)); }, (e) => { if (live) setErr(errorMessage(e, t)); });
    return () => { live = false; };
  }, [sid, t]);

  const patch = (i: number, p: Partial<Day>) => setDays((d) => d && d.map((x, j) => (j === i ? { ...x, ...p } : x)));

  async function save() {
    if (!staff || !days) return;
    const out: WH[] = [];
    for (const d of days) {
      if (!d.open) continue;
      const a = parseHM(d.start), b = parseHM(d.end);
      if (a === null || b === null || b <= a) { setErr(t("hours.errRange", { day: weekdayName(d.weekday, locale) })); return; }
      const br: [number, number][] = [];
      for (const x of d.breaks) {
        const bs = parseHM(x.s), be = parseHM(x.e);
        if (bs === null || be === null || be <= bs || bs < a || be > b) { setErr(t("hours.errBreak", { day: weekdayName(d.weekday, locale) })); return; }
        br.push([bs, be]);
      }
      br.sort((x, y) => x[0] - y[0]);
      for (let i = 1; i < br.length; i++) if (br[i]![0] < br[i - 1]![1]) { setErr(t("hours.errBreak", { day: weekdayName(d.weekday, locale) })); return; }
      out.push({ weekday: d.weekday, startMin: a, endMin: b, breaks: br });
    }
    setBusy(true); setErr(null);
    try {
      await api(`/api/panel/staff/${staff.id}/working-hours`, { method: "PUT", body: { days: out } });
      toast(t("common.saved"), "success");
      onClose();
    } catch (e) { setErr(e instanceof ApiError && e.code === "validation" ? t("hours.errBreak", { day: "" }) : errorMessage(e, t)); } finally { setBusy(false); }
  }

  return (
    <Sheet open={!!staff} onClose={onClose} title={staff ? `${t("staff.hours")}: ${staff.name}` : ""} wide>
      {err ? <Alert className="mb-3">{err}</Alert> : null}
      {!days ? <p className="text-slate-600">{t("common.loading")}</p> : (
        <div className="space-y-3">
          {days.map((d, i) => {
            const name = weekdayName(d.weekday, locale);
            return (
              <fieldset key={d.weekday} className="rounded-xl border border-slate-200 p-3" disabled={!canEdit}>
                <legend className="px-1 text-sm font-bold">{name}</legend>
                <CheckField label={t("hours.open")} checked={d.open} onChange={(e) => patch(i, { open: e.target.checked })} />
                {d.open ? (
                  <div className="mt-1 space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label={`${name}: ${t("hours.from")}`} type="time" value={d.start} onChange={(e) => patch(i, { start: e.target.value })} />
                      <Field label={`${name}: ${t("hours.to")}`} type="time" value={d.end} onChange={(e) => patch(i, { end: e.target.value })} />
                    </div>
                    {d.breaks.map((b, k) => (
                      <div key={k} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                        <Field label={`${t("hours.break")} ${k + 1}: ${t("hours.from")}`} type="time" value={b.s} onChange={(e) => patch(i, { breaks: d.breaks.map((x, j) => (j === k ? { ...x, s: e.target.value } : x)) })} />
                        <Field label={`${t("hours.break")} ${k + 1}: ${t("hours.to")}`} type="time" value={b.e} onChange={(e) => patch(i, { breaks: d.breaks.map((x, j) => (j === k ? { ...x, e: e.target.value } : x)) })} />
                        <Button variant="ghost" className="text-red-300" aria-label={`${t("hours.removeBreak")} (${name})`} onClick={() => patch(i, { breaks: d.breaks.filter((_, j) => j !== k) })}><span aria-hidden>×</span></Button>
                      </div>
                    ))}
                    {d.breaks.length < 5 ? <Button variant="secondary" className="!min-h-10 text-sm" onClick={() => patch(i, { breaks: [...d.breaks, { s: "12:30", e: "13:00" }] })}>+ {t("hours.addBreak")} ({name})</Button> : null}
                  </div>
                ) : null}
              </fieldset>
            );
          })}
          {canEdit ? (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
              <Button onClick={save} disabled={busy}>{t("common.save")}</Button>
            </div>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}
