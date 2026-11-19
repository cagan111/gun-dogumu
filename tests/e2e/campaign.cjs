/** T116: real browser/API, dropped POST response, persistent key, holds and worker resume. Mock SMS only. */
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { chromium } = require('playwright');
try { process.loadEnvFile('.env'); } catch {}
const db = new PrismaClient(); const BASE = process.env.BASE_URL || 'http://localhost:3000';
(async () => {
  let tenant, browser;
  try {
    const uid = crypto.randomUUID(); const password = 'campaign-fixture-only';
    tenant = await db.tenant.create({ data: { slug: `e2e-campaign-${uid}`, name: 'Campaign fixture', city: 'Girne', phone: '+905331110000', plan: 'salon_plus', quietStartHour: 0, quietEndHour: 0 } });
    const owner = await db.user.create({ data: { tenantId: tenant.id, email: `owner-${uid}@example.test`, name: 'Fixture owner', role: 'owner', passwordHash: await bcrypt.hash(password, 10) } });
    const staff = await db.user.create({ data: { tenantId: tenant.id, email: `staff-${uid}@example.test`, name: 'Fixture staff', role: 'staff', passwordHash: await bcrypt.hash(password, 10) } });
    await db.smsLedger.create({ data: { tenantId: tenant.id, delta: 100, reason: 'package_purchase', balanceAfter: 100 } });
    for (let i = 1; i <= 2; i++) await db.customer.create({ data: { tenantId: tenant.id, phone: `+90533999100${i}`, name: 'Fixture', marketingConsent: true } });
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined });
    async function login(user) {
      const context = await browser.newContext({ locale: 'tr-TR', viewport: { width: 390, height: 860 } }); const page = await context.newPage();
      await page.goto(`${BASE}/giris`); await page.locator('input[name="email"]').fill(user.email); await page.locator('input[name="password"]').fill(password);
      await page.getByRole('button', { name: 'Giriş yap', exact: true }).click(); await page.waitForURL((u) => u.pathname.startsWith('/panel'));
      return { context, page };
    }
    const { context, page } = await login(owner); const other = await login(staff);
    assert.equal((await context.request.post(`${BASE}/api/panel/campaigns`, { data: { text: 'Missing-key fixture' } })).status(), 400);
    let dropped = false; const keys = [];
    await page.route('**/api/panel/campaigns', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      keys.push(route.request().postDataJSON().idempotencyKey);
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      if (!dropped) { dropped = true; await route.abort(); } else await route.fulfill({ response });
    });
    await page.goto(`${BASE}/panel/ayarlar`);
    async function start(text) {
      await page.getByTestId('campaign-text').fill(text); await page.getByTestId('campaign-send').click();
      await page.getByRole('dialog', { name: 'Kampanya gönderilsin mi?' }).getByRole('button', { name: 'Gönder', exact: true }).click();
    }
    await start('Campaign first fixture'); await page.getByTestId('campaign-resume').waitFor();
    await page.reload(); await page.getByTestId('campaign-resume').click(); await page.getByTestId('campaign-cancel').waitFor();
    assert.equal(keys.length, 2); assert.equal(keys[0], keys[1]);
    assert.equal(await db.campaign.count({ where: { tenantId: tenant.id } }), 1);
    const read = async (key) => (await context.request.get(`${BASE}/api/panel/campaigns?idempotencyKey=${key}`)).json();
    const first = await read(keys[0]); assert.equal(first.pending, 2);
    const balance = await (await context.request.get(`${BASE}/api/panel/sms/balance`)).json(); assert.equal(balance.reserved, 2 * first.segmentsPerMessage); assert.equal(balance.balance, 100 - balance.reserved);
    assert.equal((await other.context.request.get(`${BASE}/api/panel/campaigns?idempotencyKey=${keys[0]}`)).status(), 403);
    assert.equal((await other.context.request.delete(`${BASE}/api/panel/campaigns?idempotencyKey=${keys[0]}`)).status(), 403);
    await db.tenant.update({ where: { id: tenant.id }, data: { status: 'suspended' } });
    await page.getByTestId('campaign-cancel').click(); await page.getByTestId('campaign-new').waitFor();
    assert.equal((await read(keys[0])).skipped, 2);
    const freed = await (await context.request.get(`${BASE}/api/panel/sms/balance`)).json(); assert.equal(freed.balance, 100); assert.equal(freed.reserved, 0);
    await db.tenant.update({ where: { id: tenant.id }, data: { status: 'trial' } });
    await page.getByTestId('campaign-new').click(); await start('Campaign worker fixture'); await page.getByTestId('campaign-cancel').waitFor();
    const second = await read(keys[2]); assert.notEqual(keys[2], keys[0]);
    await db.customer.create({ data: { tenantId: tenant.id, phone: '+905339991003', name: 'Later fixture', marketingConsent: true } });
    const code = `import {handleCampaignRecovery} from './jobs/handlers'; try{process.loadEnvFile('.env')}catch{} handleCampaignRecovery(${JSON.stringify({ tenantId: tenant.id, campaignId: second.campaignId })}).then(()=>process.exit(0)).catch(()=>process.exit(1));`;
    execFileSync(process.env.KR_PNPM || '/tmp/kr-pnpm', ['exec', 'tsx', '-e', code], { cwd: process.cwd(), env: { ...process.env, SMS_PROVIDER: 'mock', ALLOW_REAL_SMS: 'false', JOBS_QUEUE: 'none' }, stdio: 'pipe' });
    await page.getByTestId('campaign-refresh').click(); await page.getByTestId('campaign-new').waitFor();
    const done = await read(keys[2]); assert.equal(done.recipients, 2); assert.equal(done.sent, 2); assert.equal(done.pending, 0);
    assert.equal(await db.messageLog.count({ where: { tenantId: tenant.id, template: 'campaign', status: 'sent' } }), 2);
    const end = await (await context.request.get(`${BASE}/api/panel/sms/balance`)).json(); assert.equal(end.reserved, 0); assert.equal(end.balance, 100 - 2 * done.segmentsPerMessage);
    console.log('PASS campaign lost-response/reload same key, reserved balance, owner/staff boundaries, suspended cancellation, durable worker and saved audience');
  } finally {
    if (browser) await browser.close();
    if (tenant) { await db.auditLog.deleteMany({ where: { tenantId: tenant.id } }); await db.tenant.deleteMany({ where: { id: tenant.id } }); }
    await db.$disconnect();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
