"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Field } from "@/components/ui/field";
import { Badge, Card, CheckField } from "@/components/ui/form";
import { ConfirmDialog, Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client-api";
import { useI18n } from "@/lib/i18n/client";
import { usePanel } from "./ctx";
import type { Staff, Svc } from "./types";
import { money, svcName, useLoader } from "./util";

interface Draft { id?: string; nameTr: string; nameEn: string; durationMin: string; priceTry: string; bufferMin: string; active: boolean; staffIds: string[] }

const blank = (staff: Staff[]): Draft => ({ nameTr: "", nameEn: "", durationMin: "30", priceTry: "", bufferMin: "0", active: true, staffIds: staff.filter((s) => s.active).map((s) => s.id) });

export function ServicesView() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const { isOwner } = usePanel();
  const q = useLoader(async () => {
    const [services, staff] = await Promise.all([api<Svc[]>("/api/panel/services"), api<Staff[]>("/api/panel/staff")]);
    return { services, staff };
  }, []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [del, setDel] = useState<Svc | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});
  const staff = q.data?.staff ?? [];

  function open(s?: Svc) {
    setErr(null); setFe({});
    setDraft(s ? { id: s.id, nameTr: s.nameTr, nameEn: s.nameEn ?? "", durationMin: String(s.durationMin), priceTry: String(s.priceTry), bufferMin: String(s.bufferMin), active: s.active, staffIds: s.staffIds } : blank(staff));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const errs: Record<string, string> = {};
    const dur = Number(draft.durationMin), price = Number(draft.priceTry.replace(",", ".")), buf = Number(draft.bufferMin || 0);
    if (!draft.nameTr.trim()) errs.nameTr = t("err.validation");
    if (!Number.isInteger(dur) || dur < 5 || dur > 600) errs.durationMin = t("svc.errDuration");
    if (!Number.isFinite(price) || price < 0 || draft.priceTry.trim() === "") errs.priceTry = t("err.validation");
    if (!Number.isInteger(buf) || buf < 0 || buf > 240) errs.bufferMin = t("err.validation");
    setFe(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setErr(null);
    const body = { nameTr: draft.nameTr.trim(), nameEn: draft.nameEn.trim() || null, durationMin: dur, priceTry: price, bufferMin: buf, active: draft.active, staffIds: draft.staffIds };
    try {
      if (draft.id) await api(`/api/panel/services/${draft.id}`, { method: "PATCH", body });
      else await api("/api/panel/services", { method: "POST", body });
      toast(t("common.saved"), "success");
      setDraft(null);
      q.reload();
    } catch (e2) { setErr(errorMessage(e2, t)); } finally { setBusy(false); }
  }

  async function remove() {
    if (!del) return;
    setBusy(true);
    try {
      await api(`/api/panel/services/${del.id}`, { method: "DELETE" });
      toast(t("common.saved"), "success");
      setDel(null);
      q.reload();
    } catch (e) { toast(errorMessage(e, t), "error"); setDel(null); } finally { setBusy(false); }
  }

  const services = q.data?.services ?? [];
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3">
        <h2 className="flex-1 text-xl font-extrabold">{t("nav.services")}</h2>
        {isOwner ? <Button onClick={() => open()}>+ {t("svc.add")}</Button> : null}
      </div>
      {!isOwner ? <Alert tone="info" className="mt-3">{t("ownerOnly")}</Alert> : null}
      {q.error ? <Alert className="mt-3">{errorMessage(q.error, t)}</Alert> : null}
      {!q.loading && services.length === 0 && !q.error ? <p className="mt-6 text-slate-600">{t("svc.empty")}</p> : null}
      <ul className="mt-3 space-y-2">
        {services.map((s) => (
          <li key={s.id}>
            <Card as="div" className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{svcName(s, locale)}</p>
                <p className="text-sm text-slate-600">
                  {t("common.minutes", { n: s.durationMin })} · {money(s.priceTry, locale)}{s.bufferMin ? ` · ${t("svc.bufferShort", { n: s.bufferMin })}` : ""}
                </p>
                <p className="text-xs text-slate-600">{s.staffIds.length ? staff.filter((x) => s.staffIds.includes(x.id)).map((x) => x.name).join(", ") : t("svc.noStaff")}</p>
              </div>
              {!s.active ? <Badge>{t("svc.inactive")}</Badge> : null}
              {isOwner ? (
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => open(s)} aria-label={`${t("common.edit")}: ${svcName(s, locale)}`}>{t("common.edit")}</Button>
                  <Button variant="ghost" className="text-red-800" onClick={() => setDel(s)} aria-label={`${t("common.delete")}: ${svcName(s, locale)}`}>{t("common.delete")}</Button>
                </div>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>

      <Sheet open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? t("svc.edit") : t("svc.add")}>
        {draft ? (
          <form onSubmit={save} noValidate className="space-y-3">
            {err ? <Alert>{err}</Alert> : null}
            <Field label={t("svc.nameTr")} value={draft.nameTr} onChange={(e) => setDraft({ ...draft, nameTr: e.target.value })} error={fe.nameTr} maxLength={100} required data-autofocus />
            <Field label={t("svc.nameEn")} optional={t("common.optional")} value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} maxLength={100} />
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("svc.duration")} type="number" inputMode="numeric" min={5} max={600} step={5} value={draft.durationMin} onChange={(e) => setDraft({ ...draft, durationMin: e.target.value })} error={fe.durationMin} required />
              <Field label={t("svc.price")} type="number" inputMode="decimal" min={0} step="any" value={draft.priceTry} onChange={(e) => setDraft({ ...draft, priceTry: e.target.value })} error={fe.priceTry} required />
            </div>
            <Field label={t("svc.buffer")} hint={t("svc.bufferHint")} type="number" inputMode="numeric" min={0} max={240} step={5} value={draft.bufferMin} onChange={(e) => setDraft({ ...draft, bufferMin: e.target.value })} error={fe.bufferMin} />
            <fieldset>
              <legend className="mb-1 text-sm font-medium text-slate-800">{t("svc.staff")}</legend>
              {staff.filter((s) => s.active).map((s) => (
                <CheckField key={s.id} label={s.name} checked={draft.staffIds.includes(s.id)} onChange={(e) => setDraft({ ...draft, staffIds: e.target.checked ? [...draft.staffIds, s.id] : draft.staffIds.filter((x) => x !== s.id) })} />
              ))}
              <p className="text-xs text-slate-600">{t("svc.staffHint")}</p>
            </fieldset>
            <CheckField label={t("svc.active")} checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setDraft(null)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={busy}>{t("common.save")}</Button>
            </div>
          </form>
        ) : null}
      </Sheet>
      <ConfirmDialog open={!!del} title={t("svc.delTitle")} body={t("svc.delBody", { name: del ? svcName(del, locale) : "" })} confirmLabel={t("common.delete")} busy={busy} onConfirm={remove} onCancel={() => setDel(null)} />
    </div>
  );
}
