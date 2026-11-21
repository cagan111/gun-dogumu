// Browser contract test: real page/slot times; controlled quote terms and POST responses, no booking write.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:3000';
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined });
 try {
  for (const lang of ['tr', 'en']) {
   const ctx = await browser.newContext({ viewport: { width:375,height:812 } });
   await ctx.addCookies([{name:'lang',value:lang,url:BASE}]);
   const page = await ctx.newPage(); let received=[], posted=[], rejectConflict=true;
   page.on('response', async res => { if(res.url().includes('/slots?') && res.ok()) received=(await res.json()).slots; });
   await page.route('**/api/public/*/appointments', async route => { posted.push(route.request().postDataJSON()); await route.fulfill({status:rejectConflict?409:503,contentType:'application/json',body:JSON.stringify({error:{code:rejectConflict?'conflict':'unavailable'}})}); });
   await page.route('**/api/public/*/slots?*', async route => {
    const response=await route.fetch(); const body=await response.json();
    await route.fulfill({response,json:{...body,slots:body.slots.map(slot=>({...slot,offers:slot.offers.map(q=>({...q,priceTry:'125.37',durationMin:35}))}))}});
   });
   await page.goto(`${BASE}/lefkosa-usta-berber`);
   await page.getByRole('button',{name:/Saç Kesimi|Haircut/}).first().click();
   const next=()=>page.getByRole('button',{name:lang==='tr'?'Devam':'Continue',exact:true}).click();
   await next(); await page.getByRole('button',{name:/Fark etmez|No preference|Anyone/}).click(); await next();
   async function selectTime() {
    for(let i=1;i<10;i++) {
     const response=page.waitForResponse(r=>r.url().includes('/slots?')&&r.ok());
     await page.locator('button.w-16').nth(i).click(); await response;
     const buttons=page.locator('button.min-h-11[aria-pressed]');
     await page.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));
     if(await buttons.count()) { const time=await buttons.first().innerText(); await buttons.first().click(); return received.find(s=>s.time===time).offers[0]; }
    } throw Error('No available fixture time');
   }
   let offer=await selectTime(); await next();
   const summary=page.getByRole('region',{name:lang==='tr'?'Özet':'Summary'});
   assert.ok(!(await summary.innerText()).match(/Fark etmez|No preference|Anyone/),'summary binds an exact specialist');
   await summary.getByText(lang==='tr'?`${offer.durationMin} dk`:`${offer.durationMin} min`,{exact:true}).waitFor();
   await summary.getByText(`${new Intl.NumberFormat(lang==='tr'?'tr-TR':'en-GB',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(offer.priceTry))} TL`,{exact:true}).waitFor();
   // Contract field is checked independently of localized currency formatting.
   assert.equal(await summary.getAttribute('data-quote-price'),offer.priceTry);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),'375px fit');
   if(lang==='tr') {
    await page.getByRole('button',{name:'English',exact:true}).click();
    await page.getByRole('region',{name:'Summary'}).waitFor();
    assert.equal(await page.getByRole('region',{name:'Summary'}).getAttribute('data-quote-price'),offer.priceTry);
    await page.getByRole('button',{name:'Türkçe',exact:true}).click(); await summary.waitFor();
   }

   await page.locator('[name=name]').fill('Quote Browser'); await page.locator('[name=phone]').fill('+905339990088'); await page.locator('[name=kvkk]').check();
   const confirm=()=>page.getByRole('button',{name:lang==='tr'?'Randevuyu onayla':'Confirm appointment',exact:true}).click();
   await confirm();
   await page.getByText(lang==='tr'?'Fiyat, süre veya uygunluk değişti. Güncel seçimi kontrol edip yeniden onaylayın.':'Price, duration or availability changed. Check the updated selection and confirm again.',{exact:true}).waitFor();
   assert.deepEqual(posted[0].quote,offer); assert.equal(posted[0].staffId,offer.staffId);
   assert.equal(await page.locator('button.min-h-11[aria-pressed=true]').count(),0,'conflict clears selection');
   assert.equal(await page.getByRole('button',{name:lang==='tr'?'Devam':'Continue',exact:true}).isDisabled(),true);
   // Refreshed slots require another explicit selection; no automatic replay.
   assert.equal(posted.length,1); rejectConflict=false;
   const response=page.waitForResponse(r=>r.url().includes('/slots?')&&r.ok());
   await page.locator('button.w-16').nth(11).click(); await response;
   offer=await selectTime(); await next(); await confirm();
   await page.getByRole('alert').waitFor(); assert.equal(posted.length,2); assert.deepEqual(posted[1].quote,offer);
   assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>/quote/i.test(k))),false);
   // A rolling/stale slots response without offers must not enable legacy-price booking.
   await page.route('**/api/public/*/slots?*', async route => {
    const response=await route.fetch(); const body=await response.json();
    await route.fulfill({response,json:{...body,slots:body.slots.map(({offers,...slot})=>slot)}});
   });
   await page.getByRole('button',{name:lang==='tr'?'Geri':'Back',exact:true}).click();
   await page.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));
   assert.equal(await page.locator('button.min-h-11[aria-pressed]').count(),0);
   assert.equal(await page.getByRole('button',{name:lang==='tr'?'Devam':'Continue',exact:true}).isDisabled(),true);

   await ctx.close();
  }
 } finally { await browser.close(); }
 console.log('PASS TR/EN mobile exact quote display/echo and conflict reselection (intercepted POST, no writes)');
})().catch(e=>{console.error('FAIL booking quote browser contract:', e.message);process.exitCode=1;});
