/** T117 actual browser: committed response lost, reload/retry same durable key. Mock only. */
const assert=require('node:assert/strict');
const {PrismaClient}=require('@prisma/client');
const bcrypt=require('bcryptjs');
const {chromium}=require('playwright');
try{process.loadEnvFile('.env')}catch{ /* optional local env */ }
const db=new PrismaClient(),BASE=process.env.BASE_URL||'http://localhost:3000';
(async()=>{let tenant,admin,browser;try{
 const uid=crypto.randomUUID(),password='payment-fixture-only';
 tenant=await db.tenant.create({data:{slug:`payment-${uid}`,name:'Payment fixture',city:'Girne',plan:'pro'}});
 admin=await db.user.create({data:{email:`payment-${uid}@example.test`,role:'superadmin',name:'Fixture admin',passwordHash:await bcrypt.hash(password,10)}});
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined});const ctx=await browser.newContext({locale:'tr-TR',viewport:{width:390,height:860}}),page=await ctx.newPage();
 await page.goto(`${BASE}/giris`);await page.locator('input[name="email"]').fill(admin.email);await page.locator('input[name="password"]').fill(password);await page.getByRole('button',{name:'Giriş yap',exact:true}).click();await page.waitForURL(u=>u.pathname==='/admin');
 assert.equal((await ctx.request.post(`${BASE}/api/admin/payments`,{data:{tenantId:tenant.id,amountTry:750,months:1}})).status(),400);
 let droppedResolve; const droppedDone=new Promise(r=>{droppedResolve=r}); const keys=[];let dropped=false;
 await page.route('**/api/admin/payments',async route=>{const b=route.request().postDataJSON();keys.push(b.idempotencyKey);const response=await route.fetch();assert.equal(response.status(),201);if(!dropped){dropped=true;await route.abort();droppedResolve()}else await route.fulfill({response})});
 await page.goto(`${BASE}/admin/salon/${tenant.id}`);await page.getByLabel('Tutar (TL)').fill('750');await page.getByRole('button',{name:'Ödemeyi kaydet',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Ödemeyi kaydet',exact:true}).click();
 await page.getByRole('button',{name:'Aynı ödemeyi yeniden dene',exact:true}).waitFor();
 await droppedDone; await droppedDone;
 const first=await db.tenant.findUniqueOrThrow({where:{id:tenant.id}});assert.equal(await db.payment.count({where:{tenantId:tenant.id}}),1);
 await page.reload();assert.equal(await page.getByLabel('Tutar (TL)').inputValue(),'750');assert.equal(await page.getByLabel('Tutar (TL)').isDisabled(),true);
 await page.getByRole('button',{name:'Aynı ödemeyi yeniden dene',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Ödemeyi kaydet',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.getByRole('button',{name:'Ödemeyi kaydet',exact:true}).waitFor();
 assert.equal(keys.length,2);assert.equal(keys[0],keys[1]);assert.equal(await db.payment.count({where:{tenantId:tenant.id}}),1);assert.equal(await db.auditLog.count({where:{tenantId:tenant.id,action:'payment.record'}}),1);
 const after=await db.tenant.findUniqueOrThrow({where:{id:tenant.id}});assert.equal(+after.subscriptionEndsAt,+first.subscriptionEndsAt);
 assert.equal(await page.evaluate(k=>sessionStorage.getItem(k),`admin-payment:${tenant.id}`),null);
 console.log('PASS payment lost response/reload same UUID, frozen amount, one payment/audit/extension');
}finally{await browser?.close();if(tenant){await db.auditLog.deleteMany({where:{tenantId:tenant.id}});await db.tenant.delete({where:{id:tenant.id}})}if(admin)await db.user.delete({where:{id:admin.id}});await db.$disconnect()}})().catch(e=>{console.error(e?.name || "Error", e?.name === "AssertionError" ? e.message : "", String(e.stack).split("\n").filter(x=>x.includes("payment.cjs")).join("\n"));process.exitCode=1});
