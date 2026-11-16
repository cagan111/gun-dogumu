import { PLANS, type PlanId } from "@/config/plans";
import { prisma } from "./db";

type Client = Pick<typeof prisma, "planPrice">;

/** Plan fiyatı (TL/ay): önce PlanPrice (admin ezmesi), yoksa config/plans.ts. */
export async function getPlanPrice(planId: string, client: Client = prisma): Promise<number> {
  const row = await client.planPrice.findUnique({ where: { planId } });
  if (row) return Number(row.priceTry);
  return (PLANS as Record<string, { priceTry: number } | undefined>)[planId]?.priceTry ?? 0;
}

/** Tüm planların güncel fiyatı. */
export async function getAllPlanPrices(client: Client = prisma): Promise<Record<PlanId, number>> {
  const rows = await client.planPrice.findMany();
  const o = new Map(rows.map((r) => [r.planId, Number(r.priceTry)]));
  const out = {} as Record<PlanId, number>;
  for (const id of Object.keys(PLANS) as PlanId[]) out[id] = o.get(id) ?? PLANS[id].priceTry;
  return out;
}
