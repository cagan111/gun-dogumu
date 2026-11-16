import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User { role?: "owner" | "staff" | "superadmin"; tenantId?: string | null }
  interface Session {
    user: { id: string; role: "owner" | "staff" | "superadmin"; tenantId: string | null } & DefaultSession["user"];
  }
}
declare module "next-auth/jwt" {
  interface JWT { userId?: string; role?: "owner" | "staff" | "superadmin"; tenantId?: string | null }
}
