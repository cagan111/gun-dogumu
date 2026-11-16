import { useId } from "react";
import { cn } from "@/lib/cn";

export const inputClass =
  "block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-base text-slate-900 placeholder:text-slate-400 aria-[invalid=true]:border-red-600";

/** Etiketli giriş alanı; hata/ipucu aria-describedby ile bağlanır. */
export function Field({
  label, hint, error, optional, className, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | null; optional?: string }) {
  const id = useId();
  const describedBy = [hint ? `${id}-h` : "", error ? `${id}-e` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-slate-800">
        <span>{label}</span>
        {optional ? <span className="text-xs font-normal text-slate-500">{optional}</span> : null}
      </label>
      <input id={id} className={inputClass} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...props} />
      {hint ? <p id={`${id}-h`} className="mt-1 text-xs text-slate-600">{hint}</p> : null}
      {error ? <p id={`${id}-e`} role="alert" className="mt-1 text-sm font-medium text-red-700">{error}</p> : null}
    </div>
  );
}

export function Alert({ tone = "error", children, className }: { tone?: "error" | "info" | "success"; children: React.ReactNode; className?: string }) {
  const tones = {
    error: "border-red-200 bg-red-50 text-red-900",
    info: "border-sky-200 bg-sky-50 text-sky-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone], className)}>
      {children}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent", className)} />
  );
}
