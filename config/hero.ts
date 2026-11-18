/** Gerçek stok klip doğrulanamadı. İki MP4 yolu eklendiğinde oynatma otomatik açılır. */
export const HERO_MEDIA: { poster: string; desktop: string | null; mobile: string | null } = {
  poster: "/hero/poster.svg",
  desktop: null,
  mobile: null,
};
export function heroMotionAllowed(reducedMotion: boolean, saveData: boolean): boolean {
  return !reducedMotion && !saveData;
}
// Video eklemek için: public/hero/ altına barber.mp4 (masaüstü) ve barber-m.mp4 (mobil, isteğe bağlı) koyup
// yukarıdaki desktop/mobile alanlarına "/hero/barber.mp4" yollarını yazın; poster için /hero/poster.webp kullanın.
