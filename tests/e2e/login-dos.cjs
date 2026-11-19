/** Local fixture only: simulated proxy IPs and real Auth.js callbacks, then Chromium login. */
const assert=require('node:assert/strict');const crypto=require('node:crypto');
const {PrismaClient}=require('@prisma/client');const bcrypt=require('bcryptjs');const {chromium}=require('playwright');
try{process.loadEnvFile('.env')}catch{ /* optional env */ }
const db=new PrismaClient(),BASE=process.env.BASE_URL||'http://localhost:3000';
(async()=>{let user,browser;const ips=Array.from({length:9},(_,i)=>`192.0.2.${i+1}`);try{
 const email=`login-dos-${crypto.randomUUID()}@example.test`,password='fixture-login-only';
 user=await db.user.create({data:{email,name:'Fixture admin',role:'superadmin',passwordHash:await bcrypt.hash(password,10)}});
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined});const ctx=await browser.newContext({locale:'tr-TR',viewport:{width:390,height:860}});
 for(const ip of ips){const csrf=(await (await ctx.request.get(`${BASE}/api/auth/csrf`)).json()).csrfToken;const res=await ctx.request.post(`${BASE}/api/auth/callback/credentials`,{headers:{'x-forwarded-for':ip,'x-auth-return-redirect':'1'},form:{email,password:'wrong-fixture',csrfToken:csrf,callbackUrl:`${BASE}/admin`}});const body=await res.json();assert.match(body.url,/error=CredentialsSignin/)}
 const page=await ctx.newPage();await page.goto(`${BASE}/giris`);await page.locator('input[name="email"]').fill(email);await page.locator('input[name="password"]').fill(password);await page.getByRole('button',{name:'Giriş yap',exact:true}).click();await page.waitForURL(u=>u.pathname==='/admin');
 const session=await (await ctx.request.get(`${BASE}/api/auth/session`)).json();assert.equal(session.user.id,user.id);
 console.log('PASS local Auth.js wrong passwords from 9 simulated clients do not lock a real Chromium correct-password login');
}finally{await browser?.close();if(user){const keys=[...ips,'unknown','::1','127.0.0.1'].map(ip=>crypto.createHash('sha256').update(JSON.stringify([user.email,ip])).digest('hex'));await db.loginFailure.deleteMany({where:{key:{in:keys}}});await db.user.deleteMany({where:{id:user.id}})}await db.$disconnect()}})().catch(e=>{console.error(e?.name||'Error',String(e.stack).split('\n').filter(x=>x.includes('login-dos.cjs')).join('\n'));process.exitCode=1});
