"use client";
import { useEffect, useRef, useState } from "react";
import { Stamp } from "@/components/ui/kit";

/** Görünür olunca mührü basar (imza etkileşim). Reduced-motion'da animasyonsuz son hal. */
export function ViewStamp({ top, bottom, className }: { top: string; bottom: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [play, setPlay] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setPlay(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setPlay(true); io.disconnect(); } }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <span ref={ref} className={play ? "" : "opacity-0"}>
      <Stamp top={top} bottom={bottom} play={play} className={className} />
    </span>
  );
}
