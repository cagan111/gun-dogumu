import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-brand-fg shadow-[inset_0_1px_0_rgb(255_255_255/.22),0_1px_2px_rgb(0_0_0/.5)] hover:brightness-110 active:brightness-95",
  secondary: "border border-white/15 bg-white/[.04] text-slate-900 hover:border-white/30 hover:bg-white/[.08]",
  ghost: "text-slate-700 hover:bg-white/[.06]",
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
