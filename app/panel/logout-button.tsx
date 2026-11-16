"use client";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LogoutButton({ label }: { label: string }) {
  return <Button variant="secondary" onClick={() => signOut({ callbackUrl: "/" })}>{label}</Button>;
}
