import { useId } from "react";
import { cn } from "@/lib/cn";
import { inputClass } from "@/components/ui/field";

function Label({ id, label, optional }: { id: string; label: string; optional?: string }) {
  return (
    <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between text-sm font-semibold text-ink">
      <span>{label}</span>
      {optional ? <span className="text-xs font-normal text-mute">{optional}</span> : null}
    </label>
  );
}

function Msgs({ id, hint, error }: { id: string; hint?: string; error?: string | null }) {
  return (
    <>
      {hint ? <p id={`${id}-h`} className="mt-1 text-[13px] text-mute">{hint}</p> : null}
      {error ? <p id={`${id}-e`} role="alert" className="mt-1 text-sm font-medium text-danger">{error}</p> : null}
    </>
  );
}

const desc = (id: string, hint?: string, error?: string | null) => [hint ? `${id}-h` : "", error ? `${id}-e` : ""].filter(Boolean).join(" ") || undefined;

export function SelectField({ label, hint, error, optional, className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; error?: string | null; optional?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <Label id={id} label={label} optional={optional} />
      <select id={id} className={inputClass} aria-invalid={error ? true : undefined} aria-describedby={desc(id, hint, error)} {...props}>{children}</select>
      <Msgs id={id} hint={hint} error={error} />
    </div>
  );
}

export function TextareaField({ label, hint, error, optional, className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; error?: string | null; optional?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <Label id={id} label={label} optional={optional} />
      <textarea id={id} className={cn(inputClass, "min-h-24")} aria-invalid={error ? true : undefined} aria-describedby={desc(id, hint, error)} {...props} />
      <Msgs id={id} hint={hint} error={error} />
    </div>
  );
}

export function CheckField({ label, hint, className, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink">
        <input id={id} type="checkbox" className="h-5 w-5 shrink-0 rounded-md border-line-strong accent-[rgb(var(--brand))]" aria-describedby={hint ? `${id}-h` : undefined} {...props} />
        <span>{label}</span>
      </label>
      {hint ? <p id={`${id}-h`} className="ml-8 text-[13px] text-mute">{hint}</p> : null}
    </div>
  );
}

export function Card({ children, className, as: As = "section", ...props }: React.HTMLAttributes<HTMLElement> & { as?: "section" | "div" | "article" }) {
  return <As className={cn("rounded-2xl border border-line bg-bone p-4 shadow-card", className)} {...props}>{children}</As>;
}

type Tone = "slate" | "green" | "amber" | "red" | "sky" | "violet";
const TONES: Record<Tone, string> = {
  slate: "bg-sand text-ink-soft", green: "bg-ok-bg text-ok", amber: "bg-warn-bg text-warn",
  red: "bg-danger-bg text-danger", sky: "bg-info-bg text-info", violet: "bg-[#F0E4EC] text-plum",
};
export function Badge({ tone = "slate", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold", TONES[tone], className)}>{children}</span>;
}

export const selectClass = inputClass;
