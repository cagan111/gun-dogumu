"use client";
import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Modal: mobilde alttan açılan sayfa, masaüstünde ortada kutu. Esc ile kapanır, odak kutuda tutulur ve
 * kapanınca önceki öğeye döner.
 */
export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const first = root?.querySelector<HTMLElement>("[data-autofocus]") ?? root?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== "Tab" || !root) return;
      const els = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!els.length) return;
      const a = els[0]!, b = els[els.length - 1]!;
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); }
      else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn("relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl md:rounded-2xl", wide ? "md:max-w-2xl" : "md:max-w-md")}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <h2 id={titleId} className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-2xl leading-none text-slate-600 hover:bg-slate-100">
            <span aria-hidden>×</span>
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4 pb-safe">{children}</div>
      </div>
    </div>
  );
}

/** Yıkıcı işlemler için onay penceresi. */
export function ConfirmDialog({ open, title, body, confirmLabel, busy, onConfirm, onCancel, danger = true }: {
  open: boolean; title: string; body?: string; confirmLabel: string; busy?: boolean; onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      {body ? <p className="text-slate-700">{body}</p> : null}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} data-autofocus>{t("common.cancel")}</Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={busy}>{confirmLabel}</Button>
      </div>
    </Sheet>
  );
}
