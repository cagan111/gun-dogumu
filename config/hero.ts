/**
 * Ana sayfa hero arka plan videosu — TEK değişim noktası.
 * `null` ise hero eski haline döner (kodla çizilmiş salon sahnesi ↔ ürün sahnesi).
 * Gerçek çekim gelince dosyaları `public/hero/` altına koyup burayı doldurun:
 *   src: 1280 px geniş MP4 (H.264, sessiz, ≤ 2.5 MB, 8–15 sn kesintisiz döngü)
 *   srcMobile: (isteğe bağlı) 720 px geniş dikey/kırpılmış sürüm
 *   poster: JPG/WebP kare (video yüklenmezken, azaltılmış hareket ve veri tasarrufu modunda gösterilir)
 */
export type HeroVideo = { src: string; srcMobile?: string; poster: string; credit?: string };
export const heroVideo: HeroVideo | null = null;
