/** Local fixture only: simulated proxy IPs and real Auth.js callbacks, then Chromium login. */
const assert=require('node:assert/strict');const crypto=require('node:crypto');const http=require('node:http');
const {PrismaClient}=require('@prisma/client');const bcrypt=require('bcryptjs');const {chromium}=require('playwright');
try{process.loadEnvFile('.env')}catch{ /* optional env */ }
const db=new PrismaClient(),BASE=process.env.BASE_URL||'http://localhost:3000';
(async()=>{let user,browser;const ips=Array.from({length:9},(_,i)=>`127.0.0.${i+2}`);try{
 const email=`login-dos-${crypto.randomUUID()}@example.test`,password='fixture-login-only';
 user=await db.user.create({data:{email,name:'Fixture admin',role:'superadmin',passwordHash:await bcrypt.hash(password,10)}});
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined});const ctx=await browser.newContext({locale:'tr-TR',viewport:{width:390,height:860}});
 for(const ip of ips){
  const csrf=(await (await ctx.request.get(`${BASE}/api/auth/csrf`)).json()).csrfToken;
  const cookie=(await ctx.cookies()).map(c=>`${c.name}=${c.value}`).join('; ');
  const form=new URLSearchParams({email,password:'wrong-fixture',csrfToken:csrf,callbackUrl:`${BASE}/admin`}).toString();
  const body=await new Promise((resolve,reject)=>{const u=new URL(`${BASE}/api/auth/callback/credentials`);const r=http.request(u,{method:'POST',family:4,localAddress:ip,headers:{cookie,'content-type':'application/x-www-form-urlencoded','content-length':Buffer.byteLength(form),'x-forwarded-for':'203.0.113.99','x-real-ip':'203.0.113.98','x-kr-proxy-token':'attacker-marker','x-auth-return-redirect':'1'}},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>{try{resolve(JSON.parse(data))}catch{reject(new Error('Unexpected auth response'))}})});r.on('error',reject);r.end(form)});
  assert.match(body.url,/error=CredentialsSignin/);
 }
 const actualKeys=ips.map(ip=>crypto.createHash('sha256').update(JSON.stringify([email,ip])).digest('hex'));
 assert.equal(await db.loginFailure.count({where:{key:{in:actualKeys}}}),9);
 assert.equal(await db.loginFailure.count({where:{key:crypto.createHash('sha256').update(JSON.stringify([email,'203.0.113.98'])).digest('hex')}}),0);

 const page=await ctx.newPage();await page.goto(`${BASE}/giris`);await page.locator('input[name="email"]').fill(email);await page.locator('input[name="password"]').fill(password);await page.getByRole('button',{name:'Giriş yap',exact:true}).click();await page.waitForURL(u=>u.pathname==='/admin');
 const session=await (await ctx.request.get(`${BASE}/api/auth/session`)).json();assert.equal(session.user.id,user.id);
 console.log('PASS local Auth.js wrong passwords from 9 loopback clients through authenticated Caddy do not lock a real Chromium correct-password login');
}finally{await browser?.close();if(user){const keys=[...ips,'unknown','::1','127.0.0.1'].map(ip=>crypto.createHash('sha256').update(JSON.stringify([user.email,ip])).digest('hex'));await db.loginFailure.deleteMany({where:{key:{in:keys}}});await db.user.deleteMany({where:{id:user.id}})}await db.$disconnect()}})().catch(e=>{console.error(e?.name||'Error',String(e.stack).split('\n').filter(x=>x.includes('login-dos.cjs')).join('\n'));process.exitCode=1});
