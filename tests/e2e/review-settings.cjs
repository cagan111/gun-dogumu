/** T105a/b1 configuration/completion/intent API; no invitation worker is enabled. */
const assert=require('node:assert/strict');const {execFileSync}=require('node:child_process');const {existsSync}=require('node:fs');const {chromium}=require('playwright');
const pnpm=process.env.KR_PNPM||(existsSync('/tmp/kr-pnpm')?'/tmp/kr-pnpm':'pnpm'),BASE=process.env.BASE_URL||'http://localhost:3400';
function fixture(mode,data){const code=`try{process.loadEnvFile('.env')}catch{};import{createCalendarFixture,cleanupCalendarFixture,setCalendarFixtureConsent,inspectCalendarFixtureReview}from './tests/fixtures/calendar-feed';const p=process.env.KR_REV_MODE==='create'?createCalendarFixture():process.env.KR_REV_MODE==='consent'?setCalendarFixtureConsent(JSON.parse(process.env.KR_REV_FIXTURE)):process.env.KR_REV_MODE==='inspect'?inspectCalendarFixtureReview(JSON.parse(process.env.KR_REV_FIXTURE)):cleanupCalendarFixture(JSON.parse(process.env.KR_REV_FIXTURE));p.then(x=>{console.log(JSON.stringify(x??null));process.exit(0)}).catch(()=>process.exit(1));`;return JSON.parse(execFileSync(pnpm,['exec','tsx','-e',code],{env:{...process.env,KR_REV_MODE:mode,KR_REV_FIXTURE:JSON.stringify(data)},encoding:'utf8',timeout:30000}).trim().split('\n').at(-1));}
async function login(context,email){const page=await context.newPage();await page.goto(`${BASE}/giris`);await page.locator('input[name="email"]').fill(email);await page.locator('input[name="password"]').fill('CalendarFixture123!');await page.getByRole('button',{name:'Giriş yap',exact:true}).click();await page.waitForURL(u=>u.pathname.startsWith('/panel'));return page;}
(async()=>{let f,browser;try{
 f=fixture('create');browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH});const ctx=await browser.newContext({locale:'tr-TR'});await login(ctx,f.email);
 const settings=`${BASE}/api/panel/settings`,status=`${BASE}/api/panel/appointments/${f.appointmentId}/status`,url='https://g.page/r/C_fixture-1/review';
 assert.equal((await ctx.request.get(settings)).status(),200);assert.equal((await(await ctx.request.get(settings)).json()).reviewInviteEnabled,false);
 assert.equal((await ctx.request.patch(settings,{data:{reviewInviteEnabled:true}})).status(),400);
 for(const bad of ['https://google.com/url?q=https://evil.example','https://g.page.evil.example/r/id/review','https://g.page/r/id/review#evil'])assert.equal((await ctx.request.patch(settings,{data:{reviewInviteUrl:bad}})).status(),400);
 assert.equal((await ctx.request.patch(settings,{data:{reviewInviteEnabled:true,reviewInviteUrl:url}})).status(),200);
 assert.equal((await ctx.request.patch(settings,{data:{reviewInviteUrl:null}})).status(),400);assert.equal((await(await ctx.request.get(settings)).json()).reviewInviteUrl,url);
 fixture('consent',f);
 let result=await ctx.request.post(status,{data:{status:'completed'}});assert.equal(result.status(),200);const first=(await result.json()).completedAt;assert.equal(typeof first,'string');
 let snapshot=fixture('inspect',f);assert.equal(snapshot.rows.length,1);assert.equal(snapshot.rows[0].status,'pending');assert.equal(snapshot.messages,0);assert.equal(snapshot.ledgerRows,0);const intentId=snapshot.rows[0].id;
 result=await ctx.request.post(status,{data:{status:'completed'}});assert.equal((await result.json()).completedAt,first);
 assert.equal((await ctx.request.post(status,{data:{status:'confirmed'}})).status(),200);
 result=await ctx.request.post(status,{data:{status:'completed'}});assert.equal((await result.json()).completedAt,first);
 snapshot=fixture('inspect',f);assert.equal(snapshot.rows.length,1);assert.equal(snapshot.rows[0].id,intentId);assert.equal(snapshot.rows[0].status,'skipped');assert.equal(snapshot.rows[0].finishedReason,'appointment_changed');assert.equal(snapshot.messages,0);assert.equal(snapshot.ledgerRows,0);
 assert.equal((await ctx.request.patch(settings,{data:{reviewInviteEnabled:false,reviewInviteUrl:null}})).status(),200);
 const staff=await browser.newContext({locale:'tr-TR'});await login(staff,f.staffEmail);assert.equal((await staff.request.patch(settings,{data:{reviewInviteEnabled:true,reviewInviteUrl:url}})).status(),403);
 console.log('PASS review settings default-off/Google-only/owner/first-completion API');
}finally{if(browser)await browser.close();if(f)fixture('cleanup',f);}})().catch(()=>{console.error('Review settings HTTP regression failed; private fixture data omitted');process.exitCode=1;});
