"use client";
import Link from "next/link";
import { useState } from "react";
import { Alert, Field, Spinner } from "@/components/ui/field";
import { Button, buttonClass } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

export function SetPasswordForm({ token }: { token: string }) {
  const t = useT();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { setErr(t("setpw.short")); return; }
    if (pw !== pw2) { setErr(t("setpw.mismatch")); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/auth/set-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password: pw }) });
      if (res.ok) { setDone(true); return; }
      const j = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
      setErr(j.error?.code === "invalid_token" || res.status === 400 ? t("setpw.invalid") : res.status === 429 ? t("common.rateLimited") : t("common.genericError"));
    } catch { setErr(t("common.genericError")); } finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <Alert tone="success">{t("setpw.done")}</Alert>
        <Link href="/giris" className={buttonClass("primary", "w-full")}>{t("login.submit")}</Link>
      </div>
    );
  }
  if (!token) return <Alert>{t("setpw.invalid")}</Alert>;
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {err ? <Alert>{err}</Alert> : null}
      <Field label={t("setpw.password")} type="password" autoComplete="new-password" hint={t("setpw.hint")} value={pw} onChange={(e) => setPw(e.target.value)} required />
      <Field label={t("setpw.confirm")} type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
      <Button type="submit" className="w-full" disabled={busy}>{busy ? <Spinner /> : null}{t("setpw.submit")}</Button>
    </form>
  );
}
