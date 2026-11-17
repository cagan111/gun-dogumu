import type { Metadata } from "next";
import { Button, buttonClass } from "@/components/ui/button";
import { Alert, Field, Spinner } from "@/components/ui/field";
import { Badge, Card } from "@/components/ui/form";
import { ICON_NAMES, Icon } from "@/components/ui/icons";
import { Chip, EmptyState, Eyebrow, Stamp, Surface } from "@/components/ui/kit";

export const metadata: Metadata = { title: "Tasarım rehberi", robots: { index: false, follow: false } };

const LIGHT = [
  ["paper", "#F8F3E9", "sayfa zemini", "—"], ["bone", "#FFFCF6", "kart yüzeyi", "—"], ["sand", "#EFE3CD", "vurgu bölümü", "—"],
  ["line", "#DCCFB9", "süs kenarlık", "1.39"], ["line-strong", "#A89878", "alan kenarlığı", "2.56"], ["ink", "#10262A", "ana metin", "14.25"],
  ["ink-soft", "#3D5156", "ikincil metin", "7.57"], ["mute", "#4E5F62", "yardımcı metin", "6.05"], ["sea", "#1F5A60", "birincil / bağlantı", "7.06"],
  ["olive", "#4A5A36", "doğa tonu", "6.76"], ["clay", "#A8432B", "sıcak vurgu, mühür", "5.42"], ["brass-deep", "#85590F", "pirinç metin", "5.53"], ["brass", "#C8932F", "yalnız dekor", "2.48"],
] as const;
const DARK = [
  ["ink-deep", "#0E2326", "koyu zemin"], ["ink-2", "#153035", "koyu kart"], ["ink-3", "#1D3E44", "koyu kenar"], ["on-ink", "#F4ECDD", "metin 13.9"], ["on-ink-mute", "#A9BDBE", "ikincil 8.3"], ["brass-bright", "#E2B15A", "vurgu 8.3"], ["glow", "#F3C97A", "ışık"],
] as const;
const SEM = [
  ["Onaylı", "ok", "5.42"], ["Bekliyor", "warn", "5.98"], ["İptal", "danger", "5.89"], ["Bilgi", "info", "6.37"],
] as const;
const SEM_CLS: Record<string, string> = { ok: "bg-ok-bg text-ok", warn: "bg-warn-bg text-warn", danger: "bg-danger-bg text-danger", info: "bg-info-bg text-info" };
const SCALE = [
  ["display-xl", "text-display-xl md:text-[4.75rem] md:leading-none", "Ayna Saati"], ["display-lg", "text-display-lg md:text-[3.25rem]", "Günün içinden bir saat"],
  ["display-md", "text-display-md md:text-[2rem]", "Bugün 9 randevu"],
] as const;
const SVC = [["sea", "#1F5A60", "Saç kesimi"], ["clay", "#A8432B", "Sakal"], ["olive", "#4A5A36", "Fön"], ["brass-deep", "#85590F", "Boya"], ["plum", "#6B3A5B", "Manikür"], ["slate", "#3F5866", "Bakım"]] as const;

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="font-display mt-16 scroll-mt-20 border-b border-line pb-3 text-display-md md:text-[2rem]">{children}</h2>;
}

