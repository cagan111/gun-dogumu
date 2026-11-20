/** Inject a database update failure for this test user only. No real outage or SMS. */
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {PrismaClient}=require('@prisma/client'),bcrypt=require('bcryptjs'),{chromium}=require('playwright');
try{process.loadEnvFile('.env')}catch{ /* optional */ }
const db=new PrismaClient(),BASE=process.env.BASE_URL||'http://localhost:3000';
(async()=>{let user,browser;const suffix=crypto.randomBytes(6).toString('hex'),fn=`kr_logout_${suffix}`,trigger=`kr_logout_${suffix}`;try{
 const email=`logout-${suffix}@example.test`,password='fixture-logout-only';user=await db.user.create({data:{email,name:'Fixture',role:'superadmin',passwordHash:await bcrypt.hash(password,10)}});
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined});const ctx=await browser.newContext({viewport:{width:390,height:860}});
 const csrf=(await(await ctx.request.get(`${BASE}/api/auth/csrf`)).json()).csrfToken;
 await ctx.request.post(`${BASE}/api/auth/callback/credentials`,{form:{email,password,csrfToken:csrf,callbackUrl:`${BASE}/admin`},headers:{'x-auth-return-redirect':'1'}});
 assert.equal((await(await ctx.request.get(`${BASE}/api/auth/session`)).json()).user.id,user.id);
 const replay=await browser.newContext({storageState:await ctx.storageState()});
 assert.match(user.id,/^[a-z0-9]+$/);
 await db.$executeRawUnsafe(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture revocation unavailable'; END $$`);
 await db.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE UPDATE ON "User" FOR EACH ROW WHEN (OLD.id='${user.id}' AND NEW."tokenVersion" <> OLD."tokenVersion") EXECUTE FUNCTION ${fn}()`);
 const bad=await ctx.request.post(`${BASE}/api/auth/signout`,{form:{csrfToken:'invalid-fixture',callbackUrl:BASE},headers:{'x-auth-return-redirect':'1'}});
 assert.equal((await db.user.findUniqueOrThrow({where:{id:user.id}})).tokenVersion,0,'invalid CSRF cannot revoke');assert.notEqual(bad.status(),503);
 const c=(await(await ctx.request.get(`${BASE}/api/auth/csrf`)).json()).csrfToken;
 const failed=await ctx.request.post(`${BASE}/api/auth/signout`,{form:{csrfToken:c,callbackUrl:BASE},headers:{'x-auth-return-redirect':'1'}});
 assert.equal(failed.status(),503,'revocation failure must not report successful logout');
 assert.deepEqual(await failed.json(),{error:{code:'session_revocation_unavailable'}});
 assert.equal(failed.headers()['set-cookie'],undefined,'keep original cookie for retry');
 assert.equal((await db.user.findUniqueOrThrow({where:{id:user.id}})).tokenVersion,0);
 const page=await ctx.newPage();await page.goto(`${BASE}/admin`);await page.getByRole('button',{name:/çıkış|sign out|log out/i}).first().click();
 await page.getByRole('alert').filter({hasText:/çıkış|sign out|log out/i}).waitFor();assert.match(new URL(page.url()).pathname,/^\/admin/);
 await db.$executeRawUnsafe(`DROP TRIGGER ${trigger} ON "User"`);await db.$executeRawUnsafe(`DROP FUNCTION ${fn}()`);
 await page.getByRole('button',{name:/çıkış|sign out|log out/i}).first().click();await page.waitForURL(BASE+'/');
 assert.equal((await db.user.findUniqueOrThrow({where:{id:user.id}})).tokenVersion,1);
 assert.equal((await(await replay.request.get(`${BASE}/api/auth/session`)).json())?.user,undefined);
 console.log('PASS scoped PostgreSQL failure returns503/no cookie clear, visible browser error, retry revokes copied cookie');
 }finally{await browser?.close();try{await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON "User"`)}finally{try{await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${fn}()`)}finally{try{if(user)await db.user.deleteMany({where:{id:user.id}})}finally{await db.$disconnect()}}}}
})().catch(e=>{console.error(e.name,String(e.stack).split('\n').filter(x=>x.includes('logout-failure.cjs')).join('\n'));process.exitCode=1});
