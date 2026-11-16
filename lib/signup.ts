import { Prisma } from "@prisma/client";
import { z } from "zod";
import { PLANS, TRIAL_DAYS } from "@/config/plans";
import { prisma } from "./db";
import { ConflictError } from "./errors";
import { hashPassword, normalizeEmail } from "./login";
import { slugSchema, slugProblem } from "./slug";

export const CITIES = ["Lefkoşa", "Girne", "Gazimağusa", "Güzelyurt", "İskele", "Diğer"] as const;

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  // bcrypt yalnız ilk 72 baytı kullanır
  password: z.string().min(8).max(72),
  name: z.string().trim().min(2).max(100),
  salonName: z.string().trim().min(2).max(100),
  city: z.enum(CITIES),
  slug: slugSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

/** Slug biçim + rezerve + DB müsaitliği. */
export async function checkSlug(slug: string): Promise<{ valid: boolean; available: boolean; reason?: "format" | "reserved" | "taken" }> {
  const problem = slugProblem(slug);
  if (problem) return { valid: false, available: false, reason: problem };
  const exists = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  return exists ? { valid: true, available: false, reason: "taken" } : { valid: true, available: true };
}

/** Tenant (deneme) + owner kullanıcı + plan aylık SMS kredisi tek transaction'da. */
export async function signupSalon(input: SignupInput, now: Date = new Date()) {
  const email = normalizeEmail(input.email);
  const plan = PLANS.baslangic;
  const passwordHash = await hashPassword(input.password);
  try {
    return await prisma.$transaction(async (tx) => {
      // Tenant henüz yok → tenantId açıkça yazılır (withTenant kapsamı burada uygulanamaz)
      const tenant = await tx.tenant.create({
        data: {
          slug: input.slug, name: input.salonName, city: input.city,
          timeZone: "Asia/Famagusta", plan: plan.id, status: "trial",
          trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * 86_400_000),
        },
      });
      const user = await tx.user.create({
        data: { email, passwordHash, name: input.name, role: "owner", tenantId: tenant.id },
      });
      const last = await tx.smsLedger.findFirst({ where: { tenantId: tenant.id }, orderBy: { createdAt: "desc" }, select: { balanceAfter: true } });
      await tx.smsLedger.create({
        data: {
          tenantId: tenant.id, delta: plan.monthlySms, reason: "plan_monthly",
          balanceAfter: (last?.balanceAfter ?? 0) + plan.monthlySms, note: "Deneme başlangıç kredisi",
        },
      });
      return { tenantId: tenant.id, userId: user.id, slug: tenant.slug, trialEndsAt: tenant.trialEndsAt };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = String((e.meta as { target?: unknown } | undefined)?.target ?? "");
      throw new ConflictError(target.includes("email") ? "email" : "slug");
    }
    throw e;
  }
}
