/** T-122: actual HeroMedia in Chromium. Fixture MP4 is synthetic test media, not site content. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const esbuild = createRequire(require.resolve('tsx/package.json'))('esbuild');

async function main() {
  const cwd = process.cwd();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kr-hero-test-'));
  let browser;
  try {
    const clip = path.join(temp, 'fixture.mp4');
    execFileSync(process.env.FFMPEG_EXECUTABLE_PATH || 'ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0x465635:s=32x32:r=10',
      '-t', '1', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', clip,
    ]);
    const configPath = path.join(cwd, 'config/hero.ts');
    const bundle = await esbuild.build({
      stdin: { contents: 'import React from "react"; import {createRoot} from "react-dom/client"; import {HeroMedia} from "./components/hero/media"; createRoot(document.getElementById("root")).render(<HeroMedia/>);', resolveDir: cwd, loader: 'tsx' },
      bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'fixture-config', setup(build) {
        build.onLoad({ filter: /config\/hero\.ts$/ }, () => ({
          contents: fs.readFileSync(configPath, 'utf8').replace(/export const HERO_MEDIA[\s\S]*?=\s*\{[\s\S]*?\};/, 'export const HERO_MEDIA = globalThis.__heroFixture;'), loader: 'ts',
        }));
      } }],
    });
    browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}) });
    const errors = [];
    async function scenario({ name, width = 1280, configured = true, reduced = false, saveData = false, rejectPlay = false, invalidSource = false }) {
      const page = await browser.newPage({ viewport: { width, height: 860 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
      let mediaRequests = 0;
      page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`));
      await page.route('https://hero.test/**', async (route) => {
        const url = route.request().url();
        if (url.endsWith('.mp4')) {
          mediaRequests++;
          return route.fulfill({ status: 200, contentType: 'video/mp4', body: invalidSource ? Buffer.from('invalid video fixture') : fs.readFileSync(clip) });
        }
        if (url.endsWith('.svg')) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path fill="#465635" d="M0 0h32v32H0z"/></svg>' });
        return route.fulfill({ status: 200, contentType: 'text/html', body: '<div id="root"></div>' });
      });
      await page.goto('https://hero.test/');
      await page.evaluate(({ configured, saveData, rejectPlay }) => {
        globalThis.__heroFixture = { poster: '/poster.svg', desktop: configured ? '/desktop.mp4' : null, mobile: configured ? '/mobile.mp4' : null };
        const connection = new EventTarget();
        connection.saveData = saveData;
        Object.defineProperty(navigator, 'connection', { configurable: true, value: connection });
        if (rejectPlay) HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('fixture autoplay rejection', 'NotAllowedError'));
      }, { configured, saveData, rejectPlay });
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await page.locator('img').waitFor({ state: 'attached' });
      const posterOnly = !configured || reduced || saveData || rejectPlay || invalidSource;
      if (posterOnly) {
        await page.waitForFunction(() => document.querySelector('img')?.complete && !document.querySelector('video'));
        if (!configured || reduced || saveData) assert.equal(mediaRequests, 0, `${name}: no MP4 request allowed`);
      } else {
        await page.waitForFunction(() => document.querySelector('video')?.currentTime > 0);
        const media = await page.locator('video').evaluate((video) => ({ muted: video.muted, autoplay: video.autoplay, loop: video.loop, inline: video.playsInline, preload: video.preload, src: video.currentSrc }));
        assert.deepEqual({ muted: media.muted, autoplay: media.autoplay, loop: media.loop, inline: media.inline, preload: media.preload }, { muted: true, autoplay: true, loop: true, inline: true, preload: 'metadata' });
        assert.match(media.src, width < 768 ? /\/mobile\.mp4$/ : /\/desktop\.mp4$/);
        // A changed preference removes the video after it has already started.
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForFunction(() => !document.querySelector('video'));
      }
      assert.equal(await page.locator('img').getAttribute('alt'), '');
      assert.equal(await page.locator('[aria-hidden="true"]').count(), 1);
      await page.close();
      console.log(`PASS ${name}`);
    }
    await scenario({ name: 'configured desktop MP4 plays' });
    await scenario({ name: 'configured 390px mobile source plays', width: 390 });
    await scenario({ name: 'null media stays poster only', configured: false });
    await scenario({ name: 'reduced motion blocks network', reduced: true });
    await scenario({ name: 'Save-Data blocks network', saveData: true });
    await scenario({ name: 'autoplay rejection preserves poster', rejectPlay: true });
    await scenario({ name: 'invalid MP4 preserves poster', invalidSource: true });
    assert.deepEqual(errors, [], 'no uncaught browser errors');
    console.log('TAMAM — hero media: 7 real Chromium scenarios, synthetic fixture only');
  } finally {
    await browser?.close();
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
