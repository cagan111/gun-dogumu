"use client";
import { useEffect, useRef, useState } from "react";
import { HERO_MEDIA, heroMotionAllowed } from "@/config/hero";
interface DataConnection extends EventTarget { saveData?: boolean }
/** Dekoratif medya: SSR ve veri/hareket tercihlerinde yalnız poster, MP4 isteği yok. */
export function HeroMedia() {
  const [allowed, setAllowed] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: DataConnection }).connection;
    const sync = () => setAllowed(heroMotionAllowed(motion.matches, !!connection?.saveData));
    sync(); motion.addEventListener("change", sync); connection?.addEventListener("change", sync);
    return () => { motion.removeEventListener("change", sync); connection?.removeEventListener("change", sync); };
  }, []);
  const play = allowed && !failed && !!HERO_MEDIA.desktop;
  useEffect(() => {
    if (play) ref.current?.play()?.catch(() => setFailed(true));
  }, [play]);
  return <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-olive">
    {/* Dekoratif yerel poster; gerçek klibin seçimi LICENSES.md'de bekliyor. */}
    <img src={HERO_MEDIA.poster} alt="" fetchPriority="high" className="h-full w-full object-cover object-[65%_center]" />
    {play ? <video ref={ref} autoPlay muted loop playsInline preload="metadata" poster={HERO_MEDIA.poster} onError={(event) => {
      // Chromium emits source errors for a skipped media query too; only a selected source failure is fatal.
      const source = event.target;
      if (source === event.currentTarget || (source instanceof HTMLSourceElement && (!source.media || window.matchMedia(source.media).matches))) setFailed(true);
    }} className="absolute inset-0 h-full w-full object-cover object-[65%_center]">
      {HERO_MEDIA.mobile ? <source src={HERO_MEDIA.mobile} type="video/mp4" media="(max-width: 767px)" /> : null}
      <source src={HERO_MEDIA.desktop!} type="video/mp4" />
    </video> : null}
    <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/75 to-black/60" />
  </div>;
}
