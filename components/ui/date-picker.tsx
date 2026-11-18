"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/client";
import { addDays, parseDate, weekdayOf } from "@/lib/time";

/**
 * Uygulama diline göre biçimlenen tarih / ay seçici (tarayıcı yerel ayarından bağımsız).
 * Değer biçimi: mode="date" → YYYY-MM-DD, mode="month" → YYYY-MM.
 */
const pad = (n: number) => String(n).padStart(2, "0");
const tag = (l: string) => (l === "tr" ? "tr-TR" : "en-GB");
const utc = (y: number, m: number, d = 1) => new Date(Date.UTC(y, m - 1, d, 12));
const fmt = (l: string, o: Intl.DateTimeFormatOptions, d: Date) => new Intl.DateTimeFormat(tag(l), { ...o, timeZone: "UTC" }).format(d);
const mondayStart = (date: string) => addDays(date, -((weekdayOf(date) + 6) % 7));

export function DatePicker({ label, value, onChange, mode = "date", hideLabel, className, required }: {
  label: string; value: string; onChange: (v: string) => void; mode?: "date" | "month"; hideLabel?: boolean; className?: string; required?: boolean;
}) {
  const { t, locale } = useI18n();
  const id = useId();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const valid = mode === "date" ? /^\d{4}-\d{2}-\d{2}$/.test(value) : /^\d{4}-\d{2}$/.test(value);
  const nowY = new Date().getUTCFullYear(), nowM = new Date().getUTCMonth() + 1;
  const vy = valid ? Number(value.slice(0, 4)) : nowY;
  const vm = valid ? Number(value.slice(5, 7)) : nowM;
  const [view, setView] = useState({ y: vy, m: vm });
  const [focus, setFocus] = useState(valid && mode === "date" ? value : `${vy}-${pad(vm)}-01`);
  const kb = useRef(false);

  const shown = !valid ? "" : mode === "date"
    ? fmt(locale, { day: "2-digit", month: "2-digit", year: "numeric" }, utc(vy, vm, parseDate(value).d))
    : fmt(locale, { month: "long", year: "numeric" }, utc(vy, vm));

  function show() {
    kb.current = false;
    setView({ y: vy, m: vm });
    setFocus(valid && mode === "date" ? value : `${vy}-${pad(vm)}-01`);
    setOpen(true);
  }
  function close(refocus = true) { setOpen(false); if (refocus) btnRef.current?.focus(); }

  useEffect(() => {
    if (!open) return;
    popRef.current?.querySelector<HTMLElement>("[data-sel='1']")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  // klavye ile odak değişince yeni odak düğmesine geç
  useEffect(() => {
    if (open && kb.current) popRef.current?.querySelector<HTMLElement>("[data-sel='1']")?.focus();
  }, [open, focus, view]);

  const shiftMonth = (n: number) => { const x = view.y * 12 + (view.m - 1) + n; setView({ y: Math.floor(x / 12), m: (x % 12) + 1 }); };
  const monthNames = useMemo(() => Array.from({ length: 12 }, (_, i) => fmt(locale, { month: "short" }, utc(2024, i + 1))), [locale]);
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => fmt(locale, { weekday: "short" }, utc(2024, 1, 1 + i))), [locale]); // 1 Ocak 2024 = Pazartesi

  const first = `${view.y}-${pad(view.m)}-01`;
  const start = mondayStart(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  function onGridKey(e: React.KeyboardEvent) {
    const d: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next: string | null = null;
    if (e.key in d) next = addDays(focus, d[e.key]!);
    else if (e.key === "Home") next = addDays(focus, -((weekdayOf(focus) + 6) % 7));
    else if (e.key === "End") next = addDays(focus, 6 - ((weekdayOf(focus) + 6) % 7));
    else if (e.key === "PageUp" || e.key === "PageDown") {
      const p = parseDate(focus); const x = p.y * 12 + (p.m - 1) + (e.key === "PageUp" ? -1 : 1);
      const y = Math.floor(x / 12), m = (x % 12) + 1;
      next = `${y}-${pad(m)}-${pad(Math.min(p.d, new Date(Date.UTC(y, m, 0)).getUTCDate()))}`;
    }
    if (!next) return;
    e.preventDefault(); kb.current = true;
    const p = parseDate(next);
    setFocus(next); setView({ y: p.y, m: p.m });
  }
  function onMonthKey(e: React.KeyboardEvent, m: number) {
    const d: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 };
    if (!(e.key in d)) return;
    e.preventDefault(); kb.current = true;
    const n = Math.min(12, Math.max(1, m + d[e.key]!));
    setFocus(`${view.y}-${pad(n)}-01`);
  }

  const nav = "grid h-10 w-10 place-items-center rounded-lg text-lg text-olive hover:bg-sand";
  const heading = mode === "date" ? fmt(locale, { month: "long", year: "numeric" }, utc(view.y, view.m)) : String(view.y);
  return (
    <div className={className}>
      <span id={`${id}-l`} className={hideLabel ? "sr-only" : "mb-1.5 block text-sm font-medium text-slate-800"}>{label}</span>
      <div className="relative">
        <button ref={btnRef} type="button" aria-haspopup="dialog" aria-expanded={open} aria-labelledby={`${id}-l ${id}-b`} aria-required={required || undefined}
          onClick={() => (open ? close(false) : show())}
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-left text-base text-slate-900">
          <span id={`${id}-b`} className="tabular-nums">{shown || "—"}</span>
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-olive" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16v14H4zM4 10h16M8 3v5m8-5v5" /></svg>
        </button>
        {open ? (
          <>
            <div className="fixed inset-0 z-[60] bg-slate-900/40 md:bg-transparent" onClick={() => close()} aria-hidden />
            <div ref={popRef} role="dialog" aria-label={label}
              className="fixed inset-x-0 bottom-0 z-[61] rounded-t-2xl border border-line bg-white p-3 pb-6 shadow-xl md:absolute md:inset-x-auto md:bottom-auto md:left-0 md:top-full md:mt-1 md:w-72 md:rounded-xl md:pb-3">
              <div className="mb-2 flex items-center justify-between">
                <button type="button" className={nav} aria-label={t(mode === "date" ? "pick.prevMonth" : "pick.prevYear")} onClick={() => (mode === "date" ? shiftMonth(-1) : setView({ ...view, y: view.y - 1 }))}><span aria-hidden>‹</span></button>
                <div className="display-heading text-lg font-semibold" aria-live="polite">{heading}</div>
                <button type="button" className={nav} aria-label={t(mode === "date" ? "pick.nextMonth" : "pick.nextYear")} onClick={() => (mode === "date" ? shiftMonth(1) : setView({ ...view, y: view.y + 1 }))}><span aria-hidden>›</span></button>
              </div>
              {mode === "date" ? (
                <div role="grid" aria-label={heading} onKeyDown={onGridKey}>
                  <div role="row" className="grid grid-cols-7 text-center text-xs font-semibold text-slate-600">
                    {weekdays.map((w) => <span key={w} role="columnheader" className="py-1">{w}</span>)}
                  </div>
                  {Array.from({ length: 6 }, (_, r) => (
                    <div role="row" key={r} className="grid grid-cols-7">
                      {cells.slice(r * 7, r * 7 + 7).map((c) => {
                        const p = parseDate(c); const inMonth = p.m === view.m; const sel = c === value; const isF = c === focus;
                        return (
                          <button key={c} type="button" role="gridcell" tabIndex={isF ? 0 : -1} data-sel={isF ? "1" : undefined} aria-selected={sel} aria-current={c === today ? "date" : undefined}
                            aria-label={fmt(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }, utc(p.y, p.m, p.d))}
                            onClick={() => { onChange(c); close(); }}
                            className={cn("m-0.5 grid h-10 place-items-center rounded-lg text-sm tabular-nums", sel ? "bg-olive font-bold text-white" : inMonth ? "text-slate-900 hover:bg-sand" : "text-slate-400 hover:bg-sand", c === today && !sel && "ring-1 ring-olive")}>
                            {p.d}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div role="group" aria-label={String(view.y)} className="grid grid-cols-3 gap-1">
                  {monthNames.map((n, i) => {
                    const m = i + 1; const sel = value === `${view.y}-${pad(m)}`;
                    const fy = Number(focus.slice(0, 4)), fm = Number(focus.slice(5, 7));
                    const isF = fy === view.y ? fm === m : m === 1;
                    return (
                      <button key={m} type="button" tabIndex={isF ? 0 : -1} data-sel={isF ? "1" : undefined} aria-pressed={sel}
                        aria-label={fmt(locale, { month: "long", year: "numeric" }, utc(view.y, m))}
                        onKeyDown={(e) => onMonthKey(e, m)}
                        onClick={() => { onChange(`${view.y}-${pad(m)}`); close(); }}
                        className={cn("min-h-11 rounded-lg text-sm font-medium", sel ? "bg-olive text-white" : "text-slate-900 hover:bg-sand")}>
                        {n}
                      </button>
                    );
                  })}
                </div>
              )}
              {mode === "date" ? (
                <div className="mt-2 flex justify-end">
                  <button type="button" className="min-h-10 rounded-lg px-3 text-sm font-semibold text-olive hover:bg-sand" onClick={() => { onChange(today); close(); }}>{t("pick.today")}</button>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