export default function Tasarim() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 md:px-8">
      <Eyebrow>Dahili rehber · noindex</Eyebrow>
      <h1 className="font-display mt-2 text-display-xl md:text-[4.75rem] md:leading-none">Ayna Saati <em className="text-sea">tasarım sistemi</em></h1>
      <p className="mt-4 max-w-[62ch] text-lg text-ink-soft">Token ve bileşenlerin canlı karşılığı. Kaynak: <code>docs/design/DESIGN.md</code>. Bu sayfadaki her şey gerçek sınıflarla çizilir.</p>
      <nav aria-label="Bölümler" className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
        {["renk", "tipografi", "bosluk", "doku", "ikon", "bilesen", "takvim", "bos", "marka"].map((k) => (
          <a key={k} href={`#${k}`} className="rounded-md bg-sand px-3 py-1.5 text-ink-soft hover:bg-line">{k}</a>
        ))}
      </nav>

      <H id="renk">Renk</H>
      <h3 className="mt-6 font-semibold">Açık yüzeyler</h3>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {LIGHT.map(([n, hex, use, c]) => (
          <li key={n} className="overflow-hidden rounded-xl border border-line bg-bone">
            <div className="h-16" style={{ background: hex }} />
            <div className="p-3 text-sm"><p className="font-semibold">{n} <span className="tnum font-normal text-mute">{hex}</span></p><p className="text-mute">{use} · {c}</p></div>
          </li>
        ))}
      </ul>
      <h3 className="mt-8 font-semibold">Koyu yüzeyler (hero, panel çubuğu, mühür kartı)</h3>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {DARK.map(([n, hex, use]) => (
          <li key={n} className="overflow-hidden rounded-xl border border-line"><div className="h-16" style={{ background: hex }} /><div className="bg-bone p-3 text-xs"><p className="font-semibold">{n}</p><p className="tnum text-mute">{hex}</p><p className="text-mute">{use}</p></div></li>
        ))}
      </ul>
      <h3 className="mt-8 font-semibold">Anlamsal</h3>
      <ul className="mt-3 grid gap-3 sm:grid-cols-4">
        {SEM.map(([n, k, c]) => <li key={k} className={`rounded-xl px-4 py-3 text-sm font-semibold ${SEM_CLS[k]}`}>{n}<span className="block font-normal opacity-80">AA {c}:1</span></li>)}
      </ul>

      <H id="tipografi">Tipografi</H>
      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div><Eyebrow tone="sea">Fraunces · başlık</Eyebrow><p className="font-display mt-2 text-[2.75rem] font-semibold leading-none">Aa Ğğ Şş İı</p>
          <p className="font-display mt-3 text-2xl">Çiğköfte, ördek, üzüm, Gazimağusa, İskele, Şifa, Işık</p></div>
        <div><Eyebrow tone="sea">Instrument Sans · metin</Eyebrow><p className="mt-2 text-[2.75rem] font-semibold leading-none">Aa Ğğ Şş İı</p>
          <p className="mt-3 text-lg">Çiğköfte, ördek, üzüm, Gazimağusa, İskele, Şifa, Işık — <span className="tnum">0123456789 14:30</span></p></div>
      </div>
      <div className="mt-8 divide-y divide-line rounded-2xl border border-line bg-bone">
        {SCALE.map(([n, cls, sample]) => (
          <div key={n} className="flex flex-col gap-1 p-4 md:flex-row md:items-baseline md:gap-6"><code className="w-28 shrink-0 text-xs text-mute">{n}</code><p className={`font-display ${cls}`}>{sample}</p></div>
        ))}
        <div className="flex flex-col gap-1 p-4 md:flex-row md:items-baseline md:gap-6"><code className="w-28 shrink-0 text-xs text-mute">body-lg 18/28</code><p className="max-w-[62ch] text-lg">Müşterileriniz uygun saati seçsin, biz de randevu yaklaşınca hatırlatalım.</p></div>
        <div className="flex flex-col gap-1 p-4 md:flex-row md:items-baseline md:gap-6"><code className="w-28 shrink-0 text-xs text-mute">body 16/24</code><p>Randevu linkinizi paylaşın. Takvimi ve hatırlatmaları bir yerden yönetin.</p></div>
        <div className="flex flex-col gap-1 p-4 md:flex-row md:items-baseline md:gap-6"><code className="w-28 shrink-0 text-xs text-mute">small 14/20</code><p className="text-sm font-medium">Randevudan 24 saat önce hatırlatma</p></div>
        <div className="flex flex-col gap-1 p-4 md:flex-row md:items-baseline md:gap-6"><code className="w-28 shrink-0 text-xs text-mute">eyebrow</code><Eyebrow>KKTC için yapıldı</Eyebrow></div>
        <div className="flex flex-col gap-1 p-4 md:flex-row md:items-baseline md:gap-6"><code className="w-28 shrink-0 text-xs text-mute">numeral</code><p className="font-display tnum text-4xl font-semibold">1.250 <span className="text-lg text-mute">TL/ay</span></p></div>
      </div>

      <H id="bosluk">Boşluk, yarıçap, gölge</H>
      <div className="mt-6 flex flex-wrap items-end gap-3">
        {[4, 8, 12, 16, 24, 32, 48, 64, 96].map((n) => <div key={n} className="text-center text-xs text-mute"><div className="bg-sea/80" style={{ width: n, height: n }} /><span className="tnum">{n}</span></div>)}
      </div>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[["md 6", "rounded-md"], ["lg 10", "rounded-lg"], ["2xl 16", "rounded-2xl"], ["arch", "rounded-arch"], ["full", "rounded-full"]].map(([n, c]) => (
          <div key={n} className="text-center text-xs text-mute"><div className={`mx-auto h-20 w-20 border border-line-strong bg-sand ${c}`} />{n}</div>
        ))}
      </div>
      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        {[["shadow-card", "shadow-card"], ["shadow-lift", "shadow-lift"], ["shadow-pop", "shadow-pop"]].map(([n, c]) => (
          <div key={n} className={`rounded-2xl bg-bone p-6 text-sm font-semibold ${c}`}>{n}</div>
        ))}
      </div>

      <H id="doku">Doku</H>
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        <div className="grain rounded-2xl border border-line bg-paper p-6"><p className="font-semibold">.grain</p><p className="text-sm text-mute">Kâğıt grenı, açık zemin.</p></div>
        <div data-surface="ink" className="relative overflow-hidden rounded-2xl bg-ink-deep p-6 text-on-ink"><span aria-hidden className="grain-ink" /><p className="relative font-semibold">.grain-ink</p><p className="relative text-sm text-on-ink-mute">Koyu zeminde ekran karışımı.</p></div>
        <div className="rounded-2xl border border-line bg-bone p-6"><p className="font-semibold">.pole</p><div className="pole pole-anim mt-3 h-2 rounded-full" /><p className="mt-3 text-sm text-mute">Berber çizgisi: ilerleme, bekliyor.</p></div>
      </div>
      <div className="tile-rule mt-8" role="presentation" />

      <H id="ikon">İkonlar</H>
      <ul className="mt-6 grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-9">
        {ICON_NAMES.map((n) => <li key={n} className="flex flex-col items-center gap-2 rounded-xl border border-line bg-bone p-3 text-xs text-mute"><Icon name={n} className="text-ink" />{n}</li>)}
      </ul>

      <H id="bilesen">Bileşenler</H>
      <h3 className="mt-6 font-semibold">Düğme</h3>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button>Randevu al</Button><Button variant="secondary">Fiyatları gör</Button><Button variant="ghost">Vazgeç</Button><Button variant="danger">İptal et</Button>
        <Button disabled>Devre dışı</Button><Button><Spinner />Kaydediliyor</Button>
        <a href="#bilesen" className={buttonClass("primary")}>Bağlantı düğmesi</a>
        <span data-surface="ink" className="rounded-xl bg-ink-deep p-3"><Button variant="inverse">Ücretsiz dene</Button></span>
      </div>
      <h3 className="mt-8 font-semibold">Giriş alanları</h3>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        <Field label="Ad soyad" placeholder="Ayşe Yılmaz" hint="Randevu kartında görünür." />
        <Field label="Telefon" defaultValue="+90 533 000 00" error="Numara eksik görünüyor." />
        <Field label="E-posta" optional="isteğe bağlı" placeholder="ayse@ornek.com" />
      </div>
      <h3 className="mt-8 font-semibold">Çip, rozet, uyarı</h3>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Chip tone="ok">Onaylı</Chip><Chip tone="warn">Bekliyor</Chip><Chip tone="danger">İptal</Chip><Chip tone="info">Hatırlatıldı</Chip><Chip>Taslak</Chip>
        <Badge tone="green">eski rozet</Badge><Badge tone="amber">eski rozet</Badge>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3"><Alert tone="error">Saat artık boş değil, başka bir saat seçin.</Alert><Alert tone="info">Hatırlatma 24 saat önce gider.</Alert><Alert tone="success">Randevu kaydedildi.</Alert></div>
      <h3 className="mt-8 font-semibold">Kart ve kemer kartı</h3>
      <div className="mt-3 grid gap-5 md:grid-cols-3">
        <Card><p className="font-semibold">Card (eski)</p><p className="text-sm text-mute">bone + line + shadow-card</p></Card>
        <Surface className="transition hover:-translate-y-0.5 hover:shadow-lift"><p className="font-display text-xl font-semibold">Surface</p><p className="text-sm text-mute">Üzerine gelince kalkar.</p></Surface>
        <Surface arch className="text-center"><p className="eyebrow text-clay">Perşembe</p><p className="font-display tnum text-4xl font-semibold">15:30</p><p className="text-sm text-mute">Saç + Sakal</p></Surface>
      </div>
      <h3 className="mt-8 font-semibold">Sheet ve toast (statik görünüm)</h3>
      <div className="mt-3 grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl bg-ink-deep/55 p-4">
          <div className="mx-auto max-w-sm rounded-2xl bg-bone shadow-pop"><div className="mx-auto mt-2 h-1 w-9 rounded-full bg-line-strong/60" /><div className="flex items-center justify-between border-b border-line px-4 py-3"><p className="font-display text-xl font-semibold">Randevu ayrıntısı</p><span className="text-2xl text-ink-soft">×</span></div><div className="space-y-2 p-4 text-sm"><p>Ayşe Yılmaz · Saç + Sakal</p><Chip tone="ok">Onaylı</Chip></div></div>
        </div>
        <div className="flex flex-col justify-center gap-3">
          <div className="max-w-md rounded-xl border-l-4 border-l-[#7FC08F] bg-ink px-4 py-3 text-sm font-medium text-on-ink shadow-pop">Randevu kaydedildi.</div>
          <div className="max-w-md rounded-xl border-l-4 border-l-[#E8776D] bg-ink px-4 py-3 text-sm font-medium text-on-ink shadow-pop">Kaydedilemedi, tekrar deneyin.</div>
        </div>
      </div>
      <h3 className="mt-8 font-semibold">Mühür (imza etkileşim)</h3>
      <div className="mt-3 flex items-center gap-8 rounded-2xl border border-line bg-bone p-8"><Stamp top="Randevu" bottom="Onaylandı" /><p className="max-w-[40ch] text-ink-soft">Onay anında 1.7× büyüklükten sert iner, iki halka yayılır. Reduced-motion: animasyonsuz.</p></div>

      <H id="takvim">Takvim blokları</H>
      <div className="mt-6 max-w-md rounded-2xl border border-line bg-paper p-4">
        <div className="relative space-y-0">
          {[["10:00", "Ayşe Y.", "Saç kesimi · 45 dk", 0, "ok"], ["11:00", "Mert K.", "Sakal · 30 dk", 1, "warn"], ["12:00", "Elif D.", "Boya · 90 dk", 3, "ok"]].map(([t, n, s, c, st]) => {
            const col = SVC[c as number]!;
            return (
              <div key={t as string} className="flex gap-3 border-t border-line/70 py-2">
                <span className="tnum w-11 pt-1 text-xs text-mute">{t}</span>
                <div className="relative flex-1 overflow-hidden rounded-md border border-line bg-bone py-2 pl-4 pr-3 shadow-card">
                  <span aria-hidden className={st === "warn" ? "pole absolute inset-y-0 left-0 w-1.5" : "absolute inset-y-0 left-0 w-1"} style={st === "warn" ? undefined : { background: col[1] }} />
                  <p className="text-sm font-semibold">{n}</p><p className="text-xs text-ink-soft">{s}</p>
                </div>
              </div>
            );
          })}
          <div aria-hidden className="absolute left-12 right-0 top-[88px] flex items-center"><span className="h-2 w-2 rounded-full bg-clay" /><span className="h-0.5 flex-1 bg-clay" /></div>
        </div>
      </div>
      <ul className="mt-4 flex flex-wrap gap-2">{SVC.map(([n, hex, l]) => <li key={n} className="flex items-center gap-2 rounded-md border border-line bg-bone px-2.5 py-1 text-xs font-semibold"><span className="h-3 w-1 rounded-sm" style={{ background: hex }} />{l}</li>)}</ul>

      <H id="bos">Boş durum</H>
      <div className="mt-6 rounded-2xl border border-line bg-bone"><EmptyState icon="calendar" title="Bugün sakin." body="Randevu linkinizi paylaşın, ilk randevu burada belirsin." action={<Button>Linki kopyala</Button>} /></div>

      <H id="marka">Salon markası (--brand)</H>
      <p className="mt-3 max-w-[62ch] text-ink-soft">Randevu sayfasında `--brand` / `--brand-fg` salon rengine döner; düğme, seçili çerçeve ve ilerleme etkilenir.</p>
      <div className="mt-5 grid gap-5 md:grid-cols-3">
        {[["38 85 92", "Deniz"], ["168 67 43", "Kil"], ["88 52 120", "Erik"]].map(([rgb, n]) => (
          <div key={n} style={{ "--brand": rgb } as React.CSSProperties} className="rounded-2xl border border-line bg-bone p-5">
            <p className="font-display text-xl font-semibold">{n} Salon</p>
            <button type="button" aria-pressed="true" className="booking-option mt-3 flex w-full items-center justify-between rounded-lg border border-line p-3 text-left"><span className="font-semibold">Saç + Sakal</span><span className="font-display tnum">45 dk · 450 TL</span></button>
            <Button className="mt-3 w-full">Devam</Button>
            <div className="pole mt-4 h-1.5 w-2/3 rounded-full" />
          </div>
        ))}
      </div>
    </main>
  );
}
