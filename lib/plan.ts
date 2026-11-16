import { PLANS, type PlanDef, type PlanId } from "@/config/plans";
import { PlanFeatureError } from "./errors";

export type PlanFeature = keyof PlanDef["features"];

/** Bilinmeyen plan adı en düşük plana düşer. */
export function planOf(planId: string): PlanDef {
  return (PLANS as Record<string, PlanDef | undefined>)[planId] ?? PLANS.baslangic;
}
export function isPlanId(v: string): v is PlanId {
  return Object.prototype.hasOwnProperty.call(PLANS, v);
}
export function hasFeature(planId: string, feature: PlanFeature): boolean {
  return planOf(planId).features[feature];
}
export function assertFeature(planId: string, feature: PlanFeature): void {
  if (!hasFeature(planId, feature)) throw new PlanFeatureError(feature);
}
