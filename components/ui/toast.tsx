"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "error";
interface Item { id: number; msg: string; tone: Tone }
const ToastCtx = createContext<(msg: string, tone?: Tone) => void>(() => {});

/** Geçici bildirimler (aria-live). Panel ve admin kabuğu sarar. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const seq = useRef(0);
  const push = useCallback((msg: string, tone: Tone = "info") => {
    const id = ++seq.current;
    setItems((a) => [...a.slice(-3), { id, msg, tone }]);
    setTimeout(() => setItems((a) => a.filter((i) => i.id !== id)), tone === "error" ? 6000 : 3500);
  }, []);
  useEffect(() => () => { seq.current = 0; }, []);
  const value = useMemo(() => push, [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {items.map((i) => (
          <div
            key={i.id}
            role={i.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm font-medium shadow-lg",
              i.tone === "error" ? "bg-red-700 text-white" : i.tone === "success" ? "bg-emerald-700 text-white" : "bg-slate-900 text-white",
            )}
          >
            {i.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
