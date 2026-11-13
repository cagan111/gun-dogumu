'use strict';
// Ortamı menü açıkken hazırla; ilk dünya çizimi GLB çözümlemesini boğmasın.
// Oynanış/kayıt API'si ve REAL yükleyicisi değişmez. Beklemeden başlamak isteğe bağlıdır.
const VARLIK_MENU={phase:'idle',timer:0,start:0,total:0,warm:[],warmAt:0,error:''};
function varlikPaint() {
  const s=VARLIK_MENU,ready=s.phase==='ready',waiting=s.phase==='loading'||s.phase==='warming';
  for(const id of ['go','cont']) { const b=document.getElementById(id);if(b)b.disabled=waiting; }
  const text=document.getElementById('varlikStatus'),skip=document.getElementById('varlikSkip');
  if(text) {
    const n=typeof REAL==='undefined'?0:Object.keys(REAL.M).length;
    const message=ready?'Çevre hazır.':s.phase==='loading'?(n===s.total?'Zemin hazırlanıyor…':`Çevre hazırlanıyor · ${n}/${s.total}`):s.phase==='warming'?`Uzak görünüm hazırlanıyor · ${s.warmAt}/${s.warm.length}`:s.phase==='bypassed'?'Ayrıntılar oyun sırasında tamamlanabilir.':'Çevre henüz tamamlanamadı; beklemeden başlayabilirsin.';
    if(text.textContent!==message)text.textContent=message;
  }
  if(skip)skip.style.display=waiting?'inline-block':'none';
}
function varlikSkip() { clearTimeout(VARLIK_MENU.timer);VARLIK_MENU.phase='bypassed';varlikPaint(); }
function varlikFail(reason) { clearTimeout(VARLIK_MENU.timer);VARLIK_MENU.error=String(reason);VARLIK_MENU.phase='error';varlikPaint(); }
function varlikPoll() {
  const s=VARLIK_MENU;if(s.phase!=='loading')return;
  if(performance.now()-s.start>45000){varlikFail('timeout');return;}
  if(REAL.why||REAL.err){varlikFail(REAL.why||REAL.err);return;}
  const n=Object.keys(REAL.M).length;
  if(REAL.ready && n===s.total && REALG.on.value===1) {
    s.phase='warming';s.warm=[...new Set([...REAL_SET.tree,...REAL_SET.conifer])].filter(n=>REAL.M[n]);s.warmAt=0;
    s.timer=setTimeout(varlikWarm,0);
  } else s.timer=setTimeout(varlikPoll,100);
  varlikPaint();
}
function varlikWarm() {
  const s=VARLIK_MENU;if(s.phase!=='warming')return;
  // Her kart ayrı görevde; menü/girdi arada nefes alır. Oyun başladıysa yeni RT işi yapma.
  if(G.started){varlikSkip();return;}
  try {
    if(s.warmAt<s.warm.length){const n=s.warm[s.warmAt];realImpostor(n);if(!REAL.M[n].imp)throw new Error('impostor');s.warmAt++;s.timer=setTimeout(varlikWarm,0);}
    else {s.phase='ready';}
    varlikPaint();
  } catch(e){varlikFail(e);}
}
function varlikBegin() {
  const s=VARLIK_MENU;clearTimeout(s.timer);s.phase='loading';s.start=performance.now();s.error='';
  s.total=typeof REAL_SET==='undefined'?0:new Set(Object.values(REAL_SET).flat()).size;
  varlikPaint();
  // İlk menü boyansın; büyük kurulum aynı başlangıç script görevine eklenmesin.
  s.timer=setTimeout(()=>{
    try {
      if(typeof init3D!=='function'||typeof realStart!=='function'||!init3D()){varlikFail('WebGL');return;}
      realStart();varlikPoll();
    } catch(e){varlikFail(e);}
  },0);
}
function varlikMenu() {
  const go=document.getElementById('go');if(!go)return;
  if(!document.getElementById('varlikStatus')) {
    const box=document.createElement('div');box.style.cssText='margin:10px 0;font-size:14px;color:#d5d5bf';
    const text=document.createElement('p');text.id='varlikStatus';text.setAttribute('role','status');text.setAttribute('aria-live','polite');text.style.margin='6px 0';box.appendChild(text);
    const skip=document.createElement('button');skip.id='varlikSkip';skip.textContent='Beklemeyi atla';skip.title='Çevre ayrıntıları oyun sırasında tamamlanabilir';skip.style.cssText='min-height:44px;font:inherit';skip.onclick=varlikSkip;box.appendChild(skip);go.parentNode.insertBefore(box,go);
  }
  const s=VARLIK_MENU;
  if(s.phase==='idle'||s.phase==='bypassed'||s.phase==='error')varlikBegin();else varlikPaint();
}
