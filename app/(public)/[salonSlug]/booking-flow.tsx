"use client";
import Link from "next/link";
import { serviceQuoteSchema, type ServiceQuote } from "@/lib/service-quote";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Field, Spinner } from "@/components/ui/field";
import { Button, buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { dayParts, formatPrice, formatWhen, initials } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { addDays } from "@/lib/time";

interface Service { id: string; nameTr: string; nameEn: string | null; durationMin: number; priceTry: number; staffIds: string[] }
interface Staff { id: string; name: string; photoUrl: string | null }
interface Slot { startsAt: string; time: string; staffIds: string[]; offers: ServiceQuote[] }
interface Props { slug: string; salonName: string; timeZone: string; today: string; maxAdvanceDays: number; services: Service[]; staff: Staff[] }
interface Done { cancelUrl: string; startsAt: string }

const STEPS = 4;
const hue = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

function Avatar({ name, photoUrl, size = "h-14 w-14" }: { name: string; photoUrl?: string | null; size?: string }) {
  if (photoUrl) {
    return <img src={photoUrl} alt="" className={cn(size, "shrink-0 staff-portrait text-clay object-cover")} />;
  }
  return (
    <span aria-hidden className={cn(size, "grid shrink-0 place-items-center staff-portrait text-base font-bold")} style={{ backgroundColor: `hsl(${hue(name)} 28% 20%)`, color: `hsl(${hue(name)} 60% 78%)` }}>
      {initials(name)}
    </span>
  );
}

export function BookingFlow({ slug, salonName, timeZone, today, maxAdvanceDays, services, staff }: Props) {
  const { t, locale } = useI18n();
  const [step, setStep] = useState(1);
  const [service, setService] = useState<Service | null>(null);
  const [staffId, setStaffId] = useState<string>("any");
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [quote, setQuote] = useState<ServiceQuote | null>(null);
  const slotsGeneration = useRef(0);
  const submitting = useRef(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+90 ");
  const [email, setEmail] = useState("");
  const [kvkk, setKvkk] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [termsChanged, setTermsChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dayRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const svcName = (s: Service) => (locale === "en" && s.nameEn ? s.nameEn : s.nameTr);
  const eligibleStaff = useMemo(() => (service ? staff.filter((s) => service.staffIds.includes(s.id)) : []), [service, staff]);
  const days = useMemo(() => Array.from({ length: maxAdvanceDays }, (_, i) => addDays(today, i)), [today, maxAdvanceDays]);
  const staffLabel = quote ? (staff.find(s => s.id === quote.staffId)?.name ?? "") : staffId === "any" ? t("b.staff.any") : (staff.find((s) => s.id === staffId)?.name ?? "");

  const quotePrice = quote ? `${new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(quote.priceTry))} TL` : "";

  // adım değişince başlığa odaklan (ekran okuyucu + klavye)
  useEffect(() => { headingRef.current?.focus(); window.scrollTo({ top: 0 }); }, [step, done]);

  function resetSlots() {
    ++slotsGeneration.current; setSlots(null); setSlot(null); setQuote(null);
  }

  const loadSlots = useCallback(async (signal?: AbortSignal) => {
    if (!service) return;
    const generation = ++slotsGeneration.current;
    setSlots(null); setSlot(null); setQuote(null);
    try {
      const qs = new URLSearchParams({ serviceId: service.id, staffId, date });
      const res = await fetch(`/api/public/${slug}/slots?${qs}`, { signal, cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as { slots: Slot[] };
      if (signal?.aborted || generation !== slotsGeneration.current) return;
      // Missing/malformed offers cannot silently fall back to catalog prices.
      const safeSlots = j.slots.filter(s => Array.isArray(s.offers)).map(s => ({ ...s, offers: s.offers.flatMap(raw => {
        const parsed = serviceQuoteSchema.safeParse(raw);
        if (!parsed.success) return [];
        const q = parsed.data;
        return q.serviceId === service.id && q.startsAt === s.startsAt && s.staffIds.includes(q.staffId) && staff.some(p => p.id === q.staffId) && (staffId === "any" || q.staffId === staffId) ? [q] : [];
      }) })).filter(s => s.offers.length > 0);
      setSlots(safeSlots);
    } catch (e) {
      if (signal?.aborted || generation !== slotsGeneration.current || (e as Error).name === "AbortError") return;
      setSlots([]);
      setBanner(t("common.genericError"));
    }
  }, [service, staffId, date, slug, staff, t]);

  useEffect(() => {
    if (step !== 3) return;
    const ac = new AbortController();
    void loadSlots(ac.signal);
    return () => ac.abort();
  }, [step, loadSlots]);

  useEffect(() => { if (step === 3) dayRefs.current[date]?.scrollIntoView({ inline: "center", block: "nearest" }); }, [step, date]);

  const groups = useMemo(() => {
    const g = { morning: [] as Slot[], noon: [] as Slot[], evening: [] as Slot[] };
    for (const s of slots ?? []) {
      const h = Number(s.time.slice(0, 2));
      (h < 12 ? g.morning : h < 17 ? g.noon : g.evening).push(s);
    }
    return g;
  }, [slots]);

  // Canlı doğrulama; hata yalnız alan odağı bırakınca (touched) ya da ilk gönderim denemesinden sonra gösterilir
  const fieldErrors: Record<string, string> = {};
  if (name.trim().length < 2) fieldErrors.name = t("b.details.errName");
  if (phone.replace(/\D/g, "").length < 7) fieldErrors.phone = t("b.details.errPhone");
  if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) fieldErrors.email = t("b.details.errEmail");
  if (!kvkk) fieldErrors.kvkk = t("b.details.errKvkk");
  const errors: Record<string, string> = {};
  for (const k of Object.keys(fieldErrors)) if (submitted || touched[k]) errors[k] = fieldErrors[k] ?? "";
  if (serverErrors.phone && !errors.phone) errors.phone = serverErrors.phone;
  const touch = (k: string) => setTouched((p) => (p[k] ? p : { ...p, [k]: true }));

  function validateDetails() {
    setSubmitted(true);
    return Object.keys(fieldErrors).length === 0;
  }

  async function submit() {
    if (submitting.current || !service || !slot || !quote || !validateDetails()) return;
    submitting.current = true;
    setBusy(true); setBanner(null); setTermsChanged(false); setServerErrors({});
    // The displayed exact offer is frozen for this request; no alternate-staff fallback.
    const chosen = quote.staffId;
    try {
      const res = await fetch(`/api/public/${slug}/appointments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id, staffId: chosen, startsAt: slot.startsAt, quote,
          customer: { name: name.trim(), phone: phone.trim(), ...(email.trim() ? { email: email.trim() } : {}), locale },
          kvkkAccepted: true, marketingConsent: false,
        }),
      });
      if (res.status === 201) {
        const j = (await res.json()) as Done;
        setDone(j);
        return;
      }
      const j = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
      const code = j.error?.code;
      if (res.status === 409 || code === "slot_taken") {
        if (code === "conflict") setTermsChanged(true); else setBanner(t("b.err.slotTaken")); setSlot(null); setQuote(null); setStep(3); // slotlar adım 3 efektiyle tazelenir
      } else if (res.status === 422) {
        setBanner(t("b.err.unavailable")); setSlot(null); setQuote(null); setStep(3);
      } else if (res.status === 423) {
        window.location.reload();
      } else if (res.status === 429) {
        setBanner(t("common.rateLimited"));
      } else if (res.status === 404) {
        setBanner(t("b.err.notFound"));
      } else if (code === "validation" || code === "invalid_phone") {
        if (JSON.stringify(j).includes("invalid_phone") || code === "invalid_phone") setServerErrors({ phone: t("b.details.errPhone") });
        else setBanner(t("b.err.validation"));
      } else setBanner(t("common.genericError"));
    } catch {
      setBanner(t("common.genericError"));
    } finally {
      submitting.current = false; setBusy(false);
    }
  }

  const canNext = step === 1 ? !!service : step === 2 ? true : step === 3 ? !!slot && !!quote : true;
  function next() {
    setBanner(null); setTermsChanged(false);
    if (step < STEPS) setStep(step + 1);
  }
  function back() {
    setBanner(null); setTermsChanged(false);
    if (step > 1) setStep(step - 1);
  }

  /* ───────── başarı ekranı ───────── */
  if (done && service && slot && quote) {
    const full = typeof window !== "undefined" ? `${window.location.origin}${done.cancelUrl}` : done.cancelUrl;
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-t-[3rem] rounded-b-xl border border-line bg-surface p-6 text-center">
          <svg aria-hidden viewBox="0 0 88 72" className="booking-success-mark mx-auto h-[72px] w-[88px]" fill="none">
            <path d="M18 37C18 22 28 11 44 11c14 0 26 10 26 25S61 62 44 62 18 52 18 37Z" fill="#1F1B12" />
            <path d="m33 37 8 8 15-17" stroke="#C9A96E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="m9 22-4-4m6 17-6 1m66-17 5-5m1 20 6-2M21 8l-2-4" stroke="#E58F78" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <h2 ref={headingRef} tabIndex={-1} className="booking-step-heading display-heading mt-3 text-3xl font-semibold">{t("b.success.title")}</h2>
          <p className="mt-1 text-slate-700">{t("b.success.sub", { name: name.trim().split(/\s+/)[0] ?? "" })}</p>
          <dl className="mt-5 divide-y divide-line rounded-lg bg-paper text-left text-sm">
            <Row k={t("b.summary.service")} v={svcName(service)} />
            <Row k={t("b.summary.staff")} v={staffLabel} />
            <Row k={t("b.summary.when")} v={formatWhen(slot.startsAt, locale, timeZone)} />
            <Row k={t("b.summary.duration")} v={t("common.minutes", { n: quote.durationMin })} />
            <Row k={t("b.summary.total")} v={quotePrice} />
          </dl>
          <p className="mt-5 text-sm text-slate-700">{t("b.success.cancelHint")}</p>
          <a href={done.cancelUrl} data-testid="cancel-link" className={buttonClass("primary", "mt-2 w-full")}>{t("b.success.cancelLink")}</a>
          <p className="mt-2 break-all text-xs text-slate-500">{full}</p>
          <div className="mt-4 flex justify-center gap-4 text-sm font-medium">
            <Link href={`/${slug}/randevularim`} className="text-brand underline">{t("b.myAppts")}</Link>
            <a href={`/${slug}`} className="text-brand underline">{t("b.success.another")}</a>
          </div>
        </div>
      </main>
    );
  }

  const titles = [t("b.service.title"), t("b.staff.title"), t("b.date.title"), t("b.details.title")];

  return (
    <main className="mx-auto max-w-2xl px-4 pb-32 pt-5">
      <div className="mb-4">
        <p className="text-sm font-medium text-slate-700" aria-live="polite">{t("b.steps", { n: step, total: STEPS })}</p>
        <div className="mt-1.5 flex gap-1.5" aria-hidden>
          {Array.from({ length: STEPS }, (_, i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < step ? "bg-brand" : "bg-slate-200")} />)}
        </div>
      </div>
      <h2 ref={headingRef} tabIndex={-1} className="booking-step-heading display-heading text-2xl font-semibold">{titles[step - 1]}</h2>
      {step === 1 ? <p className="mt-1 text-sm text-slate-700">{t("b.service.sub")}</p> : null}
      {termsChanged || banner ? <Alert className="mt-3">{termsChanged ? t("b.err.quoteChanged") : banner}</Alert> : null}

      {/* Adım 1 – hizmet */}
      {step === 1 ? (
        <ul className="mt-4 space-y-3">
          {services.length === 0 ? <li><Alert tone="info">{t("b.service.empty")}</Alert></li> : null}
          {services.map((s) => {
            const sel = service?.id === s.id;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  aria-pressed={sel}
                  onClick={() => { setService(s); if (staffId !== "any" && !s.staffIds.includes(staffId)) setStaffId("any"); resetSlots(); }}
                  className={cn("booking-option flex w-full min-h-16 items-center justify-between gap-3 rounded-lg border bg-surface p-4 text-left transition", sel ? "border-brand" : "border-line hover:border-olive")}
                >
                  <span>
                    <span className="block font-semibold">{svcName(s)}</span>
                    <span className="mt-0.5 block text-sm text-slate-600">{t("common.minutes", { n: s.durationMin })}</span>
                  </span>
                  <span className="shrink-0 font-bold">{formatPrice(s.priceTry, locale)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* Adım 2 – personel */}
      {step === 2 ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <li>
            <StaffCard selected={staffId === "any"} onClick={() => { setStaffId("any"); resetSlots(); }} title={t("b.staff.any")} sub={t("b.staff.anySub")}
              avatar={<span aria-hidden className="grid h-14 w-14 place-items-center staff-portrait bg-sand text-xl text-olive">★</span>} />
          </li>
          {eligibleStaff.map((s) => (
            <li key={s.id}>
              <StaffCard selected={staffId === s.id} onClick={() => { setStaffId(s.id); resetSlots(); }} title={s.name} avatar={<Avatar name={s.name} photoUrl={s.photoUrl} />} />
            </li>
          ))}
        </ul>
      ) : null}

      {/* Adım 3 – gün + saat */}
      {step === 3 ? (
        <div className="mt-4">
          <div role="group" aria-label={t("b.date.title")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-none">
            {days.map((d) => {
              const p = dayParts(d, locale);
              const sel = d === date;
              return (
                <button
                  key={d}
                  ref={(el) => { dayRefs.current[d] = el; }}
                  type="button"
                  aria-pressed={sel}
                  aria-label={p.long}
                  onClick={() => { if (date !== d) { setDate(d); resetSlots(); } }}
                  className={cn("flex min-h-20 w-16 shrink-0 flex-col items-center justify-center booking-option rounded-xl border text-sm", sel ? "border-brand" : "border-line bg-surface hover:border-olive")}
                >
                  <span className="text-xs font-medium opacity-90">{d === today ? t("b.date.today") : p.weekday}</span>
                  <span className="text-xl font-extrabold leading-tight">{p.day}</span>
                  <span className="text-xs opacity-90">{p.month}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4" aria-live="polite" aria-busy={slots === null}>
            {slots === null ? (
              <p className="flex items-center gap-2 rounded-lg border border-line bg-surface p-4 text-sm text-slate-700"><Spinner />{t("b.slot.loading")}</p>
            ) : slots.length === 0 ? (
              <Alert tone="info">{t("b.slot.none")}</Alert>
            ) : (
              (["morning", "noon", "evening"] as const).map((g) =>
                groups[g].length ? (
                  <section key={g} className="mb-4" aria-label={t(`b.slot.${g}`)}>
                    <h3 className="mb-2 border-b border-line pb-2 text-sm font-bold text-olive">{t(`b.slot.${g}`)}</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {groups[g].map((s) => (
                        <button
                          key={s.startsAt}
                          type="button"
                          aria-pressed={slot?.startsAt === s.startsAt}
                          onClick={() => { setSlot(s); setQuote(s.offers[0] ?? null); }}
                          className={cn("booking-option min-h-11 rounded-lg border text-sm font-semibold", slot?.startsAt === s.startsAt ? "border-brand" : "border-line bg-surface hover:border-olive")}
                        >
                          {s.time}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null,
              )
            )}
          </div>
        </div>
      ) : null}

      {/* Adım 4 – bilgiler */}
      {step === 4 && service && slot && quote ? (
        <form id="booking-form" className="mt-4 space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <section data-quote-price={quote.priceTry} aria-label={t("b.summary.title")} className="rounded-lg border border-line bg-surface p-4 text-sm">
            <p className="font-semibold">{salonName}</p>
            <dl className="mt-2 divide-y divide-slate-100">
              <Row k={t("b.summary.service")} v={svcName(service)} />
              <Row k={t("b.summary.staff")} v={staffLabel} />
              <Row k={t("b.summary.when")} v={formatWhen(slot.startsAt, locale, timeZone)} />
              <Row k={t("b.summary.duration")} v={t("common.minutes", { n: quote.durationMin })} />
              <Row k={t("b.summary.total")} v={quotePrice} />
            </dl>
          </section>
          <Field label={t("b.details.name")} name="name" autoComplete="name" value={name} onChange={(e) => { setName(e.target.value); if (serverErrors.name) setServerErrors({}); }} onBlur={() => touch("name")} error={errors.name} required />
          <Field label={t("b.details.phone")} name="phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => { setPhone(e.target.value); if (serverErrors.phone) setServerErrors({}); }} onBlur={() => touch("phone")} hint={t("b.details.phoneHint")} error={errors.phone} required />
          <Field label={t("b.details.email")} optional={t("common.optional")} name="email" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); if (serverErrors.email) setServerErrors({}); }} onBlur={() => touch("email")} error={errors.email} />
          <div>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="kvkk" checked={kvkk} onChange={(e) => { setKvkk(e.target.checked); touch("kvkk"); }} aria-invalid={errors.kvkk ? true : undefined} aria-describedby={errors.kvkk ? "kvkk-err" : undefined} aria-required className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--brand))]" />
              <span>
                {t("b.details.kvkkPre")}
                <Link href="/gizlilik" target="_blank" className="font-semibold text-brand underline">{t("b.details.kvkkLink")}</Link>
                {t("b.details.kvkkPost")}
              </span>
            </label>
            {errors.kvkk ? <p id="kvkk-err" role="alert" className="mt-1 text-sm font-medium text-red-400">{errors.kvkk}</p> : null}
          </div>
          <p className="text-sm text-slate-700">{t("b.details.marketingInfo")} <Link href={`/${slug}/randevularim`} className="font-semibold text-brand underline">{t("b.details.marketingManage")}</Link></p>
        </form>
      ) : null}

      {/* Sabit alt çubuk */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 pb-safe pt-3">
          {step > 1 ? <Button variant="secondary" onClick={back} disabled={busy}>{t("common.back")}</Button> : null}
          {step < STEPS ? (
            <Button key="next" className="flex-1" onClick={next} disabled={!canNext}>{t("common.next")}</Button>
          ) : (
            <Button key="confirm" type="submit" form="booking-form" className="flex-1" disabled={busy}>
              {busy ? <><Spinner />{t("b.confirming")}</> : t("b.confirm")}
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-2.5 first:pt-2.5">
      <dt className="text-slate-600">{k}</dt>
      <dd className="text-right font-semibold">{v}</dd>
    </div>
  );
}

function StaffCard({ selected, onClick, title, sub, avatar }: { selected: boolean; onClick: () => void; title: string; sub?: string; avatar: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn("booking-option flex h-full min-h-32 w-full flex-col items-center justify-center gap-3 rounded-xl border bg-surface p-3 text-center", selected ? "border-brand" : "border-line hover:border-olive")}
    >
      {avatar}
      <span className="text-sm font-semibold leading-tight">{title}</span>
      {sub ? <span className="text-xs text-slate-600">{sub}</span> : null}
    </button>
  );
}
