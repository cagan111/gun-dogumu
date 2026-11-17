import { cn } from "@/lib/cn";

/** Ayna Saati ikon seti: 24×24, 1.75 çizgi, yuvarlak uç, currentColor. Dekoratif; anlam için yanında etiket olmalı. */
const P: Record<string, React.ReactNode> = {
  scissors: <><circle cx="6" cy="6.5" r="2.6" /><circle cx="6" cy="17.5" r="2.6" /><path d="M8.2 8 20 17M8.2 16 20 7" /></>,
  comb: <><rect x="3" y="6" width="18" height="6" rx="1.5" /><path d="M6 12v6M9.5 12v6M13 12v6M16.5 12v6" /></>,
  razor: <><path d="M4 15 15 4l5 5L9 20z" /><path d="m12 7 5 5" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.2 2" /></>,
  message: <><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5z" /></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></>,
  user: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-4 3.5-5.5 7-5.5s6.2 1.5 7 5.5" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  pause: <path d="M8 5v14M16 5v14" />,
  play: <path d="M8 5.5v13l11-6.5z" />,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.3 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.3-3.5-8.5s1-6 3.5-8.5z" /></>,
  chart: <><path d="M4 20V4M4 20h16" /><path d="M8 16v-4M12 16V8M16 16v-6" /></>,
};
export type IconName = keyof typeof P;
export const ICON_NAMES = Object.keys(P) as IconName[];

export function Icon({ name, className, size = 24 }: { name: IconName; className?: string; size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={cn("shrink-0", className)}>
      {P[name]}
    </svg>
  );
}
