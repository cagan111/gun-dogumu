import { PrismaClient } from "@prisma/client";
import { scopeArgs } from "./tenant";

const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;

/** Tenant'a kilitli istemci. Tenant verisine erişen tüm kod bunu kullanmalı. */
export function withTenant(tenantId: string) {
  if (!tenantId) throw new Error("tenantId gerekli");
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          return query(scopeArgs(model, operation, args as never, tenantId) as never);
        },
      },
    },
  });
}
export type TenantDb = ReturnType<typeof withTenant>;
