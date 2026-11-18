import type { Key } from "@/lib/i18n";

/**
 * Ana sayfa "salon atmosferi" şeridi. Dosyaları public/gallery/ altına .webp olarak bırakıp
 * aşağıya satır eklemek yeterli (ilk görsel büyük, sonraki 2-3 küçük gösterilir).
 * Dosya yoksa o görsel atlanır; hiçbiri yoksa bölüm gizlenir.
 */
export interface GalleryItem { src: string; alt: Key; credit?: string }
export const GALLERY: GalleryItem[] = [
  { src: "/gallery/salon-1.webp", alt: "home.gallery.alt1" },
  { src: "/gallery/salon-2.webp", alt: "home.gallery.alt2" },
  { src: "/gallery/salon-3.webp", alt: "home.gallery.alt3" },
  { src: "/gallery/salon-4.webp", alt: "home.gallery.alt4" },
];
