"use client";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LogoutButton({ label, compact }: { label: string; compact?: boolean }) {
  return <Button variant="secondary" className={compact ? "!min-h-9 !px-3 !text-sm" : undefined} onClick={() => signOut({ callbackUrl: "/" })}>{label}</Button>;
}
