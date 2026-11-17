import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icons";

/** Bölüm üstbaşlığı (eyebrow). */
export function Eyebrow({ children, tone = "clay", className }: { children: React.ReactNode; tone?: "clay" | "brass" | "sea"; className?: string }) {
  const c = { clay: "text-clay", brass: "text-brass-bright", sea: "text-sea" }[tone];
  return <p className={cn("eyebrow", c, className)}>{children}</p>;
}

type ChipTone = "ok" | "warn" | "danger" | "info" | "neutral";
const CHIP: Record<ChipTone, string> = {
  ok: "bg-ok-bg text-ok", warn: "bg-warn-bg text-warn", danger: "bg-danger-bg text-danger", info: "bg-info-bg text-info", neutral: "bg-sand text-ink-soft",
};
const CHIP_ICON: Record<ChipTone, IconName> = { ok: "check", warn: "clock", danger: "x", info: "bell", neutral: "calendar" };

/** Durum çipi: renk + ikon + yazı. "warn" (bekliyor) solunda berber çizgisi taşır. */
export function Chip({ tone = "neutral", children, icon = true, className }: { tone?: ChipTone; children: React.ReactNode; icon?: boolean; className?: string }) {
  return (
    <span className={cn("relative inline-flex h-7 items-center gap-1.5 overflow-hidden rounded-md px-2.5 text-[13px] font-semibold", tone === "warn" && "pl-4", CHIP[tone], className)}>
      {tone === "warn" ? <span aria-hidden className="pole absolute inset-y-0 left-0 w-1.5" /> : null}
      {icon ? <Icon name={CHIP_ICON[tone]} size={14} /> : null}
      {children}
    </span>
  );
}

/** Yüzey kartı; `arch` üstü kemerli (görsel/saat/mühür için). */
export function Surface({ children, className, arch, as: As = "div" }: { children: React.ReactNode; className?: string; arch?: boolean; as?: "div" | "section" | "article" }) {
  return <As className={cn("border border-line bg-bone shadow-card", arch ? "arch p-6 pt-10" : "rounded-2xl p-5 md:p-6", className)}>{children}</As>;
}

/** Boş durum: küçük kemer içinde ikon, insan sesiyle başlık, tek eylem. */
export function EmptyState({ icon = "scissors", title, body, action }: { icon?: IconName; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-10 text-center">
      <span className="arch grid h-20 w-16 place-items-center border border-line-strong bg-sand/60 pt-3 text-sea"><Icon name={icon} size={28} /></span>
      <h3 className="font-display mt-5 text-display-md">{title}</h3>
      {body ? <p className="mt-2 text-ink-soft">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Onay mührü. `play` doğruysa 600 ms'lik mühür animasyonu oynar (reduced-motion'da animasyonsuz son hal). */
export function Stamp({ top, bottom, play = true, className }: { top: string; bottom: string; play?: boolean; className?: string }) {
  return (
    <span className={cn("stamp", className)} data-play={play ? "true" : "false"} role="img" aria-label={`${top} ${bottom}`}>
      <span aria-hidden><span className="block text-[11px] uppercase tracking-[.14em]">{top}</span><span className="block text-[15px]">{bottom}</span></span>
    </span>
  );
}
