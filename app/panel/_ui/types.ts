export interface Staff { id: string; name: string; color: string; active: boolean; sortOrder: number; photoUrl: string | null }
export interface Svc { id: string; nameTr: string; nameEn: string | null; durationMin: number; priceTry: number; bufferMin: number; active: boolean; sortOrder: number; staffIds: string[] }
export interface Appt {
  id: string; staffId: string; serviceId: string; customerId: string;
  startsAt: string; endsAt: string; blockedUntil: string;
  status: "pending" | "confirmed" | "cancelled_by_customer" | "cancelled_by_salon" | "completed" | "no_show";
  source: "online" | "panel" | "walk_in"; note: string | null; priceTry: number;
  service: { nameTr: string; nameEn: string | null };
  staff: { name: string; color: string };
  customer: { id: string; name: string; phone: string; noShowCount: number };
}
export interface WH { weekday: number; startMin: number; endMin: number; breaks: [number, number][] }
export interface TimeOff { id: string; staffId: string; startsAt: string; endsAt: string; kind: "leave" | "holiday" | "other"; reason: string | null }
export type ApptStatus = Appt["status"];
