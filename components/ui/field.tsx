import { useId } from "react";
import { cn } from "@/lib/cn";

export const inputClass =
  "block min-h-11 w-full rounded-lg border border-line-strong bg-bone px-3.5 py-2 text-base text-ink shadow-[inset_0_1px_2px_rgb(16_38_42/.06)] transition-[border-color,box-shadow] duration-150 placeholder:text-mute/70 focus:border-brand focus:shadow-[0_0_0_3px_rgb(var(--brand)/.2)] aria-[invalid=true]:border-danger";

/** Etiketli giriş alanı; hata/ipucu aria-describedby ile bağlanır. */
export function Field({
  label, hint, error, optional, className, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | null; optional?: string }) {
  const id = useId();
  const describedBy = [hint ? `${id}-h` : "", error ? `${id}-e` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between text-sm font-semibold text-ink">
        <span>{label}</span>
        {optional ? <span className="text-xs font-normal text-mute">{optional}</span> : null}
      </label>
      <input id={id} className={inputClass} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...props} />
      {hint ? <p id={`${id}-h`} className="mt-1 text-[13px] text-mute">{hint}</p> : null}
      {error ? <p id={`${id}-e`} role="alert" className="mt-1 text-sm font-medium text-danger">{error}</p> : null}
    </div>
  );
}

export function Alert({ tone = "error", children, className }: { tone?: "error" | "info" | "success"; children: React.ReactNode; className?: string }) {
  const tones = {
    error: "border-danger/25 bg-danger-bg text-danger",
    info: "border-info/25 bg-info-bg text-info",
    success: "border-ok/25 bg-ok-bg text-ok",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-sm font-medium", tones[tone], className)}>
      {children}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent", className)} />
  );
}
