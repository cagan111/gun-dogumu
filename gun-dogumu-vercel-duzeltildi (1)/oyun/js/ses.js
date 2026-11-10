'use strict';
// SES — tamamen sentezlenmiş (WebAudio)
const A = { ctx: null };
function audioInit() {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    A.ctx = ac;
    A.master = ac.createGain(); A.master.gain.value = 0.7; A.master.connect(ac.destination);
    const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.noise = buf;
    const bb = ac.createBuffer(1, len, ac.sampleRate), bd = bb.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    const w = ac.createBufferSource(); w.buffer = bb; w.loop = true;
    const wf = ac.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 500;
    A.wind = ac.createGain(); A.wind.gain.value = 0.05;
    w.connect(wf); wf.connect(A.wind); A.wind.connect(A.master); w.start();
    const rn = ac.createBufferSource(); rn.buffer = buf; rn.loop = true;
    const rf = ac.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 1400;
    A.rain = ac.createGain(); A.rain.gain.value = 0;
    rn.connect(rf); rf.connect(A.rain); A.rain.connect(A.master); rn.start();
    const dr = ac.createOscillator(); dr.type = 'sine'; dr.frequency.value = 43;
    const dr2 = ac.createOscillator(); dr2.type = 'sine'; dr2.frequency.value = 44.3;
    A.drone = ac.createGain(); A.drone.gain.value = 0;
    dr.connect(A.drone); dr2.connect(A.drone); A.drone.connect(A.master); dr.start(); dr2.start();
    const ds = ac.createWaveShaper(); const c = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 4); }
    ds.curve = c; A.dist = ds; ds.connect(A.master);
  } catch (e) { A.ctx = null; }
}
function sOut(pan) {
  if (pan !== undefined && A.ctx.createStereoPanner) { const p = A.ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); p.connect(A.master); return p; }
  return A.master;
}
function tone(type, f0, f1, dur, vol, opt = {}) {
  if (!A.ctx || !(vol >= 0.003)) return;
  const ac = A.ctx, t = ac.currentTime + (opt.delay || 0);
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (opt.att || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (opt.vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = opt.vib; lg.gain.value = f0 * 0.06; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur); }
  o.connect(g); g.connect(opt.dist ? A.dist : sOut(opt.pan)); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol, ftype, f0, f1, opt = {}) {
  if (!A.ctx || !(vol >= 0.003)) return;
  const ac = A.ctx, t = ac.currentTime + (opt.delay || 0);
  const s = ac.createBufferSource(); s.buffer = A.noise; s.playbackRate.value = opt.rate || 1;
  const f = ac.createBiquadFilter(); f.type = ftype; f.Q.value = opt.q || 1;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (opt.att || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(opt.dist ? A.dist : sOut(opt.pan)); s.start(t, Math.random()); s.stop(t + dur + 0.05);
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
