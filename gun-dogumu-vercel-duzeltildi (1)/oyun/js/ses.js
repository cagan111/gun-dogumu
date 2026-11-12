'use strict';
// SES — tamamen sentezlenmiş (WebAudio)
const A = { ctx: null, live: 0, made: 0, ended: 0, dropped: 0 };
const SES_CAP = 90;   // aynı anda çalan tek seferlik ses kaynağı üst sınırı
function audioInit() {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    A.ctx = ac;
    A.master = ac.createGain(); A.master.gain.value = sesMuted() ? 0 : 0.7; A.master.connect(ac.destination);
    // ortam yolu: iç mekânda boğuklaşan alçak geçiren süzgeç (rüzgâr, yağmur, ortam katmanları, uzak adımlar)
    A.env = ac.createBiquadFilter(); A.env.type = 'lowpass'; A.env.frequency.value = 18000; A.env.connect(A.master);
    const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.noise = buf; A.brown = null;
    const bb = ac.createBuffer(1, len, ac.sampleRate), bd = bb.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    const w = ac.createBufferSource(); w.buffer = bb; w.loop = true;
    const wf = ac.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 500;
    A.wind = ac.createGain(); A.wind.gain.value = 0.05;
    A.windMod = ac.createGain(); A.windMod.gain.value = 1;
    w.connect(wf); wf.connect(A.wind); A.wind.connect(A.windMod); A.windMod.connect(A.env); w.start(); A.brown = bb;
    const rn = ac.createBufferSource(); rn.buffer = buf; rn.loop = true;
    const rf = ac.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 1400;
    A.rain = ac.createGain(); A.rain.gain.value = 0;
    rn.connect(rf); rf.connect(A.rain); A.rain.connect(A.env); rn.start();
    const dr = ac.createOscillator(); dr.type = 'sine'; dr.frequency.value = 43;
    const dr2 = ac.createOscillator(); dr2.type = 'sine'; dr2.frequency.value = 44.3;
    A.drone = ac.createGain(); A.drone.gain.value = 0;
    dr.connect(A.drone); dr2.connect(A.drone); A.drone.connect(A.master); dr.start(); dr2.start();
    const ds = ac.createWaveShaper(); const c = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 4); }
    ds.curve = c; A.dist = ds; ds.connect(A.master);
  } catch (e) { A.ctx = null; }
}
function sOut(pan, dest) {
  dest = dest || A.master;
  if (pan !== undefined && A.ctx.createStereoPanner) { const p = A.ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); p.connect(dest); return p; }
  return dest;
}
// tek seferlik kaynak sayacı (eşzamanlı ses sınırı ve test ölçümü için)
function sesTrack(src) { A.live++; A.made++; src.onended = () => { A.live--; A.ended++; }; }
function tone(type, f0, f1, dur, vol, opt = {}) {
  if (!A.ctx || !(vol >= 0.003)) return;
  if (A.live >= SES_CAP) { A.dropped++; return; }
  const ac = A.ctx, t = ac.currentTime + (opt.delay || 0);
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (opt.att || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (opt.vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = opt.vib; lg.gain.value = f0 * 0.06; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur); }
  o.connect(g); g.connect(opt.out || (opt.dist ? A.dist : sOut(opt.pan))); sesTrack(o); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol, ftype, f0, f1, opt = {}) {
  if (!A.ctx || !(vol >= 0.003)) return;
  if (A.live >= SES_CAP) { A.dropped++; return; }
  const ac = A.ctx, t = ac.currentTime + (opt.delay || 0);
  const s = ac.createBufferSource(); s.buffer = A.noise; s.playbackRate.value = opt.rate || 1;
  const f = ac.createBiquadFilter(); f.type = ftype; f.Q.value = opt.q || 1;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (opt.att || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(opt.out || (opt.dist ? A.dist : sOut(opt.pan))); sesTrack(s); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
const SFX = {
  roar(v, pan) { noise(2.4, v * 0.9, 'lowpass', 900, 90, { att: 0.25, q: 4, pan }); tone('sawtooth', 95, 38, 2.3, v * 0.45, { att: 0.3, dist: true, vib: 7 }); tone('square', 190, 70, 1.8, v * 0.12, { att: 0.2, vib: 11, pan }); },
  screech(v, pan) { tone('sawtooth', 1100, 1700, 0.18, v * 0.25, { pan }); tone('sawtooth', 1600, 600, 0.45, v * 0.25, { delay: 0.16, vib: 30, pan }); noise(0.5, v * 0.25, 'bandpass', 3000, 1500, { q: 3, pan }); },
  chirp(v, pan) { tone('square', 1800, 2600, 0.08, v * 0.12, { pan }); tone('square', 2200, 1500, 0.1, v * 0.12, { delay: 0.1, pan }); },
  thump(v) { tone('sine', 70, 28, 0.45, v, { att: 0.005 }); noise(0.25, v * 0.5, 'lowpass', 200, 40); },
  hit(v) { noise(0.12, v * 0.6, 'highpass', 1200, 600); tone('triangle', 220, 90, 0.1, v * 0.4); },
  swing() { noise(0.16, 0.12, 'bandpass', 600, 2400, { q: 2 }); },
  arrow() { noise(0.18, 0.15, 'bandpass', 3500, 900, { q: 3 }); },
  chop() { noise(0.07, 0.25, 'bandpass', 900, 500, { q: 4 }); tone('triangle', 300, 150, 0.06, 0.12); },
  rock() { noise(0.06, 0.25, 'highpass', 3000, 2000); tone('square', 900, 700, 0.04, 0.05); },
  pickup() { tone('sine', 600, 900, 0.08, 0.08); },
  scream(v, pan) { tone('sawtooth', 820, 300, 1.4, v * 0.3, { vib: 9, att: 0.05, pan }); tone('triangle', 1240, 450, 1.3, v * 0.15, { vib: 13, pan }); },
  heart(v) { tone('sine', 62, 38, 0.18, v); tone('sine', 58, 34, 0.18, v * 0.8, { delay: 0.22 }); },
  rustle(v, pan) { for (let i = 0; i < 5; i++) noise(0.09, v * rand(0.3, 1), 'bandpass', rand(1500, 4000), 1200, { delay: i * rand(0.06, 0.14), q: 1.5, pan }); },
  crackle(v) { noise(0.03, v, 'highpass', 2500, 2000); },
  bird() { const f = rand(2000, 3200); tone('sine', f, f * 1.3, 0.09, 0.025); tone('sine', f * 1.2, f * 0.9, 0.12, 0.025, { delay: 0.12 }); },
  build() { noise(0.1, 0.25, 'lowpass', 600, 200); tone('triangle', 200, 120, 0.15, 0.15, { delay: 0.12 }); },
  bell() { tone('sine', 520, 520, 1.2, 0.08); tone('sine', 780, 780, 1.0, 0.05); },
  sting() { tone('sawtooth', 110, 104, 2.5, 0.12, { att: 0.02, dist: true }); tone('sine', 1300, 1250, 2.0, 0.04, { vib: 6 }); },
  thunder(v) { noise(3.2, v, 'lowpass', 500, 50, { att: 0.03, q: 1 }); noise(1.2, v * 0.6, 'lowpass', 1500, 200, { delay: 0.05 }); },
  splash(v, pan) { noise(0.5, v * 0.5, 'bandpass', 900, 250, { q: 1.5, pan }); },
  flap(v, pan) { noise(0.12, v * 0.4, 'lowpass', 500, 150, { pan }); noise(0.12, v * 0.4, 'lowpass', 500, 150, { delay: 0.2, pan }); },
  mimic(v, pan) { tone('triangle', 320, 290, 0.5, v * 0.3, { vib: 5, att: 0.1, pan }); tone('triangle', 380, 300, 0.9, v * 0.3, { vib: 6, att: 0.1, delay: 0.6, pan }); },
  baby() { tone('square', 1400, 2000, 0.1, 0.06); tone('square', 1700, 1300, 0.12, 0.05, { delay: 0.12 }); },
  win() { [392, 494, 587, 784].forEach((f, i) => tone('sine', f, f, 2.5, 0.08, { delay: i * 0.25, att: 0.05 })); },
  jump() { noise(0.35, 0.9, 'highpass', 1800, 900, { att: 0.003 }); [220, 233, 311, 466, 622].forEach(f => tone('sawtooth', f, f * 0.97, 1.3, 0.11, { att: 0.004, dist: true })); tone('sine', 80, 30, 0.6, 0.8, { att: 0.003 }); },
  drum(v, pan) { for (let i = 0; i < 6; i++) { tone('sine', 95, 55, 0.3, v * (i % 3 === 0 ? 1 : 0.6), { delay: i * 0.38 + (i % 2) * 0.05, att: 0.005, pan }); noise(0.08, v * 0.3, 'lowpass', 400, 100, { delay: i * 0.38, pan }); } },
  warcry(v, pan) { [310, 360, 420, 480, 390].forEach((f, i) => tone('triangle', f, f * 1.25, 0.9, v * 0.16, { delay: i * 0.07, vib: 9 + i, att: 0.05, pan })); noise(0.8, v * 0.2, 'bandpass', 1200, 900, { q: 2, pan }); },
  spit(v, pan) { noise(0.15, v * 0.5, 'bandpass', 2500, 800, { q: 3, pan }); tone('square', 600, 300, 0.12, v * 0.1, { pan }); },
  crash(v, pan) { noise(0.9, v, 'lowpass', 1200, 80, { att: 0.01, pan }); tone('triangle', 120, 40, 0.6, v * 0.4, { pan }); },
  ach() { tone('sine', 880, 880, 0.4, 0.06); tone('sine', 1320, 1320, 0.6, 0.05, { delay: 0.12 }); },
  honk(v, pan) { tone('sawtooth', 220, 180, 0.35, v * 0.18, { vib: 4, pan }); tone('square', 330, 260, 0.3, v * 0.06, { pan, delay: 0.02 }); },
  shriek(v, pan) { tone('sawtooth', 1400, 2600, 0.25, v * 0.25, { pan, dist: true }); tone('sawtooth', 2500, 700, 0.9, v * 0.3, { delay: 0.2, vib: 40, pan }); noise(1.0, v * 0.4, 'bandpass', 4000, 1200, { q: 4, pan }); tone('sine', 90, 40, 1.0, v * 0.5, { delay: 0.2 }); },
  chitter(v, pan) { for (let i = 0; i < 5; i++) tone('square', rand(2200, 3200), rand(1600, 2400), 0.05, v * 0.08, { delay: i * 0.07, pan }); },
  growl(v, pan) { noise(1.4, v * 0.6, 'lowpass', 300, 80, { att: 0.2, q: 6, pan }); tone('sawtooth', 60, 45, 1.3, v * 0.3, { att: 0.2, vib: 5, dist: true }); },
  hammer(v) { noise(0.05, v * 0.4, 'highpass', 2000, 1500); tone('triangle', 500, 300, 0.05, v * 0.15); },
  levelup() { [523, 659, 784].forEach((f, i) => tone('sine', f, f, 0.5, 0.06, { delay: i * 0.1 })); },
  cough(v, pan) { noise(0.12, v * 0.4, 'bandpass', 700, 400, { q: 2, pan }); noise(0.12, v * 0.3, 'bandpass', 650, 380, { q: 2, pan, delay: 0.25 }); }
};
const panOf = (x) => L ? clamp((x - L.x) / 700, -1, 1) : 0;
const volOf = (o, max) => L ? clamp(1 - dist(o, L) / max, 0, 1) : 0.3;

// ================= CANLI SES: adımlar, nefes, nabız, ortam katmanları, dev adımları =================
// Tek giriş: sesTick(dt) — ana döngüden her kare çağrılır; kararlar ~10 Hz, düğümler yeniden kullanılır.
function sesMuted() { try { return localStorage.getItem('sonAtesSessiz') === '1'; } catch (e) { return false; } }
function sesMute() {
  A.muted = !sesMuted(); try { localStorage.setItem('sonAtesSessiz', A.muted ? '1' : '0'); } catch (e) { }
  if (A.ctx) A.master.gain.setTargetAtTime(A.muted ? 0 : 0.7, A.ctx.currentTime, 0.05);
  if (typeof msg === 'function') msg(A.muted ? 'Ses kapalı (N)' : 'Ses açık (N)', '#cde', 2);
}
const SES = { t: 0, on: false, stepAt: 0, breathAt: 0, hbAt: 0, growlAt: 0, crackAt: 0, wet: 0, seaT: 0, sea: 0, last: {}, dinoT: new WeakMap() };
function sesLoop(buf, rate) { const s = A.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate || 1; s.start(0, Math.random() * 1.5); return s; }
function sesBuild() {
  const ac = A.ctx, mk = (dest) => { const g = ac.createGain(); g.gain.value = 0; g.connect(dest || A.env); return g; };
  const bq = (type, f, q) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q || 1; return b; };
  const lfo = (f, amt, param, type) => { const o = ac.createOscillator(); o.type = type || 'sine'; o.frequency.value = f; const g = ac.createGain(); g.gain.value = amt; o.connect(g); g.connect(param); o.start(); return o; };
  const L_ = SES.L = {};
  // gündüz böcek vızıltısı (dar bantlı gürültü, yavaş dalgalanma)
  L_.ins = mk(); { const f = bq('bandpass', 5200, 9), m = ac.createGain(); m.gain.value = 0.6; lfo(0.23, 0.4, m.gain); sesLoop(A.noise, 0.9).connect(f); f.connect(m); m.connect(L_.ins); }
  // gece cırcır böcekleri: taşıyıcı × kare kapı × yavaş kabarma (iki ayrı böcek)
  L_.cri = mk();
  [[4350, 15, 0.31], [3920, 11.5, 0.19]].forEach(([f, r, s]) => {
    const o = ac.createOscillator(); o.frequency.value = f; o.start();
    const g1 = ac.createGain(); g1.gain.value = 0; lfo(r, 1, g1.gain, 'square');
    const g2 = ac.createGain(); g2.gain.value = 0; lfo(s, 1, g2.gain);
    o.connect(g1); g1.connect(g2); g2.connect(L_.cri);
  });
  // ateş uğultusu (yakın kamp ateşi)
  L_.fire = mk(); { const f = bq('lowpass', 380, 0.7); sesLoop(A.brown, 1.6).connect(f); f.connect(L_.fire); }
  // deniz dalgaları (kahverengi gürültü, yavaş şişme)
  L_.surf = mk(); { const f = bq('lowpass', 700, 0.5), m = ac.createGain(); m.gain.value = 0.55; lfo(0.11, 0.45, m.gain); lfo(0.11, 350, f.frequency); sesLoop(A.brown, 1).connect(f); f.connect(m); m.connect(L_.surf); }
  // kar fısıltısı / tipi ıslığı
  L_.snow = mk(); { const f = bq('bandpass', 2600, 0.8); lfo(0.07, 900, f.frequency); sesLoop(A.noise, 0.7).connect(f); f.connect(L_.snow); }
  // iç mekân/mağara yankısı: adımlar ve nefes buradan da geçer
  SES.dry = ac.createGain(); SES.dry.connect(A.master);
  const dl = ac.createDelay(1); dl.delayTime.value = 0.13; const fb = ac.createGain(); fb.gain.value = 0.38; const ef = bq('lowpass', 1800, 0.7);
  SES.echo = ac.createGain(); SES.echo.gain.value = 0; SES.dry.connect(SES.echo); SES.echo.connect(dl); dl.connect(ef); ef.connect(fb); fb.connect(dl); ef.connect(A.master);
  SES.on = true;
}
// hedefe yumuşak geçiş; yalnızca hedef değişince zaman çizelgesine yaz
function sesSet(key, param, v, tau) {
  if (Math.abs((SES.last[key] ?? -1) - v) < 0.0015 * Math.max(1, v)) return;
  SES.last[key] = v; param.setTargetAtTime(v, A.ctx.currentTime, tau || 1.2);
}
// yüzey sesi: biyom + kar + iç mekân
function sesStep(t, v, delay) {
  const o = { delay, out: SES.dry }, j = rand(0.85, 1.15);
  if (t === 'kar') { noise(0.13, v * 0.5, 'highpass', 2600 * j, 1300, o); noise(0.08, v * 0.35, 'bandpass', 1500 * j, 900, { delay: delay + 0.04, q: 2, out: SES.dry }); }
  else if (t === 'kum') noise(0.16, v * 0.35, 'bandpass', 2400 * j, 1400, { delay, q: 0.8, out: SES.dry, att: 0.03 });
  else if (t === 'bataklik') { noise(0.2, v * 0.5, 'bandpass', 380 * j, 1300, { delay, q: 6, out: SES.dry, att: 0.02 }); noise(0.12, v * 0.3, 'lowpass', 500, 150, o); }
  else if (t === 'tas') { noise(0.05, v * 0.35, 'highpass', 1800 * j, 1200, o); tone('triangle', 260 * j, 120, 0.06, v * 0.12, o); }
  else if (t === 'su') noise(0.3, v * 0.5, 'bandpass', 900 * j, 300, { delay, q: 1.5, out: SES.dry });
  else if (t === 'ic') { tone('sine', 120 * j, 60, 0.09, v * 0.35, o); noise(0.06, v * 0.25, 'bandpass', 900 * j, 500, { delay, q: 2, out: SES.dry }); }
  else { tone('sine', 95 * j, 45, 0.1, v * 0.3, o); noise(0.1, v * 0.22, 'bandpass', 1700 * j, 900, { delay, q: 0.9, out: SES.dry }); }
}
function sesSurface() {
  if (G.inside) return 'ic';
  if (typeof snowAt === 'function' && snowAt(L.x, L.y) > 0.12) return 'kar';
  const b = biomeFast(L.x, L.y);
  return b === 5 ? 'kum' : b === 2 ? 'bataklik' : b === 1 ? 'tas' : b === 6 ? 'su' : 'ot';
}
function sesPan(o) { const dx = o.x - L.x, dy = o.y - L.y, d = Math.hypot(dx, dy) || 1, y = G.inside ? 0 : (G.yaw || 0); return clamp((-Math.sin(y) * dx + Math.cos(y) * dy) / d, -1, 1) * 0.85; }
function sesTick(dt) {
  if (!A.ctx || !A.brown) return;
  const now = A.ctx.currentTime, act = typeof G !== 'undefined' && G.started && !G.over && !G.paused && L && !document.hidden;
  if (!SES.on) { if (!act) return; sesBuild(); }
  SES.t -= dt; if (SES.t > 0) return; SES.t = 0.1;
  if (!act) { for (const k in SES.L) sesSet(k, SES.L[k].gain, 0, 0.3); sesSet('echo', SES.echo.gain, 0, 0.3); return; }
  const n = typeof darkness === 'function' ? darkness() : 0, ins = !!G.inside, b = biomeFast(L.x, L.y);
  const wt = G.weather ? G.weather.type : 'acik', pr = typeof precipAt === 'function' ? precipAt(L.x, L.y) : null;
  const sw = typeof seasonW === 'function' ? seasonW() : [1, 0, 0, 0], winter = sw[3], wet = pr === 'yagmur' ? (wt === 'firtina' ? 1 : 0.6) : 0;
  // --- ortam katmanları
  const life = { 0: 1, 1: 0.25, 2: 1.2, 3: 0.5, 4: 0.85, 5: 0.3, 6: 0 }[b] ?? 0.5, calm = (1 - wet) * (1 - winter * 0.9) * (pr === 'kar' ? 0.1 : 1);
  sesSet('ins', SES.L.ins.gain, 0.014 * (1 - n) * life * calm, 2);
  sesSet('cri', SES.L.cri.gain, 0.006 * n * (b === 1 ? 0.2 : 1) * Math.min(1, life + 0.3) * calm, 2);
  const fd = G.fire && G.fire.fuel > 0 && !ins ? dist(L, G.fire) : 1e9, fv = fd < 650 ? Math.pow(1 - fd / 650, 2) : 0;
  sesSet('fire', SES.L.fire.gain, 0.12 * fv * (0.4 + G.fire.fuel / 160), 0.6);
  if (fv > 0.05 && now > SES.crackAt) { SES.crackAt = now + rand(0.08, 0.35) / (0.3 + fv); noise(0.025, 0.08 * fv, 'highpass', rand(1800, 3500), 1500, { pan: sesPan(G.fire) * 0.6 }); }
  if ((SES.seaT -= 0.1) <= 0) { // kıyı yakınlığı (2 Hz, 8 yön × 2 halka)
    SES.seaT = 0.5; let s = 0;
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, c = Math.cos(a), si = Math.sin(a); if (isSea(L.x + c * 260, L.y + si * 260)) s += 1; else if (isSea(L.x + c * 650, L.y + si * 650)) s += 0.45; }
    SES.sea = Math.min(1, s / 3);
  }
  sesSet('surf', SES.L.surf.gain, 0.16 * SES.sea, 1.5);
  sesSet('snow', SES.L.snow.gain, pr === 'kar' ? (G.weather.heavy ? 0.035 : 0.014) : 0, 2);
  const ws = G.wind && isFinite(G.wind.s) ? G.wind.s : 0.55;
  sesSet('wind', A.windMod.gain, (0.45 + ws * 1.1) * (b === 1 ? 1.3 : 1), 1.5);
  sesSet('env', A.env.frequency, ins ? 650 : 18000, 0.25);
  sesSet('echo', SES.echo.gain, ins ? 0.55 : 0, 0.2);
  // gece uzak hırıltılar (tehlike yokken bile tedirgin)
  if (n > 0.55 && !ins && now > SES.growlAt) { if (SES.growlAt) { const a = rand(0, 6.283); SFX.growl(rand(0.06, 0.16) * n, Math.sin(a) * 0.9); } SES.growlAt = now + rand(18, 45); }
  if (!SES.growlAt) SES.growlAt = now + rand(8, 20);
  // --- lider adımları (ses zamanı önceden planlanır; karar hızından bağımsız düzgün ritim)
  const ride = !!G.mount, mv = L.moving && !ride && !G.sleep;
  if (mv) {
    const per = L.sprinting ? 0.3 : L.sneak ? 0.78 : 0.5, v = (L.sprinting ? 0.42 : L.sneak ? 0.1 : 0.24), surf = sesSurface();
    if (SES.stepAt < now) SES.stepAt = now + 0.05;
    while (SES.stepAt < now + 0.13) { sesStep(surf, v * rand(0.85, 1.1), SES.stepAt - now); SES.stepAt += per * rand(0.96, 1.04); }
  } else SES.stepAt = 0;
  // --- nefes: koşu ya da düşük dayanıklılık
  const st = L.stam ?? 100, ex = Math.max(L.sprinting ? 0.5 : 0, clamp((45 - st) / 45, 0, 1));
  if (ex > 0.05 && !G.sleep && now > SES.breathAt) {
    const per = 1.5 - ex * 0.75, v = 0.03 + ex * 0.07, o = { out: SES.dry, q: 1.2 };
    noise(per * 0.35, v, 'bandpass', 800, 1500, { ...o, att: per * 0.2 });
    noise(per * 0.45, v * 1.2, 'bandpass', 1400, 600, { ...o, att: 0.05, delay: per * 0.42 });
    SES.breathAt = now + per;
  }
  // --- nabız: can düşükken (tehlike nabzını oyun.js zaten çalıyor; çakışmasın)
  const hpf = L.maxhp ? L.hp / L.maxhp : 1;
  if (hpf < 0.4 && (G.danger || 0) <= 0.15 && now > SES.hbAt) { const k = 1 - hpf / 0.4; SFX.heart(0.18 + k * 0.3); SES.hbAt = now + 1.15 - k * 0.5; }
  // --- büyük yaratık adımları: en yakın 3 dev gövdeli (r>30), yön ve uzaklığa göre
  if (G.dinos) {
    let near = [];
    for (const d of G.dinos) {
      if (d.dead || !d.moving || d.fly || d.mounted || !(d.r > 30) || d.type === 'dev') continue; // dev'in adımı yaratik.js'te
      const dd = dist(d, L); if (dd < 1500) near.push([dd, d]);
    }
    if (near.length > 3) near.sort((a, c) => a[0] - c[0]), near.length = 3;
    for (const [dd, d] of near) {
      let t = SES.dinoT.get(d) || 0; t -= 0.1;
      if (t <= 0) {
        const big = clamp((d.r - 30) / 50, 0, 1), fall = 1 - dd / 1500, v = (0.12 + 0.4 * big) * fall * fall * (ins ? 0.6 : 1);
        t = (0.42 + d.r / 140) * rand(0.9, 1.1);
        if (v > 0.006) { const out = sOut(sesPan(d), A.env); tone('sine', 80 - big * 35, 26, 0.35 + big * 0.2, v, { att: 0.006, out }); noise(0.22, v * 0.45, 'lowpass', 260, 50, { out }); if (big > 0.5 && dd < 500) G.shake = Math.max(G.shake || 0, 2.5 * big * fall); }
      }
      SES.dinoT.set(d, t);
    }
  }
}
