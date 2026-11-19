/** T143 real browser login: unsafe next stays local; no external navigation is permitted. */
const assert=require('node:assert/strict');
const {PrismaClient}=require('@prisma/client');const bcrypt=require('bcryptjs');const {chromium}=require('playwright');
try{process.loadEnvFile('.env')}catch{ /* optional local env */ }
const db=new PrismaClient(),BASE=process.env.BASE_URL||'http://localhost:3000';
(async()=>{let tenant,user,browser;try{
 const uid=crypto.randomUUID(),password='redirect-fixture-only';tenant=await db.tenant.create({data:{slug:`redirect-${uid}`,name:'Fixture',city:'Girne'}});
 user=await db.user.create({data:{tenantId:tenant.id,email:`redirect-${uid}@example.test`,name:'Fixture owner',role:'owner',passwordHash:await bcrypt.hash(password,10)}});
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined});
 for(const [next,path] of [['/\t/evil.example','/panel'],['/\n/evil.example','/panel'],['/\r/evil.example','/panel'],['/panel/ayarlar?from=login','/panel/ayarlar']]){
  const ctx=await browser.newContext({locale:'tr-TR',viewport:{width:390,height:860}}),page=await ctx.newPage();const external=[];
  await page.route('**/*',route=>{if(new URL(route.request().url()).origin!==new URL(BASE).origin){external.push('external');return route.abort()}return route.continue()});
  await page.goto(`${BASE}/giris?next=${encodeURIComponent(next)}`);await page.locator('input[name="email"]').fill(user.email);await page.locator('input[name="password"]').fill(password);await page.getByRole('button',{name:'Giriş yap',exact:true}).click();
  await page.waitForURL(u=>u.origin===new URL(BASE).origin&&u.pathname===path);assert.equal(external.length,0);if(path.includes('ayarlar'))assert.equal(new URL(page.url()).search,'?from=login');await ctx.close();
 }
 console.log('PASS safe-next actual Chromium TAB/LF/CR login stays local; valid path/query preserved');
}finally{await browser?.close();if(tenant)await db.tenant.deleteMany({where:{id:tenant.id}});await db.$disconnect()}})().catch(e=>{console.error(e?.name||'Error');process.exitCode=1});
