/** T144: real HTTP/browser consent; fixture OTP, no SMS provider is called. */
const assert=require('node:assert/strict');const crypto=require('node:crypto');
const {PrismaClient}=require('@prisma/client');const bcrypt=require('bcryptjs');const {chromium}=require('playwright');
try{process.loadEnvFile('.env')}catch{ /* optional env */ }
const db=new PrismaClient(),BASE=process.env.BASE_URL||'http://localhost:3000';
(async()=>{let tenant,other,browser;try{
 const uid=crypto.randomUUID(),phone='+905339993333',password='consent-fixture-only';tenant=await db.tenant.create({data:{slug:`consent-${uid}`,name:'Fixture',city:'Girne',plan:'salon_plus'}});other=await db.tenant.create({data:{slug:`consent-other-${uid}`,name:'Other',city:'Girne'}});
 const customer=await db.customer.create({data:{tenantId:tenant.id,phone,name:'Original',email:'original@example.test'}});
 const owner=await db.user.create({data:{tenantId:tenant.id,email:`owner-${uid}@example.test`,name:'Owner',role:'owner',passwordHash:await bcrypt.hash(password,10)}}),staff=await db.user.create({data:{tenantId:tenant.id,email:`staff-${uid}@example.test`,name:'Staff',role:'staff',passwordHash:await bcrypt.hash(password,10)}});
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined});const ctx=await browser.newContext({locale:'tr-TR',viewport:{width:390,height:860}}),page=await ctx.newPage();
 const endpoint=`${BASE}/api/public/${tenant.slug}/marketing-consent`;
 assert.equal((await ctx.request.get(endpoint)).status(),401);assert.equal((await ctx.request.patch(endpoint,{data:{marketingConsent:true}})).status(),401);
 const code='123456';const secret=process.env.NEXTAUTH_SECRET||process.env.AUTH_SECRET;assert.ok(secret);
 await db.otp.create({data:{tenantId:tenant.id,phone,codeHash:crypto.createHash('sha256').update(code+secret).digest('hex'),expiresAt:new Date(Date.now()+300000)}});
 await page.goto(`${BASE}/${tenant.slug}/randevularim`);
 assert.equal(await page.evaluate(async({slug,phone,code})=>(await fetch(`/api/public/${slug}/otp/verify`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phone,code})})).status,{slug:tenant.slug,phone,code}),200);
 await page.reload();
 await page.getByTestId('consent-toggle').waitFor();
 await page.getByTestId('consent-toggle').check();await page.getByTestId('consent-save').click();
 await page.getByRole('status').getByText('Pazarlama tercihiniz kaydedildi.',{exact:true}).waitFor();
 await page.reload();await page.waitForFunction(()=>{const e=document.querySelector('[data-testid="consent-toggle"]');return e&&!e.disabled});assert.equal(await page.getByTestId('consent-toggle').isChecked(),true);
 await page.getByTestId('consent-toggle').uncheck();await page.getByTestId('consent-save').click();await page.getByRole('status').getByText('Pazarlama tercihiniz kaydedildi.',{exact:true}).waitFor();assert.equal((await db.customer.findUniqueOrThrow({where:{id:customer.id}})).marketingConsent,false);
 await page.getByTestId('consent-toggle').check();await page.getByTestId('consent-save').click();await page.getByRole('status').getByText('Pazarlama tercihiniz kaydedildi.',{exact:true}).waitFor();
 const signed=(await ctx.cookies()).find(c=>c.name===`kr_my_${tenant.slug}`);assert.ok(signed);await ctx.addCookies([{...signed,name:`kr_my_${other.slug}`}]);
 assert.equal(await page.evaluate(async url=>(await fetch(url,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({marketingConsent:false,phone:'+905339990000'})})).status,endpoint),400);
 const foreign=await page.evaluate(async url=>(await fetch(url,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({marketingConsent:false})})).status,`${BASE}/api/public/${other.slug}/marketing-consent`);assert.equal(foreign,401);
 async function login(user){const c=await browser.newContext({locale:'tr-TR'}),p=await c.newPage();await p.goto(`${BASE}/giris`);await p.locator('input[name="email"]').fill(user.email);await p.locator('input[name="password"]').fill(password);await p.getByRole('button',{name:'Giriş yap',exact:true}).click();await p.waitForURL(u=>u.pathname==='/panel');return {c,p}}
 const s=await login(staff);assert.equal((await s.c.request.patch(`${BASE}/api/panel/customers/${customer.id}/marketing-consent`,{data:{marketingConsent:false}})).status(),403);
 const o=await login(owner);assert.equal((await o.c.request.patch(`${BASE}/api/panel/customers/${customer.id}/marketing-consent`,{data:{marketingConsent:true}})).status(),400);
 assert.equal((await o.c.request.patch(`${BASE}/api/panel/customers/foreign-id/marketing-consent`,{data:{marketingConsent:false}})).status(),404);
 await o.p.goto(`${BASE}/panel/musteriler`);await o.p.getByRole('button',{name:/Original/}).click();await o.p.getByTestId('customer-opt-out').click();await o.p.getByTestId('customer-opt-out').waitFor({state:'hidden'});
 await page.reload();await page.waitForFunction(()=>{const e=document.querySelector('[data-testid="consent-toggle"]');return e&&!e.disabled});assert.equal(await page.getByTestId('consent-toggle').isChecked(),false);
 const after=await db.customer.findUniqueOrThrow({where:{id:customer.id}});assert.equal(after.name,'Original');assert.equal(after.email,'original@example.test');assert.equal(await db.auditLog.count({where:{tenantId:tenant.id,action:'customer.marketing_consent'}}),4);
 console.log('PASS consent OTP-bound browser opt-in, persisted preference, owner opt-out, staff/tenant/anonymous boundaries and audit');
}finally{await browser?.close();const ids=[tenant?.id,other?.id].filter(Boolean);await db.auditLog.deleteMany({where:{tenantId:{in:ids}}});await db.tenant.deleteMany({where:{id:{in:ids}}});await db.$disconnect()}})().catch(e=>{console.error(e?.name||'Error',String(e.stack).split('\n').filter(x=>x.includes('consent.cjs')).join('\n'));process.exitCode=1});
