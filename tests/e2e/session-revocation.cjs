/** Local Auth.js replay fixtures only; never print cookies, passwords or reset tokens. */
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const {PrismaClient} = require('@prisma/client'), bcrypt = require('bcryptjs'), {chromium} = require('playwright');
try { process.loadEnvFile('.env'); } catch { /* optional */ }
const db = new PrismaClient(), BASE = process.env.BASE_URL || 'http://localhost:3000';
(async () => { let browser, user; try {
 const email = `session-${crypto.randomUUID()}@example.test`, password = 'fixture-session-only';
 user = await db.user.create({data:{email,name:'Fixture',role:'superadmin',passwordHash:await bcrypt.hash(password,10)}});
 browser = await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH || undefined});
 async function login(pw) {
  const c = await browser.newContext(); const csrf = (await (await c.request.get(`${BASE}/api/auth/csrf`)).json()).csrfToken;
  const r = await c.request.post(`${BASE}/api/auth/callback/credentials`, {form:{email,password:pw,csrfToken:csrf,callbackUrl:`${BASE}/admin`},headers:{'x-auth-return-redirect':'1'}});
  assert.equal(r.status(),200); assert.equal((await (await c.request.get(`${BASE}/api/auth/session`)).json()).user.id,user.id); return c;
 }
 const first = await login(password), oldState = await first.storageState(), replay = await browser.newContext({storageState:oldState});
 const csrf = (await (await first.request.get(`${BASE}/api/auth/csrf`)).json()).csrfToken;
 await first.request.post(`${BASE}/api/auth/signout`, {form:{csrfToken:csrf,callbackUrl:BASE},headers:{'x-auth-return-redirect':'1'}});
 assert.equal((await (await replay.request.get(`${BASE}/api/auth/session`)).json())?.user,undefined,'copied cookie must fail after logout');
 assert.equal((await db.user.findUniqueOrThrow({where:{id:user.id}})).tokenVersion,1);
 const fresh = await login(password), stale = await browser.newContext({storageState:oldState});
 await stale.request.post(`${BASE}/api/auth/signout`,{form:{csrfToken:(await (await stale.request.get(`${BASE}/api/auth/csrf`)).json()).csrfToken,callbackUrl:BASE},headers:{'x-auth-return-redirect':'1'}});
 assert.equal((await (await fresh.request.get(`${BASE}/api/auth/session`)).json()).user.id,user.id,'stale logout cannot revoke fresh generation');
 const copied = await browser.newContext({storageState:await fresh.storageState()});
 const raw = crypto.randomBytes(32).toString('base64url');
 await db.loginToken.create({data:{userId:user.id,purpose:'set_password',tokenHash:crypto.createHash('sha256').update(raw).digest('hex'),expiresAt:new Date(Date.now()+60000)}});
 assert.equal((await fresh.request.post(`${BASE}/api/auth/set-password`,{data:{token:raw,password:'fixture-updated-password'}})).status(),200);
 assert.equal((await db.user.findUniqueOrThrow({where:{id:user.id}})).tokenVersion,2);
 assert.equal((await (await copied.request.get(`${BASE}/api/auth/session`)).json())?.user,undefined,'copied cookie must fail after password reset');
 const page = await copied.newPage(); await page.goto(`${BASE}/admin`); await page.waitForURL('**/giris**');
 assert.equal((await copied.request.get(`${BASE}/api/admin/tenants`)).status(),401);
 await login('fixture-updated-password');
 console.log('PASS real Auth.js copied-cookie logout/password revocation, stale logout isolation, admin page/API denial and fresh login');
 } finally { await browser?.close(); if(user) await db.user.deleteMany({where:{id:user.id}}); await db.$disconnect(); }
})().catch(e=>{console.error(e.name,String(e.stack).split('\n').filter(x=>x.includes('session-revocation.cjs')).join('\n'));process.exitCode=1});
