import { LangSwitcher } from "@/components/lang-switcher";
import { initials, mapsUrl } from "@/lib/format";
import { getT } from "@/lib/i18n";

interface Props {
  name: string; city?: string | null; address?: string | null; logoUrl?: string | null; coverUrl?: string | null; slug?: string; compact?: boolean;
}

/** Kapak görseli ya da marka renkli gradyan başlık; adres tek satır + "Yol tarifi" bağlantısı (gömülü harita yok). */
export async function SalonHeader({ name, city, address, logoUrl, coverUrl, slug, compact }: Props) {
  const { t } = await getT();
  const line = [address, city].filter(Boolean).join(", ");
  return (
    <header
      className="relative overflow-hidden bg-brand text-brand-fg"
      style={coverUrl ? { backgroundImage: `linear-gradient(rgb(0 0 0 / .35), rgb(0 0 0 / .55)), url(${JSON.stringify(coverUrl)})`, backgroundSize: "cover", backgroundPosition: "center" } : { backgroundImage: "linear-gradient(135deg, rgb(var(--brand)) 0%, rgb(var(--brand) / .75) 100%)" }}
    >
      <div className={`mx-auto flex max-w-2xl flex-col px-4 ${compact ? "pb-5 pt-4" : "pb-7 pt-4"}`}>
        <div className="flex items-center justify-between">
          {slug ? <a href={`/${slug}/randevularim`} className="rounded-full bg-white/20 px-3 py-1.5 text-sm font-medium hover:bg-white/30">{t("b.myAppts")}</a> : <span />}
          <LangSwitcher />
        </div>
        <div className="mt-5 flex items-center gap-4">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-16 w-16 shrink-0 rounded-2xl border-2 border-white/70 bg-white object-cover" />
          ) : (
            <span aria-hidden className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border-2 border-white/60 bg-white/20 text-xl font-bold">{initials(name)}</span>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold leading-tight">{name}</h1>
            {line ? (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm opacity-95">
                <span className="truncate">{line}</span>
                <a href={mapsUrl([name, address, city])} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">{t("b.directions")}</a>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
