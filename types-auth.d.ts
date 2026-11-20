import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User { tokenVersion?: number; role?: "owner" | "staff" | "superadmin"; tenantId?: string | null }
  interface Session {
    user: { tokenVersion?: number; id: string; role: "owner" | "staff" | "superadmin"; tenantId: string | null } & DefaultSession["user"];
  }
}
declare module "next-auth/jwt" {
  interface JWT { tokenVersion?: number; userId?: string; role?: "owner" | "staff" | "superadmin"; tenantId?: string | null }
}
