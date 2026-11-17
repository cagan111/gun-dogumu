import { SALON_SVG } from "./salon-svg";

/**
 * Sahne A. Varsayılan: kodla çizilmiş özgün salon illüstrasyonu.
 * Lisanslı bir fotoğraf eklendiğinde tek prop yeter: `<SalonScene photoSrc="/img/salon.jpg" alt="…" />`.
 */
export function SalonScene({ photoSrc, alt }: { photoSrc?: string; alt: string }) {
  if (photoSrc) {
    return <img className="hs-photo" src={photoSrc} alt={alt} loading="eager" decoding="async" />;
  }
  const svg = SALON_SVG.replace(/ role="img" aria-label="[^"]*"/, "");
  return <div role="img" aria-label={alt} className="h-full w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}
