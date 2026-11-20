/** Owned fixture + real Auth.js login and HTTP capability lifecycle. Never prints capability URLs. */
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {existsSync}=require('node:fs');
const pnpm=process.env.KR_PNPM||(existsSync('/tmp/kr-pnpm')?'/tmp/kr-pnpm':'pnpm');
const {chromium}=require('playwright');
const BASE=process.env.BASE_URL||'http://localhost:3400';
let stage='fixture';
function fixture(mode,data){
 const code=`try{process.loadEnvFile('.env')}catch{};import{createCalendarFixture,cleanupCalendarFixture}from './tests/fixtures/calendar-feed';const p=process.env.KR_CAL_MODE==='create'?createCalendarFixture():cleanupCalendarFixture(JSON.parse(process.env.KR_CAL_FIXTURE));p.then(x=>{console.log(JSON.stringify(x??null));process.exit(0)}).catch(()=>process.exit(1));`;
 const out=execFileSync(pnpm,['exec','tsx','-e',code],{env:{...process.env,KR_CAL_MODE:mode,KR_CAL_FIXTURE:JSON.stringify(data)},encoding:'utf8',timeout:30000});return JSON.parse(out.trim().split('\n').at(-1));
}
(async()=>{let f,browser;try{
 f=fixture('create');stage='browser';browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,headless:true});const ctx=await browser.newContext({locale:"tr-TR"});const page=await ctx.newPage();
 const endpoint=`${BASE}/api/panel/staff/${f.staffId}/calendar`;
 stage='anonymous';assert.equal((await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,401);
 stage='login';await page.goto(`${BASE}/giris`);await page.locator('input[name="email"]').fill(f.email);await page.locator('input[name="password"]').fill('CalendarFixture123!');await page.getByRole('button',{name:'Giriş yap',exact:true}).click();await page.waitForURL(u=>u.pathname.startsWith('/panel'));
 stage='mint';
 const mint=async()=>{const r=await ctx.request.post(endpoint,{data:{}});assert.equal(r.status(),200);assert.match(r.headers()['cache-control'],/no-store/);return(await r.json()).path;};
 assert.equal((await ctx.request.post(endpoint,{headers:{'content-type':'text/plain'},data:'{}'})).status(),415);
 const first=await mint();stage='feed';let res=await fetch(BASE+first);assert.equal(res.status,200);assert.match(res.headers.get('content-type'),/text\/calendar/);assert.match(res.headers.get('cache-control'),/no-store/);assert.equal(res.headers.get('referrer-policy'),'no-referrer');const text=await res.text();assert.equal((text.match(/BEGIN:VEVENT/g)||[]).length,1);assert.ok(!/PRIVATE_HTTP|90533|Private service/.test(text));
 stage='rotate';const second=await mint();assert.equal((await fetch(BASE+first)).status,404);assert.equal((await fetch(BASE+second)).status,200);
 stage='revoke';assert.equal((await ctx.request.delete(endpoint)).status(),200);assert.equal((await fetch(BASE+second)).status,404);assert.equal((await fetch(`${BASE}/api/calendar/not-a-token`)).status,404);
 console.log('PASS calendar-feed owner login/rotation/revocation/minimal ICS');
}finally{if(browser)await browser.close();if(f)fixture('cleanup',f);}})().catch(e=>{console.error(e.name,(e.stack||'').split('\n').filter(l=>l.includes('calendar-feed.cjs')).join(' '));console.error('Calendar HTTP regression failed at',stage,'; capability output intentionally omitted');process.exitCode=1;});
