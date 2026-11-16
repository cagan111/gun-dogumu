"use client";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Alert, Field, Spinner } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

/** Girişten sonra hedef: ?next= varsa o, yoksa role göre /admin ya da /panel. */
export async function landingFor(next: string | null): Promise<string> {
  if (next) return next;
  try {
    const s = (await (await fetch("/api/auth/session", { cache: "no-store" })).json()) as { user?: { role?: string } } | null;
    return s?.user?.role === "superadmin" ? "/admin" : "/panel";
  } catch {
    return "/panel";
  }
}

export function LoginForms({ next }: { next: string | null }) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [magicEmail, setMagicEmail] = useState("");
  const [magicBusy, setMagicBusy] = useState(false);
  const [magicMsg, setMagicMsg] = useState<string | null>(null);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await signIn("credentials", { email: email.trim(), password, redirect: false });
      if (!r || r.error) { setErr(t("login.error")); return; }
      window.location.assign(await landingFor(next));
    } catch {
      setErr(t("common.genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function magic(e: React.FormEvent) {
    e.preventDefault();
    setMagicBusy(true); setMagicMsg(null);
    try {
      const res = await fetch("/api/auth/magic-link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: magicEmail.trim() }) });
      setMagicMsg(res.ok ? t("login.magicSent") : res.status === 429 ? t("common.rateLimited") : t("common.genericError"));
    } catch {
      setMagicMsg(t("common.genericError"));
    } finally {
      setMagicBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={login} className="space-y-4" noValidate>
        {err ? <Alert>{err}</Alert> : null}
        <Field label={t("login.email")} name="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field label={t("login.password")} name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit" className="w-full" disabled={busy || !email || !password}>{busy ? <><Spinner />{t("login.submitting")}</> : t("login.submit")}</Button>
      </form>

      <div className="my-6 border-t border-slate-200" />
      <form onSubmit={magic} className="space-y-3" noValidate>
        <h2 className="font-semibold">{t("login.magicTitle")}</h2>
        <p className="text-sm text-slate-700">{t("login.magicSub")}</p>
        {magicMsg ? <Alert tone="info">{magicMsg}</Alert> : null}
        <Field label={t("login.email")} name="magic-email" type="email" autoComplete="email" value={magicEmail} onChange={(e) => setMagicEmail(e.target.value)} required />
        <Button type="submit" variant="secondary" className="w-full" disabled={magicBusy || !magicEmail}>{magicBusy ? <Spinner /> : null}{t("login.magicSend")}</Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-700">
        {t("login.noAccount")} <Link href="/kayit" className="font-semibold text-brand underline">{t("login.signup")}</Link>
      </p>
    </>
  );
}
