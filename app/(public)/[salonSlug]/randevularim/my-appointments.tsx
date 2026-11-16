"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Field, Spinner } from "@/components/ui/field";
import { Button, buttonClass } from "@/components/ui/button";
import { formatPrice, formatWhen } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";

interface Appt {
  id: string; startsAt: string; status: string; staffName: string; priceTry: number; cancelUrl: string;
  service: { nameTr: string; nameEn: string | null };
}

export function MyAppointments({ slug, timeZone }: { slug: string; timeZone: string }) {
  const { t, locale } = useI18n();
  const [phase, setPhase] = useState<"phone" | "code" | "list">("phone");
  const [phone, setPhone] = useState("+90 ");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<Appt[] | null>(null);

  async function loadList() {
    const res = await fetch(`/api/public/${slug}/my-appointments`, { cache: "no-store" });
    if (res.status === 401) { setPhase("phone"); setErr(t("mine.expired")); return; }
    if (!res.ok) { setErr(t("common.genericError")); return; }
    setItems(((await res.json()) as { appointments: Appt[] }).appointments);
    setPhase("list");
  }

  // çerez hâlâ geçerliyse doğrudan liste
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/public/${slug}/my-appointments`, { cache: "no-store" });
        if (res.ok) { setItems(((await res.json()) as { appointments: Appt[] }).appointments); setPhase("list"); }
      } catch { /* oturum yok */ }
    })();
  }, [slug]);

  const post = (path: string, body: unknown) =>
    fetch(`/api/public/${slug}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await post("otp/request", { phone: phone.trim() });
      if (res.ok) { setPhase("code"); setCode(""); return; }
      const j = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
      const c = j.error?.code;
      setErr(c === "invalid_phone" ? t("mine.errPhone") : c === "sms_unavailable" ? t("mine.errSms") : res.status === 429 ? t("common.rateLimited") : t("common.genericError"));
    } catch { setErr(t("common.genericError")); } finally { setBusy(false); }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await post("otp/verify", { phone: phone.trim(), code: code.trim() });
      if (res.ok) { await loadList(); return; }
      const j = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
      setErr(j.error?.code === "otp_locked" ? t("mine.errLocked") : res.status === 429 ? t("common.rateLimited") : t("mine.errCode"));
    } catch { setErr(t("common.genericError")); } finally { setBusy(false); }
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-xl font-extrabold">{t("mine.title")}</h2>
      {err ? <Alert className="mt-3">{err}</Alert> : null}

      {phase === "phone" ? (
        <form onSubmit={sendCode} className="mt-3 space-y-4" noValidate>
          <p className="text-sm text-slate-700">{t("mine.phoneIntro")}</p>
          <Field label={t("mine.phone")} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <Button type="submit" className="w-full" disabled={busy || phone.replace(/\D/g, "").length < 7}>{busy ? <><Spinner />{t("mine.sending")}</> : t("mine.sendCode")}</Button>
        </form>
      ) : null}

      {phase === "code" ? (
        <form onSubmit={verify} className="mt-3 space-y-4" noValidate>
          <p className="text-sm text-slate-700">{t("mine.codeIntro", { phone: phone.trim() })}</p>
          <Field label={t("mine.code")} inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />
          <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>{busy ? <Spinner /> : null}{t("mine.verify")}</Button>
          <Button variant="ghost" className="w-full" onClick={() => { setPhase("phone"); setErr(null); }}>{t("mine.changePhone")}</Button>
        </form>
      ) : null}

      {phase === "list" ? (
        <div className="mt-3">
          <p className="text-sm font-semibold text-slate-700">{t("mine.list")}</p>
          {items && items.length === 0 ? <p className="mt-3 text-slate-700">{t("mine.empty")}</p> : null}
          <ul className="mt-3 space-y-3">
            {(items ?? []).map((a) => (
              <li key={a.id} className="rounded-xl border border-slate-200 p-4">
                <p className="font-semibold">{locale === "en" && a.service.nameEn ? a.service.nameEn : a.service.nameTr}</p>
                <p className="text-sm text-slate-700">{formatWhen(a.startsAt, locale, timeZone)} · {a.staffName} · {formatPrice(a.priceTry, locale)}</p>
                <Link href={a.cancelUrl} className="mt-2 inline-block text-sm font-semibold text-brand underline">{t("mine.cancelLink")}</Link>
              </li>
            ))}
          </ul>
          <Link href={`/${slug}`} className={buttonClass("primary", "mt-5 w-full")}>{t("mine.book")}</Link>
        </div>
      ) : null}
    </div>
  );
}
