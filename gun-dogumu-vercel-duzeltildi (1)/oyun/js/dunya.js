'use strict';
// =============================================================
//  DÜNYA — ada, arazi yüksekliği, biyomlar, dünya üretimi (tohumlu),
//          zaman, ışık, hava
// =============================================================
// biyom kodları: 0 orman, 1 dağ, 2 bataklık, 3 sisli vadi, 4 çayır/ova, 5 kumsal, 6 deniz
const BIOME_AD = ['Orman', 'Dağlar', 'Bataklık', 'Sisli Vadi', 'Çayır', 'Kumsal', 'Deniz'];
const B_SEA = 6;

// ---- tohumlu değer gürültüsü (deterministik)
let nzSeed = 0;
function nzHash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + nzSeed) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = nzHash(i, j), b = nzHash(i + 1, j), c = nzHash(i, j + 1), d = nzHash(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, oct) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let k = 0; k < oct; k++) { s += a * vnoise(x * f + k * 17.3, y * f - k * 9.1); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---- ada kıyısı: pozitif = karada kıyıdan içeri uzaklık (yaklaşık), negatif = deniz
let ISL = null;
function landness(x, y) {
  if (!ISL) return 1e4;
  const P = ISL, dx = x - CAMP.x, dy = y - CAMP.y, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
  let R = P.R0 + P.a2 * Math.sin(2 * a + P.p2) + P.a3 * Math.sin(3 * a + P.p3) + P.a5 * Math.sin(5 * a + P.p5) + P.a9 * Math.sin(9 * a + P.p9);
  R += (fbm(x / (2600 * ISLK) + 31.7, y / (2600 * ISLK) - 12.1, 4) - 0.5) * 2600 * ISLK + (vnoise(x / 700 - 4.4, y / 700 + 2.7) - 0.5) * 260;
  return clamp(R, 6000 * ISLK, 7500 * ISLK) - r;
}
// biyom lekesi: 1 merkezde, 0 kenarda, dışarıda negatif (−0.5'e kadar; daha uzaksa −1)
function blobT(b, x, y) {
  const dx = x - b.x, dy = y - b.y, m = b.r * 1.6;
  if (dx > m || dx < -m || dy > m || dy < -m) return -1;
  const a = Math.atan2(dy, dx);
  return 1 - Math.hypot(dx, dy) / (b.r * (1 + 0.18 * Math.sin(a * 3 + b.p) + 0.08 * Math.sin(a * 7 + b.q)));
}

// Biyom lekeleri değişmeden kalır; her örnekte tüm adayı taramak yerine
// blobT'nin aynı 1.6*r sınırını kapsayan, sırası korunmuş aday listesi kullanılır.
const BLOB_CELL=1000;
let blobIndex=null;
function buildBlobIndex() {
  const n=Math.ceil(WORLD/BLOB_CELL), cells=Array.from({length:n*n},()=>[]);
  for(const b of G.blobs) {
    const m=b.r*1.6, x0=Math.max(0,Math.floor((b.x-m)/BLOB_CELL)),x1=Math.min(n-1,Math.floor((b.x+m)/BLOB_CELL));
    const y0=Math.max(0,Math.floor((b.y-m)/BLOB_CELL)),y1=Math.min(n-1,Math.floor((b.y+m)/BLOB_CELL));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)cells[y*n+x].push(b);
  }
  blobIndex={source:G.blobs,length:G.blobs.length,n,cells};
}
function blobsNear(x,y) {
  const q=blobIndex;
  if(!q||q.source!==G.blobs||q.length!==G.blobs.length||x<0||y<0||x>=WORLD||y>=WORLD||!Number.isFinite(x)||!Number.isFinite(y))return G.blobs;
  return q.cells[Math.floor(y/BLOB_CELL)*q.n+Math.floor(x/BLOB_CELL)];
}

