import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import { GALLERY } from "@/config/gallery";
import { getT } from "@/lib/i18n";

/** Dosyası bulunmayan görseller atlanır; hiç görsel yoksa bölüm render edilmez. */
export async function GalleryStrip() {
  const { t } = await getT();
  const items = GALLERY.filter((g) => existsSync(path.join(process.cwd(), "public", g.src))).slice(0, 4);
  if (items.length === 0) return null;
  const [big, ...rest] = items;
  const frame = "relative overflow-hidden rounded-lg border border-line bg-sand";
  return (
    <section aria-labelledby="gallery-h" className="border-b border-line bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-14 md:py-20">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-gold">{t("home.gallery.badge")}</p>
        <h2 id="gallery-h" className="display-heading mt-2 max-w-xl text-3xl font-semibold tracking-tight">{t("home.gallery.title")}</h2>
        <div className={`mt-8 grid gap-3 md:gap-4 ${rest.length ? "md:grid-cols-[1.6fr_1fr]" : ""}`}>
          <figure className={`${frame} aspect-[4/3] md:aspect-auto md:min-h-[26rem]`}>
            <Image src={big!.src} alt={t(big!.alt)} fill sizes="(min-width: 1152px) 680px, (min-width: 768px) 60vw, 100vw" className="object-cover" loading="lazy" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
          </figure>
          {rest.length ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:gap-4">
              {rest.map((g) => (
                <figure key={g.src} className={`${frame} aspect-[4/3] ${rest.length === 1 ? "col-span-2 md:col-span-1" : ""}`}>
                  <Image src={g.src} alt={t(g.alt)} fill sizes="(min-width: 1152px) 420px, (min-width: 768px) 38vw, 50vw" className="object-cover" loading="lazy" />
                </figure>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
