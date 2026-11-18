/** T141: actual TLS reverse proxy + Chromium. Start Next with AUTH_URL/NEXTAUTH_URL=https://localhost:3443 first. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kr-tls-'));
  let browser, proxy;
  try {
    const key = path.join(temp, 'key.pem'), cert = path.join(temp, 'cert.pem');
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' });
    fs.chmodSync(key, 0o600);
    proxy = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, (req, res) => {
      const upstream = http.request({ hostname: '127.0.0.1', port: 3000, method: req.method, path: req.url, headers: { ...req.headers, host: 'localhost:3443', 'x-forwarded-host': 'localhost:3443', 'x-forwarded-proto': 'https' } }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
      upstream.on('error', () => { res.writeHead(502); res.end(); }); req.pipe(upstream);
    });
    await new Promise((r) => proxy.listen(3443, '127.0.0.1', r));
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined });
    const context = await browser.newContext({ ignoreHTTPSErrors: true, locale: 'tr-TR' });
    const page = await context.newPage();
    await page.goto('https://localhost:3443/giris');
    await page.locator('input[name="email"]').fill(process.env.E2E_OWNER_EMAIL || 'owner@lefkosa-usta-berber.test');
    await page.locator('input[name="password"]').fill(process.env.E2E_OWNER_PASSWORD || 'demo12345');
    await page.getByRole('button', { name: 'Giriş yap', exact: true }).click();
    await page.waitForURL((u) => u.pathname.startsWith('/panel'), { timeout: 20000 });
    const cookie = (await context.cookies()).find((c) => c.name === '__Secure-authjs.session-token');
    assert(cookie && cookie.secure && cookie.httpOnly, 'secure-prefixed HTTP-only session issued');
    await page.reload(); assert(new URL(page.url()).pathname.startsWith('/panel'), 'panel survives reload without login loop');
    await page.goto('https://localhost:3443/admin'); assert(new URL(page.url()).pathname !== '/admin', 'owner cannot access admin');
    const anonymous = await browser.newContext({ ignoreHTTPSErrors: true });
    const p = await anonymous.newPage(); await p.goto('https://localhost:3443/panel');
    assert(new URL(p.url()).pathname === '/giris', 'anonymous redirected');
    console.log('PASS TLS login, secure cookie, panel reload, owner/admin and anonymous boundaries');
  } finally {
    if (browser) await browser.close();
    if (proxy) { proxy.closeAllConnections(); await new Promise((r) => proxy.close(r)); }
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
