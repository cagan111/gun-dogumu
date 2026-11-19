"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client-api";

export interface PanelInfo {
  role: "owner" | "staff";
  userName: string;
  tenant: {
    name: string; slug: string; plan: string; planName: string; status: string; timeZone: string; slotMinutes: number;
    daysLeft: number | null; // deneme/abonelik bitimine kalan gün
    features: { reports: boolean; customerNotes: boolean; campaigns: boolean };
  };
}
interface Ctx extends PanelInfo {
  isOwner: boolean;
  balance: number | null;
  reserved: number;
  refreshBalance: () => void;
}

const C = createContext<Ctx | null>(null);

export function PanelProvider({ info, children }: { info: PanelInfo; children: React.ReactNode }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [reserved, setReserved] = useState(0);
  const refreshBalance = useCallback(() => {
    api<{ balance: number; reserved?: number }>("/api/panel/sms/balance").then((r) => { setBalance(r.balance); setReserved(r.reserved ?? 0); }).catch(() => {});
  }, []);
  useEffect(refreshBalance, [refreshBalance]);
  const value = useMemo(() => ({ ...info, isOwner: info.role === "owner", balance, reserved, refreshBalance }), [info, balance, reserved, refreshBalance]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function usePanel(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error("PanelProvider yok");
  return v;
}
