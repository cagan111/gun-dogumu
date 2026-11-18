"use client";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { Alert, Field, Spinner, inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/client";
import { translate, type Key } from "@/lib/i18n/shared";
import { slugify } from "@/lib/slugify";

const STEPS = 4;
const CITIES = ["Lefkoşa", "Girne", "Gazimağusa", "Güzelyurt", "İskele", "Diğer"] as const;
type SlugState = "idle" | "checking" | "ok" | "taken" | "format" | "reserved";

interface Day { weekday: number; startMin: number; endMin: number; breaks: [number, number][] }
const range = (days: number[], s: number, e: number, br: [number, number][] = []): Day[] => days.map((weekday) => ({ weekday, startMin: s, endMin: e, breaks: br }));
const HOUR_PRESETS: { key: Key; days: Day[] }[] = [
  { key: "signup.hours.p1", days: range([1, 2, 3, 4, 5, 6], 540, 1140, [[780, 810]]) },
  { key: "signup.hours.p2", days: range([1, 2, 3, 4, 5, 6], 600, 1200) },
  { key: "signup.hours.p3", days: range([0, 1, 2, 3, 4, 5, 6], 540, 1080) },
  { key: "signup.hours.p4", days: range([1, 2, 3, 4, 5], 540, 1050) },
];
interface Svc { key: number; tr: string; en: string; dur: string; price: string }
const SERVICE_PRESETS: { key: Key; dur: number; price: number }[] = [
  { key: "signup.services.s1", dur: 30, price: 450 },
  { key: "signup.services.s2", dur: 20, price: 250 },
  { key: "signup.services.s3", dur: 30, price: 400 },
  { key: "signup.services.s4", dur: 45, price: 500 },
  { key: "signup.services.s5", dur: 90, price: 1500 },
];

export function SignupWizard() {
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [salonName, setSalonName] = useState("");
  const [city, setCity] = useState<(typeof CITIES)[number]>("Lefkoşa");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugState, setSlugState] = useState<SlugState>("idle");
  const [preset, setPreset] = useState(0);
  const [svcs, setSvcs] = useState<Svc[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const keyRef = useRef(0);

  useEffect(() => { headingRef.current?.focus(); }, [step]);

  // salon adından slug öner (kullanıcı elle değiştirmediyse)
  useEffect(() => { if (!slugTouched) setSlug(slugify(salonName)); }, [salonName, slugTouched]);

  // canlı slug kontrolü (400 ms gecikmeli)
  useEffect(() => {
    if (!slug) { setSlugState("idle"); return; }
    setSlugState("checking");
    const ac = new AbortController();
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/slug-check?slug=${encodeURIComponent(slug)}`, { signal: ac.signal });
        if (!res.ok) { setSlugState("idle"); return; }
        const j = (await res.json()) as { valid: boolean; available: boolean; reason?: "format" | "reserved" | "taken" };
        setSlugState(j.available ? "ok" : (j.reason ?? "taken"));
      } catch { /* iptal */ }
    }, 400);
    return () => { clearTimeout(id); ac.abort(); };
  }, [slug]);

  const slugMsg: Record<SlugState, string | null> = {
    idle: null, checking: t("signup.slug.checking"), ok: t("signup.slug.ok"), taken: t("signup.slug.taken"),
    format: t("signup.slug.format"), reserved: t("signup.slug.reserved"),
  };

  function validate(s: number) {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (name.trim().length < 2) e.name = t("signup.errName");
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = t("signup.errEmailFormat");
      if (password.length < 8) e.password = t("signup.errPassword");
    }
    if (s === 2) {
      if (salonName.trim().length < 2) e.salonName = t("signup.errSalon");
      if (slugState !== "ok") e.slug = slugMsg[slugState] ?? t("signup.errSlugNeeded");
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next(e?: React.FormEvent) {
    e?.preventDefault();
    if (!validate(step)) return;
    setBanner(null);
    setStep(step + 1);
  }

  const toggleService = (p: (typeof SERVICE_PRESETS)[number]) => {
    setSvcs((cur) => cur.some((s) => s.tr === translate("tr", p.key))
      ? cur.filter((s) => s.tr !== translate("tr", p.key))
      : [...cur, { key: ++keyRef.current, tr: translate("tr", p.key), en: translate("en", p.key), dur: String(p.dur), price: String(p.price) }]);
  };
  const patchSvc = (key: number, patch: Partial<Svc>) => setSvcs((cur) => cur.map((s) => (s.key === key ? { ...s, ...patch, en: patch.tr !== undefined ? "" : s.en } : s)));

  async function finish() {
    setBusy(true); setBanner(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, name: name.trim(), salonName: salonName.trim(), city, slug }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: { code?: string; field?: string } };
        if (j.error?.code === "conflict" && j.error.field === "email") { setErrors({ email: t("signup.errEmail") }); setStep(1); }
        else if (j.error?.code === "conflict") { setErrors({ slug: t("signup.errSlug") }); setSlugState("taken"); setStep(2); }
        else if (res.status === 429) setBanner(t("common.rateLimited"));
        else if (res.status === 400) { setBanner(t("common.genericError")); setStep(1); }
        else setBanner(t("common.genericError"));
        return;
      }
      const r = await signIn("credentials", { email: email.trim(), password, redirect: false });
      if (!r || r.error) { window.location.assign("/giris"); return; }
      // 3. ve 4. adım: personel (sahibi) + çalışma saatleri + hizmetler. Hata olursa salon yine de hazır; panelde tamamlanır.
      let partial = false;
      const json = { "content-type": "application/json" };
      try {
        const sRes = await fetch("/api/panel/staff", { method: "POST", headers: json, body: JSON.stringify({ name: name.trim() }) });
        if (!sRes.ok) throw new Error("staff");
        const staff = (await sRes.json()) as { id: string };
        const hRes = await fetch(`/api/panel/staff/${staff.id}/working-hours`, { method: "PUT", headers: json, body: JSON.stringify({ days: HOUR_PRESETS[preset]!.days }) });
        if (!hRes.ok) partial = true;
        for (const s of svcs) {
          const dur = Number(s.dur), price = Number(s.price);
          if (!s.tr.trim() || !Number.isFinite(dur) || dur < 5 || !Number.isFinite(price) || price < 0) { partial = true; continue; }
          const vRes = await fetch("/api/panel/services", {
            method: "POST", headers: json,
            body: JSON.stringify({ nameTr: s.tr.trim(), ...(s.en ? { nameEn: s.en } : {}), durationMin: dur, priceTry: price, staffIds: [staff.id] }),
          });
          if (!vRes.ok) partial = true;
        }
      } catch { partial = true; }
      window.location.assign(partial ? "/panel?onboarding=1" : "/panel");
    } catch {
      setBanner(t("common.genericError"));
    } finally {
      setBusy(false);
    }
  }

  const titles = [t("signup.s1.title"), t("signup.s2.title"), t("signup.s3.title"), t("signup.s4.title")];

  return (
    <div>
      <p className="text-sm font-medium text-slate-700" aria-live="polite">{t("signup.step", { n: step, total: STEPS })}</p>
      <div className="mt-1.5 flex gap-1.5" aria-hidden>
        {Array.from({ length: STEPS }, (_, i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < step ? "bg-brand" : "bg-slate-200")} />)}
      </div>
      <h2 ref={headingRef} tabIndex={-1} className="mt-4 text-lg font-bold outline-none">{titles[step - 1]}</h2>
      {banner ? <Alert className="mt-3">{banner}</Alert> : null}

      {step === 1 ? (
        <form onSubmit={next} noValidate className="mt-4 space-y-4">
          <Field label={t("signup.name")} name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} required />
          <Field label={t("signup.email")} name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} required />
          <Field label={t("signup.password")} name="password" type="password" autoComplete="new-password" hint={t("signup.passwordHint")} value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} required />
          <Button type="submit" className="w-full">{t("common.next")}</Button>
          <p className="text-center text-sm text-slate-700">{t("signup.haveAccount")} <Link href="/giris" className="font-semibold text-brand underline">{t("login.submit")}</Link></p>
        </form>
      ) : null}

      {step === 2 ? (
        <form onSubmit={next} noValidate className="mt-4 space-y-4">
          <Field label={t("signup.salonName")} name="salonName" value={salonName} onChange={(e) => setSalonName(e.target.value)} error={errors.salonName} required />
          <div>
            <label htmlFor="city" className="mb-1.5 block text-sm font-medium text-slate-800">{t("signup.city")}</label>
            <select id="city" name="city" value={city} onChange={(e) => setCity(e.target.value as (typeof CITIES)[number])} className={inputClass}>
              {CITIES.map((c) => <option key={c} value={c}>{c === "Diğer" ? t("signup.cityOther") : c}</option>)}
            </select>
          </div>
          <div>
            <Field label={t("signup.slug")} name="slug" value={slug} autoCapitalize="none" spellCheck={false}
              onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); }}
              hint={t("signup.slugHint")} error={errors.slug && slugState !== "ok" ? errors.slug : null} required />
            <p data-testid="slug-status" aria-live="polite" className={cn("mt-1 text-sm font-medium", slugState === "ok" ? "text-emerald-300" : slugState === "checking" ? "text-slate-600" : "text-red-400")}>
              {slugState !== "idle" && !errors.slug ? slugMsg[slugState] : slugState === "ok" ? slugMsg.ok : ""}
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(1)}>{t("common.back")}</Button>
            <Button type="submit" className="flex-1" disabled={slugState === "checking"}>{t("common.next")}</Button>
          </div>
        </form>
      ) : null}

      {step === 3 ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-slate-700">{t("signup.hours.intro")}</p>
          <fieldset>
            <legend className="sr-only">{titles[2]}</legend>
            <div className="space-y-2">
              {HOUR_PRESETS.map((p, i) => (
                <label key={p.key} className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm", preset === i ? "border-brand ring-2 ring-brand" : "border-slate-300")}>
                  <input type="radio" name="hours" checked={preset === i} onChange={() => setPreset(i)} className="h-4 w-4 accent-[rgb(var(--brand))]" />
                  {t(p.key)}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="text-xs text-slate-600">{t("signup.hours.staffNote")}</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(2)}>{t("common.back")}</Button>
            <Button className="flex-1" onClick={() => setStep(4)}>{t("common.next")}</Button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-slate-700">{t("signup.services.intro")}</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label={titles[3]}>
            {SERVICE_PRESETS.map((p) => {
              const on = svcs.some((s) => s.tr === translate("tr", p.key));
              return (
                <button key={p.key} type="button" aria-pressed={on} onClick={() => toggleService(p)}
                  className={cn("min-h-10 rounded-full border px-4 text-sm font-medium", on ? "border-brand bg-brand text-brand-fg" : "border-slate-300 bg-surface hover:bg-slate-50")}>
                  {t(p.key)}
                </button>
              );
            })}
          </div>
          <ul className="space-y-3">
            {svcs.map((s) => (
              <li key={s.key} className="rounded-xl border border-slate-200 p-3">
                <Field label={t("signup.services.name")} value={s.tr} onChange={(e) => patchSvc(s.key, { tr: e.target.value })} />
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Field label={t("signup.services.duration")} inputMode="numeric" value={s.dur} onChange={(e) => patchSvc(s.key, { dur: e.target.value.replace(/\D/g, "") })} />
                  <Field label={t("signup.services.price")} inputMode="numeric" value={s.price} onChange={(e) => patchSvc(s.key, { price: e.target.value.replace(/\D/g, "") })} />
                </div>
                <button type="button" className="mt-2 text-sm font-medium text-red-400 underline" onClick={() => setSvcs((c) => c.filter((x) => x.key !== s.key))}>{t("signup.services.remove")}</button>
              </li>
            ))}
          </ul>
          <Button variant="secondary" onClick={() => setSvcs((c) => [...c, { key: ++keyRef.current, tr: "", en: "", dur: "30", price: "" }])}>+ {t("signup.services.add")}</Button>
          <p className="text-xs text-slate-600">
            {t("signup.terms", { terms: "@@T@@", privacy: "@@P@@" }).split(/(@@T@@|@@P@@)/).map((part, i) =>
              part === "@@T@@" ? <Link key={i} href="/kosullar" target="_blank" className="font-semibold underline">{t("home.terms")}</Link>
              : part === "@@P@@" ? <Link key={i} href="/gizlilik" target="_blank" className="font-semibold underline">{t("home.privacy")}</Link>
              : part)}
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(3)} disabled={busy}>{t("common.back")}</Button>
            <Button className="flex-1" onClick={() => void finish()} disabled={busy}>{busy ? <><Spinner />{t("signup.submitting")}</> : t("signup.submit")}</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
