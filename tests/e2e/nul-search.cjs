/** Real HTTP NUL guards and literal owner/staff search; own PostgreSQL fixtures only. */
const assert=require('node:assert/strict'),crypto=require('node:crypto');const {PrismaClient}=require('@prisma/client'),bcrypt=require('bcryptjs'),{chromium}=require('playwright');
try{process.loadEnvFile('.env')}catch{ /* optional */ }
const db=new PrismaClient(),BASE=process.env.BASE_URL||'http://localhost:3000';
(async()=>{let browser,tenant;try{
 for(const url of ['/api/public/%00/services','/api/r/%00aaaaaaaaaaaaaaaaaaaa','/api/public/unknown/services?q=%00abc','/favicon.ico%00','/faviconXico%00']){const r=await fetch(BASE+url);assert.equal(r.status,400,'NUL URL must fail validation before DB');assert.equal((await r.json()).error.code,'validation')}
 tenant=await db.tenant.create({data:{slug:`nul-${crypto.randomUUID()}`,name:'Fixture',city:'Girne'}});await db.customer.createMany({data:['Normal Alice','Sale %%%','Code ___'].map((name,i)=>({tenantId:tenant.id,name,phone:`+90533125000${i}`}))});
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined});const password='fixture-search-only';let owner;
 for(const role of ['owner','staff']){const email=`${role}-${crypto.randomUUID()}@example.test`;await db.user.create({data:{tenantId:tenant.id,email,name:'Fixture',role,passwordHash:await bcrypt.hash(password,10)}});const ctx=await browser.newContext();const csrf=(await(await ctx.request.get(BASE+'/api/auth/csrf')).json()).csrfToken;await ctx.request.post(BASE+'/api/auth/callback/credentials',{form:{email,password,csrfToken:csrf,callbackUrl:BASE+'/panel'},headers:{'x-auth-return-redirect':'1'}});assert.ok((await(await ctx.request.get(BASE+'/api/auth/session')).json()).user?.id);if(role==='owner')owner=ctx;
  for(const [q,name] of [['%%%','Sale %%%'],['___','Code ___']]){const r=await ctx.request.get(BASE+'/api/panel/customers?q='+encodeURIComponent(q));assert.equal(r.status(),200);assert.deepEqual((await r.json()).customers.map(c=>c.name),[name])}
  const bad=await ctx.request.get(BASE+'/api/panel/customers?q=%00abc');assert.equal(bad.status(),400);
 }
 assert.equal((await owner.request.get(BASE+'/api/panel/services/%00')).status(),400);
 const valid={nameTr:'Fixture service',durationMin:30,priceTry:100,bufferMin:0,active:true,sortOrder:0};
 assert.equal((await owner.request.post(BASE+'/api/panel/services',{data:valid})).status(),201);
 assert.equal((await owner.request.post(BASE+'/api/panel/services',{data:{...valid,nameTr:'bad\0name'}})).status(),400);assert.equal(await db.service.count({where:{tenantId:tenant.id}}),1);
 const anonymous=await browser.newContext(),csrf=(await(await anonymous.request.get(BASE+'/api/auth/csrf')).json()).csrfToken;const invalid=await anonymous.request.post(BASE+'/api/auth/callback/credentials',{form:{email:'bad\0@example.test',password,csrfToken:csrf,callbackUrl:BASE+'/panel'},headers:{'x-auth-return-redirect':'1'}});assert.match((await invalid.json()).url,/error=CredentialsSignin/);
 console.log('PASS public/protected NUL URL400, body400/no write, literal owner/staff wildcard search, malformed-email generic login rejection');
 }finally{await browser?.close();if(tenant)await db.tenant.deleteMany({where:{id:tenant.id}});await db.$disconnect()}
})().catch(e=>{console.error(e.name,typeof e.actual==='number'?JSON.stringify({actual:e.actual,expected:e.expected}):'',String(e.stack).split('\n').filter(x=>x.includes('nul-search.cjs')).join('\n'));process.exitCode=1});
