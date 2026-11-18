"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Field } from "@/components/ui/field";
import { Badge, Card, SelectField, TextareaField } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage, isCode } from "@/lib/client-api";
import { DEFAULT_BRAND } from "@/lib/brand-color";
import { SMS_PACKAGES } from "@/config/plans";
import { useI18n } from "@/lib/i18n/client";
import type { Key } from "@/lib/i18n/shared";
import { smsSegments } from "@/lib/messaging/segments";
import { withFooter } from "@/lib/messaging/templates";
import { usePanel } from "./ctx";
import { fmtDateTime, useLoader } from "./util";

interface Settings {
  smsSenderName: string | null; reminderOffsets: number[]; cancelHoursBefore: number; slotMinutes: number; minLeadMinutes: number;
  maxAdvanceDays: number; brandColor: string | null; logoUrl: string | null; coverUrl: string | null; locale: "tr" | "en"; timeZone: string;
}
const OFFSETS = [10080, 2880, 1440, 720, 240, 120, 60, 30];
const ZONES = ["Asia/Famagusta", "Asia/Nicosia", "Europe/Istanbul", "Europe/London"];
const SLOTS = [5, 10, 15, 20, 30, 60];
const offsetLabel = (m: number, t: ReturnType<typeof useI18n>["t"]) => (m % 1440 === 0 ? t("set.offDays", { n: m / 1440 }) : m % 60 === 0 ? t("set.offHours", { n: m / 60 }) : t("common.minutes", { n: m }));

export function SettingsView() {
  const { t } = useI18n();
  const { isOwner, tenant } = usePanel();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h2 className="text-xl font-extrabold">{t("nav.settings")}</h2>
      <PublicLink slug={tenant.slug} />
      <SmsCard />
      {isOwner ? <><Campaign /><SettingsForm /></> : <Alert tone="info">{t("ownerOnly")}</Alert>}
    </div>
  );
}

