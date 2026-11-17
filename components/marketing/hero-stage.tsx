"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icons";

type Labels = { group: string; a: string; b: string; pause: string; play: string; sample: string };

/**
 * Hero sahnesi: A (salondan bir an) ve B (ürün: 3 telefon) dönüşümlü. 8 sn / 12 sn; fare üstündeyken, duraklatılınca
 * ve prefers-reduced-motion'da otomatik geçiş kapalı (noktalarla elle geçilir).
 */
export function HeroStage({ a, b, cardsA, cardsB, labels }: { a: React.ReactNode; b: React.ReactNode; cardsA: React.ReactNode; cardsB: React.ReactNode; labels: Labels }) {
  const [scene, setScene] = useState<"a" | "b">("a");
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (paused || hover || reduced) return;
    const id = setTimeout(() => setScene((s) => (s === "a" ? "b" : "a")), scene === "a" ? 7000 : 12000);
    return () => clearTimeout(id);
  }, [scene, paused, hover, reduced]);

  const auto = !paused && !reduced;
  return (
    <div className="pb-14">
      <div className="hs" data-scene={scene} role="group" aria-roledescription="carousel" aria-label={labels.group}
        onPointerEnter={(e) => { if (e.pointerType === "mouse") setHover(true); }} onPointerLeave={() => setHover(false)}>
        <div className="hs-clip hs-u">
          <div className="hs-scene hs-a" aria-hidden={scene !== "a"}>{a}</div>
          <div className="hs-scene hs-b" aria-hidden={scene !== "b"}>{b}<span className="ph-tag">{labels.sample}</span></div>
        </div>
        <div className="hs-cards hs-u" aria-hidden>
          {scene === "a" ? cardsA : cardsB}
        </div>
        <div className="hs-ctl" role="group" aria-label={labels.group}>
          <button type="button" className="hs-dot" aria-pressed={scene === "a"} aria-label={labels.a} onClick={() => { setScene("a"); }} />
          <button type="button" className="hs-dot" aria-pressed={scene === "b"} aria-label={labels.b} onClick={() => { setScene("b"); }} />
          {!reduced ? (
            <button type="button" className="hs-pause" aria-label={auto ? labels.pause : labels.play} onClick={() => setPaused((p) => !p)}>
              <Icon name={auto ? "pause" : "play"} size={18} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
