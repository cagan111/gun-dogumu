"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, Field } from "@/components/ui/field";
import { Badge, Card, TextareaField } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage, isCode } from "@/lib/client-api";
import { useI18n } from "@/lib/i18n/client";
import type { Key } from "@/lib/i18n/shared";
import { usePanel } from "./ctx";
import { fmtDateTime, money, statusTone, svcName } from "./util";

interface Cust { id: string; name: string; phone: string; email: string | null; noShowCount: number; marketingConsent: boolean; createdAt: string }
interface Slim { id: string; startsAt: string; status: string; priceTry: number; service: { nameTr: string; nameEn: string | null }; staffName: string }
interface Detail extends Cust { notesEnabled: boolean; notes: string | null; upcoming: Slim[]; past: Slim[] }

export function CustomersView() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}

function Inner() {
  const { t } = useI18n();
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const openId = sp.get("id");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Cust[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<unknown>(null);
  const seq = useRef(0);

  useEffect(() => { const h = setTimeout(() => { setTerm(q.trim()); setPage(1); }, 300); return () => clearTimeout(h); }, [q]);
  useEffect(() => {
    const id = ++seq.current;
    setLoading(true);
    api<{ total: number; customers: Cust[] }>(`/api/panel/customers?page=${page}&pageSize=25${term ? `&q=${encodeURIComponent(term)}` : ""}`).then(
      (r) => { if (id !== seq.current) return; setRows((p) => (page === 1 ? r.customers : [...p, ...r.customers])); setTotal(r.total); setErr(null); setLoading(false); },
      (e) => { if (id === seq.current) { setErr(e); setLoading(false); } },
    );
  }, [term, page]);

  const close = useCallback(() => router.replace(path), [router, path]);

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-xl font-extrabold">{t("nav.customers")}</h2>
      <form role="search" onSubmit={(e) => e.preventDefault()} className="mt-3">
        <Field label={t("cust.search")} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("cust.searchPh")} autoComplete="off" />
      </form>
      {err ? <Alert className="mt-3">{errorMessage(err, t)}</Alert> : null}
      <p className="mt-3 text-sm text-slate-600" aria-live="polite">{t("cust.total", { n: total })}</p>
      <ul className="mt-2 space-y-2">
        {rows.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => router.replace(`${path}?id=${c.id}`)} className="block w-full text-left">
              <Card as="div" className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{c.name}</p>
                  <p className="text-sm text-slate-600">{c.phone}</p>
                </div>
                {c.noShowCount > 0 ? <Badge tone="red">{t("cust.noShows", { n: c.noShowCount })}</Badge> : null}
              </Card>
            </button>
          </li>
        ))}
      </ul>
      {!loading && rows.length === 0 && !err ? <p className="mt-4 text-slate-600">{t("cust.empty")}</p> : null}
      {rows.length < total ? <div className="mt-4 flex justify-center"><Button variant="secondary" disabled={loading} onClick={() => setPage((p) => p + 1)}>{t("common.more")}</Button></div> : null}
      <DetailSheet id={openId} onClose={close} />
    </div>
  );
}

function ApptList({ title, list }: { title: string; list: Slim[] }) {
  const { t, locale } = useI18n();
  const { tenant } = usePanel();
  if (!list.length) return null;
  return (
    <section className="mt-4">
      <h3 className="font-bold">{title}</h3>
      <ul className="mt-1 divide-y divide-slate-200 text-sm">
        {list.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{fmtDateTime(a.startsAt, locale, tenant.timeZone)}</span>
              <span className="text-slate-600">{svcName(a.service, locale)} · {a.staffName} · {money(a.priceTry, locale)}</span>
            </span>
            <Badge tone={statusTone(a.status)}>{t(`st.${a.status}` as Key)}</Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DetailSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const { tenant } = usePanel();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [noteErr, setNoteErr] = useState<string | null>(null);

  useEffect(() => {
    setD(null); setErr(null); setNoteErr(null);
    if (!id) return;
    let live = true;
    api<Detail>(`/api/panel/customers/${id}`).then((r) => { if (live) { setD(r); setNotes(r.notes ?? ""); } }, (e) => { if (live) setErr(errorMessage(e, t)); });
    return () => { live = false; };
  }, [id, t]);

  async function saveNotes() {
    if (!d) return;
    setBusy(true); setNoteErr(null);
    try {
      const r = await api<Detail>(`/api/panel/customers/${d.id}`, { method: "PATCH", body: { notes: notes.trim() || null } });
      setD(r);
      toast(t("common.saved"), "success");
    } catch (e) { setNoteErr(isCode(e, "plan_feature") ? t("cust.notesPro") : errorMessage(e, t)); } finally { setBusy(false); }
  }

  return (
    <Sheet open={!!id} onClose={onClose} title={d?.name ?? t("cust.detail")} wide>
      {err ? <Alert>{err}</Alert> : null}
      {!d && !err ? <p className="text-slate-600">{t("common.loading")}</p> : null}
      {d ? (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={`tel:${d.phone}`} className="font-semibold text-brand underline">{d.phone}</a>
            {d.email ? <span className="text-sm text-slate-600">{d.email}</span> : null}
            <Badge tone={d.noShowCount > 0 ? "red" : "slate"}>{t("cust.noShows", { n: d.noShowCount })}</Badge>
            {d.marketingConsent ? <Badge tone="green">{t("cust.consent")}</Badge> : null}
          </div>
          <p className="mt-1 text-xs text-slate-600">{t("cust.since", { date: fmtDateTime(d.createdAt, locale, tenant.timeZone) })}</p>
          <div className="mt-4">
            {d.notesEnabled ? (
              <>
                <TextareaField label={t("cust.notes")} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} error={noteErr} />
                <Button className="mt-2" onClick={saveNotes} disabled={busy}>{t("common.save")}</Button>
              </>
            ) : <Alert tone="info">{t("cust.notesPro")}</Alert>}
          </div>
          <ApptList title={t("cust.upcoming")} list={d.upcoming} />
          <ApptList title={t("cust.past")} list={d.past} />
        </div>
      ) : null}
    </Sheet>
  );
}
