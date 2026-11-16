"use client";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { Alert, Spinner } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { landingFor } from "../login-forms";

export function MagicSignIn({ token }: { token: string }) {
  const t = useT();
  const [failed, setFailed] = useState(!token);
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return; // token tek kullanımlık: çift çağrı (strict mode) olmasın
    started.current = true;
    void (async () => {
      try {
        const r = await signIn("magic-link", { token, redirect: false });
        if (!r || r.error) { setFailed(true); return; }
        window.location.assign(await landingFor(null));
      } catch {
        setFailed(true);
      }
    })();
  }, [token]);

  if (failed) {
    return (
      <div className="space-y-4">
        <Alert>{t("magic.failed")}</Alert>
        <Link href="/giris" className={buttonClass("primary", "w-full")}>{t("magic.retry")}</Link>
      </div>
    );
  }
  return <p role="status" className="flex items-center gap-2 text-slate-700"><Spinner />{t("magic.signingIn")}</p>;
}
