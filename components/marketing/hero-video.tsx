"use client";
import { useEffect, useRef, useState } from "react";
import type { HeroVideo as Cfg } from "@/config/hero";

/**
 * Tam yüzey hero videosu. Poster her zaman altta; video yalnızca oynamaya başlayınca belirir.
 * prefers-reduced-motion ve Save-Data (veya yavaş bağlantı) durumunda video hiç oynatılmaz, yalnız poster görünür.
 */
export function HeroVideo({ cfg }: { cfg: Cfg }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const slow = !!conn?.saveData || conn?.effectiveType === "slow-2g" || conn?.effectiveType === "2g";
    const ok = !mq.matches && !slow;
    setAllowed(ok);
    const v = ref.current;
    if (!v) return;
    if (!ok) { v.pause(); return; }
    v.play().catch(() => setOn(false));
  }, []);

  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden bg-ink-deep">
      <img src={cfg.poster} alt="" className="h-full w-full object-cover" decoding="async" fetchPriority="high" />
      {allowed ? (
        <video
          ref={ref}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${on ? "opacity-100" : "opacity-0"}`}
          autoPlay muted loop playsInline preload="metadata" poster={cfg.poster}
          onPlaying={() => setOn(true)}
        >
          {cfg.srcMobile ? <source src={cfg.srcMobile} type="video/mp4" media="(max-width: 767px)" /> : null}
          <source src={cfg.src} type="video/mp4" />
        </video>
      ) : null}
    </div>
  );
}
