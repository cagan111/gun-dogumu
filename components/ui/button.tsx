import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-brand-fg hover:opacity-90 active:opacity-80",
  secondary: "border border-line bg-white text-slate-900 hover:bg-paper",
  ghost: "text-slate-700 hover:bg-slate-100",
  danger: "bg-red-700 text-white hover:bg-red-800",
};

export function buttonClass(variant: Variant = "primary", className?: string) {
  return cn(base, variants[variant], className);
}

export function Button({
  variant = "primary", className, type = "button", ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}
