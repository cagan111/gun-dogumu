/** Gerçek stok klip doğrulanamadı. İki MP4 yolu eklendiğinde oynatma otomatik açılır. */
export const HERO_MEDIA: { poster: string; desktop: string | null; mobile: string | null } = {
  poster: "/hero/poster.svg",
  desktop: null,
  mobile: null,
};
export function heroMotionAllowed(reducedMotion: boolean, saveData: boolean): boolean {
  return !reducedMotion && !saveData;
}
