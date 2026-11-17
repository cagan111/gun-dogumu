import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "inverse";
const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-base font-semibold transition-[background-color,box-shadow,transform,filter] duration-150 ease-soft active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-brand-fg shadow-[inset_0_1px_0_rgb(255_255_255/.18),0_1px_2px_rgb(16_38_42/.18)] hover:brightness-110 active:shadow-inset-press",
  secondary: "border border-line-strong bg-bone text-ink shadow-card hover:bg-sand active:shadow-inset-press",
  ghost: "text-ink-soft hover:bg-sand/60",
  danger: "bg-danger text-white shadow-[inset_0_1px_0_rgb(255_255_255/.15)] hover:brightness-110 active:shadow-inset-press",
  inverse: "bg-brass-bright text-ink shadow-[inset_0_1px_0_rgb(255_255_255/.35)] hover:brightness-105 active:shadow-inset-press",
};

export function buttonClass(variant: Variant = "primary", className?: string) {
  return cn(base, variants[variant], className);
}

export function Button({
  variant = "primary", className, type = "button", ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}