function PublicLink({ slug }: { slug: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [url, setUrl] = useState(`/${slug}`);
  useEffect(() => setUrl(`${window.location.origin}/${slug}`), [slug]);
  return (
    <Card aria-labelledby="link-h">
      <h3 id="link-h" className="font-bold">{t("set.publicLink")}</h3>
      <p className="mt-1 break-all text-sm text-slate-700" data-testid="public-url">{url}</p>
      <div className="mt-2 flex gap-2">
        <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(url).then(() => toast(t("set.copied"), "success"), () => toast(t("common.genericError"), "error"))}>{t("set.copy")}</Button>
        <a href={`/${slug}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center px-3 font-semibold text-brand underline">{t("panel.publicPage")}</a>
      </div>
    </Card>
  );
}

/* ───────────── SMS kredisi ───────────── */

interface Req { id: string; size: number; status: "open" | "fulfilled" | "rejected"; createdAt: string }

function SmsCard() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const { balance, isOwner, tenant } = usePanel();
  const reqs = useLoader(() => api<Req[]>("/api/panel/sms/requests"), []);
  const [pick, setPick] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function request(size: number) {
    setBusy(true);
    try {
      await api("/api/panel/sms/requests", { method: "POST", body: { size } });
      toast(t("sms.requested"), "success");
      reqs.reload();
    } catch (e) { toast(isCode(e, "conflict") ? t("sms.dup") : errorMessage(e, t), "error"); } finally { setBusy(false); setPick(null); }
  }

  return (
    <Card id="sms" aria-labelledby="sms-h" className="scroll-mt-20">
      <h3 id="sms-h" className="font-bold">{t("sms.title")}</h3>
      <p className="mt-1 text-3xl font-extrabold tabular-nums" data-testid="sms-balance">{balance ?? "…"} <span className="text-base font-semibold text-slate-600">{t("sms.credits")}</span></p>
      <p className="text-sm text-slate-600">{t("sms.note")}</p>
      {isOwner ? (
        <div className="mt-3">
          <p className="text-sm font-medium">{t("sms.request")}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {SMS_PACKAGES.map((n) => <Button key={n} variant="secondary" disabled={busy} onClick={() => setPick(n)}>{n} SMS</Button>)}
          </div>
        </div>
      ) : null}
      {(reqs.data ?? []).length ? (
        <ul className="mt-3 divide-y divide-slate-200 text-sm">
          {reqs.data!.slice(0, 5).map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-1.5">
              <span>{r.size} SMS · {fmtDateTime(r.createdAt, locale, tenant.timeZone)}</span>
              <Badge tone={r.status === "open" ? "amber" : r.status === "fulfilled" ? "green" : "slate"}>{t(`sms.st.${r.status}` as Key)}</Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <ConfirmDialog open={pick !== null} danger={false} title={t("sms.confirmTitle", { n: pick ?? 0 })} body={t("sms.confirmBody")} confirmLabel={t("sms.confirm")} busy={busy} onConfirm={() => pick && request(pick)} onCancel={() => setPick(null)} />
    </Card>
  );
}

/* ───────────── Kampanya (Salon+) ───────────── */

function Campaign() {
  const { t, locale } = useI18n();
  const { tenant, refreshBalance } = usePanel();
  const [text, setText] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<{ recipients: number; sent: number; failed: number; skipped: number } | null>(null);
  const info = smsSegments(withFooter(text, locale), undefined);

  async function send() {
    setBusy(true); setErr(null); setRes(null);
    try {
      setRes(await api("/api/panel/campaigns", { method: "POST", body: { text: text.trim() } }));
      setText("");
      refreshBalance();
    } catch (e) { setErr(errorMessage(e, t)); } finally { setBusy(false); setConfirm(false); }
  }

  return (
    <Card aria-labelledby="camp-h">
      <h3 id="camp-h" className="font-bold">{t("camp.title")}</h3>
      {!tenant.features.campaigns ? <Alert tone="info" className="mt-2">{t("camp.plus")}</Alert> : (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-slate-600">{t("camp.note")}</p>
          {err ? <Alert>{err}</Alert> : null}
          {res ? <Alert tone="success">{t("camp.result", { sent: res.sent, n: res.recipients, failed: res.failed + res.skipped })}</Alert> : null}
          <TextareaField label={t("camp.text")} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} hint={t("camp.counter", { chars: text.trim().length, seg: text.trim() ? info.segments : 0 })} />
          <Button disabled={busy || text.trim().length < 3} onClick={() => setConfirm(true)}>{t("camp.send")}</Button>
        </div>
      )}
      <ConfirmDialog open={confirm} danger={false} title={t("camp.confirmTitle")} body={t("camp.confirmBody", { seg: info.segments })} confirmLabel={t("camp.send")} busy={busy} onConfirm={send} onCancel={() => setConfirm(false)} />
    </Card>
  );
}

/* ───────────── Ayar formu ───────────── */

function SettingsForm() {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const q = useLoader(() => api<Settings>("/api/panel/settings"), []);
  const [f, setF] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});
  useEffect(() => { if (q.data) setF(q.data); }, [q.data]);

  if (q.error) return <Alert>{errorMessage(q.error, t)}</Alert>;
  if (!f) return <p className="text-slate-600">{t("common.loading")}</p>;
  const set = (p: Partial<Settings>) => setF({ ...f, ...p });
  const offs = [...new Set([...OFFSETS, ...f.reminderOffsets])].sort((a, b) => b - a);
  const zones = ZONES.includes(f.timeZone) ? ZONES : [f.timeZone, ...ZONES];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f) return;
    const errs: Record<string, string> = {};
    if (f.smsSenderName && !/^[A-Za-z0-9 .-]{1,11}$/.test(f.smsSenderName)) errs.smsSenderName = t("set.errSender");
    if (f.reminderOffsets.length < 1 || f.reminderOffsets.length > 3) errs.reminderOffsets = t("set.errOffsets");
    for (const k of ["logoUrl", "coverUrl"] as const) if (f[k] && !f[k]!.startsWith("https://")) errs[k] = t("set.errHttps");
    if (!Number.isInteger(f.cancelHoursBefore) || f.cancelHoursBefore < 0 || f.cancelHoursBefore > 720) errs.cancelHoursBefore = t("err.validation");
    if (!Number.isInteger(f.minLeadMinutes) || f.minLeadMinutes < 0 || f.minLeadMinutes > 10080) errs.minLeadMinutes = t("err.validation");
    if (!Number.isInteger(f.maxAdvanceDays) || f.maxAdvanceDays < 1 || f.maxAdvanceDays > 365) errs.maxAdvanceDays = t("err.validation");
    setFe(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setErr(null);
    try {
      const body: Settings = {
        smsSenderName: f.smsSenderName?.trim() || null, reminderOffsets: [...f.reminderOffsets].sort((a, b) => b - a), cancelHoursBefore: f.cancelHoursBefore,
        slotMinutes: f.slotMinutes, minLeadMinutes: f.minLeadMinutes, maxAdvanceDays: f.maxAdvanceDays, brandColor: f.brandColor, logoUrl: f.logoUrl?.trim() || null,
        coverUrl: f.coverUrl?.trim() || null, locale: f.locale, timeZone: f.timeZone,
      };
      await api("/api/panel/settings", { method: "PATCH", body });
      toast(t("common.saved"), "success");
      router.refresh();
    } catch (x) { setErr(x instanceof ApiError && x.code === "validation" ? t("err.validation") : errorMessage(x, t)); } finally { setBusy(false); }
  }

  const num = (v: string) => (v === "" ? NaN : Number(v));
  return (
    <form onSubmit={save} noValidate className="space-y-6">
      {err ? <Alert>{err}</Alert> : null}
      <Card aria-labelledby="rem-h" className="space-y-3">
        <h3 id="rem-h" className="font-bold">{t("set.messages")}</h3>
        <Field label={t("set.sender")} hint={t("set.senderHint")} value={f.smsSenderName ?? ""} onChange={(e) => set({ smsSenderName: e.target.value })} maxLength={11} error={fe.smsSenderName} />
        <fieldset>
          <legend className="text-sm font-medium text-slate-800">{t("set.reminders")}</legend>
          <p className="text-xs text-slate-600">{t("set.remindersHint")}</p>
          <div className="mt-1 grid grid-cols-2 gap-x-3 sm:grid-cols-4">
            {offs.map((m) => (
              <label key={m} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--brand))]" checked={f.reminderOffsets.includes(m)}
                  onChange={(e) => set({ reminderOffsets: e.target.checked ? [...f.reminderOffsets, m] : f.reminderOffsets.filter((x) => x !== m) })} />
                {offsetLabel(m, t)}
              </label>
            ))}
          </div>
          {fe.reminderOffsets ? <p role="alert" className="text-sm font-medium text-red-700">{fe.reminderOffsets}</p> : null}
        </fieldset>
        <SelectField label={t("set.locale")} hint={t("set.localeHint")} value={f.locale} onChange={(e) => set({ locale: e.target.value as "tr" | "en" })}>
          <option value="tr">Türkçe</option><option value="en">English</option>
        </SelectField>
      </Card>

      <Card aria-labelledby="book-h" className="space-y-3">
        <h3 id="book-h" className="font-bold">{t("set.booking")}</h3>
        <Field label={t("set.cancelHours")} hint={t("set.cancelHoursHint")} type="number" inputMode="numeric" min={0} max={720} value={Number.isNaN(f.cancelHoursBefore) ? "" : f.cancelHoursBefore} onChange={(e) => set({ cancelHoursBefore: num(e.target.value) })} error={fe.cancelHoursBefore} />
        <SelectField label={t("set.slot")} value={f.slotMinutes} onChange={(e) => set({ slotMinutes: Number(e.target.value) })}>
          {SLOTS.map((m) => <option key={m} value={m}>{t("common.minutes", { n: m })}</option>)}
        </SelectField>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("set.minLead")} hint={t("set.minLeadHint")} type="number" inputMode="numeric" min={0} value={Number.isNaN(f.minLeadMinutes) ? "" : f.minLeadMinutes} onChange={(e) => set({ minLeadMinutes: num(e.target.value) })} error={fe.minLeadMinutes} />
          <Field label={t("set.maxAdvance")} hint={t("set.maxAdvanceHint")} type="number" inputMode="numeric" min={1} max={365} value={Number.isNaN(f.maxAdvanceDays) ? "" : f.maxAdvanceDays} onChange={(e) => set({ maxAdvanceDays: num(e.target.value) })} error={fe.maxAdvanceDays} />
        </div>
        <SelectField label={t("set.tz")} value={f.timeZone} onChange={(e) => set({ timeZone: e.target.value })}>
          {zones.map((z) => <option key={z} value={z}>{ZONES.includes(z) ? t(`tz.${z}` as Key) : z}</option>)}
        </SelectField>
      </Card>

      <Card aria-labelledby="look-h" className="space-y-3">
        <h3 id="look-h" className="font-bold">{t("set.look")}</h3>
        <div>
          <label htmlFor="brand-color" className="mb-1.5 block text-sm font-medium text-slate-800">{t("set.brand")}</label>
          <div className="flex items-center gap-3">
            <input id="brand-color" type="color" value={f.brandColor ?? DEFAULT_BRAND} onChange={(e) => set({ brandColor: e.target.value })} className="h-11 w-16 cursor-pointer rounded-lg border border-slate-300 bg-white p-1" />
            <span className="text-sm tabular-nums text-slate-700">{f.brandColor ?? DEFAULT_BRAND}</span>
            {f.brandColor ? <Button variant="ghost" onClick={() => set({ brandColor: null })}>{t("set.brandReset")}</Button> : null}
          </div>
        </div>
        <Field label={t("set.logo")} optional={t("common.optional")} type="url" inputMode="url" placeholder="https://…" value={f.logoUrl ?? ""} onChange={(e) => set({ logoUrl: e.target.value })} error={fe.logoUrl} />
        <Field label={t("set.cover")} optional={t("common.optional")} type="url" inputMode="url" placeholder="https://…" value={f.coverUrl ?? ""} onChange={(e) => set({ coverUrl: e.target.value })} error={fe.coverUrl} />
      </Card>
      <div className="flex justify-end pb-2"><Button type="submit" disabled={busy} className="w-full sm:w-auto">{t("common.save")}</Button></div>
    </form>
  );
}
