"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Field } from "@/components/ui/field";
import { Badge, CheckField, SelectField, TextareaField } from "@/components/ui/form";
import { Sheet, ConfirmDialog } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage } from "@/lib/client-api";
import { cn } from "@/lib/cn";
import { dayParts } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import type { Key } from "@/lib/i18n/shared";
import { addDays, utcToLocal, weekdayOf, zonedToUtc } from "@/lib/time";
import { usePanel } from "./ctx";
import type { Appt, ApptStatus, Staff, Svc, TimeOff, WH } from "./types";
import { fmtMin, money, parseHM, statusTone, svcName, useLoader } from "./util";

const PPM = 1.25; // px / dakika
const GUTTER = 44;
const MIN_COL = 120;
const ACTIVE: ApptStatus[] = ["pending", "confirmed"];

interface Col { key: string; date: string; staff: Staff; label: string; sub?: string }
interface Placed { a: Appt; start: number; dur: number; lane: number; lanes: number }

const mondayOf = (date: string) => addDays(date, -((weekdayOf(date) + 6) % 7));

/** Aynı sütundaki çakışan randevuları şeritlere böler. */
function place(list: { a: Appt; start: number; dur: number }[]): Placed[] {
  const sorted = [...list].sort((x, y) => x.start - y.start || x.a.id.localeCompare(y.a.id));
  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  const lanesEnd: number[] = [];
  const flush = () => { for (const p of cluster) p.lanes = Math.max(lanesEnd.length, 1); cluster = []; lanesEnd.length = 0; };
  for (const it of sorted) {
    if (it.start >= clusterEnd) { flush(); clusterEnd = -1; }
    let lane = lanesEnd.findIndex((e) => e <= it.start);
    if (lane === -1) { lane = lanesEnd.length; lanesEnd.push(0); }
    lanesEnd[lane] = it.start + it.dur;
    clusterEnd = Math.max(clusterEnd, it.start + it.dur);
    const p: Placed = { ...it, lane, lanes: 1 };
    cluster.push(p); out.push(p);
  }
  flush();
  return out;
}