// ---- yükseklik haritası (HC birimlik ızgara, çift doğrusal örnekleme)
const HC = 50; let HN = Math.round(WORLD / HC), HW = HN + 1;
function islandGridReset() { HN = Math.round(WORLD / HC); HW = HN + 1; }
let HM = null, TMUL = null;
// Arazi profili: 0 eski, 1 merkez yamaç, 2 kayıtlı kıyı. Eski v4 arazisi değişmez.
function cavSiteEnabled() { return (G.caveTerrain===1||G.caveTerrain===2)&&!G.coastPlanning; }
function selectCoastalHome(seed) {
  const R=mulberry32(seed^0x73c4), offset=R()*TAU;
  for(let i=0;i<96;i++) {
    const a=offset+i*TAU/96,c=Math.cos(a),sn=Math.sin(a);let lo=0,hi=WORLD*.7;
    if(landness(CAMP.x+c*hi,CAMP.y+sn*hi)>=0)continue;
    for(let k=0;k<28;k++){const m=(lo+hi)/2;if(landness(CAMP.x+c*m,CAMP.y+sn*m)>0)lo=m;else hi=m}
    const r=(lo+hi)/2,h={v:1,x:CAMP.x+c*(r-320),y:CAMP.y+sn*(r-320),ang:a-Math.PI/2};
    const cave={x:h.x-c*430,y:h.y-sn*430},beach={x:h.x+c*180,y:h.y+sn*180};
    if(h.x<1700||h.y<1700||h.x>WORLD-1700||h.y>WORLD-1700||biomeAt(beach.x,beach.y)!==5)continue;
    if([h,cave].some(q=>groundH(q.x,q.y)<1||G.ccamps.some(o=>Math.hypot(q.x-o.x,q.y-o.y)<2500)))continue;
    // Terrası biçimlendirmek mevcut su/enkaz/liman düzlemlerini değiştirmesin.
    if(G.lakes.some(o=>Math.hypot(h.x-o.x,h.y-o.y)<o.r+1750))continue;
    if([G.harbor,...G.wrecks].some(o=>Math.hypot(h.x-o.x,h.y-o.y)<1900||Math.hypot(cave.x-o.x,cave.y-o.y)<800))continue;
    if(Math.hypot(h.x-G.rift.x,h.y-G.rift.y)<2000)continue;
    return h;
  }
  return null;
}
function cavSiteReserved(x,y,margin=0) {
  if (!cavSiteEnabled()) return false;
  const q=homeLocal(x,y),dx=q.x,dy=q.y;
  return Math.hypot(dx,dy+430)<200+margin || (Math.abs(dx)<60+margin&&dy>-430-margin&&dy<(G.caveTerrain===2?240:40)+margin);
}
function cavSiteHeight(x,y) {
  const q=homeLocal(x,y),dx=q.x,dy=q.y;
  if (Math.abs(dx)>700||dy>180||dy<-1350) return 0;
  const ramp=128*sstep(40,300,-dy)*(1-sstep(180,420,Math.abs(dx)))*(1-sstep(650,1100,-dy));
  const ridge=320*(1-sstep(0,1,Math.hypot(dx/550,(dy+790)/510)));
  return Math.max(ramp,ridge);
}
function cavSiteRocks() {
  if (!cavSiteEnabled()) return;
  const R=mulberry32(G.seed^0x51ac), points=[[-83,-300,48],[83,-300,48],[-145,-450,64],[145,-450,64],[-74,-580,60],[74,-580,60]];
  for (const [dx,dy,r] of points) {
    const v=[];for(let i=0;i<8;i++){const a=i/8*TAU;v.push([Math.cos(a)*r*(.85+R()*.2),Math.sin(a)*r*(.85+R()*.2)])}
    const q=homeWorld(dx,dy);
    const o={x:q.x,y:q.y,r,kind:'rock',res:'stone',amt:28,v,shade:.95+R()*.1,i:G.rocks.length,shelter:true};G.rocks.push(o);gAdd(o);
  }
}
function rawH(x, y) {
  const c = landness(x, y);
  if (c < 0) return Math.max(-190, -2 + c * 0.22);   // deniz tabanı
  let h = 2 + 20 * sstep(0, 800, c);
  const wI = sstep(0, 900, c);
  const hill = (fbm(x / 1800 + 7.3, y / 1800 + 1.9, 3) - 0.5) * 2;
  h += hill * 105 * wI;
  // geniş vadiler
  const vv = Math.abs(fbm(x / 4200 - 3.3, y / 4200 + 8.8, 2) - 0.5) * 2;
  h -= (1 - sstep(0, 0.22, vv)) * 45 * wI;
  let mm = 0, mist = 0, sw = 0, md = 0;
  for (const b of blobsNear(x,y)) {
    const t = blobT(b, x, y); if (t <= -0.3) continue;
    if (b.k === 1) mm = Math.max(mm, sstep(-0.25, 0.55, t));
    else if (b.k === 3) mist = Math.max(mist, sstep(-0.2, 0.45, t));
    else if (b.k === 2) sw = Math.max(sw, sstep(-0.2, 0.4, t));
    else if (b.k === 4) md = Math.max(md, sstep(-0.3, 0.5, t));
  }
  if (md > 0) h = h * (1 - md * 0.4) + md * 14;               // ova: yumuşak, açık
  if (sw > 0) h = h * (1 - sw * 0.8) + sw * 4;                // bataklık: alçak ve düz
  if (mist > 0) h -= mist * 50;                               // sisli vadi: çukur
  if (mm > 0) {
    const rg = clamp(1 - Math.abs(fbm(x / 640 + 2.2, y / 640 - 5.5, 3) * 2 - 1) * 2.6, 0, 1);
    const pk = fbm(x / 1500 - 9.1, y / 1500 + 4.4, 2);
    h += Math.pow(mm, 1.35) * (330 + 330 * rg * rg + 260 * pk);
  }
  const dc = Math.hypot(x-HOME.x,y-HOME.y);
  if(G.caveTerrain===2) {
    const centre=Math.hypot(x-CAMP.x,y-CAMP.y);
    if(centre<1500)h=8+(h-8)*sstep(700,1500,centre);
    if(!G.coastPlanning&&Math.hypot(HOME.x-CAMP.x,HOME.y-CAMP.y)>1&&dc<1500)h=8+(h-8)*sstep(700,1500,dc);
  } else if(dc<1500)h=8+(h-8)*sstep(700,1500,dc);
  if(cavSiteEnabled())h+=cavSiteHeight(x,y);
  return Math.max(h, 1.2);
}
function groundH(x, y) {
  if (!HM) return 0;
  let fx = x / HC, fy = y / HC;
  if (!(fx > 0)) fx = 0; else if (fx > HN - 0.0001) fx = HN - 0.0001;
  if (!(fy > 0)) fy = 0; else if (fy > HN - 0.0001) fy = HN - 0.0001;
  const i = fx | 0, j = fy | 0, u = fx - i, v = fy - j, k = j * HW + i;
  const a = HM[k], b = HM[k + 1], c = HM[k + HW], d = HM[k + HW + 1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function isSea(x, y) { return HM ? groundH(x, y) < 0 : false; }
// Buz yüzeyi yalnız canlıların yürüyüş yüksekliğidir; arazi verisi değişmez. (Codex)
function frozenLakeAt(x, y) {
  for (const l of G.lakes || []) { if (!l.frozen || !Number.isFinite(l.h)) continue; const dx = x - l.x, dy = y - l.y; if (Math.abs(dx) <= l.r && Math.abs(dy) <= l.r && dx * dx + dy * dy <= l.r * l.r) return l; }
  return null;
}
function walkSurfaceH(x, y) { const h = groundH(x, y), lake = frozenLakeAt(x, y); return lake ? Math.max(h, lake.h) : h; }
// eğime göre yürüme hızı çarpanı: düzde 1, dik dağ yamacında ~0.55
function terrainMul(x, y) {
  if (!TMUL) return 1;
  let fx = x / HC, fy = y / HC;
  if (!(fx > 0)) fx = 0; else if (fx > HN - 0.0001) fx = HN - 0.0001;
  if (!(fy > 0)) fy = 0; else if (fy > HN - 0.0001) fy = HN - 0.0001;
  const i = fx | 0, j = fy | 0, u = fx - i, v = fy - j, k = j * HW + i;
  const a = TMUL[k], b = TMUL[k + 1], c = TMUL[k + HW], d = TMUL[k + HW + 1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function buildTMul() {
  TMUL = new Float32Array(HW * HW);
  for (let j = 0; j < HW; j++) for (let i = 0; i < HW; i++) {
    const k = j * HW + i, i0 = Math.max(0, i - 1), i1 = Math.min(HN, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(HN, j + 1);
    const gx = (HM[j * HW + i1] - HM[j * HW + i0]) / ((i1 - i0) * HC), gy = (HM[j1 * HW + i] - HM[j0 * HW + i]) / ((j1 - j0) * HC);
    const s = Math.hypot(gx, gy);
    TMUL[k] = HM[k] < 0 ? 1 : 1 - clamp((s - 0.15) * 0.75, 0, 0.45);
  }
}
// bir noktanın çevresini (r içinde tam, r..r+band arası geçişle) h seviyesine düzle
function flattenH(x, y, r, band, h, bottom) {
  const R = r + band, i0 = Math.max(0, Math.floor((x - R) / HC)), i1 = Math.min(HN, Math.ceil((x + R) / HC)), j0 = Math.max(0, Math.floor((y - R) / HC)), j1 = Math.min(HN, Math.ceil((y + R) / HC));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const d = Math.hypot(i * HC - x, j * HC - y); if (d > R) continue;
    const k = j * HW + i, tgt = d < r && bottom !== undefined ? Math.max(0.5, h - bottom * (1 - d / r)) : h;
    HM[k] = d < r ? tgt : tgt + (HM[k] - tgt) * sstep(r, R, d);
  }
}

function biomeAt(x, y) {
  const c = landness(x, y);
  if (c < 0 || (HM && groundH(x, y) < 0)) return B_SEA;
  let mt = -1;
  const bs=blobsNear(x,y);
  for (const b of bs) if (b.k === 1) { const t = blobT(b, x, y); if (t > mt) mt = t; }
  if (c < 170 + 150 * vnoise(x / 650 + 3.1, y / 650 - 7.7) && mt < -0.1) return 5;
  for (const k of [3, 1, 2, 4]) for (const b of bs) { if (b.k === k && blobT(b, x, y) > 0) return k; }
  return 0;
}
function biomeFast(x, y) {
  const i = clamp(Math.floor(x / MAPC), 0, MAPN - 1), j = clamp(Math.floor(y / MAPC), 0, MAPN - 1);
  return G.bmap[j * MAPN + i];
}
// kıyıya kadar ışın: kamptan a yönünde ilk deniz noktasının yarıçapı
function coastR(a, r0 = 4500 * ISLK) {
  const rMax = 8200 * ISLK;
  for (let r = r0; r < rMax; r += 20) if (groundH(CAMP.x + Math.cos(a) * r, CAMP.y + Math.sin(a) * r) < 0) return r;
  return rMax;
}

function genWorld(seed,chooseHome=false) {
  blobIndex=null;
  const coastal=G.caveTerrain===2,savedHome={v:1,x:HOME.x,y:HOME.y,ang:HOME.ang};
  if(coastal){setHome(null);G.coastPlanning=true}
  const S = mulberry32(seed);
  const sr = (a, b) => a + S() * (b - a), sri = (a, b) => Math.floor(sr(a, b + 1)), spick = a => a[Math.floor(S() * a.length)];
  const sg = () => (S() + S() + S() - 1.5) / 1.5;
  grid = new Map();
  Object.assign(G, { ccamps: [], trees: [], rocks: [], crystals: [], bushes: [], herbs: [], poisons: [], nests: [], lakes: [], pools: [], deco: [], blobs: [], wrecks: [], harbor: null });
  nzSeed = (seed * 2654435761) | 0; HM = null; TMUL = null;
  ISL = { R0: sr(6750, 6950) * ISLK, a2: sr(120, 260), p2: sr(0, TAU), a3: sr(100, 220), p3: sr(0, TAU), a5: sr(60, 140), p5: sr(0, TAU), a9: sr(30, 70), p9: sr(0, TAU) };
  const dC = (x, y) => Math.hypot(x - CAMP.x, y - CAMP.y);
  const nearCamp = (x, y, m) => Math.hypot(x-HOME.x,y-HOME.y)<m;
  const inW = (x, y, m = 80) => x > m && y > m && x < WORLD - m && y < WORLD - m;
  const polar = (a, r) => ({ x: CAMP.x + Math.cos(a) * r, y: CAMP.y + Math.sin(a) * r });

  // ---- biyom lekeleri (kamp çevresi ~1900 birim orman kalır)
  function placeBlob(k, rmin, rmax, dmin, dmax, clear, sep) {
    for (let t = 0; t < 60; t++) {
      const r = sr(rmin, rmax), p = polar(sr(0, TAU), sr(dmin, dmax));
      if (dC(p.x, p.y) - r * 1.26 < clear || landness(p.x, p.y) < r * 0.5) continue;
      if (G.blobs.some(b => Math.hypot(b.x - p.x, b.y - p.y) < (b.r + r) * sep)) continue;
      const b = { k, x: p.x, y: p.y, r, p: sr(0, 9), q: sr(0, 9) }; G.blobs.push(b); return b;
    }
    return null;
  }
  // sisli vadiler; en uzaktaki yarığı taşır
  const riftA = sr(0, TAU);
  { const r = sr(650, 800), d = Math.min(sr(4500, 5200) * ISLK, coastR0(riftA) - r - 500), p = polar(riftA, d); G.blobs.push({ k: 3, x: p.x, y: p.y, r, p: sr(0, 9), q: sr(0, 9) }); }
  G.rift = { x: G.blobs[0].x, y: G.blobs[0].y, r: 50, found: false };
  for (let i = 0; i < Math.round(2 * ISLK * ISLK); i++) placeBlob(3, 550, 800, 3000 * ISLK, 5600 * ISLK, 2400, 1.1);
  // dağ sıraları: kavisli zincirler
  for (let m = 0; m < Math.round(5 * ISLK * ISLK); m++) {
    let a = sr(0, TAU), d = sr(2900, 5400 * ISLK), dir = sr(0, TAU), n = sri(4, 6), x = CAMP.x + Math.cos(a) * d, y = CAMP.y + Math.sin(a) * d;
    for (let i = 0; i < n; i++) {
      const r = sr(380, 660);
      if (dC(x, y) - r * 1.26 > 2300 && landness(x, y) > r * 0.3 && Math.hypot(x - G.rift.x, y - G.rift.y) > r + 900) G.blobs.push({ k: 1, x, y, r, p: sr(0, 9), q: sr(0, 9) });
      dir += sr(-0.5, 0.5); x += Math.cos(dir) * r * 1.05; y += Math.sin(dir) * r * 1.05;
    }
  }
  for (let i = 0; i < Math.round(4 * ISLK * ISLK); i++) placeBlob(2, 550, 900, 2600 * ISLK, 5600 * ISLK, 2100, 1.0);
  placeBlob(4, 700, 950, 2300, 2900, 1500, 0.9);              // kampa en yakın ova
  for (let i = 0; i < Math.round(7 * ISLK * ISLK); i++) placeBlob(4, 700, 1250, 2500, 6000 * ISLK, 1600, 0.9);

  buildBlobIndex();
  // ---- yükseklik haritası
  HM = new Float32Array(HW * HW);
  for (let j = 0; j < HW; j++) for (let i = 0; i < HW; i++) HM[j * HW + i] = rawH(i * HC, j * HC);
  flattenH(G.rift.x, G.rift.y, 160, 260, groundH(G.rift.x, G.rift.y));
  if (cavSiteEnabled()) { const q=homeWorld(0,-430);flattenH(q.x,q.y,110,70,136); }
  // biyom haritası
  G.bmap = new Uint8Array(MAPN * MAPN);
  for (let j = 0; j < MAPN; j++) for (let i = 0; i < MAPN; i++) G.bmap[j * MAPN + i] = biomeAt((i + 0.5) * MAPC, (j + 0.5) * MAPC);
  const B = (x, y) => biomeFast(x, y);
  const land = (x, y) => inW(x, y) && groundH(x, y) > 2.5;

  // ---- liman: kampa en yakın kıyı noktası (karada, su kenarında)
  { let ba = 0, br = 1e9; for (let k = 0; k < 240; k++) { const a = k / 240 * TAU, r = coastR(a); if (r < br) { br = r; ba = a; } }
    let r = br - 10; while (r > br - 200 && groundH(CAMP.x + Math.cos(ba) * r, CAMP.y + Math.sin(ba) * r) < 1) r -= 5;
    const p = polar(ba, r); G.harbor = { x: p.x, y: p.y, a: ba }; }
  // ---- batık gemiler: kumsalda, birbirinden ve limandan uzak
  { const a0 = G.harbor.a + Math.PI / 3 + sr(-0.3, 0.3);
    for (let i = 0; i < 3; i++) {
      let best = null;
      for (let t = 0; t < 16 && !best; t++) {
        const a = a0 + i * TAU / 3 + (t ? sr(-0.55, 0.55) : 0), r = coastR(a);
        let rr = r - 10; while (rr > r - 200 && groundH(CAMP.x + Math.cos(a) * rr, CAMP.y + Math.sin(a) * rr) < 1.2) rr -= 5;
        const p = polar(a, rr - 25);
        if (dC(p.x, p.y) < 4600 * ISLK || !inW(p.x, p.y, 200)) continue;
        if (Math.hypot(p.x - G.harbor.x, p.y - G.harbor.y) < 2500 * ISLK || G.wrecks.some(w => Math.hypot(w.x - p.x, w.y - p.y) < 4000 * ISLK)) continue;
        if (t < 12 && B(p.x, p.y) !== 5) continue;
        best = { x: p.x, y: p.y, r: 60, found: false, i, a };
      }
      if (best) G.wrecks.push(best);
    }
  }

  // ---- göller (katı) ve bataklık havuzları (sığ)
  for (let i = 0; i < Math.round(28 * ISLK * ISLK); i++) {
    let x, y, r, k = 0;
    do { x = sr(CAMP.x - 7000 * ISLK, CAMP.x + 7000 * ISLK); y = sr(CAMP.y - 7000 * ISLK, CAMP.y + 7000 * ISLK); r = sr(110, 240); }
    while ((nearCamp(x, y, r + 550) || ![0, 4].includes(B(x, y)) || landness(x, y) < r + 350 || groundH(x, y) > 260 || Math.hypot(x - G.rift.x, y - G.rift.y) < 600 || G.lakes.some(l => Math.hypot(l.x - x, l.y - y) < l.r + r + 400)) && k++ < 80);
    if (k >= 80) continue;
    const o = { x, y, r, kind: 'lake', h: Math.max(2, groundH(x, y) - 4) }; G.lakes.push(o); gAdd(o);
    flattenH(x, y, r, 150, o.h, 9);
  }
  // ---- yamyam kampları: 3–4, kamptan çok uzakta
  const nCC = sri(3, 4);
  for (let k = 0; k < 400 && G.ccamps.length < nCC; k++) {
    const p = polar(sr(0, TAU), sr(3300 * ISLK, 5800 * ISLK)), b = B(p.x, p.y);
    if (b === 1 || b === 5 || b === B_SEA || landness(p.x, p.y) < 500 || groundH(p.x, p.y) > 300) continue;
    if (Math.hypot(p.x - G.rift.x, p.y - G.rift.y) < 1000 || G.ccamps.some(c => Math.hypot(c.x - p.x, c.y - p.y) < 2800 * ISLK)) continue;
    if (G.lakes.some(l => Math.hypot(l.x - p.x, l.y - p.y) < l.r + 250)) continue;
    flattenH(p.x, p.y, 170, 160, groundH(p.x, p.y));
    G.ccamps.push({ x: p.x, y: p.y, r: 90, totem: 250, alive: true, found: false, captives: [], spawned: false, i: G.ccamps.length,
      huts: [0, 1, 2].map(i => { const a = i / 3 * TAU + sr(-0.3, 0.3); return [Math.cos(a) * sr(55, 75), Math.sin(a) * sr(55, 75)]; }) });
  }
  for (const w of G.wrecks) flattenH(w.x, w.y, 70, 90, Math.max(1.5, groundH(w.x, w.y)));
  if(coastal) {
    const chosen=chooseHome?selectCoastalHome(seed):savedHome;
    if(!chosen||Math.hypot(chosen.x-CAMP.x,chosen.y-CAMP.y)<1){G.caveTerrain=1;G.coastPlanning=false;setHome(null);return genWorld(seed)}
    setHome(chosen);G.coastPlanning=false;
    // Kıyı/tehdit planı her yüklemede aynı merkezden üretilir; yalnız boş yerel alan yeniden örneklenir.
    const i0=Math.max(0,Math.floor((HOME.x-1500)/HC)),i1=Math.min(HN,Math.ceil((HOME.x+1500)/HC)),j0=Math.max(0,Math.floor((HOME.y-1500)/HC)),j1=Math.min(HN,Math.ceil((HOME.y+1500)/HC));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)if(Math.hypot(i*HC-HOME.x,j*HC-HOME.y)<1500)HM[j*HW+i]=rawH(i*HC,j*HC);
    const q=homeWorld(0,-430);flattenH(q.x,q.y,110,70,136);
    for(let j=0;j<MAPN;j++)for(let i=0;i<MAPN;i++)G.bmap[j*MAPN+i]=biomeAt((i+.5)*MAPC,(j+.5)*MAPC);
    G.fire.x=HOME.x;G.fire.y=HOME.y;
  }
  const free = (x, y, m) => !cavSiteReserved(x,y,m) && land(x, y) && !G.lakes.some(l => Math.hypot(l.x - x, l.y - y) < l.r + m) && Math.hypot(x - G.rift.x, y - G.rift.y) > 120
    && !G.ccamps.some(c => Math.hypot(c.x - x, c.y - y) < 150) && !G.wrecks.some(c => Math.hypot(c.x - x, c.y - y) < 130) && Math.hypot(x - G.harbor.x, y - G.harbor.y) > 160;
  for (const b of G.blobs) if (b.k === 2) for (let i = 0, n = Math.round(10 * (b.r / 650) ** 2); i < n; i++) {
    const a = sr(0, TAU), rr = sr(0, b.r * 0.8), x = b.x + Math.cos(a) * rr, y = b.y + Math.sin(a) * rr;
    if (!free(x, y, 60) || B(x, y) !== 2 || G.pools.some(p => Math.hypot(p.x - x, p.y - y) < 170)) continue;
    const p = { x, y, r: sr(45, 90), croc: null, h: Math.max(1.5, groundH(x, y) - 1) }; G.pools.push(p);
    flattenH(x, y, p.r, 70, p.h, 3);
  }
  buildTMul();
  const inPool = (x, y, m) => G.pools.some(p => Math.hypot(p.x - x, p.y - y) < p.r + m);
  const BX0 = CAMP.x - 7500 * ISLK, BX1 = CAMP.x + 7500 * ISLK, BY0 = CAMP.y - 7500 * ISLK, BY1 = CAMP.y + 7500 * ISLK;
  const rx = () => sr(BX0, BX1), ry = () => sr(BY0, BY1);

  // ---- ağaçlar (≤ 9000)
  const TREE_MAX = 9000;
  function addTree(x, y) {
    if (G.trees.length >= TREE_MAX || !free(x, y, 30) || nearCamp(x, y, 250) || inPool(x, y, 15)) return;
    const b = B(x, y);
    if (b === B_SEA || (b === 1 && (groundH(x, y) > 470 || S() < 0.7)) || (b === 5 && S() < 0.5)) return;
    if (gQuery(x, y, 40).some(o => (o.kind === 'tree' || o.kind === 'rock' || o.kind === 'crystal') && Math.hypot(o.x - x, o.y - y) < 40)) return;
    const t = { x, y, r: 13, kind: 'tree', res: 'wood', amt: 18, cr: sr(36, 62), tone: S(), sw: sr(0, TAU), b, i: G.trees.length };
    if (b === 0 && dC(x, y) > 3200) { t.cr = sr(48, 72); t.tone *= 0.6; t.dark = 1; }   // sık, karanlık orman
    G.trees.push(t); gAdd(t);
  }
  for (let i = 0; i < 20; i++) { const a = sr(0, TAU), r = sr(270, 560); addTree(HOME.x + Math.cos(a) * r, HOME.y + Math.sin(a) * r); }
  for (let c = 0; c < Math.round(1150 * ISLK * ISLK); c++) {
    const cx = rx(), cy = ry(), b = B(cx, cy); if (b === B_SEA) continue;
    const far = dC(cx, cy) > 3200;
    let n = sri(12, 30), rad = 280;
    if (b === 0 && far) { n = Math.round(n * 2); rad = 340; }
    else if (b === 4) { n = sri(1, 3); rad = 500; }
    else if (b === 1) n = sri(3, 8);
    else if (b === 2) n = sri(8, 18);
    else if (b === 3) n = sri(6, 14);
    else if (b === 5) { n = sri(0, 2); rad = 150; }
    for (let i = 0; i < n; i++) { const a = sr(0, TAU), rr = Math.abs(sg()) * rad; addTree(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  }
  const TP = [1, 0.15, 0.6, 0.5, 0.22, 0.12, 0];
  for (let i = 0; i < Math.round(6000 * ISLK * ISLK); i++) { const x = rx(), y = ry(); if (S() < TP[B(x, y)]) addTree(x, y); }

  // ---- kayalar (dağda yoğun, kumsalda sürüklenmiş taşlar) ve kristaller (≤ 2500)
  const ROCK_MAX = cavSiteEnabled()?2494:2500;
  function addRock(x, y) {
    if (G.rocks.length >= ROCK_MAX || !free(x, y, 30) || nearCamp(x, y, 220) || inPool(x, y, 20)) return;
    if (gQuery(x, y, 50).some(o => (o.kind === 'tree' || o.kind === 'rock' || o.kind === 'crystal') && Math.hypot(o.x - x, o.y - y) < 46)) return;
    const big = B(x, y) === 1 && S() < 0.35, r = big ? sr(26, 44) : sr(16, 30), v = [], n = sri(6, 9);
    for (let i = 0; i < n; i++) { const a = i / n * TAU; v.push([Math.cos(a) * r * sr(0.75, 1.15), Math.sin(a) * r * sr(0.75, 1.15)]); }
    const o = { x, y, r, kind: 'rock', res: 'stone', amt: big ? 22 : 14, v, shade: sr(0.85, 1.15), i: G.rocks.length }; G.rocks.push(o); gAdd(o);
  }
  for (let i = 0; i < 7; i++) { const a = sr(0, TAU), r = sr(300, 600); addRock(HOME.x + Math.cos(a) * r, HOME.y + Math.sin(a) * r); }
  for (const b of G.blobs) if (b.k === 1) for (let i = 0, n = Math.round(80 * (b.r / 560) ** 2); i < n; i++) { const a = sr(0, TAU), rr = sr(0, b.r * 1.1), x = b.x + Math.cos(a) * rr, y = b.y + Math.sin(a) * rr; if (B(x, y) === 1) addRock(x, y); }
  for (let c = 0; c < Math.round(1000 * ISLK * ISLK); c++) {
    const cx = rx(), cy = ry(), b = B(cx, cy); if (b === B_SEA) continue;
    const n = b === 4 ? sri(0, 2) : b === 5 ? sri(1, 3) : sri(1, 4), sp = b === 5 ? 120 : 70;
    for (let i = 0; i < n; i++) addRock(cx + sr(-sp, sp), cy + sr(-sp, sp));
  }
  for (const b of G.blobs) if (b.k === 1 || b.k === 3) for (let i = 0, n = b.k === 1 ? Math.round(9 * (b.r / 520) ** 2) : 12; i < n; i++) {
    const a = sr(0, TAU), rr = sr(0, b.r * 0.9), x = b.x + Math.cos(a) * rr, y = b.y + Math.sin(a) * rr;
    if (B(x, y) !== b.k || !free(x, y, 30) || gQuery(x, y, 40).some(o => Math.hypot(o.x - x, o.y - y) < o.r + 22)) continue;
    const o = { x, y, r: 13, kind: 'crystal', res: 'crystal', amt: 4, i: G.crystals.length, hue: sr(180, 220) }; G.crystals.push(o); gAdd(o);
  }

  // ---- çalılar, şifalı otlar, zehirli bitkiler
  function addBush(x, y) {
    if (!free(x, y, 20) || nearCamp(x, y, 160) || inPool(x, y, 10)) return;
    const b = B(x, y); if (b === 1 || b === 3 || b === 5 || b === B_SEA || (b === 4 && S() < 0.4)) return;
    G.bushes.push({ x, y, r: 16, res: 'meyve', amt: 5, max: 5, berries: Array.from({ length: 7 }, () => [sr(-11, 11), sr(-11, 11)]), col: spick(['#b3243a', '#6a2a8a', '#c4382a']) });
  }
  for (let i = 0; i < 12; i++) { const a = sr(0, TAU), r = sr(200, 480); addBush(HOME.x + Math.cos(a) * r, HOME.y + Math.sin(a) * r); }
  for (let i = 0; i < Math.round(3600 * ISLK * ISLK); i++) addBush(rx(), ry());
  for (let i = 0; i < 6; i++) { const a = sr(0, TAU), r = sr(350, 650), x = HOME.x + Math.cos(a) * r, y = HOME.y + Math.sin(a) * r; if (free(x, y, 15)) G.herbs.push({ x, y, r: 10, res: 'herb', amt: 3, max: 3 }); }
  for (let i = 0; i < 4000 * ISLK * ISLK && G.herbs.length < 380 * ISLK * ISLK; i++) {
    const x = rx(), y = ry(), b = B(x, y);
    if ((b === 0 || b === 2 || b === 4) && free(x, y, 15) && !nearCamp(x, y, 300) && !inPool(x, y, 10)) G.herbs.push({ x, y, r: 10, res: 'herb', amt: 3, max: 3 });
  }
  for (const b of G.blobs) if (b.k === 2) for (let i = 0, n = Math.round(26 * (b.r / 600) ** 2); i < n; i++) {
    const a = sr(0, TAU), rr = sr(0, b.r), x = b.x + Math.cos(a) * rr, y = b.y + Math.sin(a) * rr;
    if (B(x, y) === 2 && free(x, y, 15) && !inPool(x, y, 8)) G.poisons.push({ x, y, r: 10, res: 'poison', amt: 2, max: 2 });
  }
  // ---- yuvalar (sis ve dağ)
  for (const b of G.blobs) if (b.k === 3 || b.k === 1) for (let i = 0; i < (b.k === 3 ? 4 : 1); i++) {
    const a = sr(0, TAU), rr = sr(100, b.r * 0.8), x = b.x + Math.cos(a) * rr, y = b.y + Math.sin(a) * rr;
    if (free(x,y,30)&&(G.caveTerrain!==2||Math.hypot(x-HOME.x,y-HOME.y)>=1800)) G.nests.push({ x, y, r: 20, eggs: sri(1, 3), found: false });
  }
  // ---- süsleme (≤ 7000): ova uzun otları, kumsal sürüklenmiş odunlar
  for (let i = 0; i < 15000 * ISLK * ISLK && G.deco.length < 7000 * ISLK * ISLK; i++) {
    const x = rx(), y = ry(), b = B(x, y);
    if (b === B_SEA || !free(x, y, 5) || nearCamp(x, y, 140)) continue;
    const u = S();
    const t = b === 0 ? (dC(x, y) > 3200 ? (u < 0.7 ? 'fern' : u < 0.85 ? 'deadtree' : 'bone') : (u < 0.85 ? 'fern' : 'bone'))
      : b === 1 ? (u < 0.6 ? 'pebble' : 'bone') : b === 2 ? 'reed' : b === 3 ? (u < 0.5 ? 'deadtree' : 'bone')
      : b === 4 ? (u < 0.8 ? 'grass' : u < 0.92 ? 'fern' : 'bone') : (u < 0.5 ? 'drift' : u < 0.85 ? 'pebble' : 'bone');
    G.deco.push({ x, y, t, a: sr(0, TAU), s: sr(0.7, 1.3) });
  }
  cavSiteRocks();
  makeBiomeTint();
  function coastR0(a) { let r = 4000 * ISLK; while (r < 8000 * ISLK && landness(CAMP.x + Math.cos(a) * r, CAMP.y + Math.sin(a) * r) > 0) r += 40; return r; }
}

let biomeTint = null, biomeMini = null;
function makeBiomeTint() {
  if (typeof document === 'undefined') return;
  biomeTint = document.createElement('canvas'); biomeTint.width = biomeTint.height = MAPN;
  biomeMini = document.createElement('canvas'); biomeMini.width = biomeMini.height = MAPN;
  const g = biomeTint.getContext('2d'), m = biomeMini.getContext('2d');
  const tint = [null, 'rgba(118,108,92,0.75)', 'rgba(52,64,34,0.65)', 'rgba(62,66,78,0.7)', 'rgba(150,158,70,0.35)', 'rgba(196,180,128,0.75)', 'rgba(24,52,78,0.92)'];
  const mini = [[44, 74, 36], [110, 103, 90], [61, 74, 42], [65, 69, 79], [104, 128, 56], [196, 180, 128], [27, 53, 80]];
  for (let j = 0; j < MAPN; j++) for (let i = 0; i < MAPN; i++) { const b = G.bmap[j * MAPN + i]; if (tint[b]) { g.fillStyle = tint[b]; g.fillRect(i, j, 1, 1); } }
  const id = m.createImageData(MAPN, MAPN), D = id.data;
  for (let j = 0; j < MAPN; j++) for (let i = 0; i < MAPN; i++) {
    const x = (i + 0.5) * MAPC, y = (j + 0.5) * MAPC, b = G.bmap[j * MAPN + i], h = groundH(x, y), c = mini[b];
    let s;
    if (b === B_SEA) s = 0.75 + 0.35 * clamp(1 + h / 120, 0, 1);              // sığ su daha açık
    else {
      const sh = (groundH(x - MAPC, y - MAPC) - groundH(x + MAPC, y + MAPC)) / (MAPC * 2);   // kuzeybatıdan ışık
      s = clamp(1 + sh * 0.9, 0.55, 1.45) * (1 + clamp(h / 900, 0, 1) * 0.45);
    }
    const k = (j * MAPN + i) * 4; D[k] = clamp(c[0] * s, 0, 255); D[k + 1] = clamp(c[1] * s, 0, 255); D[k + 2] = clamp(c[2] * s, 0, 255); D[k + 3] = 255;
  }
  m.putImageData(id, 0, 0);
  m.fillStyle = '#1d3a4c';
  for (const l of G.lakes) { m.beginPath(); m.arc(l.x / MAPC, l.y / MAPC, Math.max(1, l.r / MAPC), 0, TAU); m.fill(); }
  m.fillStyle = '#2a3a28';
  for (const p of G.pools) { m.beginPath(); m.arc(p.x / MAPC, p.y / MAPC, Math.max(0.8, p.r / MAPC), 0, TAU); m.fill(); }
}

// =============================================================
//  ZAMAN ve IŞIK
// =============================================================
const phase = () => (G.t % CYCLE) / CYCLE;
function baseDark() {
  const p = phase();
  if (p < 0.47) return 0;
  if (p < 0.6) { const k = (p - 0.47) / 0.13; return 0.95 * k * k * (3 - 2 * k); }
  if (p < 0.9) return 0.95;
  const k = (p - 0.9) / 0.1; return 0.95 * (1 - k * k * (3 - 2 * k));
}
function darkness() {
  let d = baseDark();
  const w = G.weather && G.weather.type;
  if (w === 'yagmur' || w === 'firtina') d = Math.max(d, 0.28);
  if (w === 'sis') d = Math.max(d, 0.2);
  if (w === 'kar') d = Math.max(d, G.weather.heavy ? 0.24 : 0.14);
  if (G.finale) d = Math.max(d, 0.6);
  if (G.flash > 0) d *= 0.15;
  return d;
}
const isNight = () => baseDark() > 0.55;
const goHome = () => { const p = phase(); return p > 0.46 && p < 0.93; };
const lightMul = () => G.weather && G.weather.type === 'sis' ? 0.65 : G.weather && (G.weather.type === 'firtina' || (G.weather.type === 'kar' && G.weather.heavy)) ? 0.85 : 1;
function fireR() { return G.fire.fuel <= 0 ? 0 : (90 + G.fire.fuel * 2.6) * lightMul(); }
function lights() {
  const lm = lightMul(), out = [];
  if (G.fire.fuel > 0) out.push({ x: G.fire.x, y: G.fire.y, r: fireR() * (0.96 + Math.sin(G.now * 13) * 0.02 + Math.random() * 0.03), safe: true, warm: 1 });
  for (const b of G.builds) {
    if (b.type === 'mesale' && b.built) out.push({ x: b.x, y: b.y - 20, r: 150 * lm * (0.97 + Math.random() * 0.04), warm: 0.6 });
    if (b.type === 'kule' && b.built) out.push({ x: b.x, y: b.y - 10, r: 220 * lm * (0.97 + Math.random() * 0.03), warm: 0.6 });
  }
  { const g = typeof doorGuard === 'function' && doorGuard(); if (g) out.push({ x: g.x, y: g.y, r: 165 * lm * (0.96 + Math.random() * 0.05), warm: 0.7, guard: 1 }); }
  if (L && G.torchOn && L.hp > 0) out.push({ x: L.x, y: L.y, r: 175 * lm * (0.95 + Math.random() * 0.06), warm: 0.7 });
  if (G.rift) out.push({ x: G.rift.x, y: G.rift.y, r: G.finale ? 420 : 240, warm: 0, blue: 1 });
  for (const c of G.ccamps || []) if (c.alive) out.push({ x: c.x, y: c.y, r: 170 * (0.94 + Math.random() * 0.08), warm: 0.9, red: 1 });
  return out;
}
// ---- görüş: dünyayı yalnızca halkının, ışıklarının ve evcil yaratıklarının gördüğü kadar görürsün
function visionSources() {
  const out = [], n = isNight(), wf = G.weather.type === 'sis' ? 0.7 : 1;
  const f = (x, y) => (n ? 0.55 : 1) * wf * (biomeFast(x, y) === 3 ? 0.6 : 1);
  if (L) out.push({ x: L.x, y: L.y, r: (G.mount ? 440 : 380) * f(L.x, L.y), who: L });
  const sb = abilOn('kasif') ? 1.6 : 1;
  for (const p of G.people) { if (p === L || p.inHut || p.grabbed) continue; out.push({ x: p.x, y: p.y, r: (p.group === 'kasif' ? 330 * sb : p.child ? 120 : 220) * f(p.x, p.y), who: p }); }
  for (const d of G.dinos) if (d.tamed) out.push({ x: d.x, y: d.y, r: (d.fly ? 460 : 200) * (n ? 0.7 : 1), who: d });
  for (const b of G.builds) { if (b.type === 'kule' && b.built) out.push({ x: b.x, y: b.y, r: 480 * (n ? 0.75 : 1) }); else if (b.built && !BUILD[b.type].flat) out.push({ x: b.x, y: b.y, r: 110 }); }
  out.push({ x: G.fire.x, y: G.fire.y, r: G.fire.fuel > 0 ? Math.max(fireR() * 1.05, n ? 0 : 260) : 110 });
  for (const b of G.builds) if (b.type === 'mesale' && b.built) out.push({ x: b.x, y: b.y, r: 150 * lightMul() });
  if (G.torchOn && L) out.push({ x: L.x, y: L.y, r: 190 * lightMul() });
  return out;
}
function visible(x, y, m = 0) { if (!G.vis) return true; for (const s of G.vis) { const r = s.r + m; if ((x - s.x) ** 2 + (y - s.y) ** 2 < r * r) return true; } return false; }
function visibleK(x, y, k) { if (!G.vis) return true; for (const s of G.vis) { const r = s.r * k; if ((x - s.x) ** 2 + (y - s.y) ** 2 < r * r) return true; } return false; }
function exploredAt(x, y) { const i = Math.floor(x / MAPC), j = Math.floor(y / MAPC); return i >= 0 && j >= 0 && i < MAPN && j < MAPN && G.explored[j * MAPN + i] === 1; }
function safeZones() {
  const z = [], n = isNight(), lm = lightMul();
  if (G.fire.fuel > 0) z.push({ x: G.fire.x, y: G.fire.y, r: n ? fireR() * 0.88 : Math.max(fireR(), 320) });
  if (n) {
    for (const b of G.builds) { if (b.type === 'mesale' && b.built) z.push({ x: b.x, y: b.y, r: 125 * lm }); if (b.type === 'kule' && b.built) z.push({ x: b.x, y: b.y, r: 180 * lm }); }
    if (G.torchOn && L) z.push({ x: L.x, y: L.y, r: 135 * lm });
    { const g = typeof doorGuard === 'function' && doorGuard(); if (g) z.push({ x: g.x, y: g.y, r: 140 * lm, guard: 1 }); }
  }
  return z;
}
function inSafe(x, y, zones) { for (const s of zones) if ((x - s.x) ** 2 + (y - s.y) ** 2 < s.r * s.r) return s; return null; }
function lightLevel(x, y, LS) {
  if (darkness() < 0.45) return 1;
  let m = 0;
  for (const l of LS) { const d = Math.hypot(x - l.x, y - l.y); m = Math.max(m, clamp((l.r - d) / (l.r * 0.45), 0, 1)); }
  return m;
}

// =============================================================
//  HAVA
// =============================================================
function setWeather(type, t) {
  // yağış türü sıcaklığa göre: soğukta yağmur/fırtına kara döner (fırtına → yoğun kar)
  let heavy = 0;
  if ((type === 'yagmur' || type === 'firtina') && tempAt(G.fire.x, G.fire.y, type) < 0.5) { heavy = type === 'firtina' ? 1 : 0; type = 'kar'; }
  if (type === 'kar' && t === undefined) t = 0;
  const old = G.weather.type; G.weather = heavy ? { type, t, heavy } : { type, t };
  if (type === old) return;
  if (type === 'kar') msg(heavy ? 'Tipi! Kar savruluyor, göz gözü görmüyor.' : 'Kar yağmaya başladı. Ateşi besleyin, sıcak tutun.', '#dfeaff', 5);
  if (type === 'yagmur') msg('Yağmur başladı. Ateş daha hızlı sönecek.', '#9bd', 4);
  if (type === 'firtina') msg('Fırtına! Şimşekler karanlığı yırtıyor...', '#bcf', 5);
  if (type === 'sis') msg('Yoğun bir sis çöktü. Işık zayıfladı.', '#bbc', 5);
  if (type === 'acik' && old !== 'acik') msg('Hava açıldı.', '#ddd', 3);
}
function updWeather(dt) {
  const w = G.weather;
  if (w.t > 0) { w.t -= dt; if (w.t <= 0 && !isNight()) setWeather('acik', 0); }
  updSeasons(dt);
  if (A.ctx) { const lp = L ? precipAt(L.x, L.y) : null; A.rain.gain.setTargetAtTime(lp === 'yagmur' ? (w.type === 'firtina' ? 0.09 : 0.05) : 0, A.ctx.currentTime, 1.5); }
  if (w.type === 'firtina') {
    G.lightT = (G.lightT || 6) - dt;
    if (G.lightT <= 0) {
      G.lightT = rand(5, 14); G.flash = 0.22;
      const v = rand(0.4, 0.9); setTimeout(() => SFX.thunder(v), rand(200, 1400));
      for (const p of G.people) p.fear = Math.min(100, p.fear + 4);
    }
  }
  G.flash = Math.max(0, (G.flash || 0) - dt);
}

// =============================================================
//  MEVSİMLER, SICAKLIK, KAR
//  4 mevsim × 50 gün, yinelenir (1. gün = ilkbahar). Mevsim geçişleri ±3 gün yumuşatılır.
// =============================================================
const SEASON_LEN = 50, SEASON_BLEND = 3, SNOW_H = [0, 100, 200, 300, 400, 500], LAPSE = 0.055;
const SEASONS = [
  { key: 'ilkbahar', ad: 'İlkbahar', ic: '🌱', T0: 7, T1: 16, amp: 5, wx: [0.58, 0.2, 0.1, 0.12], dayRain: 0.22, grow: 1.1, berry: 1 },
  { key: 'yaz', ad: 'Yaz', ic: '☀️', T0: 21, T1: 23, amp: 6, wx: [0.72, 0.08, 0.12, 0.08], dayRain: 0.12, grow: 1, berry: 1 },
  { key: 'sonbahar', ad: 'Sonbahar', ic: '🍂', T0: 14, T1: 4, amp: 5, wx: [0.52, 0.2, 0.08, 0.2], dayRain: 0.25, grow: 0.7, berry: 0.45 },
  { key: 'kis', ad: 'Kış', ic: '❄️', T0: -4, T1: -5, amp: 4, wx: [0.5, 0.34, 0.06, 0.1], dayRain: 0.3, grow: 0, berry: 0 }];
const BIO_T = [-0.5, 0, 1, -1.5, 0, 1.5, 2, 0];
function seasonOf(day) {
  const d = Math.max(0, (day || 1) - 1), i = Math.floor(d / SEASON_LEN) % 4;
  return { i, key: SEASONS[i].key, ad: SEASONS[i].ad, ic: SEASONS[i].ic, day: d % SEASON_LEN + 1, t: (d % SEASON_LEN) / SEASON_LEN };
}
// sürekli gün (0 = 1. günün başı); newDay'de phase 1→0 sararken day++ olduğundan kesintisiz
const dayF = () => Math.max(0, (G.day || 1) - 1 + phase());
// mevsim ağırlıkları [ilkbahar, yaz, sonbahar, kış]: sınırda son/ilk 3 gün komşu mevsimle karışır
function seasonW(df) {
  if (df === undefined) df = dayF();
  const w = [0, 0, 0, 0], k = Math.floor(df / SEASON_LEN), i = k % 4, u = df - k * SEASON_LEN, B = SEASON_BLEND;
  const sm = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  if (u < B && df >= B) { const a = sm((u + B) / (2 * B)); w[i] += a; w[(i + 3) % 4] += 1 - a; }
  else if (u > SEASON_LEN - B) { const a = sm((u - (SEASON_LEN - B)) / (2 * B)); w[i] += 1 - a; w[(i + 1) % 4] += a; }
  else w[i] = 1;
  return w;
}
// mevsim içi ilerlemeye göre değer (ör. sonbahar başta ılık, sonda soğuk), sınırlarda karışık
function seasonVal(f, df) {
  if (df === undefined) df = dayF();
  const w = seasonW(df), k = Math.floor(df / SEASON_LEN), u = (df - k * SEASON_LEN) / SEASON_LEN, i = k % 4;
  let v = 0;
  for (let j = 0; j < 4; j++) if (w[j] > 0) { const t = j === i ? u : j === (i + 3) % 4 ? 1 : 0; v += w[j] * f(SEASONS[j], t); }
  return v;
}
function dayAnom(d) { const h = Math.sin(d * 127.1 + ((G.seed || 1) % 1000) * 0.37) * 43758.5453; return ((h - Math.floor(h)) - 0.5) * 6; }
// kamp düzlüğündeki (yükseklik ~8, orman) hava sıcaklığı, °C. Kare başına önbellekli.
const _TC = { t: -1, w: '', v: 0 };
function baseTemp(wt) {
  const w = wt || (G.weather && G.weather.type) || 'acik', ck = wt ? '!' + wt : w;
  if (_TC.t === G.t && _TC.w === ck) return _TC.v;
  const df = dayF(), p = phase();
  let T = seasonVal((s, u) => s.T0 + (s.T1 - s.T0) * u, df);
  const A = seasonVal(s => s.amp, df);
  T += A * Math.cos((p - 0.3) * TAU);                        // en sıcak öğleden sonra, en soğuk gece yarısı sonrası
  const d0 = Math.floor(df), fr = df - d0, sf = fr * fr * (3 - 2 * fr);
  T += dayAnom(d0) + (dayAnom(d0 + 1) - dayAnom(d0)) * sf;   // günden güne yumuşak sapma
  T += wt ? wxOff(w) : G.wxOff !== undefined ? G.wxOff : wxOff(w);   // hava etkisi: updSeasons'ta yumuşatılır (sıçrama yok)
  _TC.t = G.t; _TC.w = ck; _TC.v = T;
  return T;
}
const wxOff = w => (w === 'yagmur' ? -1.5 : w === 'firtina' ? -3 : w === 'kar' ? -1 : w === 'sis' ? -1 : 0.5) - 2 * baseDark();
// yerel sıcaklık: mevsim + gün saati + yükseklik + biyom + hava
function tempAt(x, y, wt) {
  const h = typeof groundH === 'function' && HM ? groundH(x, y) : 8;
  return baseTemp(wt) - LAPSE * Math.max(0, h - 8) + (BIO_T[biomeFast(x, y)] || 0);
}
const isPrecip = w => w === 'yagmur' || w === 'firtina' || w === 'kar';
// tek yağış kaynağı: kampta G.weather.type; başka yerde aynı yağış, yerel sıcaklığa göre kar/yağmur
function precipAt(x, y) {
  const w = G.weather && G.weather.type;
  if (!isPrecip(w)) return null;
  // Kamp çevresinde yapay yağış çemberi yok; kampın kar/yağmur histerezisi yerel sıcaklığa uygulanır (Codex).
  const T = tempAt(x, y);
  return (w === 'kar' ? T <= 1.5 : T < -0.5) ? 'kar' : 'yagmur';
}
// kar derinliği (0..1.5): 100'lük yükseklik bantlarında saklanır, yerel değer bant arası + biyom
function snowAt(x, y, h) {
  const B = G.snowB; if (!B) return 0;
  if (h === undefined) h = groundH(x, y);
  if (h < 1) return 0;
  const f = clamp(h / 100, 0, SNOW_H.length - 1), i = Math.min(SNOW_H.length - 2, f | 0), u = f - i, d = B[i] + (B[i + 1] - B[i]) * u;
  const b = biomeFast(x, y); return d * (b === 5 ? 0.55 : b === 2 ? 0.75 : b === 6 ? 0 : 1);
}
// mevsim görünüm ağırlıkları + kar özeti (uc.js yeniden boyama tetikleyicisi)
function seasonLook() { const w = seasonW(); return { sp: w[0], su: w[1], au: w[2], wi: w[3], snow: G.snowB ? G.snowB.slice() : [0, 0, 0, 0, 0, 0] }; }
function updSeasons(dt) {
  if (!G.snowB || G.snowB.length !== SNOW_H.length) G.snowB = SNOW_H.map(() => 0);
  G.season = seasonOf(G.day);
  { const tg = wxOff(G.weather.type); G.wxOff = G.wxOff === undefined ? tg : G.wxOff + (tg - G.wxOff) * Math.min(1, dt / 40); }
  G.seasonT = (G.seasonT || 0) - dt;
  if (G.seasonT > 0) return;
  const step = (1 + (-G.seasonT)) / DAYK; G.seasonT = 1;   // kar/buz günlük hızı gün uzunluğundan bağımsız
  const w = G.weather, wt = w.type, T0 = baseTemp(), Tc = tempAt(G.fire.x, G.fire.y);
  G.tempCamp = Tc;
  // kampta yağış türü: histerezisli yağmur ⇄ kar
  if ((wt === 'yagmur' || wt === 'firtina') && Tc < -0.5) { G.weather = { type: 'kar', t: w.t, heavy: wt === 'firtina' ? 1 : 0 }; msg('Yağmur kara döndü.', '#dfeaff', 4); }
  else if (wt === 'kar' && Tc > 1.5) { G.weather = { type: w.heavy ? 'firtina' : 'yagmur', t: w.t }; msg('Kar sulu sepkene, sonra yağmura döndü.', '#9bd', 4); }
  // kar birikimi / erime (yükseklik bantları)
  const pr = isPrecip(G.weather.type), hv = G.weather.heavy ? 1.6 : G.weather.type === 'firtina' ? 1.3 : 1;
  for (let i = 0; i < SNOW_H.length; i++) {
    const Tb = T0 - LAPSE * Math.max(0, SNOW_H[i] - 8);
    let d = G.snowB[i];
    if (pr && Tb < 0.5) d += step * 0.0026 * hv;
    if (Tb > 0) d -= step * Tb * 0.0007 * (pr ? 2 : 1);
    G.snowB[i] = clamp(d, 0, 1.5);
  }
  // göller: -2'nin altında bir süre kalınca donar, +2'nin üstünde bir süre kalınca çözülür
  let fz = 0, th = 0;
  for (const l of G.lakes || []) {
    const T = tempAt(l.x, l.y);
    if (!l.frozen) { l.iceT = T < -2 ? (l.iceT || 0) + step : Math.max(0, (l.iceT || 0) - step); if (l.iceT > 90) { l.frozen = true; l.iceT = 0; if (dist(l, G.fire) < 3200) fz++; } }
    else { l.iceT = T > 2 ? (l.iceT || 0) + step : Math.max(0, (l.iceT || 0) - step); if (l.iceT > 90) { l.frozen = false; l.iceT = 0; clearThawedLake(l); if (dist(l, G.fire) < 3200) th++; } }
  }
  if (fz) msg('🧊 Kampa yakın göl buz tuttu. Balıkçılar orada balık tutamaz.', '#cfe8ff', 5);
  if (th) msg('💧 Gölün buzu çözüldü. Balıkçılar yeniden ağ atabilir.', '#9cf', 4);
}
