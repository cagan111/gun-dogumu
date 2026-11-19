"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const requestScope = useRef({ slug, slugGeneration: 0, requestGeneration: 0 });
  const [viewSlug, setViewSlug] = useState(slug);
  const requestCurrent = useCallback((token: { slug: string; slugGeneration: number; requestGeneration: number }) => requestScope.current.slug === token.slug && requestScope.current.slugGeneration === token.slugGeneration && requestScope.current.requestGeneration === token.requestGeneration, []);
  const beginRequest = useCallback((requestSlug: string) => {
    const scope = requestScope.current;
    if (scope.slug !== requestSlug) return null;
    scope.requestGeneration += 1;
    return { slug: requestSlug, slugGeneration: scope.slugGeneration, requestGeneration: scope.requestGeneration };
  }, []);
  const [phase, setPhase] = useState<"phone" | "code" | "list">("phone");
  const [phone, setPhone] = useState("+90 ");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<Appt[] | null>(null);
  const [marketingConsent, setMarketingConsent] = useState<boolean | null>(null);
  const [marketingDraft, setMarketingDraft] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentErr, setConsentErr] = useState<string | null>(null);
  const [consentSaved, setConsentSaved] = useState(false);

  const loadConsent = useCallback(async (requestToken?: { slug: string; slugGeneration: number; requestGeneration: number }) => {
    const token = requestToken ?? beginRequest(slug);
    if (!token) return;
    setConsentLoading(true); setConsentErr(null); setConsentSaved(false);
    try {
      const res = await fetch(`/api/public/${slug}/marketing-consent`, { cache: "no-store" });
      if (!requestCurrent(token)) return;
      if (res.status === 401) { setItems(null); setMarketingConsent(null); setMarketingDraft(false); setPhase("phone"); setErr(t("mine.expired")); return; }
      if (!res.ok) { setConsentErr(t("mine.consentError")); return; }
      const result = (await res.json()) as { marketingConsent: boolean };
      if (!requestCurrent(token)) return;
      if (typeof result.marketingConsent !== "boolean") { setConsentErr(t("mine.consentError")); return; }
      setMarketingConsent(result.marketingConsent);
      setMarketingDraft(result.marketingConsent);
    } catch { if (requestCurrent(token)) setConsentErr(t("mine.consentError")); }
    finally { if (requestCurrent(token)) setConsentLoading(false); }
  }, [slug, t, requestCurrent, beginRequest]);

  const loadList = useCallback(async (showExpired = true) => {
    const token = beginRequest(slug);
    if (!token) return;
    setErr(null);
    try {
      const res = await fetch(`/api/public/${slug}/my-appointments`, { cache: "no-store" });
      if (!requestCurrent(token)) return;
      if (res.status === 401) { setPhase("phone"); if (showExpired) setErr(t("mine.expired")); return; }
      if (!res.ok) { setErr(t("common.genericError")); return; }
      const result = (await res.json()) as { appointments: Appt[] };
      if (!requestCurrent(token)) return;
      setItems(result.appointments);
      setPhase("list");
      await loadConsent(token);
    } catch { if (requestCurrent(token)) setErr(t("common.genericError")); }
  }, [slug, t, loadConsent, requestCurrent, beginRequest]);

  // çerez hâlâ geçerliyse doğrudan liste
  useEffect(() => {
    if (requestScope.current.slug !== slug) requestScope.current = { slug, slugGeneration: requestScope.current.slugGeneration + 1, requestGeneration: requestScope.current.requestGeneration + 1 };
    else requestScope.current.requestGeneration += 1;
    setViewSlug(slug);
    setPhase("phone"); setPhone("+90 "); setCode(""); setItems(null); setMarketingConsent(null); setMarketingDraft(false);
    setErr(null); setConsentErr(null); setConsentSaved(false); setConsentLoading(false); setConsentBusy(false); setBusy(false);
    void loadList(false);
  }, [loadList]);

  const post = (path: string, body: unknown) =>
    fetch(`/api/public/${slug}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    const token = beginRequest(slug);
    if (!token) return;
    setBusy(true); setErr(null);
    try {
      const res = await post("otp/request", { phone: phone.trim() });
      if (!requestCurrent(token)) return;
      if (res.ok) { setPhase("code"); setCode(""); return; }
      const j = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
      if (!requestCurrent(token)) return;
      const c = j.error?.code;
      setErr(c === "invalid_phone" ? t("mine.errPhone") : c === "sms_unavailable" ? t("mine.errSms") : res.status === 429 ? t("common.rateLimited") : t("common.genericError"));
    } catch { if (requestCurrent(token)) setErr(t("common.genericError")); } finally { if (requestCurrent(token)) setBusy(false); }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    const token = beginRequest(slug);
    if (!token) return;
    setBusy(true); setErr(null);
    try {
      const res = await post("otp/verify", { phone: phone.trim(), code: code.trim() });
      if (!requestCurrent(token)) return;
      if (res.ok) { setBusy(false); await loadList(); return; }
      const j = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
      if (!requestCurrent(token)) return;
      setErr(j.error?.code === "otp_locked" ? t("mine.errLocked") : res.status === 429 ? t("common.rateLimited") : t("mine.errCode"));
    } catch { if (requestCurrent(token)) setErr(t("common.genericError")); } finally { if (requestCurrent(token)) setBusy(false); }
  }

  async function saveMarketingConsent() {
    if (marketingConsent === null || marketingDraft === marketingConsent) return;
    const token = beginRequest(slug);
    if (!token) return;
    setConsentBusy(true); setConsentErr(null); setConsentSaved(false);
    try {
      const res = await fetch(`/api/public/${slug}/marketing-consent`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ marketingConsent: marketingDraft }) });
      if (!requestCurrent(token)) return;
      if (res.status === 401) { setItems(null); setMarketingConsent(null); setMarketingDraft(false); setPhase("phone"); setErr(t("mine.expired")); return; }
      if (!res.ok) { setConsentErr(t("mine.consentError")); return; }
      const result = (await res.json()) as { marketingConsent: boolean };
      if (!requestCurrent(token)) return;
      if (typeof result.marketingConsent !== "boolean") { setConsentErr(t("mine.consentError")); return; }
      setMarketingConsent(result.marketingConsent); setMarketingDraft(result.marketingConsent); setConsentSaved(true);
    } catch { if (requestCurrent(token)) setConsentErr(t("mine.consentError")); }
    finally { if (requestCurrent(token)) setConsentBusy(false); }
  }

  if (viewSlug !== slug) return <div className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-slate-200"><p className="text-slate-600">{t("common.loading")}</p></div>;

  return (
    <div className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-slate-200">
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
          <Button variant="ghost" className="w-full" disabled={busy} onClick={() => { beginRequest(slug); setPhase("phone"); setErr(null); }}>{t("mine.changePhone")}</Button>
        </form>
      ) : null}

      {phase === "list" ? (
        <div className="mt-3">
          <section className="mb-4 rounded-xl border border-slate-200 p-4" aria-labelledby="marketing-consent-title">
            <h3 id="marketing-consent-title" className="font-bold">{t("mine.consentTitle")}</h3>
            <p className="mt-1 text-sm text-slate-700">{t("mine.consentInfo")} <Link href="/gizlilik" className="font-semibold text-brand underline">{t("mine.consentPrivacy")}</Link></p>
            {consentErr ? <Alert className="mt-3">{consentErr}</Alert> : null}
            {marketingConsent === null && consentLoading ? <p className="mt-3 text-sm text-slate-600">{t("common.loading")}</p> : null}
            {marketingConsent === null && !consentLoading && consentErr ? <Button variant="secondary" className="mt-3" onClick={() => void loadConsent()}>{t("mine.consentRetry")}</Button> : null}
            {marketingConsent !== null ? (
              <>
                <label className="mt-3 flex min-h-11 items-center gap-3 text-sm font-medium">
                  <input type="checkbox" data-testid="consent-toggle" checked={marketingDraft} disabled={consentBusy || marketingConsent === null} onChange={(e) => { setMarketingDraft(e.target.checked); setConsentSaved(false); setConsentErr(null); }} className="h-5 w-5 accent-[rgb(var(--brand))]" />
                  <span>{t("mine.consentLabel")}</span>
                </label>
                <Button variant="secondary" className="mt-2 w-full" data-testid="consent-save" onClick={saveMarketingConsent} disabled={consentBusy || marketingConsent === null || marketingDraft === marketingConsent}>
                  {consentBusy ? <><Spinner />{t("mine.consentSaving")}</> : t("mine.consentSave")}
                </Button>
                {consentSaved ? <p className="mt-2 text-sm text-emerald-700" role="status">{t("mine.consentSaved")}</p> : null}
              </>
            ) : null}
          </section>
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