export function CalendarView() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const { tenant, refreshBalance } = usePanel();
  const tz = tenant.timeZone;
  const snap = Math.min(tenant.slotMinutes, 30);
  const today = useMemo(() => utcToLocal(new Date(), tz).date, [tz]);
  const [date, setDate] = useState(today);
  const [view, setView] = useState<"day" | "week">("day");
  const [weekStaffId, setWeekStaffId] = useState<string>("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [create, setCreate] = useState<{ date: string; staffId: string; time: string } | null>(null);
  const [nowMin, setNowMin] = useState(() => utcToLocal(new Date(), tz).minutes);
  const [drag, setDrag] = useState<{ id: string; colIdx: number; start: number } | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNowMin(utcToLocal(new Date(), tz).minutes), 30_000);
    return () => clearInterval(id);
  }, [tz]);

  // statik veri: personel, hizmetler, çalışma saatleri, izinler
  const base = useLoader(async () => {
    const [staffAll, services, timeOff] = await Promise.all([
      api<Staff[]>("/api/panel/staff"), api<Svc[]>("/api/panel/services"), api<TimeOff[]>("/api/panel/time-off"),
    ]);
    const staff = staffAll.filter((s) => s.active);
    const hours = Object.fromEntries(await Promise.all(staff.map(async (s) => [s.id, (await api<{ days: WH[] }>(`/api/panel/staff/${s.id}/working-hours`)).days] as const)));
    return { staff, services: services.filter((s) => s.active), timeOff, hours };
  }, []);
  const staff = base.data?.staff ?? [];
  useEffect(() => { if (!weekStaffId && staff[0]) setWeekStaffId(staff[0].id); }, [staff, weekStaffId]);

  const range = view === "day" ? { from: date, to: date } : { from: mondayOf(date), to: addDays(mondayOf(date), 6) };
  const apptsQ = useLoader(
    () => api<{ appointments: Appt[] }>(`/api/panel/appointments?from=${range.from}&to=${range.to}${view === "week" && weekStaffId ? `&staffId=${weekStaffId}` : ""}`),
    [range.from, range.to, view === "week" ? weekStaffId : ""],
  );
  const appts = useMemo(() => apptsQ.data?.appointments ?? [], [apptsQ.data]);

  const cols: Col[] = useMemo(() => {
    if (view === "day") return staff.map((s) => ({ key: s.id, date, staff: s, label: s.name }));
    const s = staff.find((x) => x.id === weekStaffId);
    if (!s) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(mondayOf(date), i);
      const p = dayParts(d, locale);
      return { key: d, date: d, staff: s, label: p.weekday, sub: `${p.day} ${p.month}` };
    });
  }, [view, staff, date, weekStaffId, locale]);

  const local = useCallback((a: Appt) => {
    const s = utcToLocal(new Date(a.startsAt), tz);
    return { date: s.date, start: s.minutes, dur: Math.round((new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60_000) };
  }, [tz]);

  const visible = useMemo(() => appts.filter((a) => showCancelled || a.status !== "cancelled_by_customer" && a.status !== "cancelled_by_salon"), [appts, showCancelled]);

  // zaman ızgarası aralığı
  const { gridStart, gridEnd } = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (const c of cols) {
      for (const h of base.data?.hours[c.staff.id] ?? []) {
        if (h.weekday !== weekdayOf(c.date)) continue;
        lo = Math.min(lo, h.startMin); hi = Math.max(hi, Math.min(h.endMin, 1440));
      }
    }
    for (const a of visible) { const l = local(a); lo = Math.min(lo, l.start); hi = Math.max(hi, Math.min(l.start + l.dur, 1440)); }
    if (!Number.isFinite(lo)) { lo = 9 * 60; hi = 19 * 60; }
    let s = Math.floor(lo / 60) * 60, e = Math.ceil(hi / 60) * 60;
    if (e - s < 240) e = Math.min(1440, s + 240);
    if (e - s < 240) s = Math.max(0, e - 240);
    return { gridStart: s, gridEnd: e };
  }, [cols, base.data, visible, local]);
  const height = (gridEnd - gridStart) * PPM;

  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragInfo = useRef<{ id: string; x0: number; y0: number; col0: number; start0: number; moved: boolean; colIdx: number; start: number } | null>(null);
  const suppressClick = useRef(false);

  async function commitMove(a: Appt, col: Col, start: number) {
    const before = apptsQ.data;
    const startsAt = zonedToUtc(col.date, start, tz).toISOString();
    const dur = new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime();
    const buf = new Date(a.blockedUntil).getTime() - new Date(a.endsAt).getTime();
    // iyimser güncelleme; hata olursa geri alınır
    apptsQ.setData((d) => d && {
      appointments: d.appointments.map((x) => x.id === a.id
        ? { ...x, staffId: col.staff.id, staff: { name: col.staff.name, color: col.staff.color }, startsAt, endsAt: new Date(new Date(startsAt).getTime() + dur).toISOString(), blockedUntil: new Date(new Date(startsAt).getTime() + dur + buf).toISOString() }
        : x),
    });
    try {
      await api(`/api/panel/appointments/${a.id}`, { method: "PATCH", body: { startsAt, staffId: col.staff.id } });
      toast(t("cal.moved"), "success");
      apptsQ.reload();
    } catch (e) {
      if (before) apptsQ.setData(before);
      toast(errorMessage(e, t), "error");
    }
  }

  function onPointerDown(e: React.PointerEvent, a: Appt, colIdx: number) {
    if (e.pointerType === "touch" || e.button !== 0 || !ACTIVE.includes(a.status)) return;
    const l = local(a);
    dragInfo.current = { id: a.id, x0: e.clientX, y0: e.clientY, col0: colIdx, start0: l.start, moved: false, colIdx, start: l.start };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragInfo.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) return;
    d.moved = true;
    let colIdx = d.colIdx;
    colRefs.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX < r.right) colIdx = i;
    });
    const start = Math.max(0, Math.min(1439, d.start0 + Math.round((e.clientY - d.y0) / PPM / snap) * snap));
    d.colIdx = colIdx; d.start = start;
    setDrag({ id: d.id, colIdx, start });
  }
  function onPointerUp(a: Appt) {
    const d = dragInfo.current;
    dragInfo.current = null;
    if (!d || !d.moved) return;
    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 0);
    setDrag(null);
    const col = cols[d.colIdx];
    if (!col || (d.colIdx === d.col0 && d.start === d.start0)) return;
    void commitMove(a, col, d.start);
  }
  function onPointerCancel() { dragInfo.current = null; setDrag(null); }

  function onColClick(e: React.MouseEvent<HTMLDivElement>, col: Col) {
    const r = e.currentTarget.getBoundingClientRect();
    const m = gridStart + Math.floor((e.clientY - r.top) / PPM / snap) * snap;
    setCreate({ date: col.date, staffId: col.staff.id, time: fmtMin(m) });
  }

  const selected = appts.find((a) => a.id === sel) ?? null;
  const title = view === "day" ? dayParts(date, locale).long : `${dayParts(range.from, locale).day} ${dayParts(range.from, locale).month} – ${dayParts(range.to, locale).day} ${dayParts(range.to, locale).month}`;
  const step = view === "day" ? 1 : 7;
  const count = visible.filter((a) => ACTIVE.includes(a.status)).length;
  const isTodayCol = (c: Col) => c.date === today;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="secondary" className="!px-3" aria-label={t("cal.prev")} onClick={() => setDate(addDays(date, -step))}><span aria-hidden>‹</span></Button>
          <Button variant="secondary" onClick={() => setDate(today)}>{t("cal.today")}</Button>
          <Button variant="secondary" className="!px-3" aria-label={t("cal.next")} onClick={() => setDate(addDays(date, step))}><span aria-hidden>›</span></Button>
        </div>
        <label className="sr-only" htmlFor="cal-date">{t("cal.pickDate")}</label>
        <input id="cal-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-base" />
        <div role="group" aria-label={t("cal.view")} className="inline-flex rounded-xl border border-slate-300 bg-white p-0.5">
          {(["day", "week"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn("min-h-10 rounded-lg px-4 text-sm font-semibold", view === v ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100")}>{t(v === "day" ? "cal.day" : "cal.week")}</button>
          ))}
        </div>
        <Button className="ml-auto" onClick={() => setCreate({ date, staffId: "any", time: "" })}>+ {t("cal.new")}</Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <h2 className="text-xl font-extrabold" aria-live="polite">{title}</h2>
        <span className="text-sm text-slate-600">{t("cal.count", { n: count })}</span>
        {view === "week" && staff.length ? (
          <SelectField label={t("cal.staff")} value={weekStaffId} onChange={(e) => setWeekStaffId(e.target.value)} className="ml-auto w-44">
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectField>
        ) : null}
        <CheckField label={t("cal.showCancelled")} checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} className={view === "week" ? "" : "ml-auto"} />
      </div>

      {base.error || apptsQ.error ? <Alert className="mt-3">{errorMessage(base.error ?? apptsQ.error, t)}</Alert> : null}
      {!base.loading && staff.length === 0 ? (
        <Alert tone="info" className="mt-3">{t("cal.noStaff")} <Link href="/panel/personel" className="font-semibold underline">{t("nav.staff")}</Link></Alert>
      ) : null}

      {cols.length ? (
        <div className={cn("mt-3 max-h-[calc(100dvh-16rem)] min-h-80 overflow-auto rounded-2xl border border-slate-200 bg-white md:max-h-[calc(100dvh-15rem)]", apptsQ.loading && "opacity-70")} data-testid="cal-scroll" tabIndex={0} aria-label={t("cal.grid")}>
          <div style={{ display: "grid", gridTemplateColumns: `${GUTTER}px repeat(${cols.length}, minmax(${MIN_COL}px, 1fr))` }}>
            <div className="sticky left-0 top-0 z-30 border-b border-r border-slate-200 bg-white" />
            {cols.map((c) => (
              <div key={c.key} className="sticky top-0 z-20 border-b border-r border-slate-200 bg-white px-2 py-2 text-center">
                <div className="flex items-center justify-center gap-1.5 text-sm font-bold">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: c.staff.color }} />
                  <span className={cn("min-w-0 truncate", view === "week" && isTodayCol(c) && "text-brand")}>{c.label}</span>
                </div>
                {c.sub ? <div className="text-xs text-slate-600">{c.sub}</div> : null}
              </div>
            ))}
            <div className="sticky left-0 z-20 border-r border-slate-200 bg-white" style={{ height }}>
              {Array.from({ length: Math.ceil((gridEnd - gridStart) / 60) + 1 }, (_, i) => gridStart + i * 60).filter((m) => m < gridEnd + 1).map((m) => (
                <span key={m} className="absolute right-1 -translate-y-1/2 text-[11px] font-medium tabular-nums text-slate-600" style={{ top: (m - gridStart) * PPM + (m === gridStart ? 8 : 0) }}>{fmtMin(m)}</span>
              ))}
            </div>
            {cols.map((c, ci) => {
              const hours = (base.data?.hours[c.staff.id] ?? []).find((h) => h.weekday === weekdayOf(c.date));
              const offs: { a: number; b: number; kind: "off" | "break" | "leave" }[] = [];
              if (!hours) offs.push({ a: gridStart, b: gridEnd, kind: "off" });
              else {
                if (hours.startMin > gridStart) offs.push({ a: gridStart, b: hours.startMin, kind: "off" });
                if (hours.endMin < gridEnd) offs.push({ a: hours.endMin, b: gridEnd, kind: "off" });
                for (const [s, e] of hours.breaks) offs.push({ a: s, b: e, kind: "break" });
              }
              const dayStart = zonedToUtc(c.date, gridStart, tz).getTime();
              const dayEnd = zonedToUtc(c.date, gridEnd, tz).getTime();
              for (const o of base.data?.timeOff ?? []) {
                if (o.staffId !== c.staff.id) continue;
                const s = Math.max(new Date(o.startsAt).getTime(), dayStart), e = Math.min(new Date(o.endsAt).getTime(), dayEnd);
                if (e > s) offs.push({ a: gridStart + (s - dayStart) / 60_000, b: gridStart + (e - dayStart) / 60_000, kind: "leave" });
              }
              const items = place(visible.filter((a) => a.staffId === c.staff.id && local(a).date === c.date).map((a) => ({ a, start: local(a).start, dur: local(a).dur })));
              return (
                <div
                  key={c.key}
                  ref={(el) => { colRefs.current[ci] = el; }}
                  data-testid="cal-col"
                  className="relative cursor-cell border-r border-slate-200"
                  style={{
                    height,
                    backgroundImage: `repeating-linear-gradient(to bottom, #cbd5e1 0, #cbd5e1 1px, transparent 1px, transparent ${60 * PPM}px), repeating-linear-gradient(to bottom, #f1f5f9 0, #f1f5f9 1px, transparent 1px, transparent ${snap * PPM}px)`,
                  }}
                  onClick={(e) => onColClick(e, c)}
                >
                  {offs.map((o, i) => (
                    <div key={i} aria-hidden className={cn("pointer-events-none absolute inset-x-0", o.kind === "off" ? "bg-slate-200/70" : o.kind === "break" ? "bg-slate-200/60" : "bg-amber-100/70")}
                      style={{ top: (o.a - gridStart) * PPM, height: (o.b - o.a) * PPM, backgroundImage: o.kind === "off" ? undefined : "repeating-linear-gradient(135deg, transparent 0 6px, rgb(148 163 184 / .35) 6px 7px)" }} />
                  ))}
                  {items.map((p) => {
                    const dragging = drag?.id === p.a.id;
                    return (
                      <Block key={p.a.id} p={p} color={c.staff.color} gridStart={gridStart} locale={locale} ghost={dragging}
                        onClick={() => { if (!suppressClick.current) setSel(p.a.id); }}
                        onPointerDown={(e) => onPointerDown(e, p.a, ci)} onPointerMove={onPointerMove} onPointerUp={() => onPointerUp(p.a)} onPointerCancel={onPointerCancel} />
                    );
                  })}
                  {drag && drag.colIdx === ci ? (() => {
                    const a = appts.find((x) => x.id === drag.id);
                    if (!a) return null;
                    const dur = local(a).dur;
                    return (
                      <div aria-hidden className="pointer-events-none absolute inset-x-1 z-20 rounded-md border-2 border-brand bg-brand/20 px-1.5 py-0.5 text-xs font-bold text-slate-900" style={{ top: (drag.start - gridStart) * PPM, height: Math.max(dur * PPM, 26) }}>
                        {fmtMin(drag.start)}–{fmtMin(drag.start + dur)}
                      </div>
                    );
                  })() : null}
                  {isTodayCol(c) && nowMin >= gridStart && nowMin <= gridEnd ? (
                    <div aria-hidden data-testid="now-line" className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-red-500" style={{ top: (nowMin - gridStart) * PPM }}>
                      <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-red-500" />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <p className="mt-2 text-xs text-slate-600"><span className="hidden md:inline">{t("cal.dragHint")} </span>{t("cal.legend")}</p>

      <ApptSheet appt={selected} staff={staff} services={base.data?.services ?? []} onClose={() => setSel(null)} onChanged={() => { apptsQ.reload(); refreshBalance(); }} />
      <CreateSheet init={create} staff={staff} services={base.data?.services ?? []} onClose={() => setCreate(null)} onCreated={(d) => { setCreate(null); if (d) setDate(d); apptsQ.reload(); refreshBalance(); }} />
    </div>
  );
}

function Block({ p, color, gridStart, locale, ghost, onClick, ...ptr }: {
  p: Placed; color: string; gridStart: number; locale: "tr" | "en"; ghost: boolean; onClick: () => void;
} & Pick<React.ButtonHTMLAttributes<HTMLButtonElement>, "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel">) {
  const { t } = useI18n();
  const { a } = p;
  const cancelled = a.status === "cancelled_by_customer" || a.status === "cancelled_by_salon";
  const w = 100 / p.lanes;
  const h = Math.max(p.dur * PPM - 2, 24);
  const label = `${fmtMin(p.start)}–${fmtMin(p.start + p.dur)} ${a.customer.name}, ${svcName(a.service, locale)}, ${a.staff.name}, ${t(`st.${a.status}` as Key)}`;
  return (
    <button
      type="button"
      data-testid="appt-block"
      data-status={a.status}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      {...ptr}
      className={cn(
        "absolute z-10 overflow-hidden rounded-md border border-l-4 px-1.5 py-0.5 text-left text-xs leading-tight text-slate-900 shadow-sm transition-opacity md:cursor-grab md:active:cursor-grabbing",
        a.status === "pending" && "border-dashed",
        a.status === "completed" && "opacity-70",
        a.status === "no_show" && "border-red-500 text-red-900",
        cancelled && "opacity-45 line-through",
        ghost && "opacity-30",
      )}
      style={{
        top: (p.start - gridStart) * PPM + 1, height: h, left: `calc(${p.lane * w}% + 2px)`, width: `calc(${w}% - 4px)`,
        borderColor: a.status === "no_show" ? undefined : color, borderLeftColor: color,
        backgroundColor: `${color}26`,
        backgroundImage: a.status === "no_show" ? "repeating-linear-gradient(135deg, transparent 0 5px, rgb(239 68 68 / .22) 5px 7px)" : undefined,
        touchAction: "manipulation",
      }}
    >
      <span className="block truncate font-bold">
        {a.status === "completed" ? "✓ " : a.status === "no_show" ? "✗ " : a.status === "pending" ? "? " : ""}{fmtMin(p.start)} {a.customer.name}
      </span>
      {h >= 40 ? <span className="block truncate text-slate-700">{svcName(a.service, locale)}</span> : null}
      {h >= 58 ? <span className="block truncate text-[11px] font-medium text-slate-600">{t(`st.${a.status}` as Key)}</span> : null}
    </button>
  );
}

/* ───────────── Randevu ayrıntı sayfası ───────────── */

const ACTIONS: Record<ApptStatus, { to: "confirmed" | "completed" | "no_show" | "cancelled_by_salon"; key: Key; variant: "primary" | "secondary" | "danger" }[]> = {
  pending: [{ to: "confirmed", key: "act.confirm", variant: "primary" }, { to: "cancelled_by_salon", key: "act.cancel", variant: "danger" }],
  confirmed: [{ to: "completed", key: "act.complete", variant: "primary" }, { to: "no_show", key: "act.noShow", variant: "secondary" }, { to: "cancelled_by_salon", key: "act.cancel", variant: "danger" }],
  completed: [{ to: "confirmed", key: "act.reopen", variant: "secondary" }],
  no_show: [{ to: "confirmed", key: "act.reopen", variant: "secondary" }],
  cancelled_by_salon: [{ to: "confirmed", key: "act.reopen", variant: "secondary" }],
  cancelled_by_customer: [],
};

function ApptSheet({ appt, staff, services, onClose, onChanged }: { appt: Appt | null; staff: Staff[]; services: Svc[]; onClose: () => void; onChanged: () => void }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const { tenant, role } = usePanel();
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mDate, setMDate] = useState("");
  const [mTime, setMTime] = useState("");
  const [mStaff, setMStaff] = useState("");
  const id = appt?.id;
  useEffect(() => { setMoving(false); setErr(null); }, [id]);

  const cur = useMemo(() => {
    if (!appt) return null;
    const l = utcToLocal(new Date(appt.startsAt), tenant.timeZone);
    return { date: l.date, time: fmtMin(l.minutes), end: fmtMin(utcToLocal(new Date(appt.endsAt), tenant.timeZone).minutes) };
  }, [appt, tenant.timeZone]);

  async function setStatus(to: "confirmed" | "completed" | "no_show" | "cancelled_by_salon") {
    if (!appt) return;
    setBusy(true); setErr(null);
    try {
      await api(`/api/panel/appointments/${appt.id}/status`, { method: "POST", body: { status: to } });
      toast(t("act.updated"), "success");
      setConfirmCancel(false);
      onChanged();
      if (to !== "confirmed") onClose();
    } catch (e) { setErr(errorMessage(e, t)); setConfirmCancel(false); } finally { setBusy(false); }
  }

  async function move() {
    if (!appt) return;
    const m = parseHM(mTime);
    if (!mDate || m === null) { setErr(t("err.validation")); return; }
    setBusy(true); setErr(null);
    try {
      await api(`/api/panel/appointments/${appt.id}`, { method: "PATCH", body: { startsAt: zonedToUtc(mDate, m, tenant.timeZone).toISOString(), staffId: mStaff || undefined } });
      toast(t("cal.moved"), "success");
      setMoving(false);
      onChanged();
      onClose();
    } catch (e) { setErr(errorMessage(e, t)); } finally { setBusy(false); }
  }

  if (!appt || !cur) return null;
  const svc = services.find((s) => s.id === appt.serviceId);
  const stf = svc ? staff.filter((s) => svc.staffIds.includes(s.id)) : staff;
  return (
    <>
      <Sheet open onClose={onClose} title={t("appt.title")}>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(appt.status)}>{t(`st.${appt.status}` as Key)}</Badge>
            <Badge>{t(`src.${appt.source}` as Key)}</Badge>
            {appt.customer.noShowCount > 0 ? <Badge tone="red">{t("cust.noShows", { n: appt.customer.noShowCount })}</Badge> : null}
          </div>
          <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-slate-600">{t("appt.customer")}</dt>
            <dd className="font-semibold">{role === "owner" ? <Link className="underline" href={`/panel/musteriler?id=${appt.customer.id}`}>{appt.customer.name}</Link> : appt.customer.name}</dd>
            <dt className="text-slate-600">{t("appt.phone")}</dt>
            <dd><a className="font-semibold text-brand underline" href={`tel:${appt.customer.phone}`}>{appt.customer.phone}</a></dd>
            <dt className="text-slate-600">{t("appt.service")}</dt>
            <dd className="font-semibold">{svcName(appt.service, locale)} · {money(appt.priceTry, locale)}</dd>
            <dt className="text-slate-600">{t("appt.staff")}</dt>
            <dd className="font-semibold">{appt.staff.name}</dd>
            <dt className="text-slate-600">{t("appt.when")}</dt>
            <dd className="font-semibold">{dayParts(cur.date, locale).long}, {cur.time}–{cur.end}</dd>
            {appt.note ? (<><dt className="text-slate-600">{t("appt.note")}</dt><dd>{appt.note}</dd></>) : null}
          </dl>
          {err ? <Alert>{err}</Alert> : null}
          {!moving ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {ACTIONS[appt.status].map((a) => (
                <Button key={a.to + a.key} variant={a.variant} disabled={busy} onClick={() => (a.to === "cancelled_by_salon" ? setConfirmCancel(true) : setStatus(a.to))}>{t(a.key)}</Button>
              ))}
              {ACTIVE.includes(appt.status) ? <Button variant="secondary" onClick={() => { setMoving(true); setMDate(cur.date); setMTime(cur.time); setMStaff(appt.staffId); }}>{t("act.move")}</Button> : null}
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <h3 className="font-bold">{t("act.move")}</h3>
              <Field label={t("cal.pickDate")} type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} />
              <Field label={t("appt.time")} type="time" step={tenant.slotMinutes * 60} value={mTime} onChange={(e) => setMTime(e.target.value)} />
              <SelectField label={t("appt.staff")} value={mStaff} onChange={(e) => setMStaff(e.target.value)}>
                {stf.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </SelectField>
              <div className="flex gap-2">
                <Button onClick={move} disabled={busy}>{t("common.save")}</Button>
                <Button variant="secondary" onClick={() => setMoving(false)}>{t("common.cancel")}</Button>
              </div>
            </div>
          )}
        </div>
      </Sheet>
      <ConfirmDialog open={confirmCancel} title={t("act.cancelTitle")} body={t("act.cancelBody", { name: appt.customer.name })} confirmLabel={t("act.cancel")} busy={busy} onConfirm={() => setStatus("cancelled_by_salon")} onCancel={() => setConfirmCancel(false)} />
    </>
  );
}

/* ───────────── Yeni randevu ───────────── */

function CreateSheet({ init, staff, services, onClose, onCreated }: { init: { date: string; staffId: string; time: string } | null; staff: Staff[]; services: Svc[]; onClose: () => void; onCreated: (date?: string) => void }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const { tenant } = usePanel();
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("any");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [walkIn, setWalkIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [phoneErr, setPhoneErr] = useState<string | null>(null);

  useEffect(() => {
    if (!init) return;
    setServiceId(services[0]?.id ?? ""); setStaffId(init.staffId); setDate(init.date); setTime(init.time);
    setName(""); setPhone(""); setNote(""); setWalkIn(false); setErr(null); setPhoneErr(null);
  }, [init, services]);

  const svc = services.find((s) => s.id === serviceId);
  const staffOpts = svc ? staff.filter((s) => svc.staffIds.includes(s.id)) : staff;
  useEffect(() => { if (staffId !== "any" && !staffOpts.some((s) => s.id === staffId)) setStaffId("any"); }, [staffOpts, staffId]);

  function toggleWalkIn(v: boolean) {
    setWalkIn(v);
    if (v) {
      const now = utcToLocal(new Date(), tenant.timeZone);
      setDate(now.date); setTime(fmtMin(Math.ceil(now.minutes / 5) * 5));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const m = parseHM(time);
    if (!serviceId || !date || m === null || name.trim().length < 2) { setErr(t("err.validation")); return; }
    setBusy(true); setErr(null); setPhoneErr(null);
    try {
      await api("/api/panel/appointments", {
        method: "POST",
        body: { serviceId, staffId, startsAt: zonedToUtc(date, m, tenant.timeZone).toISOString(), source: walkIn ? "walk_in" : "panel", note: note.trim() || undefined, customer: { name: name.trim(), phone: phone.trim() } },
      });
      toast(t("cal.created"), "success");
      onCreated(date);
    } catch (e2) {
      if (e2 instanceof ApiError && (e2.code === "invalid_phone" || e2.extra.fieldErrors?.customer)) setPhoneErr(t("err.invalid_phone"));
      else setErr(errorMessage(e2, t));
    } finally { setBusy(false); }
  }

  return (
    <Sheet open={!!init} onClose={onClose} title={t("cal.new")}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        {err ? <Alert>{err}</Alert> : null}
        {services.length === 0 ? <Alert tone="info">{t("cal.noServices")} <Link href="/panel/hizmetler" className="font-semibold underline">{t("nav.services")}</Link></Alert> : null}
        <SelectField label={t("appt.service")} value={serviceId} onChange={(e) => setServiceId(e.target.value)} required>
          {services.map((s) => <option key={s.id} value={s.id}>{svcName(s, locale)} · {t("common.minutes", { n: s.durationMin })} · {money(s.priceTry, locale)}</option>)}
        </SelectField>
        <SelectField label={t("appt.staff")} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
          <option value="any">{t("appt.anyStaff")}</option>
          {staffOpts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </SelectField>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("cal.pickDate")} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <Field label={t("appt.time")} type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} required />
        </div>
        <CheckField label={t("appt.walkIn")} checked={walkIn} onChange={(e) => toggleWalkIn(e.target.checked)} />
        <Field label={t("appt.customer")} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" required />
        <Field label={t("appt.phone")} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 533 …" error={phoneErr} autoComplete="off" required />
        <TextareaField label={t("appt.note")} optional={t("common.optional")} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="[&_textarea]:min-h-16" />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" disabled={busy || services.length === 0}>{t("cal.create")}</Button>
        </div>
      </form>
    </Sheet>
  );
}
