"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

export function LogoutButton({ label, compact }: { label: string; compact?: boolean }) {
  const t = useT(), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  async function logout() {
    if (busy) return;
    setBusy(true); setFailed(false);
    try {
      const csrfResponse = await fetch("/api/auth/csrf", { cache: "no-store" });
      if (!csrfResponse.ok) throw new Error("csrf unavailable");
      const { csrfToken } = await csrfResponse.json() as { csrfToken?: string };
      if (!csrfToken) throw new Error("csrf unavailable");
      const response = await fetch("/api/auth/signout", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "x-auth-return-redirect": "1" }, body: new URLSearchParams({ csrfToken, callbackUrl: "/" }) });
      if (!response.ok) throw new Error("logout unavailable");
      const result = await response.json() as { url?: string };
      if (!result.url) throw new Error("logout unconfirmed");
      const destination = new URL(result.url, window.location.origin);
      if (destination.origin !== window.location.origin || destination.pathname !== "/" || destination.search || destination.hash) throw new Error("logout unconfirmed");
      window.location.assign("/");
    } catch { setFailed(true); setBusy(false); }
  }
  return <div>
    <Button variant="secondary" disabled={busy} aria-busy={busy} className={compact ? "!min-h-9 !px-3 !text-sm" : undefined} onClick={() => void logout()}>{label}</Button>
    {failed ? <p role="alert" className="mt-2 max-w-xs text-sm text-inherit">{t("panel.logoutError")}</p> : null}
  </div>;
}
