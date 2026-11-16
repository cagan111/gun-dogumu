import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminShell } from "./_ui/shell";

export const dynamic = "force-dynamic";

/** Süper-admin kabuğu: yalnız platform sahibi (role=superadmin). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user?.role !== "superadmin") redirect("/giris?next=/admin");
  return <AdminShell email={session.user.email ?? ""}>{children}</AdminShell>;
}
