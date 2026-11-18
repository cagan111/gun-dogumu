import { expect, it } from "vitest";
import { HERO_MEDIA, heroMotionAllowed } from "@/config/hero";
it("hareket veya veri tasarrufunda video yüklemez", () => {
  expect(heroMotionAllowed(false, false)).toBe(true);
  for (const pair of ([[true, false], [false, true], [true, true]] as const)) expect(heroMotionAllowed(pair[0], pair[1])).toBe(false);
});
it("lisansı doğrulanmamış klip yerine yerel poster kullanır", () => {
  expect(HERO_MEDIA.poster).toBe("/hero/poster.svg");
  expect(HERO_MEDIA.desktop).toBeNull(); expect(HERO_MEDIA.mobile).toBeNull();
});
