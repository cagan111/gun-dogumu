'use strict';
// =============================================================
//  MODEL3D — insan ve yaratık 3B modelleri (THREE global, r149)
//  Koordinat: dünya (x,y) -> three (x, yükseklik, y). 1 dünya birimi = 1 three birimi.
//  Modeller +X yönüne bakacak şekilde kurulur; çizici group.rotation.y = -ang yapar.
//  API:
//    M3.person(p)            -> THREE.Group (ayaklar y=0'da, yetişkin boyu ~34, çocuk ~20)
//    M3.updPerson(g, p, t)   -> her karede: yürüyüş, çalışma, saldırı, yere düşme, taşınma...
//    M3.dino(d)              -> THREE.Group (boyut d.r ile orantılı; yamyam ve taklitçi de buradan)
//    M3.updDino(g, d, t)     -> her karede animasyon
//  Ekler (isteğe bağlı):
//    M3.mouthPos(g, v3)      -> yaratığın ağzının dünya konumu (kapılan insanı asmak için)
//    M3.seatPos(g, v3)       -> eyer/sırt konumu (binici için)
//    M3.FLY_H                -> kanatlının d.alt=1 iken gövde yüksekliği
//  Bütün geometri ve malzemeler modül düzeyinde önbelleklenir; varlık başına yalnızca
//  Mesh düğümleri oluşturulur. Geometriler r=1 biriminde kurulur, kök d.r ile ölçeklenir.
// =============================================================
const M3 = (function () {
  const T3 = THREE, PI = Math.PI;
  const cl = (v, a, b) => v < a ? a : v > b ? b : v;
  const WHITE = new T3.Color(1, 1, 1);
  const col = h => (h && h.isColor) ? h : new T3.Color(h == null ? '#888' : h);
  function shd(h, k) { const c = col(h).clone(); if (k < 0) c.multiplyScalar(1 + k); else c.lerp(WHITE, k); return c; }
  function mix(a, b, t) { return col(a).clone().lerp(col(b), t); }

  // ---------------------------------------------------------------- malzemeler
  const LM = o => new T3.MeshLambertMaterial(Object.assign({ flatShading: true }, o));
  const VC = LM({ vertexColors: true });
  const FLASH = LM({ color: 0xffe2e2, emissive: 0x5a3030 });
  const POIS = LM({ vertexColors: true, color: 0xa4c070 });
  const MATS = {};
  function tint(h) { const k = 't' + h; return MATS[k] || (MATS[k] = LM({ color: col(h), vertexColors: true })); }
  function glow(h) { const k = 'g' + h; return MATS[k] || (MATS[k] = LM({ color: 0x0a0a0a, emissive: col(h) })); }

  // ---------------------------------------------------------------- geometri kurucu
  const U_ICO0 = new T3.IcosahedronGeometry(1, 0), U_ICO1 = new T3.IcosahedronGeometry(1, 1), U_BOX = new T3.BoxGeometry(1, 1, 1);
  const _m = new T3.Matrix4(), _q = new T3.Quaternion(), _e = new T3.Euler(), _p = new T3.Vector3(), _s = new T3.Vector3();
  const _v0 = new T3.Vector3(), _v1 = new T3.Vector3(), _v2 = new T3.Vector3(), _up = new T3.Vector3(0, 1, 0), _d = new T3.Vector3(), _m2 = new T3.Matrix4();
  function PB(seed) { this.p = []; this.c = []; this.s = seed || 11; }
  const pp = PB.prototype;
  pp.rnd = function () { this.s = (this.s * 16807) % 2147483647; return this.s / 2147483647; };
  pp._t = function (a, b, c, k) {
    const j = 0.93 + this.rnd() * 0.14;
    this.p.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) this.c.push(k.r * j, k.g * j, k.b * j);
  };
  // o: { belly: renk, by: bu y'nin altındaki üçgenler belly rengi alır, half: ±1 (yalnız z işareti tutan üçgenler) }
  pp.add = function (geo, m, k, o) {
    const src = geo.index ? geo.toNonIndexed() : geo, a = src.attributes.position.array;
    const k1 = col(k), k2 = o && o.belly ? col(o.belly) : null, by = o && o.by != null ? o.by : -1e9, half = o && o.half || 0;
    for (let i = 0; i < a.length; i += 9) {
      _v0.set(a[i], a[i + 1], a[i + 2]).applyMatrix4(m); _v1.set(a[i + 3], a[i + 4], a[i + 5]).applyMatrix4(m); _v2.set(a[i + 6], a[i + 7], a[i + 8]).applyMatrix4(m);
      if (half && (_v0.z + _v1.z + _v2.z) * half < 0) continue;
      const cy = (_v0.y + _v1.y + _v2.y) / 3;
      this._t(_v0, _v1, _v2, k2 && cy < by ? k2 : k1);
    }
    if (src !== geo) src.dispose();
    return this;
  };
  pp.ball = function (x, y, z, rx, ry, rz, k, o) {
    o = o || {};
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(o.ax || 0, o.ay || 0, o.az || 0)), _s.set(rx, ry, rz));
    if (o.belly && o.by == null) o.by = y - ry * 0.3;
    return this.add(o.d === 0 ? U_ICO0 : U_ICO1, _m, k, o);
  };
  pp.box = function (x, y, z, sx, sy, sz, k, az, ay, ax) {
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(ax || 0, ay || 0, az || 0)), _s.set(sx, sy, sz));
    return this.add(U_BOX, _m, k);
  };
  // a -> b arası incelen silindir. o: { n: kenar, wz: dünya-z ezme katsayısı (ekseni XY düzlemindeyken) }
  pp.tube = function (a, b, ra, rb, k, o) {
    o = o || {};
    _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const len = _d.length() || 1e-4; _d.multiplyScalar(1 / len);
    const g = new T3.CylinderGeometry(Math.max(rb, 1e-4), Math.max(ra, 1e-4), 1, o.n || 6, 1, false);
    _m.compose(_p.set(0, 0, 0), _q.setFromUnitVectors(_up, _d), _s.set(1, len, 1));
    _m2.makeScale(1, 1, o.wz || 1); _m.premultiply(_m2);
    _m2.makeTranslation((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); _m.premultiply(_m2);
    this.add(g, _m, k, o); g.dispose(); return this;
  };
  pp.cone = function (a, b, ra, k, o) { return this.tube(a, b, ra, 0.001, k, Object.assign({ n: 4 }, o || {})); };
  pp.tri = function (a, b, c, k, two) {
    const K = col(k);
    this._t(_v0.set(a[0], a[1], a[2]), _v1.set(b[0], b[1], b[2]), _v2.set(c[0], c[1], c[2]), K);
    if (two !== false) this._t(_v0, _v2, _v1, K);
    return this;
  };
  pp.quad = function (a, b, c, d, k, two) { return this.tri(a, b, c, k, two).tri(a, c, d, k, two); };
  // x0..x1 arasında kesiti değişen kutu: (b: alt, t: üst, w: yarı genişlik), zc: z merkezi
  pp.wedge = function (x0, x1, b0, t0, b1, t1, w0, w1, k, zc) {
    zc = zc || 0;
    const P = [[x0, b0, zc - w0], [x0, b0, zc + w0], [x0, t0, zc + w0], [x0, t0, zc - w0], [x1, b1, zc - w1], [x1, b1, zc + w1], [x1, t1, zc + w1], [x1, t1, zc - w1]];
    const cx = (x0 + x1) / 2, cy = (b0 + t0 + b1 + t1) / 4, K = col(k);
    const F = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]];
    const A = new T3.Vector3(), B = new T3.Vector3(), Cc = new T3.Vector3(), Dd = new T3.Vector3(), n = new T3.Vector3(), e1 = new T3.Vector3(), e2 = new T3.Vector3();
    for (const f of F) {
      A.fromArray(P[f[0]]); B.fromArray(P[f[1]]); Cc.fromArray(P[f[2]]); Dd.fromArray(P[f[3]]);
      n.crossVectors(e1.subVectors(B, A), e2.subVectors(Cc, A));
      const ox = (A.x + B.x + Cc.x + Dd.x) / 4 - cx, oy = (A.y + B.y + Cc.y + Dd.y) / 4 - cy, oz = (A.z + B.z + Cc.z + Dd.z) / 4 - zc;
      if (n.x * ox + n.y * oy + n.z * oz >= 0) { this._t(A, B, Cc, K); this._t(A, Cc, Dd, K); }
      else { this._t(A, Cc, B, K); this._t(A, Dd, Cc, K); }
    }
    return this;
  };
  pp.build = function () {
    const g = new T3.BufferGeometry();
    g.setAttribute('position', new T3.BufferAttribute(new Float32Array(this.p), 3));
    g.setAttribute('color', new T3.BufferAttribute(new Float32Array(this.c), 3));
    g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  };
  const GEO = {};
  let seedN = 3;
  function geo(key, fn) { let g = GEO[key]; if (!g) { const pb = new PB(seedN += 17); fn(pb); g = GEO[key] = pb.build(); } return g; }
  function mesh(g, mat, parent, x, y, z) { const m = new T3.Mesh(g, mat || VC); m.position.set(x || 0, y || 0, z || 0); if (parent) parent.add(m); return m; }
  function grp(parent, x, y, z) { const m = new T3.Group(); m.position.set(x || 0, y || 0, z || 0); if (parent) parent.add(m); return m; }

  // iki kemikli düzlemsel IK. Açılar: 0 = aşağı sarkık, + = öne. dir: +1 diz öne, -1 diz arkaya
  const IK = { a: 0, b: 0 };
  function ik2(hx, hy, ax, ay, L1, L2, dir) {
    const dx = ax - hx, dy = ay - hy; let d = Math.hypot(dx, dy);
    d = cl(d, Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3);
    const beta = Math.atan2(dx, -dy), al = Math.acos(cl((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const t1 = beta + dir * al, kx = hx + L1 * Math.sin(t1), ky = hy - L1 * Math.cos(t1);
    IK.a = t1; IK.b = Math.atan2(ax - kx, -(ay - ky));
  }

  // ---------------------------------------------------------------- veri
  const FB = { // DINO tablosu yoksa yedek
    kucuk: { r: 9, col: '#6b7d3a', eye: '#b6ff5a', cd: 0.7 }, geceavcisi: { r: 12, col: '#3a3f4a', eye: '#7cff9a', cd: 0.8 }, tukurgec: { r: 13, col: '#5a6a4a', eye: '#ff9a3a', cd: 0.9 },
    kesici: { r: 17, col: '#4a3a2e', eye: '#ff4040', cd: 1.4 }, yirtici: { r: 20, col: '#8a4b2a', eye: '#ffd23a', cd: 0.9 }, yelken: { r: 56, col: '#5a4a3a', eye: '#ffb030', cd: 1.5 },
    dev: { r: 62, col: '#3e3b35', eye: '#ff3a1a', cd: 1.6 }, ordek: { r: 26, col: '#8a7a50', eye: '#ddd', cd: 1 }, gurleyen: { r: 20, col: '#7a6a5a', eye: '#ddd', cd: 1.1 },
    boynuzlu: { r: 40, col: '#a08860', eye: '#ddd', cd: 1.3 }, zirhli: { r: 38, col: '#6a6248', eye: '#ddd', cd: 1.6 }, uzunboyun: { r: 74, col: '#6f7f62', eye: '#ddd', cd: 2 },
    kanatli: { r: 16, col: '#8a6a5a', eye: '#9cf', cd: 1 }, batakci: { r: 30, col: '#46553a', eye: '#cf6', cd: 1.2 }, yamyam: { r: 11, col: '#3a2a20', eye: '#e8d8b0', cd: 1 }, taklitci: { r: 12, col: '#d8d0c8', eye: '#ffffff', cd: 1.2 }
  };
  function defOf(type) {
    const D = (typeof DINO !== 'undefined' && DINO) ? DINO[type] : null;
    return D || FB[type] || FB.yirtici;
  }
  const BONE = '#e8e0cc', MAW = '#5a0c0c', CLAW = '#1c1814';

  // =============================================================
  //  THEROPOD (iki ayaklı)
  // =============================================================
  const TP0 = { H: 1.15, tl: 0.85, th: 0.4, tw: 0.34, pitch: 0, tailL: 1.75, tailN: 4, tailR: 0.26, nL: 0.62, nA: 0.95, nR: 0.2, hL: 0.72, hH: 0.34, hW: 0.36, tp: 0.55, teeth: 5, leg: [0.58, 0.62, 0.36], lr: 0.17, arm: 0.4, S: 0.42, eye: 0.06 };
  const TP = {
    kucuk: { H: 1.22, th: 0.3, tw: 0.25, nL: 0.78, nA: 1.05, nR: 0.12, hL: 0.6, hH: 0.25, hW: 0.26, lr: 0.115, tailR: 0.19, tailL: 1.9, leg: [0.56, 0.66, 0.4], arm: 0.36, eye: 0.07 },
    geceavcisi: { H: 1.2, th: 0.31, tw: 0.26, nL: 0.7, nA: 0.85, nR: 0.14, hL: 0.7, hH: 0.3, hW: 0.32, lr: 0.125, tailR: 0.2, tailL: 1.9, arm: 0.5, eye: 0.115 },
    tukurgec: { H: 1.2, th: 0.35, tw: 0.29, nL: 0.85, nA: 1.0, nR: 0.14, hL: 0.7, hH: 0.28, hW: 0.3, lr: 0.14, tailR: 0.22 },
    kesici: { H: 1.25, th: 0.35, tw: 0.27, nL: 0.7, nA: 0.7, nR: 0.17, hL: 0.9, hH: 0.33, hW: 0.32, tp: 0.5, teeth: 6, arm: 0.62, lr: 0.15, tailL: 2.05, tailN: 5, tailR: 0.22, leg: [0.6, 0.68, 0.42], S: 0.5, eye: 0.065 },
    yirtici: { H: 1.2, th: 0.42, tw: 0.36, hL: 0.88, hH: 0.42, hW: 0.4, nR: 0.23, teeth: 6, arm: 0.45 },
    yelken: { H: 1.15, tl: 0.95, th: 0.44, tw: 0.38, tailL: 2.1, tailN: 5, tailR: 0.3, nL: 0.72, nA: 0.72, nR: 0.24, hL: 1.3, hH: 0.36, hW: 0.34, tp: 0.42, teeth: 9, arm: 0.62, lr: 0.2, eye: 0.05 },
    dev: { H: 1.32, tl: 0.92, th: 0.54, tw: 0.47, tailL: 1.85, tailN: 5, tailR: 0.38, nL: 0.5, nA: 0.72, nR: 0.37, hL: 1.25, hH: 0.66, hW: 0.64, tp: 0.66, teeth: 8, arm: 0.26, lr: 0.25, leg: [0.66, 0.7, 0.42], eye: 0.055 },
    gurleyen: { H: 1.12, th: 0.4, tw: 0.36, nL: 0.6, nA: 0.8, nR: 0.2, hL: 0.6, hH: 0.34, hW: 0.36, teeth: 0, arm: 0.34, herb: true, tailR: 0.28, lr: 0.16 }
  };
  function stripe(pb, P, x, k, wid) {
    const u = (x - 0.1) / P.tl, f = Math.sqrt(Math.max(0.04, 1 - u * u));
    pb.ball(x, 0.05, 0, wid || 0.035, P.th * f * 1.03, P.tw * f * 1.05, k);
  }
  function topY(P, x, z) { const u = (x - 0.1) / P.tl, w = (z || 0) / P.tw; return P.th * Math.sqrt(Math.max(0, 1 - u * u - w * w)); }

  function skull(pb, P, T, c) {
    const L = P.hL, h = P.hH, w = P.hW * 0.5, tp = P.tp;
    if (P.herb) { // kubbe kafa
      pb.wedge(-0.12 * L, 0.45 * L, 0, 0.72 * h, 0, 0.62 * h, w * 0.9, w * 0.95, c.col);
      pb.wedge(0.45 * L, L, 0, 0.55 * h, 0.06 * h, 0.22 * h, w * 0.85, w * 0.45, c.col);
      pb.wedge(0.88 * L, 1.05 * L, 0.0, 0.26 * h, -0.06 * h, 0.08 * h, w * 0.4, w * 0.25, '#4a4034');
      pb.ball(0.14 * L, 0.86 * h, 0, 0.42 * L, 0.6 * h, w * 1.05, '#e4d8c0');
      pb.ball(0.2 * L, 1.1 * h, 0, 0.28 * L, 0.42 * h, w * 0.75, '#efe6d2');
      for (let i = 0; i < 7; i++) { const a = PI * 0.5 + (i / 6 - 0.5) * PI * 1.3, x = 0.1 * L + Math.cos(a) * 0.1 * L - 0.34 * L * Math.abs(Math.sin(a)) * 0 - 0.3 * L * (1 - Math.abs(i - 3) / 4), z = Math.cos((i / 6) * PI) * w * 1.15; pb.cone([x, 0.6 * h, z], [x - 0.14 * L, 0.78 * h, z * 1.35], 0.07 * L, '#5a4a3a'); }
      for (const s of [-1, 1]) { pb.ball(0.5 * L, 0.42 * h, s * w * 0.86, 0.05 * L, 0.05 * L, 0.03 * L, '#0c0a08', { d: 0 }); pb.cone([0.72 * L, 0.36 * h, s * w * 0.5], [0.78 * L, 0.52 * h, s * w * 0.6], 0.04 * L, '#5a4a3a'); }
      return;
    }
    pb.wedge(-0.14 * L, 0.36 * L, 0, 0.9 * h, 0, 0.95 * h, w * 0.78, w, c.col);
    pb.wedge(0.36 * L, L, 0, 0.9 * h, 0.03 * h, 0.5 * h, w * 0.96, w * tp, c.col);
    pb.wedge(0.36 * L, 0.98 * L, 0.84 * h, 0.98 * h, 0.46 * h, 0.56 * h, w * 0.5, w * tp * 0.5, c.dk);     // burun sırtı
    pb.wedge(0.02 * L, 0.96 * L, -0.03 * h, 0.02 * h, -0.01 * h, 0.04 * h, w * 0.8, w * tp * 0.8, MAW);       // damak
    for (const s of [-1, 1]) {
      pb.wedge(0.12 * L, 0.42 * L, 0.78 * h, 1.12 * h, 0.82 * h, 0.98 * h, w * 0.22, w * 0.16, T === 'yirtici' ? '#c87a3a' : c.dk, s * w * 0.8); // kaş çıkıntısı
      pb.ball(0.3 * L, 0.6 * h, s * w * 0.99, 0.085 * L, 0.2 * h, 0.03 * L, '#141010', { d: 0 });           // göz çukuru
      const n = P.teeth, tl = (T === 'dev' ? 0.26 : T === 'yelken' ? 0.3 : 0.2) * h;
      for (let i = 0; i < n; i++) { const u = 0.4 + 0.56 * (i + 0.5) / n, x = u * L, ww = w * (0.96 + (tp - 0.96) * ((u - 0.36) / 0.64)) * 0.94, yb = 0.03 * h * ((u - 0.36) / 0.64); pb.cone([x, yb + 0.02 * h, s * ww], [x + 0.01 * L, yb - tl * (0.75 + 0.5 * pb.rnd()), s * ww * 0.97], 0.34 * L / n * 0.5, BONE, { n: 3 }); }
      pb.ball(0.93 * L, 0.42 * h, s * w * tp * 0.8, 0.03 * L, 0.03 * L, 0.02 * L, '#0c0a08', { d: 0 });       // burun deliği
    }
    if (T === 'tukurgec') for (const s of [-1, 1]) { pb.tri([0.05 * L, 0.9 * h, s * w * 0.5], [0.45 * L, 1.75 * h, s * w * 0.75], [0.85 * L, 0.6 * h, s * w * 0.4], '#c84a2a'); pb.tri([0.05 * L, 0.9 * h, s * w * 0.5], [0.2 * L, 1.5 * h, s * w * 0.7], [0.45 * L, 1.75 * h, s * w * 0.75], '#8a2a14'); }
    if (T === 'dev') { for (let i = 0; i < 4; i++) pb.ball((0.45 + i * 0.13) * L, (0.9 - i * 0.1) * h, 0, 0.05 * L, 0.07 * h, 0.1 * w, c.dk, { d: 0 }); pb.box(0.6 * L, 0.55 * h, w * 0.86, 0.3 * L, 0.03 * h, 0.02, '#7a2a20', 0.5); pb.box(0.66 * L, 0.5 * h, w * 0.82, 0.24 * L, 0.03 * h, 0.02, '#7a2a20', 0.5); }
    if (T === 'yelken') pb.wedge(0.22 * L, 0.5 * L, 0.9 * h, 1.3 * h, 0.85 * h, 0.95 * h, w * 0.1, w * 0.06, '#8a3018');
    if (T === 'geceavcisi') for (let i = 0; i < 4; i++) pb.cone([(-0.1 + i * 0.1) * L, 0.9 * h, 0], [(-0.32 + i * 0.1) * L, (1.5 - i * 0.1) * h, 0], 0.04 * L, '#9fb4b0', { n: 3 });
    if (T === 'kesici') for (let i = 0; i < 3; i++) pb.cone([(-0.12 + i * 0.12) * L, 0.9 * h, 0], [(-0.4 + i * 0.12) * L, (1.25 - i * 0.08) * h, 0], 0.05 * L, '#6a1a10', { n: 3 });
  }
  function jawG(pb, P, T, c) {
    const L = P.hL, h = P.hH, w = P.hW * 0.5, tp = P.tp;
    if (P.herb) { pb.wedge(0, 0.95 * L, -0.24 * h, 0.02, -0.1 * h, 0.04 * h, w * 0.8, w * 0.36, c.bel); return; }
    pb.wedge(-0.08 * L, 0.93 * L, -0.42 * h, 0, -0.2 * h, 0, w * 0.86, w * tp * 0.82, c.jaw);
    pb.wedge(0.02 * L, 0.88 * L, -0.02 * h, 0.03 * h, -0.02 * h, 0.03 * h, w * 0.66, w * tp * 0.6, MAW);
    pb.wedge(0.1 * L, 0.7 * L, 0.02 * h, 0.07 * h, 0.02 * h, 0.05 * h, w * 0.3, w * 0.16, '#8a2a2a');     // dil
    const n = Math.max(3, P.teeth - 1), tl = (T === 'dev' ? 0.2 : 0.16) * h;
    for (const s of [-1, 1]) for (let i = 0; i < n; i++) { const u = 0.36 + 0.54 * (i + 0.5) / n, x = u * L, ww = w * (0.86 + (tp * 0.82 - 0.86) * u) * 0.9; pb.cone([x, 0, s * ww], [x, tl * (0.7 + 0.5 * pb.rnd()), s * ww], 0.3 * L / n * 0.5, BONE, { n: 3 }); }
  }
  function theroSpec(T, colHex) {
    const key = 'th|' + T + '|' + colHex;
    if (GEO[key]) return GEO[key];
    const P = Object.assign({}, TP0, TP[T] || TP.yirtici), def = defOf(T);
    const c = { col: col(colHex), dk: shd(colHex, -0.4), lt: shd(colHex, 0.25), bel: mix(shd(colHex, 0.3), '#c8b890', 0.3), jaw: shd(colHex, -0.2) };
    if (T === 'geceavcisi') c.bel = shd(colHex, 0.12);
    const S = { kind: 'thero', P, T, g: {} }, g = S.g;
    g.torso = geo(key + 'torso', pb => {
      pb.ball(0.1, 0, 0, P.tl, P.th, P.tw, c.col, { belly: c.bel, by: -P.th * 0.42 });
      pb.ball(0.52, -0.04, 0, P.tl * 0.5, P.th * 0.86, P.tw * 0.9, c.col, { belly: c.bel, by: -P.th * 0.42 });
      if (T === 'yirtici') { for (let i = -2; i <= 2; i++) stripe(pb, P, 0.1 + i * 0.26, c.dk, 0.04); for (let i = 0; i < 6; i++) { const x = -0.55 + i * 0.26; pb.cone([x, topY(P, x) - 0.03, 0], [x - 0.08, topY(P, x) + 0.22, 0], 0.085, '#c87a3a'); } }
      else if (T === 'dev') {
        pb.wedge(-0.7, 0.85, P.th * 0.55, P.th * 0.92, P.th * 0.5, P.th * 0.98, 0.07, 0.1, c.dk);
        for (let i = 0; i < 12; i++) { const x = -0.6 + (i % 6) * 0.27, z = (i < 6 ? -1 : 1) * P.tw * (0.42 + 0.1 * (i % 2)); pb.ball(x, topY(P, x, z) + 0.0, z, 0.085, 0.05, 0.07, shd(colHex, -0.3), { d: 0 }); }
        pb.box(0.15, 0.12, P.tw * 0.97, 0.5, 0.03, 0.03, '#7a2a20', 0.5); pb.box(0.25, 0.08, P.tw * 0.95, 0.42, 0.03, 0.03, '#7a2a20', 0.5); pb.box(-0.2, 0.1, -P.tw * 0.99, 0.4, 0.03, 0.03, '#6a2018', -0.6);
      } else if (T === 'yelken') {
        const N = 9, xs = [], hs = [];
        for (let i = 0; i <= N; i++) { const x = -0.98 + i * 1.72 / N; xs.push(x); hs.push(0.12 + 1.05 * Math.pow(Math.sin((i + 0.35) / (N + 0.7) * PI), 0.8)); }
        for (let i = 0; i < N; i++) {
          const y0 = P.th * 0.4, a = [xs[i], y0, 0], b = [xs[i + 1], y0, 0], cT = [xs[i + 1], P.th * 0.7 + hs[i + 1], 0], dT = [xs[i], P.th * 0.7 + hs[i], 0];
          const m1 = [xs[i], y0 + (dT[1] - y0) * 0.5, 0], m2 = [xs[i + 1], y0 + (cT[1] - y0) * 0.5, 0];
          pb.quad(a, b, m2, m1, i % 2 ? '#6a2212' : '#7a2a16'); pb.quad(m1, m2, cT, dT, i % 2 ? '#b0481f' : '#c8582c');
        }
        for (let i = 0; i <= N; i++) pb.tube([xs[i], P.th * 0.4, 0], [xs[i], P.th * 0.7 + hs[i] + 0.05, 0], 0.03, 0.012, '#34100a', { n: 4 });
        stripe(pb, P, -0.3, c.dk, 0.05); stripe(pb, P, 0.3, c.dk, 0.05);
      } else if (T === 'kesici') {
        for (let i = -3; i <= 3; i++) stripe(pb, P, 0.1 + i * 0.2, '#1e1610', 0.04);
        for (let i = 0; i < 6; i++) { const x = -0.6 + i * 0.26; pb.ball(x, topY(P, x) + 0.0, 0, 0.07, 0.045, 0.1, '#7a1a10', { d: 0 }); }
      } else if (T === 'geceavcisi') {
        for (let i = -2; i <= 2; i++) stripe(pb, P, 0.1 + i * 0.24, '#7f928f', 0.022);
        for (let i = 0; i < 7; i++) { const x = -0.6 + i * 0.22; pb.cone([x, topY(P, x) - 0.03, 0], [x - 0.16, topY(P, x) + 0.2, 0], 0.04, '#aebfba', { n: 3 }); }
      } else if (T === 'gurleyen') {
        pb.wedge(-0.7, 0.8, P.th * 0.6, P.th * 0.9, P.th * 0.55, P.th * 0.95, 0.1, 0.12, shd(colHex, -0.25));
        for (let i = 0; i < 5; i++) { const x = -0.5 + i * 0.28; for (const s of [-1, 1]) pb.ball(x, topY(P, x, s * P.tw * 0.55), s * P.tw * 0.55, 0.06, 0.04, 0.05, c.lt, { d: 0 }); }
      } else {
        pb.wedge(-0.72, 0.85, P.th * 0.6, P.th * 0.9, P.th * 0.55, P.th * 0.95, 0.06, 0.07, c.dk);
        for (let i = 0; i < 6; i++) { const x = -0.45 + i * 0.22, z = (i % 2 ? 1 : -1) * P.tw * 0.6; pb.ball(x, topY(P, x, z), z, 0.06, 0.04, 0.06, T === 'tukurgec' ? '#c8a04a' : c.lt, { d: 0 }); }
      }
    });
    // kuyruk
    g.tail = []; S.tsl = P.tailL / P.tailN;
    for (let i = 0; i < P.tailN; i++) {
      const r0 = P.tailR * Math.pow(1 - i / P.tailN, 0.85), r1 = i === P.tailN - 1 ? 0.012 : P.tailR * Math.pow(1 - (i + 1) / P.tailN, 0.85);
      g.tail.push(geo(key + 'tail' + i, pb => {
        const kk = T === 'kesici' ? (i % 2 ? '#1e1610' : c.col) : T === 'yirtici' && i % 2 ? c.dk : T === 'geceavcisi' && i === P.tailN - 1 ? '#7f928f' : c.col;
        pb.tube([0.03, 0, 0], [-S.tsl, 0, 0], r0, r1, kk, { n: 6, wz: 0.78 });
        if (T === 'yirtici' && i < 2) pb.cone([-S.tsl * 0.5, r0 * 0.8, 0], [-S.tsl * 0.6, r0 * 0.8 + 0.16, 0], 0.07, '#c87a3a');
        if (T === 'dev' || T === 'gurleyen') pb.wedge(-S.tsl, 0, r1 * 0.6, r1 * 1.05, r0 * 0.6, r0 * 1.05, 0.04, 0.06, c.dk);
        if (T === 'geceavcisi' && i < 3) pb.cone([-S.tsl * 0.4, r0 * 0.8, 0], [-S.tsl * 0.75, r0 + 0.14, 0], 0.035, '#aebfba', { n: 3 });
      }));
    }
    // boyun (pivot: boyun kökü)
    S.nx = P.tl * 0.82 + 0.02; S.ny = P.th * 0.22;
    S.hx = Math.cos(P.nA) * P.nL; S.hy = Math.sin(P.nA) * P.nL;
    g.neck = geo(key + 'neck', pb => {
      const a2 = P.nA + 0.3, mx = Math.cos(a2) * P.nL * 0.5, my = Math.sin(a2) * P.nL * 0.5;
      pb.tube([-0.18, -0.12, 0], [mx, my, 0], P.nR * 1.55, P.nR * 1.15, c.col, { n: 6, wz: 0.85 });
      pb.tube([mx, my, 0], [S.hx + 0.02, S.hy, 0], P.nR * 1.15, P.nR * 0.98, c.col, { n: 6, wz: 0.85 });
      pb.ball(mx, my, 0, P.nR * 1.15, P.nR * 1.15, P.nR * 0.98, c.col, { d: 0 });
      if (T === 'geceavcisi') for (let i = 0; i < 3; i++) pb.cone([mx * (0.4 + i * 0.5) - P.nR, my * (0.4 + i * 0.5) + P.nR * 0.3, 0], [mx * (0.4 + i * 0.5) - P.nR - 0.2, my * (0.4 + i * 0.5) + 0.2, 0], 0.035, '#aebfba', { n: 3 });
      if (T === 'tukurgec') pb.tube([mx * 1.5, my * 1.5, 0], [mx * 1.7, my * 1.7, 0], P.nR * 1.35, P.nR * 1.3, '#a83a1c', { n: 6 });
    });
    g.head = geo(key + 'head', pb => skull(pb, P, T, c));
    g.jaw = geo(key + 'jaw', pb => jawG(pb, P, T, c));
    if (!P.herb) g.eyes = geo(key + 'eyes', pb => { for (const s of [-1, 1]) pb.ball(0.3 * P.hL, 0.6 * P.hH, s * P.hW * 0.5 * 1.0, P.eye, P.eye, P.eye * 0.55, '#fff', { d: 0 }); });
    S.eyeMat = glow(def.eye || '#f0d040');
    if (T === 'tukurgec') g.frill = geo(key + 'frill', pb => {
      const N = 10, R = 1.0;
      for (let i = 0; i < N; i++) {
        const a0 = -PI * 0.78 + i * PI * 1.56 / N, a1 = a0 + PI * 1.56 / N;
        const p0 = [-0.12, Math.cos(a0) * R, Math.sin(a0) * R], p1 = [-0.12, Math.cos(a1) * R, Math.sin(a1) * R], am = (a0 + a1) / 2, pm = [-0.2, Math.cos(am) * R * 0.86, Math.sin(am) * R * 0.86];
        pb.tri([0.02, 0, 0], p0, pm, i % 2 ? '#e8641e' : '#d8501a'); pb.tri([0.02, 0, 0], pm, p1, i % 2 ? '#c8401a' : '#eb7a2a');
        pb.tube([0, 0, 0], p0, 0.035, 0.012, '#6a1a0a', { n: 3 });
      }
    });
    // bacak
    const lr = P.lr, [L1, L2, L3] = P.leg;
    g.thigh = geo(key + 'thigh', pb => { pb.tube([0, 0.06, 0], [0, -L1, 0], lr * 1.85, lr * 0.95, c.col, { n: 6, wz: 0.62 }); pb.ball(0, -L1, 0, lr * 0.95, lr * 0.95, lr * 0.7, c.col, { d: 0 }); });
    g.shin = geo(key + 'shin', pb => { pb.tube([0, 0, 0], [0, -L2, 0], lr * 0.98, lr * 0.5, c.col, { n: 5, wz: 0.75 }); });
    g.meta = geo(key + 'meta', pb => { pb.tube([0, 0, 0], [0, -L3, 0], lr * 0.52, lr * 0.46, c.dk, { n: 5 }); pb.ball(0, 0, 0, lr * 0.56, lr * 0.56, lr * 0.5, c.dk, { d: 0 }); });
    S.toeH = lr * 0.38;
    g.toes = geo(key + 'toes', pb => {
      const f = lr * 5.4, h = S.toeH;
      for (const z of [-0.13, 0, 0.13]) { const tl = (z === 0 ? 0.34 : 0.27) * f; pb.wedge(-0.04 * f, tl, -h, h * 0.9, -h, -h * 0.25, 0.05 * f, 0.035 * f, c.dk, z * f + (z ? z * f * 0.7 : 0) * 0); pb.cone([tl - 0.01, -h * 0.5, z * f * 1.25], [tl + 0.11 * f, -h, z * f * 1.4], 0.035 * f, T === 'kesici' ? BONE : CLAW); }
      pb.cone([-0.02 * f, -h * 0.3, 0], [-0.2 * f, -h, 0], 0.045 * f, c.dk);
      if (T === 'kesici') { pb.tube([0.04 * f, 0, -0.1 * f], [0.2 * f, 0.26 * f, -0.12 * f], 0.05 * f, 0.045 * f, c.dk, { n: 4 }); pb.tube([0.2 * f, 0.26 * f, -0.12 * f], [0.42 * f, 0.3 * f, -0.12 * f], 0.055 * f, 0.035 * f, BONE, { n: 4 }); pb.cone([0.42 * f, 0.3 * f, -0.12 * f], [0.54 * f, 0.08 * f, -0.12 * f], 0.04 * f, BONE); }
    });
    g.arm = geo(key + 'arm', pb => {
      const a = P.arm, k = P.herb ? c.col : c.dk;
      pb.tube([0, 0.03, 0], [-0.12 * a, -0.5 * a, 0], 0.13 * a + 0.02, 0.09 * a + 0.012, k, { n: 5 });
      pb.tube([-0.12 * a, -0.5 * a, 0], [0.26 * a, -0.86 * a, 0], 0.09 * a + 0.012, 0.06 * a + 0.01, k, { n: 5 });
      const cn = T === 'kesici' || T === 'yelken' ? 0.34 : 0.2;
      for (const z of [-0.07, 0.07]) pb.cone([0.26 * a, -0.86 * a, z * a], [(0.26 + cn * 0.6) * a, (-0.86 - cn) * a, z * a * 1.8], 0.05 * a + 0.006, T === 'kesici' ? BONE : CLAW);
    });
    return (GEO[key] = S);
  }
  function rigThero(S, root, ud) {
    const P = S.P, g = S.g, M = ud.meshes;
    const body = grp(root, 0, P.H, 0); ud.body = body;
    M.push(ud.torso = mesh(g.torso, VC, body));
    ud.tail = []; let par = body, tx = -P.tl * 0.72 + 0.1, ty = P.th * 0.1;
    for (let i = 0; i < g.tail.length; i++) { const m = mesh(g.tail[i], VC, par, i ? -S.tsl : tx, i ? 0 : ty, 0); M.push(m); ud.tail.push(m); par = m; }
    M.push(ud.neck = mesh(g.neck, VC, body, S.nx, S.ny, 0));
    M.push(ud.head = mesh(g.head, VC, ud.neck, S.hx, S.hy, 0));
    M.push(ud.jaw = mesh(g.jaw, VC, ud.head, 0, 0, 0));
    if (g.eyes) ud.eyes = mesh(g.eyes, S.eyeMat, ud.head);
    if (g.frill) { M.push(ud.frill = mesh(g.frill, VC, ud.neck, S.hx * 0.82, S.hy * 0.82, 0)); ud.frill.rotation.z = P.nA - PI / 2 + 0.5; ud.frillK = 0; }
    ud.arms = []; ud.legs = [];
    for (const s of [-1, 1]) {
      const a = mesh(g.arm, VC, body, P.tl * 0.62, -P.th * 0.42, s * P.tw * 0.78); M.push(a); ud.arms.push(a);
      const th = mesh(g.thigh, VC, root, 0, P.H, s * P.tw * 0.86), sh = mesh(g.shin, VC, th, 0, -P.leg[0], 0), me = mesh(g.meta, VC, sh, 0, -P.leg[1], 0), to = mesh(g.toes, VC, me, 0, -P.leg[2], 0);
      to.scale.z = s > 0 ? -1 : 1; if (S.T !== 'kesici') to.scale.z = 1;
      M.push(th, sh, me, to); ud.legs.push({ th, sh, me, to });
    }
    ud.mouth = { n: ud.head, x: P.hL * 0.6, y: -P.hH * 0.2 };
    ud.seat = { n: body, x: 0.1, y: P.th + 0.05 };
    ud.neckBase = { n: ud.neck, x: S.hx * 0.25, y: S.hy * 0.25, r: P.nR * 1.7 };
    ud.side = P.tw;
  }
  function updThero(ud, d, t, dt, def) {
    const S = ud.S, P = S.P, T = S.T, ph = d.anim || 0, id = d.id || 0, mv = ud.mv, s = Math.sin(ph), c = Math.cos(ph);
    // saldırı / ağız
    const cd = def.cd || 1, atk = d.atkCd > 0 ? cl((d.atkCd / cd - 0.55) / 0.45, 0, 1) : 0;
    const roar = T === 'dev' && d.roarT > 16 ? 1 : 0;
    let open = atk > 0 || d.carry || roar ? 1 : 0;
    if (P.herb) open = atk > 0 ? 0.4 : 0;
    ud.jawK += (open - ud.jawK) * Math.min(1, dt * (open ? 22 : 9));
    const lunge = atk * atk, pant = (1 - mv) * (0.03 + 0.03 * Math.sin(t * 2.2 + id));
    const bob = mv * Math.abs(c) * 0.06 + Math.sin(t * 2.2 + id) * 0.012;
    const Hc = P.H + bob - lunge * 0.08;
    const body = ud.body;
    body.position.y = Hc; body.position.x = lunge * 0.12;
    body.rotation.z = P.pitch + mv * Math.sin(ph * 2) * 0.025 - lunge * (P.herb ? 0.3 : 0.1) + roar * 0.12;
    body.rotation.x = mv * s * 0.05;
    const br = 1 + Math.sin(t * 2.2 + id) * 0.02; ud.torso.scale.set(1, br, br);
    // bacaklar
    for (let i = 0; i < 2; i++) {
      const L = ud.legs[i], p = ph + (i ? PI : 0), sn = Math.sin(p), cs = Math.cos(p), lift = mv * Math.max(0, cs);
      const fx = mv * sn * P.S + (1 - mv) * (i ? -0.1 : 0.12) + lunge * 0.05;
      const phi = 0.38 + mv * 0.42 * sn - lift * 0.5;
      const bx = fx, byy = S.toeH + lift * 0.3;
      const ax = bx - P.leg[2] * Math.sin(phi), ay = byy + P.leg[2] * Math.cos(phi);
      ik2(body.position.x * 0.5, Hc, ax, ay, P.leg[0], P.leg[1], 1);
      L.th.position.y = Hc; L.th.position.x = body.position.x * 0.5;
      L.th.rotation.z = IK.a; L.sh.rotation.z = IK.b - IK.a; L.me.rotation.z = phi - IK.b; L.to.rotation.z = -phi - lift * 0.7;
    }
    // kuyruk
    const tw = d.moving ? ph * 0.5 : t * 1.2 + id, amp = (0.1 + mv * 0.16) * (4 / ud.tail.length);
    for (let i = 0; i < ud.tail.length; i++) { const m = ud.tail[i]; m.rotation.y = Math.sin(tw - i * 0.7) * amp * (0.6 + i * 0.25); m.rotation.z = (i === 0 ? 0.06 : -0.02) + mv * Math.sin(ph * 2 - i * 0.6) * 0.03 + lunge * 0.05; }
    // boyun, kafa
    const hb = mv * Math.sin(ph * 2) * 0.05 + (1 - mv) * Math.sin(t * 1.5 + id) * 0.03;
    const butt = P.herb ? lunge * 0.9 : 0;
    ud.neck.rotation.z = hb - lunge * 0.45 - butt + roar * 0.3 - body.rotation.z * 0.6;
    ud.neck.rotation.y = (1 - mv) * Math.sin(t * 0.45 + id * 1.7) * 0.28 * (1 - lunge);
    ud.head.rotation.z = -ud.neck.rotation.z * 0.75 + ud.jawK * 0.22 - (P.herb ? 0.15 + butt * 0.4 : 0.08) + roar * 0.2;
    ud.head.rotation.y = (1 - mv) * Math.sin(t * 0.45 + id * 1.7 + 0.6) * 0.22;
    ud.jaw.rotation.z = -(ud.jawK * (roar ? 0.75 : 0.62) + pant);
    if (ud.frill) { const fo = d.frill > 0 ? 1 : 0; ud.frillK += (fo - ud.frillK) * Math.min(1, dt * 14); const f = 0.16 + 0.84 * ud.frillK; ud.frill.scale.set(1, f, f * (1 + 0.05 * Math.sin(t * 40) * ud.frillK)); }
    // kollar
    const aa = Math.sin(t * 3 + id) * 0.12;
    ud.arms[0].rotation.z = 0.2 + aa + lunge * 0.9 + mv * s * 0.15; ud.arms[1].rotation.z = 0.2 - aa + lunge * 0.9 - mv * s * 0.15;
  }

  // =============================================================
  //  DÖRT AYAKLILAR
  // =============================================================
  const QP = {
    boynuzlu: { by: 0.92, tr: [1.02, 0.52, 0.6], fl: { x: 0.56, y: 0.86, z: 0.46, L: [0.46, 0.46], r: 0.19 }, bl: { x: -0.56, y: 0.94, z: 0.46, L: [0.5, 0.5], r: 0.21 }, tail: { x: -0.9, y: 0.05, len: 0.95, n: 3, r: 0.22, dz: [-0.35, -0.1, 0.05] }, neck: { x: 0.82, y: -0.02, n: 1, len: 0.34, a0: -0.05, da: 0, r0: 0.36, r1: 0.3 }, hp: -0.12, S: 0.26 },
    zirhli: { by: 0.6, tr: [1.05, 0.38, 0.72], fl: { x: 0.58, y: 0.5, z: 0.5, L: [0.28, 0.27], r: 0.17 }, bl: { x: -0.56, y: 0.55, z: 0.52, L: [0.31, 0.29], r: 0.19 }, tail: { x: -0.92, y: 0.0, len: 1.0, n: 4, r: 0.2, dz: [-0.05, 0.03, 0.03, 0.03] }, neck: { x: 0.88, y: -0.06, n: 1, len: 0.22, a0: -0.1, da: 0, r0: 0.26, r1: 0.24 }, hp: 0, S: 0.2 },
    ordek: { by: 1.18, pitch: -0.14, tr: [1.0, 0.5, 0.46], fl: { x: 0.62, y: 0.8, z: 0.32, L: [0.43, 0.42], r: 0.11 }, bl: { x: -0.3, y: 1.18, z: 0.36, L: [0.62, 0.62], r: 0.2 }, tail: { x: -0.82, y: 0.08, len: 1.5, n: 4, r: 0.3, dz: [0.2, -0.02, -0.03, -0.03] }, neck: { x: 0.78, y: 0.1, n: 2, len: 0.75, a0: 0.95, da: -0.25, r0: 0.25, r1: 0.16 }, hp: -0.2, S: 0.36 },
    uzunboyun: { by: 1.42, tr: [1.05, 0.6, 0.66], fl: { x: 0.6, y: 1.34, z: 0.44, L: [0.72, 0.68], r: 0.2 }, bl: { x: -0.58, y: 1.3, z: 0.46, L: [0.7, 0.66], r: 0.22 }, tail: { x: -0.88, y: 0.1, len: 2.7, n: 6, r: 0.34, dz: [-0.3, -0.12, 0.02, 0.12, 0.12, 0.08] }, neck: { x: 0.8, y: 0.2, n: 5, len: 2.9, a0: 0.62, da: 0.09, r0: 0.34, r1: 0.14 }, hp: -0.1, S: 0.3 }
  };
  function quadSpec(T, colHex) {
    const key = 'q|' + T + '|' + colHex;
    if (GEO[key]) return GEO[key];
    const P = QP[T], c = { col: col(colHex), dk: shd(colHex, -0.4), lt: shd(colHex, 0.25), bel: mix(shd(colHex, 0.3), '#c8b890', 0.3) };
    const S = { kind: 'quad', P, T, g: {} }, g = S.g, [RX, RY, RZ] = P.tr;
    const top = (x, z) => RY * Math.sqrt(Math.max(0, 1 - x * x / (RX * RX) - (z || 0) * (z || 0) / (RZ * RZ)));
    g.torso = geo(key + 'torso', pb => {
      pb.ball(0, 0, 0, RX, RY, RZ, c.col, { belly: c.bel, by: -RY * 0.45 });
      if (T === 'boynuzlu') {
        pb.ball(0.5, 0.06, 0, 0.55, RY * 0.95, RZ * 0.9, c.col, { belly: c.bel, by: -RY * 0.45 });
        pb.wedge(-0.85, 0.7, RY * 0.6, RY * 0.93, RY * 0.7, RY * 1.02, 0.1, 0.14, shd(colHex, -0.25));
        for (let i = 0; i < 5; i++) { const x = -0.6 + i * 0.3; for (const s of [-1, 1]) pb.ball(x, top(x, s * RZ * 0.6), s * RZ * 0.6, 0.07, 0.04, 0.07, shd(colHex, -0.2), { d: 0 }); }
      } else if (T === 'zirhli') {
        pb.ball(0, RY * 0.22, 0, RX * 0.97, RY * 0.9, RZ * 0.98, shd(colHex, -0.15));
        const topS = (x, z) => RY * 0.22 + RY * 0.9 * Math.sqrt(Math.max(0, 1 - x * x / (RX * RX * 0.94) - z * z / (RZ * RZ * 0.96)));
        for (let i = -3; i <= 3; i++) for (let j = -2; j <= 2; j++) { const x = i * 0.27, z = j * 0.25; if (x * x / (RX * RX) + z * z / (RZ * RZ) > 0.8) continue; pb.cone([x, topS(x, z) - 0.04, z], [x - 0.03, topS(x, z) + 0.1, z], 0.1, (i + j) % 2 ? '#8a8262' : '#4e4834', { n: 5 }); }
        for (let i = -3; i <= 3; i++) for (const s of [-1, 1]) { const x = i * 0.27 + 0.03, zz = RZ * Math.sqrt(Math.max(0.1, 1 - x * x / (RX * RX))) * 0.9; pb.cone([x, 0.06, s * zz], [x - 0.05, 0.14, s * (zz + 0.3)], 0.085, '#d8d0b8'); }
      } else if (T === 'ordek') {
        pb.ball(-0.3, 0.06, 0, 0.6, RY * 0.98, RZ * 0.98, c.col, { belly: c.bel, by: -RY * 0.45 });
        pb.wedge(-0.9, 0.85, RY * 0.6, RY * 1.02, RY * 0.5, RY * 0.9, 0.05, 0.05, shd(colHex, -0.3));
        for (let i = 0; i < 4; i++) { const x = -0.5 + i * 0.3, f = Math.sqrt(Math.max(0.04, 1 - x * x / (RX * RX))); pb.ball(x, 0.08, 0, 0.03, RY * f * 1.02, RZ * f * 1.04, c.lt); }
      } else if (T === 'uzunboyun') {
        pb.ball(0.45, 0.12, 0, 0.6, RY * 0.9, RZ * 0.85, c.col, { belly: c.bel, by: -RY * 0.45 });
        pb.ball(-0.5, 0.04, 0, 0.55, RY * 0.85, RZ * 0.85, c.col, { belly: c.bel, by: -RY * 0.45 });
        for (let i = 0; i < 7; i++) { const x = -0.7 + i * 0.25; pb.ball(x, top(x, 0) + (i > 3 ? 0.06 : 0.0), 0, 0.09, 0.05, 0.1, c.dk, { d: 0 }); }
        for (let i = 0; i < 6; i++) { const x = -0.55 + i * 0.25; for (const s of [-1, 1]) pb.ball(x, top(x, s * RZ * 0.62), s * RZ * 0.62, 0.07, 0.035, 0.07, shd(colHex, -0.22), { d: 0 }); }
      }
    });
    const tl = P.tail; S.tsl = tl.len / tl.n; g.tail = [];
    for (let i = 0; i < tl.n; i++) {
      const r0 = tl.r * Math.pow(1 - i / tl.n, 0.8) + 0.01, r1 = i === tl.n - 1 ? (T === 'zirhli' ? 0.07 : 0.015) : tl.r * Math.pow(1 - (i + 1) / tl.n, 0.8) + 0.01;
      g.tail.push(geo(key + 'tail' + i, pb => {
        pb.tube([0.04, 0, 0], [-S.tsl, 0, 0], r0, r1, c.col, { n: 6, wz: T === 'zirhli' ? 1.15 : 0.85 });
        if (T === 'zirhli') {
          for (const s of [-1, 1]) pb.cone([-S.tsl * 0.5, 0, s * r0 * 0.9], [-S.tsl * 0.6, 0.03, s * (r0 + 0.16)], 0.05, '#d8d0b8');
          if (i === tl.n - 1) { pb.ball(-S.tsl - 0.08, 0, 0.13, 0.2, 0.15, 0.17, shd(colHex, -0.3)); pb.ball(-S.tsl - 0.08, 0, -0.13, 0.2, 0.15, 0.17, shd(colHex, -0.3)); pb.ball(-S.tsl - 0.2, 0, 0, 0.14, 0.12, 0.14, '#3a3626'); }
        }
        if (T === 'uzunboyun' && i < 3) pb.ball(-S.tsl * 0.5, r0 * 0.85, 0, 0.08, 0.04, 0.08, c.dk, { d: 0 });
        if (T === 'ordek') pb.wedge(-S.tsl, 0, r1 * 0.7, r1 * 1.25, r0 * 0.7, r0 * 1.25, 0.03, 0.04, shd(colHex, -0.3));
      }));
    }
    const nk = P.neck; S.nsl = nk.len / nk.n; g.neck = [];
    for (let i = 0; i < nk.n; i++) {
      const r0 = nk.r0 + (nk.r1 - nk.r0) * i / nk.n, r1 = nk.r0 + (nk.r1 - nk.r0) * (i + 1) / nk.n;
      g.neck.push(geo(key + 'neck' + i, pb => {
        pb.tube([-0.06, 0, 0], [S.nsl + 0.02, 0, 0], r0, r1, c.col, { n: 6, wz: 0.85 });
        if (T === 'uzunboyun') pb.wedge(0, S.nsl, r0 * 0.75, r0 * 1.02, r1 * 0.75, r1 * 1.02, 0.05, 0.04, c.dk);
        if (T === 'ordek') pb.wedge(0, S.nsl, r0 * 0.75, r0 * 1.15, r1 * 0.75, r1 * 1.15, 0.03, 0.03, shd(colHex, -0.3));
      }));
    }
    g.head = geo(key + 'head', pb => {
      if (T === 'boynuzlu') {
        const fk = shd(colHex, -0.18), fx = -0.1, fy = 0.36, az = 0.5;
        pb.ball(fx, fy, 0, 0.1, 0.62, 0.74, fk, { az });
        pb.ball(fx + 0.06, fy - 0.02, 0, 0.08, 0.4, 0.5, mix(colHex, '#8a3a2a', 0.45), { az });
        for (let i = 0; i < 9; i++) { const a = (i / 8 - 0.5) * PI * 1.25, ly = Math.cos(a) * 0.62, lz = Math.sin(a) * 0.74; pb.cone([fx - Math.sin(az) * ly * 0.95, fy + Math.cos(az) * ly * 0.95, lz * 0.95], [fx - Math.sin(az) * ly * 1.14 - 0.03, fy + Math.cos(az) * ly * 1.14, lz * 1.14], 0.07, BONE); }
        pb.wedge(-0.12, 0.42, -0.3, 0.3, -0.27, 0.14, 0.3, 0.22, c.col);
        pb.wedge(0.42, 0.74, -0.27, 0.14, -0.26, -0.02, 0.22, 0.11, c.col);
        pb.wedge(0.7, 0.86, -0.3, 0.0, -0.36, -0.2, 0.1, 0.04, '#4a4030');
        for (const s of [-1, 1]) { pb.tube([0.16, 0.24, s * 0.2], [0.6, 0.62, s * 0.3], 0.085, 0.05, BONE, { n: 5 }); pb.cone([0.6, 0.62, s * 0.3], [1.0, 0.76, s * 0.33], 0.05, '#f4eedc', { n: 5 }); pb.ball(0.3, 0.06, s * 0.265, 0.05, 0.05, 0.03, '#0c0a08', { d: 0 }); }
        pb.cone([0.56, 0.04, 0], [0.72, 0.36, 0], 0.075, BONE, { n: 5 });
      } else if (T === 'zirhli') {
        pb.wedge(-0.1, 0.3, -0.2, 0.2, -0.18, 0.14, 0.3, 0.27, shd(colHex, -0.1));
        pb.wedge(0.3, 0.52, -0.18, 0.14, -0.16, 0.0, 0.27, 0.15, shd(colHex, -0.1));
        pb.wedge(-0.08, 0.34, 0.14, 0.25, 0.1, 0.17, 0.26, 0.2, '#4e4834');
        pb.wedge(0.46, 0.58, -0.2, -0.02, -0.22, -0.12, 0.13, 0.08, '#3a3626');
        for (const s of [-1, 1]) { pb.cone([-0.02, 0.14, s * 0.26], [-0.16, 0.26, s * 0.46], 0.08, '#d8d0b8'); pb.cone([0.02, -0.1, s * 0.27], [-0.08, -0.16, s * 0.45], 0.07, '#d8d0b8'); pb.ball(0.2, 0.06, s * 0.275, 0.04, 0.04, 0.025, '#0c0a08', { d: 0 }); }
      } else if (T === 'ordek') {
        pb.wedge(-0.14, 0.26, -0.15, 0.17, -0.14, 0.13, 0.15, 0.15, c.col);
        pb.wedge(0.26, 0.5, -0.12, 0.13, -0.08, 0.02, 0.14, 0.15, c.col);
        pb.wedge(0.44, 0.74, -0.1, 0.03, -0.07, -0.02, 0.15, 0.22, '#d0b070');
        pb.tube([0.14, 0.1, 0], [-0.3, 0.3, 0], 0.09, 0.07, '#b8503a', { n: 5, wz: 0.7 }); pb.tube([-0.3, 0.3, 0], [-0.7, 0.4, 0], 0.07, 0.035, '#a03c28', { n: 5, wz: 0.7 });
        for (const s of [-1, 1]) pb.ball(0.16, 0.05, s * 0.15, 0.04, 0.04, 0.02, '#0c0a08', { d: 0 });
      } else {
        pb.wedge(-0.12, 0.2, -0.11, 0.12, -0.1, 0.13, 0.11, 0.12, c.col);
        pb.wedge(0.2, 0.44, -0.1, 0.13, -0.08, 0.02, 0.12, 0.09, c.col);
        pb.wedge(0.02, 0.24, 0.12, 0.2, 0.12, 0.14, 0.05, 0.04, c.dk);
        for (const s of [-1, 1]) pb.ball(0.14, 0.05, s * 0.12, 0.03, 0.03, 0.018, '#0c0a08', { d: 0 });
      }
    });
    g.jaw = geo(key + 'jaw', pb => {
      if (T === 'boynuzlu') pb.wedge(0, 0.72, -0.4, -0.26, -0.33, -0.25, 0.2, 0.06, shd(colHex, -0.15));
      else if (T === 'zirhli') pb.wedge(0, 0.48, -0.27, -0.17, -0.22, -0.15, 0.22, 0.1, shd(colHex, -0.2));
      else if (T === 'ordek') pb.wedge(0, 0.7, -0.19, -0.11, -0.11, -0.06, 0.12, 0.19, '#b89a5c');
      else pb.wedge(0, 0.4, -0.16, -0.09, -0.11, -0.07, 0.1, 0.07, c.bel);
    });
    const legG = (L, nm) => {
      const r = L.r;
      g[nm + 'u'] = geo(key + nm + 'u', pb => { pb.tube([0, 0.08, 0], [0, -L.L[0], 0], r * 1.3, r * 0.85, c.col, { n: 6 }); pb.ball(0, -L.L[0], 0, r * 0.86, r * 0.86, r * 0.86, c.col, { d: 0 }); });
      g[nm + 'l'] = geo(key + nm + 'l', pb => {
        pb.tube([0, 0, 0], [0, -L.L[1] + r * 0.3, 0], r * 0.84, r * 0.78, c.dk, { n: 6 });
        pb.tube([0.02, -L.L[1] + r * 0.45, 0], [0.04, -L.L[1], 0], r * 0.86, r * 1.02, c.dk, { n: 6 });
        for (const z of [-0.5, 0, 0.5]) pb.ball(r * 0.9, -L.L[1] + r * 0.16, z * r * 1.1, r * 0.2, r * 0.18, r * 0.2, T === 'ordek' ? CLAW : '#d8d0b8', { d: 0 });
      });
    };
    legG(P.fl, 'f'); legG(P.bl, 'b');
    if (T === 'boynuzlu') g.saddle = geo('saddle', pb => {
      pb.ball(0, 0, 0, 0.36, 0.1, 0.5, '#5a3418'); pb.wedge(-0.34, -0.2, 0, 0.26, 0, 0.1, 0.3, 0.3, '#6a4020'); pb.wedge(0.2, 0.32, 0, 0.18, 0, 0.06, 0.18, 0.14, '#6a4020');
      for (const s of [-1, 1]) { pb.box(0, -0.3, s * 0.56, 0.1, 0.62, 0.03, '#3a2210'); pb.box(0, -0.62, s * 0.58, 0.16, 0.05, 0.1, '#8a7a5a'); }
      pb.ball(-0.1, -0.02, 0, 0.5, 0.06, 0.56, '#8a2a1a');
    });
    return (GEO[key] = S);
  }
  function rigQuad(S, root, ud) {
    const P = S.P, g = S.g, M = ud.meshes;
    const body = grp(root, 0, P.by, 0); ud.body = body;
    M.push(ud.torso = mesh(g.torso, VC, body));
    ud.tail = []; let par = body;
    for (let i = 0; i < g.tail.length; i++) { const m = mesh(g.tail[i], VC, par, i ? -S.tsl : P.tail.x, i ? 0 : P.tail.y, 0); M.push(m); ud.tail.push(m); par = m; }
    ud.necks = []; par = body;
    for (let i = 0; i < g.neck.length; i++) { const m = mesh(g.neck[i], VC, par, i ? S.nsl : P.neck.x, i ? 0 : P.neck.y, 0); M.push(m); ud.necks.push(m); par = m; }
    M.push(ud.head = mesh(g.head, VC, par, S.nsl, 0, 0));
    M.push(ud.jaw = mesh(g.jaw, VC, ud.head, -0.05, 0, 0));
    ud.legs = [];
    const defs = [[P.fl, 'f', 1, -1, 0], [P.fl, 'f', -1, -1, PI], [P.bl, 'b', 1, 1, PI], [P.bl, 'b', -1, 1, 0]];
    for (const [L, nm, s, dir, po] of defs) {
      const u = mesh(g[nm + 'u'], VC, root, L.x, L.y, s * L.z), l = mesh(g[nm + 'l'], VC, u, 0, -L.L[0], 0);
      M.push(u, l); ud.legs.push({ u, l, L, dir, po });
    }
    ud.mouth = { n: ud.head, x: 0.5, y: -0.15 };
    ud.seat = { n: body, x: 0, y: P.tr[1] + 0.06 };
    ud.neckBase = { n: ud.necks[0], x: 0.02, y: 0, r: P.neck.r0 * 1.12 };
    ud.side = P.tr[2];
  }
  function updQuad(ud, d, t, dt, def) {
    const S = ud.S, P = S.P, T = S.T, ph = d.anim || 0, id = d.id || 0, mv = ud.mv;
    const cd = def.cd || 1, atk = d.atkCd > 0 ? cl((d.atkCd / cd - 0.6) / 0.4, 0, 1) : 0, lunge = atk * atk;
    const bob = mv * Math.abs(Math.cos(ph)) * 0.03 + Math.sin(t * 1.6 + id) * 0.008;
    const body = ud.body, pitch = P.pitch || 0;
    body.position.y = P.by + bob; body.position.x = lunge * 0.15;
    body.rotation.z = pitch + mv * Math.sin(ph * 2) * 0.012; body.rotation.x = mv * Math.sin(ph) * 0.035;
    const br = 1 + Math.sin(t * 1.6 + id) * 0.02; ud.torso.scale.set(1, br, br);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    for (const G4 of ud.legs) {
      const L = G4.L, p = ph + G4.po, sn = Math.sin(p), lift = mv * Math.max(0, Math.cos(p));
      const hx = L.x * cp - (L.y - P.by) * sp + body.position.x, hy = P.by + bob + L.x * sp + (L.y - P.by) * cp;
      const fx = L.x + (L.x > 0 ? 0.04 : -0.02) + mv * sn * P.S, fy = lift * 0.2;
      ik2(hx, hy, fx, fy, L.L[0], L.L[1], G4.dir);
      G4.u.position.x = hx; G4.u.position.y = hy; G4.u.rotation.z = IK.a; G4.l.rotation.z = IK.b - IK.a;
    }
    // kuyruk
    const tw = d.moving ? ph * 0.5 : t * 1.1 + id, n = ud.tail.length, club = T === 'zirhli' && d.swing > 0 ? Math.sin(d.swing * 15) * 0.5 : 0;
    const amp = (T === 'uzunboyun' ? 0.16 : 0.1) * (0.6 + mv * 0.5);
    for (let i = 0; i < n; i++) { const m = ud.tail[i]; m.rotation.y = Math.sin(tw - i * 0.7) * amp * (0.5 + i * 0.3) + club * (0.4 + i * 0.25); m.rotation.z = (P.tail.dz[i] || 0) - (i === 0 ? pitch : 0) + Math.sin(t * 0.9 + i) * 0.015; }
    // boyun
    const nk = P.neck, nn = ud.necks.length, sw = Math.sin(t * 0.8 + id), sw2 = Math.sin(t * 0.37 + id * 2.1);
    const down = (T === 'boynuzlu' ? 0.55 : T === 'zirhli' ? 0.15 : T === 'uzunboyun' ? 0.5 : 0.35) * lunge;
    const graze = (T === 'ordek' || T === 'uzunboyun') ? 0 : 0;
    let tot = 0;
    for (let i = 0; i < nn; i++) {
      const m = ud.necks[i]; let a = (i ? nk.da : nk.a0 - pitch) + (mv ? Math.sin(ph + i * 0.5) * 0.02 : 0) + sw2 * 0.03 - down / nn - graze;
      m.rotation.z = a; tot += a; m.rotation.y = (T === 'uzunboyun' ? sw * 0.09 + sw2 * 0.05 : (1 - mv) * sw2 * 0.18 / nn);
    }
    ud.head.rotation.z = -(tot + pitch) + P.hp + Math.sin(t * 0.9 + id) * 0.05 - down * 0.5 + (mv ? Math.sin(ph) * 0.04 : 0);
    ud.head.rotation.y = (1 - mv) * sw2 * 0.2;
    ud.jawK += ((atk > 0 && T !== 'boynuzlu' ? 1 : 0) - ud.jawK) * Math.min(1, dt * 10);
    ud.jaw.rotation.z = -(ud.jawK * 0.35 + 0.03 + 0.03 * Math.sin(t * 2.6 + id));
    if (S.g.saddle) {
      const want = !!d.tamed && !d.pet;
      if (want && !ud.saddle) ud.saddle = mesh(S.g.saddle, VC, body, 0.05, P.tr[1] - 0.02, 0);
      if (ud.saddle) ud.saddle.visible = want;
    }
  }

  // =============================================================
  //  BATAKÇI (timsah)
  // =============================================================
  function crocSpec(colHex) {
    const key = 'croc|' + colHex;
    if (GEO[key]) return GEO[key];
    const c = { col: col(colHex), dk: shd(colHex, -0.4), bel: mix(shd(colHex, 0.35), '#c8c090', 0.4) };
    const S = { kind: 'croc', T: 'batakci', g: {}, P: {} }, g = S.g;
    g.torso = geo(key + 'torso', pb => {
      pb.ball(0, 0, 0, 0.98, 0.25, 0.44, c.col, { belly: c.bel, by: -0.1 });
      for (let i = 0; i < 8; i++) { const x = -0.82 + i * 0.23, f = Math.sqrt(Math.max(0.05, 1 - x * x / 0.96)); for (const z of [-0.12, 0.12]) pb.cone([x, 0.25 * f - 0.04, z], [x - 0.06, 0.25 * f + 0.09, z], 0.075, c.dk); if (i % 2) for (const z of [-0.3, 0.3]) pb.cone([x, 0.2 * f - 0.05, z * f], [x - 0.05, 0.2 * f + 0.04, z * f * 1.05], 0.06, c.dk); }
    });
    S.tsl = 0.33; g.tail = [];
    for (let i = 0; i < 5; i++) {
      const r0 = 0.24 * Math.pow(1 - i / 5, 0.8) + 0.01, r1 = i === 4 ? 0.012 : 0.24 * Math.pow(1 - (i + 1) / 5, 0.8) + 0.01;
      g.tail.push(geo(key + 'tail' + i, pb => { pb.tube([0.04, 0, 0], [-S.tsl, 0, 0], r0, r1, c.col, { n: 6, wz: i < 2 ? 1.2 : 0.7 }); pb.cone([-S.tsl * 0.2, r0 * 0.7, 0], [-S.tsl * 0.5, r0 + 0.1, 0], 0.06, c.dk); pb.cone([-S.tsl * 0.65, r0 * 0.6, 0], [-S.tsl * 0.95, r0 * 0.8 + 0.09, 0], 0.05, c.dk); }));
    }
    g.head = geo(key + 'head', pb => {
      pb.wedge(-0.15, 0.3, -0.02, 0.2, -0.02, 0.17, 0.3, 0.27, c.col);
      pb.wedge(0.3, 1.25, -0.02, 0.15, 0.0, 0.09, 0.25, 0.11, c.col);
      pb.wedge(1.1, 1.3, 0.0, 0.13, 0.0, 0.1, 0.13, 0.11, c.dk);
      pb.wedge(-0.05, 1.22, -0.035, -0.01, -0.015, 0.01, 0.24, 0.09, MAW);
      for (const s of [-1, 1]) { pb.ball(0.16, 0.2, s * 0.18, 0.1, 0.08, 0.07, c.dk, { d: 0 }); for (let i = 0; i < 7; i++) { const u = (i + 0.5) / 7, x = 0.32 + u * 0.92, w = 0.25 + (0.11 - 0.25) * u; pb.cone([x, 0.0, s * w * 0.96], [x, -0.1 - 0.04 * (i % 2), s * w * 0.98], 0.035, BONE, { n: 3 }); } }
    });
    g.jaw = geo(key + 'jaw', pb => {
      pb.wedge(-0.1, 1.2, -0.13, -0.02, -0.07, -0.02, 0.27, 0.09, c.bel);
      pb.wedge(0, 1.15, -0.03, 0.0, -0.03, 0.0, 0.22, 0.07, MAW);
      for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const u = (i + 0.5) / 6, x = 0.35 + u * 0.8, w = 0.24 + (0.09 - 0.24) * u; pb.cone([x, -0.02, s * w * 0.9], [x, 0.08, s * w * 0.9], 0.03, BONE, { n: 3 }); }
    });
    g.eyes = geo(key + 'eyes', pb => { for (const s of [-1, 1]) pb.ball(0.19, 0.235, s * 0.2, 0.05, 0.045, 0.045, '#fff', { d: 0 }); });
    S.eyeMat = glow(defOf('batakci').eye || '#cf6');
    g.leg = [];
    for (const s of [-1, 1]) g.leg.push(geo(key + 'leg' + s, pb => {
      pb.tube([0, 0, 0], [0.05, -0.02, s * 0.24], 0.11, 0.08, c.dk, { n: 5 });
      pb.tube([0.05, -0.02, s * 0.24], [0.1, -0.29, s * 0.3], 0.08, 0.06, c.dk, { n: 5 });
      for (const a of [-0.5, 0, 0.5]) pb.cone([0.1, -0.29, s * 0.3], [0.1 + Math.cos(a) * 0.17, -0.33, s * 0.3 + s * 0.06 + Math.sin(a) * 0.13], 0.04, c.dk);
    }));
    return (GEO[key] = S);
  }
  function rigCroc(S, root, ud) {
    const g = S.g, M = ud.meshes;
    const body = grp(root, 0, 0.34, 0); ud.body = body;
    M.push(ud.torso = mesh(g.torso, VC, body));
    ud.tail = []; let par = body;
    for (let i = 0; i < 5; i++) { const m = mesh(g.tail[i], VC, par, i ? -S.tsl : -0.82, i ? 0 : 0.0, 0); M.push(m); ud.tail.push(m); par = m; }
    M.push(ud.head = mesh(g.head, VC, body, 0.78, -0.06, 0));
    M.push(ud.jaw = mesh(g.jaw, VC, ud.head, 0, 0, 0));
    ud.eyes = mesh(g.eyes, S.eyeMat, ud.head);
    ud.legs = [];
    for (const [x, s, po] of [[0.52, -1, 0], [0.52, 1, PI], [-0.42, -1, PI], [-0.42, 1, 0]]) { const m = mesh(g.leg[s < 0 ? 0 : 1], VC, body, x, -0.02, s * 0.3); M.push(m); ud.legs.push({ m, s, po }); }
    ud.mouth = { n: ud.head, x: 0.8, y: -0.05 }; ud.seat = { n: body, x: 0, y: 0.26 }; ud.side = 0.44;
    ud.neckBase = null;
  }
  function updCroc(ud, d, t, dt, def) {
    const ph = d.anim || 0, id = d.id || 0, mv = ud.mv, cd = def.cd || 1;
    const atk = d.atkCd > 0 ? cl((d.atkCd / cd - 0.5) / 0.5, 0, 1) : 0;
    const open = atk > 0 || d.carry ? 1 : (d.st === 'lunge' ? 0.7 : 0);
    ud.jawK += (open - ud.jawK) * Math.min(1, dt * 18);
    const hid = d.hidden ? 1 : 0; ud.hidK += (hid - ud.hidK) * Math.min(1, dt * 4);
    const body = ud.body;
    body.position.y = 0.34 + mv * 0.05 - ud.hidK * 0.36 + Math.sin(t * 1.4 + id) * 0.006;
    body.rotation.y = mv * Math.sin(ph) * 0.07; body.rotation.z = ud.jawK * 0.06;
    for (const L of ud.legs) { const p = ph + L.po; L.m.rotation.y = -L.s * mv * Math.sin(p) * 0.55; L.m.rotation.x = -L.s * mv * Math.max(0, Math.cos(p)) * 0.3; L.m.position.y = -0.02 - mv * 0.05; }
    const sw = d.moving ? ph * 0.6 : t * 0.9 + id;
    for (let i = 0; i < 5; i++) { const m = ud.tail[i]; m.rotation.y = Math.sin(sw - i * 0.8) * (0.12 + mv * 0.2) * (0.6 + i * 0.2); m.rotation.z = i === 0 ? -0.06 : 0.02; }
    ud.head.rotation.z = ud.jawK * 0.4; ud.head.rotation.y = -body.rotation.y + (1 - mv) * Math.sin(t * 0.5 + id) * 0.1;
    ud.jaw.rotation.z = -ud.jawK * 0.5;
  }

  // =============================================================
  //  KANATLI (pterozor)
  // =============================================================
  const FLY_H = 85;
  function flySpec(colHex) {
    const key = 'fly|' + colHex;
    if (GEO[key]) return GEO[key];
    const c = { col: col(colHex), dk: shd(colHex, -0.45), m1: shd(colHex, -0.1), m2: shd(colHex, -0.3), bel: shd(colHex, 0.3) };
    const S = { kind: 'fly', T: 'kanatli', g: {}, P: {} }, g = S.g;
    g.torso = geo(key + 'torso', pb => {
      pb.ball(0, 0, 0, 0.7, 0.27, 0.3, c.col, { belly: c.bel, by: -0.08 });
      pb.tube([-0.6, 0, 0], [-1.0, 0.02, 0], 0.1, 0.01, c.col, { n: 4 });
      pb.tube([0.5, 0.05, 0], [0.92, 0.3, 0], 0.17, 0.11, c.col, { n: 5 });
    });
    g.head = geo(key + 'head', pb => {
      pb.wedge(-0.14, 0.2, -0.1, 0.12, -0.08, 0.1, 0.11, 0.1, c.col);
      pb.wedge(0.2, 1.0, -0.02, 0.1, 0.0, 0.015, 0.09, 0.012, '#c8b08a');
      pb.tri([0.12, 0.1, 0], [-0.62, 0.42, 0], [-0.1, 0.02, 0], '#b4502a'); pb.tri([0.12, 0.1, 0], [-0.3, 0.42, 0], [-0.62, 0.42, 0], '#8a3418');
      for (const s of [-1, 1]) pb.ball(0.08, 0.04, s * 0.105, 0.035, 0.035, 0.02, '#0c0a08', { d: 0 });
    });
    g.jaw = geo(key + 'jaw', pb => { pb.wedge(0, 0.92, -0.09, -0.03, -0.01, 0.0, 0.08, 0.012, '#b09870'); });
    g.wi = []; g.wo = [];
    for (const s of [-1, 1]) {
      g.wi.push(geo(key + 'wi' + s, pb => {
        pb.tube([0, 0, 0], [0.12, 0.03, s * 1.1], 0.06, 0.045, c.dk, { n: 4 });
        pb.quad([0.05, 0, 0], [0.12, 0.02, s * 1.1], [-0.72, 0, s * 1.0], [-0.7, 0, 0], c.m1);
        pb.tri([0.3, 0, s * 0.02], [0.12, 0.02, s * 1.1], [0.05, 0, 0], c.m2);
      }));
      g.wo.push(geo(key + 'wo' + s, pb => {
        pb.tube([0, 0, 0], [-0.3, 0, s * 1.25], 0.045, 0.012, c.dk, { n: 4 });
        pb.tri([0, 0, 0], [-0.3, 0, s * 1.25], [-0.84, -0.02, s * -0.1], c.m2);
        for (const a of [0, 0.5]) pb.cone([0.0, 0, 0], [0.12, -0.02 - a * 0.1, s * 0.06], 0.02, CLAW);
      }));
    }
    g.leg = geo(key + 'leg', pb => { pb.tube([0, 0, 0], [-0.1, -0.22, 0], 0.06, 0.04, c.dk, { n: 4 }); pb.tube([-0.1, -0.22, 0], [0, -0.42, 0], 0.04, 0.03, c.dk, { n: 4 }); for (const z of [-0.05, 0.05]) pb.cone([0, -0.42, 0], [0.14, -0.45, z], 0.025, CLAW); });
    return (GEO[key] = S);
  }
  function rigFly(S, root, ud) {
    const g = S.g, M = ud.meshes;
    const body = grp(root, 0, 0.45, 0); ud.body = body;
    M.push(ud.torso = mesh(g.torso, VC, body));
    M.push(ud.head = mesh(g.head, VC, body, 0.95, 0.33, 0));
    M.push(ud.jaw = mesh(g.jaw, VC, ud.head, 0.05, 0, 0));
    ud.wings = [];
    for (let i = 0; i < 2; i++) { const s = i ? 1 : -1, wi = mesh(g.wi[i], VC, body, 0.2, 0.12, s * 0.2), wo = mesh(g.wo[i], VC, wi, 0.12, 0.03, s * 1.1); M.push(wi, wo); ud.wings.push({ wi, wo, s }); }
    ud.legs = []; for (const s of [-1, 1]) { const m = mesh(g.leg, VC, body, -0.35, -0.12, s * 0.16); M.push(m); ud.legs.push(m); }
    ud.mouth = { n: ud.head, x: 0.6, y: -0.05 }; ud.seat = { n: body, x: 0, y: 0.28 }; ud.side = 0.3; ud.neckBase = null;
  }
  function updFly(ud, d, t, dt) {
    const id = d.id || 0, alt = cl(d.alt == null ? (d.fly === false ? 0 : 1) : d.alt, 0, 1), r = ud.r;
    const fp = (d.anim || 0) * (alt > 0.5 ? 1.2 : 0.3), flap = Math.sin(fp), air = cl(alt * 3, 0, 1);
    const body = ud.body;
    body.position.y = 0.45 + alt * (FLY_H / r) + air * (flap * -0.1 + Math.sin(t * 0.7 + id) * 0.25);
    body.rotation.z = (1 - air) * 0.55 + air * 0.05; body.rotation.x = air * Math.sin(t * 0.5 + id) * 0.15;
    for (const W of ud.wings) {
      const up = air * (0.12 + flap * 0.55) + (1 - air) * -1.25;
      W.wi.rotation.x = -W.s * up; W.wi.rotation.y = (1 - air) * W.s * 0.5;
      W.wo.rotation.x = -W.s * (air * (Math.sin(fp - 0.7) * 0.5 - 0.1) + (1 - air) * -0.4); W.wo.rotation.y = (1 - air) * W.s * -2.0;
    }
    ud.head.rotation.z = -body.rotation.z - air * 0.25 + Math.sin(t * 1.3 + id) * 0.05; ud.head.rotation.y = Math.sin(t * 0.6 + id) * 0.3 * (1 - air * 0.6);
    const open = d.atkCd > 0.5 ? 1 : 0; ud.jawK += (open - ud.jawK) * Math.min(1, dt * 12); ud.jaw.rotation.z = -ud.jawK * 0.45 - 0.03;
    for (const L of ud.legs) L.rotation.z = air * -1.1 - (1 - air) * body.rotation.z;
  }

  // =============================================================
  //  TAKLİTÇİ (açığa çıkmış hali) — dünya biriminde, ~54 boy
  // =============================================================
  function mimicSpec() {
    if (GEO.mimic) return GEO.mimic;
    const sk = '#d8d0c8', dk = '#8a7f7a', g = {};
    g.torso = geo('mm_torso', pb => {
      pb.tube([0, 0, 0], [0.6, 7, 0], 2.2, 1.5, sk, { n: 6, wz: 1.3 });
      pb.ball(1.6, 11.5, 0, 3.0, 5.6, 4.6, sk);
      for (let i = 0; i < 5; i++) { const y = 8 + i * 1.7, f = Math.sqrt(Math.max(0.1, 1 - Math.pow((y - 11.5) / 5.6, 2))); pb.ball(1.6, y, 0, 3.0 * f * 1.05, 0.22, 4.6 * f * 1.05, '#6a5656'); }
      for (let i = 0; i < 7; i++) pb.cone([-0.9 + i * 0.07, 1.5 + i * 2.2, 0], [-2.2 + i * 0.07, 2.3 + i * 2.2, 0], 0.55, dk);
      pb.tube([2.2, 15.5, 0], [4.6, 20, 0], 1.3, 0.95, sk, { n: 5 });
      for (const s of [-1, 1]) pb.ball(1.2, 15.6, s * 4.6, 1.5, 1.4, 1.6, sk, { d: 0 });
      pb.ball(0.2, 0, 0, 2.5, 1.8, 3.3, dk, { d: 0 });
    });
    g.half = [];
    for (const s of [-1, 1]) g.half.push(geo('mm_half' + s, pb => {
      pb.ball(1.0, 3.6, 0, 3.6, 4.4, 3.3, '#e8e2da', { half: s });
      pb.quad([-2.4, 0, s * 0.05], [4.4, 0.4, s * 0.05], [4.2, 6.6, s * 0.05], [-1.8, 7.6, s * 0.05], '#3a0808');
      for (let i = 0; i < 7; i++) { const y = 1.0 + i * 0.95; pb.cone([3.6 - Math.abs(i - 3) * 0.12, y, s * 0.3], [3.9, y + 0.2, s * -0.9 - s * (i % 2) * 0.5], 0.3, '#f4f0e4', { n: 3 }); if (i % 2) pb.cone([1.4, y, s * 0.3], [1.6, y, s * -0.6], 0.22, '#f4f0e4', { n: 3 }); }
      pb.ball(0.6, 3.2, s * 1.2, 1.5, 2.4, 0.8, '#7a1212', { d: 0 });
    }));
    g.eye = []; for (const s of [-1, 1]) g.eye.push(geo('mm_eye' + s, pb => pb.ball(3.2, 5.0, s * 2.35, 0.55, 0.55, 0.4, '#fff', { d: 0 })));
    g.maw = geo('mm_maw', pb => { pb.ball(0.6, 1.2, 0, 1.6, 1.6, 1.5, '#2a0505', { d: 0 }); pb.tube([0.8, 1.5, 0], [3.4, 4.2, 0], 0.55, 0.12, '#8a1a1a', { n: 4 }); });
    g.uarm = geo('mm_uarm', pb => { pb.tube([0, 0, 0], [0, -13, 0], 0.95, 0.7, sk, { n: 5 }); pb.ball(0, -13, 0, 0.95, 0.95, 0.95, dk, { d: 0 }); });
    g.farm = geo('mm_farm', pb => pb.tube([0, 0, 0], [0, -14, 0], 0.75, 0.5, sk, { n: 5 }));
    g.hand = geo('mm_hand', pb => { pb.ball(0, -0.8, 0, 0.9, 1.3, 1.1, dk, { d: 0 }); for (let k = -1.5; k <= 1.5; k++) { pb.tube([0, -1.5, k * 0.5], [0.5, -4.8, k * 1.0], 0.28, 0.2, sk, { n: 3 }); pb.cone([0.5, -4.8, k * 1.0], [1.6, -8.4, k * 1.25], 0.22, '#1a1414', { n: 3 }); } });
    g.thigh = geo('mm_thigh', pb => { pb.tube([0, 0.5, 0], [0, -13.5, 0], 1.3, 0.85, sk, { n: 5 }); pb.ball(0, -13.5, 0, 1.05, 1.05, 1.05, dk, { d: 0 }); });
    g.shin = geo('mm_shin', pb => { pb.tube([0, 0, 0], [0, -12.6, 0], 0.85, 0.55, sk, { n: 5 }); pb.wedge(-1.0, 4.2, -13.5, -12.2, -13.5, -13.0, 1.0, 1.3, dk); for (const z of [-0.8, 0, 0.8]) pb.cone([4.0, -13.1, z], [5.6, -13.5, z * 1.3], 0.3, '#1a1414', { n: 3 }); });
    return (GEO.mimic = { g, eyeMat: glow('#ff2a1a') });
  }
  function rigMimic(root, ud) {
    const S = mimicSpec(), g = S.g, M = ud.meshes, o = {};
    o.root = grp(root, 0, 0, 0);
    M.push(o.torso = mesh(g.torso, VC, o.root, 0, 27, 0));
    o.head = grp(o.torso, 4.6, 19.6, 0);
    M.push(o.maw = mesh(g.maw, VC, o.head));
    o.half = []; for (let i = 0; i < 2; i++) { const h = mesh(g.half[i], VC, o.head); M.push(h); mesh(g.eye[i], S.eyeMat, h); o.half.push(h); }
    o.arms = []; o.legs = [];
    for (const s of [-1, 1]) {
      const u = mesh(g.uarm, VC, o.torso, 1.2, 15.6, s * 5.2), f = mesh(g.farm, VC, u, 0, -13, 0), h = mesh(g.hand, VC, f, 0, -14, 0); M.push(u, f, h); o.arms.push({ u, f, h, s });
      const th = mesh(g.thigh, VC, o.root, 0, 27, s * 2.3), sh = mesh(g.shin, VC, th, 0, -13.5, 0); M.push(th, sh); o.legs.push({ th, sh });
    }
    o.root.scale.setScalar(1.02);
    return o;
  }
  function updMimic(o, d, t) {
    const ph = d.anim || 0, mv = d.moving ? 1 : 0, s = Math.sin(ph), id = d.id || 0, at = d.swing > 0 ? cl(d.swing / 0.3, 0, 1) : 0;
    const jit = Math.sin(t * 31 + id) * Math.sin(t * 7.3) > 0.7 ? 1 : 0;
    o.torso.position.y = 27 + (mv ? Math.abs(Math.cos(ph)) * 0.8 : Math.sin(t * 1.3) * 0.3) - 1.0;
    o.torso.rotation.z = -0.3 - at * 0.25 + Math.sin(t * 0.9 + id) * 0.03; o.torso.rotation.x = Math.sin(t * 0.6 + id) * 0.05 + jit * 0.06;
    o.head.rotation.z = 0.15 + at * 0.2 + jit * 0.12; o.head.rotation.x = Math.sin(t * 1.7 + id) * 0.18 + jit * 0.3; o.head.rotation.y = Math.sin(t * 0.8 + id) * 0.25;
    const open = 0.2 + 0.14 * Math.sin(t * 12) + at * 0.75 + 0.1 * Math.sin(t * 2.1);
    o.half[0].rotation.x = -open; o.half[1].rotation.x = open;
    for (let i = 0; i < 2; i++) {
      const L = o.legs[i], sg = i ? -1 : 1, a = mv * s * sg * 0.55 + 0.22;
      L.th.rotation.z = a; L.sh.rotation.z = -0.4 - mv * Math.max(0, -Math.cos(ph) * sg) * 0.7 - (a > 0 ? a * 0.3 : 0);
      L.th.position.y = o.torso.position.y;
      const A = o.arms[i];
      A.u.rotation.z = 0.75 + at * 0.85 - mv * s * sg * 0.25 + Math.sin(t * 1.1 + i * 2) * 0.06; A.u.rotation.x = A.s * (0.12 + at * -0.2);
      A.f.rotation.z = 0.75 - at * 0.6 + Math.sin(t * 1.9 + i) * 0.1; A.h.rotation.z = 0.5 + Math.sin(t * 6 + i * 3) * 0.2;
    }
  }

  // =============================================================
  //  İNSANLAR — dünya biriminde, boy 34
  // =============================================================
  const PGEO = {};
  function pgeo() {
    if (PGEO.torso) return PGEO;
    const W = '#ffffff', P = PGEO;
    P.torso = geo('p_torso', pb => {
      pb.tube([0, 0.5, 0], [0, 11.6, 0], 2.7, 3.0, W, { n: 6, wz: 1.55 });
      pb.tube([0, -4.2, 0], [0, 1.0, 0], 3.3, 2.85, '#dcdcdc', { n: 6, wz: 1.4 });
      pb.tube([0, 0.6, 0], [0, 1.7, 0], 2.95, 2.95, '#6a6a6a', { n: 6, wz: 1.5 });
      pb.ball(0, 11.4, 0, 2.9, 1.5, 5.3, W, { d: 0 });
      pb.wedge(2.3, 3.1, 7.0, 11.5, 7.6, 11.2, 1.0, 0.6, '#b8b8b8');
    });
    P.head = geo('p_head', pb => {
      pb.tube([0, -1.0, 0], [0, 1.2, 0], 1.35, 1.25, '#d8d8d8', { n: 5 });
      pb.ball(0.2, 3.5, 0, 3.15, 3.5, 3.0, W);
      pb.wedge(3.0, 3.9, 2.6, 3.8, 2.7, 3.1, 0.5, 0.3, '#dddddd');
      for (const s of [-1, 1]) { pb.ball(2.95, 4.15, s * 1.25, 0.4, 0.5, 0.55, '#1c1c1c', { d: 0 }); pb.ball(0.2, 3.4, s * 3.0, 0.7, 0.9, 0.4, '#d0d0d0', { d: 0 }); }
      pb.box(3.05, 1.75, 0, 0.5, 0.3, 1.5, '#7a5a5a');
    });
    P.hair = [
      geo('p_hair0', pb => { pb.ball(-0.5, 4.55, 0, 3.3, 2.95, 3.3, W); pb.ball(-1.6, 3.0, 0, 2.4, 2.6, 3.2, W, { d: 0 }); }),
      geo('p_hair1', pb => { pb.ball(-0.5, 4.55, 0, 3.35, 2.95, 3.35, W); pb.ball(-1.7, 1.6, 0, 2.3, 3.6, 3.3, W); }),
      geo('p_hair2', pb => { pb.ball(-0.5, 4.55, 0, 3.3, 2.9, 3.3, W); pb.ball(-3.4, 5.4, 0, 1.6, 1.6, 1.6, W, { d: 0 }); pb.ball(-1.6, 3.0, 0, 2.3, 2.5, 3.15, W, { d: 0 }); })
    ];
    P.uarm = geo('p_uarm', pb => { pb.tube([0, 0.4, 0], [0, -6.2, 0], 1.5, 1.2, W, { n: 5 }); pb.ball(0, 0.2, 0, 1.6, 1.5, 1.6, W, { d: 0 }); });
    P.farm = geo('p_farm', pb => { pb.tube([0, 0, 0], [0, -5.4, 0], 1.12, 0.92, W, { n: 5 }); pb.ball(0, -6.1, 0, 1.15, 1.35, 1.2, '#f2f2f2', { d: 0 }); });
    P.thigh = geo('p_thigh', pb => pb.tube([0, 0.5, 0], [0, -7.6, 0], 1.95, 1.5, W, { n: 5 }));
    P.shin = geo('p_shin', pb => { pb.tube([0, 0, 0], [0, -6.6, 0], 1.45, 1.1, '#ffe8d8', { n: 5 }); pb.wedge(-1.3, 3.2, -7.9, -6.2, -7.9, -7.0, 1.25, 1.2, '#55504a'); });
    P.pack = geo('p_pack', pb => { pb.box(0, 0, 0, 3.4, 6.4, 6.2, W); pb.box(0, 3.4, 0, 2.6, 1.2, 5.0, '#b0b0b0'); pb.box(1.4, 0.5, 2.2, 0.8, 7.0, 0.7, '#555'); pb.box(1.4, 0.5, -2.2, 0.8, 7.0, 0.7, '#555'); });
    P.basket = geo('p_basket', pb => { pb.tube([0, -3.2, 0], [0, 3.2, 0], 2.0, 3.0, '#b89858', { n: 7 }); pb.tube([0, 2.6, 0], [0, 3.3, 0], 3.15, 3.15, '#8a6a34', { n: 7 }); pb.tube([0, -0.4, 0], [0, 0.2, 0], 2.62, 2.68, '#8a6a34', { n: 7 }); });
    P.basketFill = geo('p_bfill', pb => pb.ball(0, 3.2, 0, 2.6, 1.3, 2.6, W, { d: 0 }));
    P.cloak = geo('p_cloak', pb => {
      const xs = [-3.0, -4.2, -5.6], ys = [11.6, 3, -7.5], ws = [5.2, 6.4, 7.6];
      for (let i = 0; i < 2; i++) for (let j = 0; j < 4; j++) { const z0 = -1 + j * 0.5, z1 = z0 + 0.5, bow = z => -1.4 * (1 - z * z); pb.quad([xs[i] - bow(z0) * 0 + (1 - z0 * z0) * -0.8, ys[i], z0 * ws[i]], [xs[i] + (1 - z1 * z1) * -0.8, ys[i], z1 * ws[i]], [xs[i + 1] + (1 - z1 * z1) * -0.8, ys[i + 1], z1 * ws[i + 1]], [xs[i + 1] + (1 - z0 * z0) * -0.8, ys[i + 1], z0 * ws[i + 1]], (i + j) % 2 ? '#5a1c0e' : '#6a2412'); }
      pb.ball(0, 11.7, 0, 3.3, 1.5, 5.7, '#3a0e06', { d: 0 }); pb.ball(2.9, 11.0, 0, 0.7, 0.8, 0.8, '#d8b050', { d: 0 });
      for (let j = 0; j < 4; j++) { const z = (-0.75 + j * 0.5) * 7.6; pb.tri([-6.4, -7.5, z - 1.9], [-6.4, -7.5, z + 1.9], [-6.6, -10.2, z], '#3a0e06'); }
    });
    P.band = geo('p_band', pb => { pb.tube([0.1, 5.0, 0], [0.1, 6.0, 0], 3.3, 3.2, '#c8402a', { n: 8 }); pb.tri([-3.0, 5.6, 0.5], [-5.6, 4.0, 1.4], [-4.6, 2.2, 0.2], '#c8402a'); pb.tri([-3.0, 5.6, -0.3], [-5.0, 2.6, -1.4], [-4.0, 1.6, -0.6], '#a03020'); pb.cone([-1.0, 5.8, 2.6], [-2.6, 10.6, 3.4], 0.55, '#e8dcc0', { n: 3 }); pb.cone([-1.4, 5.8, 2.9], [-3.6, 9.2, 3.9], 0.5, '#8a3018', { n: 3 }); });
    P.armor = geo('p_armor', pb => { pb.tube([0, 2.2, 0], [0, 11.3, 0], 3.05, 3.4, '#8a6a3a', { n: 6, wz: 1.52 }); for (let i = 0; i < 3; i++) pb.tube([0, 3.4 + i * 2.9, 0], [0, 4.0 + i * 2.9, 0], 3.3 + i * 0.1, 3.3 + i * 0.1, '#5a4024', { n: 6, wz: 1.52 }); for (const s of [-1, 1]) pb.ball(0, 11.6, s * 5.0, 2.2, 1.3, 2.2, '#6a4a2a', { d: 0 }); });
    // --- yamyam
    const ASH = '#b9b0a2';
    P.ctorso = geo('p_ctorso', pb => {
      pb.tube([0, 0.5, 0], [0, 11.6, 0], 2.5, 2.9, ASH, { n: 6, wz: 1.55 });
      pb.ball(0, 11.4, 0, 2.8, 1.5, 5.3, ASH, { d: 0 });
      pb.tube([0, -5.0, 0], [0, 1.2, 0], 3.5, 2.8, '#2a1e16', { n: 6, wz: 1.35 });
      for (let j = 0; j < 5; j++) { const z = (j - 2) * 1.5; pb.tri([2.9, -5.0, z - 0.9], [2.9, -5.0, z + 0.9], [3.1, -7.4, z], '#3a2a1c'); }
      for (let i = 0; i < 4; i++) pb.box(2.75, 4.2 + i * 1.6, 0, 0.5, 0.45, 6.4 - i * 0.5, '#2a2220');           // kömürle çizilmiş kaburgalar
      pb.box(2.9, 7.0, 0, 0.5, 7.0, 0.6, '#2a2220');
      for (let i = -2; i <= 2; i++) pb.cone([2.9, 11.2 - Math.abs(i) * 0.5, i * 1.25], [3.5, 9.0 - Math.abs(i) * 0.5, i * 1.3], 0.42, BONE, { n: 3 }); // diş kolye
      pb.box(-2.6, 8.4, 2.0, 0.5, 2.6, 2.0, '#8a1a12', 0.2); pb.box(-2.6, 6.0, -1.8, 0.5, 2.0, 1.8, '#8a1a12', -0.2);
    });
    P.chead = geo('p_chead', pb => {
      pb.tube([0, -1.0, 0], [0, 1.2, 0], 1.3, 1.2, ASH, { n: 5 });
      pb.ball(0, 3.5, 0, 3.1, 3.4, 3.0, '#a69c8e');
      pb.ball(-0.8, 4.6, 0, 3.2, 3.0, 3.3, '#15100c');                                                      // keçeleşmiş saç
      for (let i = 0; i < 5; i++) pb.cone([-2.4, 4 + (i % 2), (i - 2) * 1.2], [-4.6, 0.4 - (i % 3), (i - 2) * 1.6], 0.7, '#15100c', { n: 3 });
      // kemik maske (hayvan kafatası)
      pb.wedge(2.2, 3.7, 1.6, 7.0, 2.4, 6.4, 2.7, 2.3, BONE);
      pb.wedge(2.6, 4.2, -2.6, 1.8, -2.0, 2.4, 1.9, 1.3, '#dcd2ba');
      pb.wedge(3.5, 4.6, -3.2, -1.2, -2.8, -1.6, 1.0, 0.7, '#cfc4a8');
      for (const s of [-1, 1]) {
        pb.ball(3.55, 4.5, s * 1.25, 0.5, 0.95, 0.8, '#050404', { d: 0 });
        pb.tube([2.6, 6.6, s * 1.9], [1.6, 9.6, s * 3.6], 0.55, 0.35, '#cfc4a8', { n: 4 }); pb.cone([1.6, 9.6, s * 3.6], [2.6, 12.0, s * 3.0], 0.35, BONE);
        pb.box(3.72, 5.9, s * 1.3, 0.2, 0.9, 0.45, '#b02020');
        for (let i = 0; i < 3; i++) pb.cone([4.0, -2.9 + i * 0.1, s * (0.25 + i * 0.3)], [4.1, -4.2, s * (0.25 + i * 0.3)], 0.2, BONE, { n: 3 });
      }
      pb.box(4.15, 0.6, 0, 0.2, 3.2, 0.4, '#b02020'); pb.ball(4.1, 0.9, 0, 0.3, 0.7, 0.5, '#050404', { d: 0 });
    });
    return P;
  }
  // --- aletler: tutma noktası orijinde, +X yönünde uzanır
  const TOOLS = {
    spear1: pb => spearG(pb, '#b89060'), spear2: pb => spearG(pb, '#9a9a9a'), spear3: pb => spearG(pb, '#eee6d0', true),
    bow: pb => { const N = 6, R = 10; for (let i = 0; i < N; i++) { const a0 = -1.3 + i * 2.6 / N, a1 = a0 + 2.6 / N; pb.tube([Math.cos(a0) * R - R * 0.6, Math.sin(a0) * R, 0], [Math.cos(a1) * R - R * 0.6, Math.sin(a1) * R, 0], 0.45, 0.45, '#7a5a2a', { n: 4 }); } pb.tube([Math.cos(1.3) * R - R * 0.6, -Math.sin(1.3) * R, 0], [Math.cos(1.3) * R - R * 0.6, Math.sin(1.3) * R, 0], 0.1, 0.1, '#e6dcc8', { n: 3 }); },
    axe: pb => axeG(pb, '#7a6a5a'), axe2: pb => axeG(pb, '#a4a4a4'),
    pick: pb => { pb.tube([-3, 0, 0], [10, 0, 0], 0.5, 0.45, '#6a4a2a', { n: 4 }); pb.tube([9.5, 0, 0], [8.0, 4.6, 0], 0.7, 0.12, '#999', { n: 4 }); pb.tube([9.5, 0, 0], [8.0, -4.6, 0], 0.7, 0.12, '#999', { n: 4 }); },
    knife: pb => { pb.tube([-1.5, 0, 0], [2, 0, 0], 0.5, 0.5, '#5a3a1a', { n: 4 }); pb.wedge(2, 8, -0.9, 0.5, -0.1, 0.3, 0.14, 0.08, '#cccccc'); },
    hammer: pb => { pb.tube([-2.5, 0, 0], [8, 0, 0], 0.48, 0.45, '#6a4a2a', { n: 4 }); pb.box(8, 0, 0, 2.4, 4.6, 2.4, '#777'); },
    sickle: pb => { pb.tube([-2, 0, 0], [5, 0, 0], 0.48, 0.45, '#6a4a2a', { n: 4 }); let px = 5, py = 0; for (let i = 1; i <= 5; i++) { const a = -1.2 + i * 0.62, nx = 7.5 + Math.cos(a - PI / 2) * 3.6, ny = 3.4 + Math.sin(a - PI / 2) * 3.6; pb.tube([px, py, 0], [nx, ny, 0], 0.4, 0.3 - i * 0.04, '#aaa', { n: 3, wz: 0.4 }); px = nx; py = ny; } },
    club: pb => { pb.tube([-3, 0, 0], [7, 0, 0], 0.55, 0.9, BONE, { n: 5 }); pb.ball(-3.4, 0, 0, 1.0, 1.0, 1.0, '#dcd2ba', { d: 0 }); pb.tube([7, 0, 0], [15, 0, 0], 1.0, 1.9, '#3a2a1c', { n: 5 }); pb.ball(15, 0, 0, 2.0, 2.0, 2.0, '#33241a', { d: 0 }); for (let i = 0; i < 6; i++) { const a = i * 1.05, x = 10.5 + (i % 3) * 2.0; pb.cone([x, Math.cos(a) * 1.2, Math.sin(a) * 1.2], [x + 0.6, Math.cos(a) * 3.8, Math.sin(a) * 3.8], 0.5, BONE, { n: 3 }); } pb.box(12, 0, 0, 2.2, 3.5, 3.5, '#5a1010', 0.4, 0.3); },
    torch: pb => { pb.tube([-3, 0, 0], [7, 0, 0], 0.5, 0.6, '#5a3a1a', { n: 4 }); pb.tube([6, 0, 0], [8.5, 0, 0], 0.9, 1.0, '#2a1a10', { n: 5 }); }
  };
  function spearG(pb, tip, bone) { pb.tube([-15, 0, 0], [18, 0, 0], 0.5, 0.42, '#6a4520', { n: 4 }); pb.tube([16.5, 0, 0], [18.5, 0, 0], 0.7, 0.7, '#3a2a1a', { n: 4 }); pb.tube([18, 0, 0], [26.5, 0, 0], bone ? 1.25 : 1.5, 0.05, tip, { n: 4, wz: 0.4 }); if (bone) for (const s of [-1, 1]) pb.cone([19.5, 0, 0], [18, s * 2.2, 0], 0.4, tip, { n: 3 }); }
  function axeG(pb, k) { pb.tube([-3, 0, 0], [10, 0, 0], 0.5, 0.45, '#6a4a2a', { n: 4 }); pb.wedge(7.2, 10.6, -0.4, 0.4, -4.4, -0.6, 0.55, 0.12, k); pb.wedge(7.6, 10.2, -0.3, 1.3, -0.2, 1.0, 0.6, 0.5, k); }
  function toolGeo(k) { return geo('tool_' + k, TOOLS[k]); }
  let FLAME = null;
  function flameGeo() { return FLAME || (FLAME = geo('flame', pb => { pb.ball(0, 0, 0, 1.5, 2.2, 1.5, '#fff', { d: 0 }); pb.cone([0, 1.2, 0], [0.4, 4.6, 0], 1.0, '#fff'); })); }

  const BAGCOL = { wood: '#7a5028', stone: '#999999', crystal: '#77aacc', herb: '#55aa55', poison: '#aa55cc', food: '#aa3333' };
  const ARMED = { muhafiz: 1, takip: 1, avci: 1 };
  const WTOOL = { odun: 'axe', tas: 'pick', kasap: 'knife', zanaat: 'hammer', mimar: 'hammer', ciftci: 'sickle' };
  function tunicOf(p) {
    if (p.downed > 0) return '#5a5050';
    if (p.leader) return '#8a3a1a';
    if (p.child) return '#b89a6a';
    const GR = typeof GROUPS !== 'undefined' ? GROUPS : null;
    return (GR && (GR[p.group] || GR.bos) || { col: '#555' }).col;
  }
  function toolOf(p, working) {
    const eq = p.eq || {};
    if (p.cannibal) return 'club';
    if (p.child) return null;
    if (working && WTOOL[p.group]) return p.group === 'odun' && eq.balta ? 'axe2' : WTOOL[p.group];
    if (p.leader || ARMED[p.group]) {
      const shooting = p.leader && typeof G !== 'undefined' && G && G.shootCd > 0.3;
      if (eq.yay && (p.group === 'avci' || shooting)) return 'bow';
      return eq.kemikMizrak ? 'spear3' : eq.mizrak ? 'spear2' : 'spear1';
    }
    if (p.group === 'odun') return eq.balta ? 'axe2' : 'axe';
    if (p.group === 'tas') return 'pick';
    return null;
  }

  function person(p) {
    p = p || {};
    const PG = pgeo(), g = new T3.Group(), root = grp(g), ud = g.userData;
    ud.kind = 'person'; ud.root = root; ud.can = !!p.cannibal; ud.lt = -1; ud.lie = 0; ud.thr = 0;
    const can = ud.can;
    ud.torso = mesh(can ? PG.ctorso : PG.torso, VC, root, 0, 15.5, 0);
    ud.head = mesh(can ? PG.chead : PG.head, VC, ud.torso, 0, 12.3, 0);
    if (!can) ud.hair = mesh(PG.hair[(p.id || 0) % 3], VC, ud.head);
    ud.arms = []; ud.legs = [];
    for (const s of [-1, 1]) {
      const u = mesh(PG.uarm, VC, ud.torso, 0, 11.0, s * 5.7), f = mesh(PG.farm, VC, u, 0, -6.2, 0);
      ud.arms.push({ u, f, s });
      const th = mesh(PG.thigh, VC, root, 0, 15.5, s * 2.15), sh = mesh(PG.shin, VC, th, 0, -7.6, 0);
      ud.legs.push({ th, sh });
    }
    ud.tool = mesh(toolGeo('spear1'), VC, ud.arms[1].f, 0.3, -6.0, 0.2); ud.tool.visible = false; ud.toolK = null;
    look(ud, p, false);
    updPerson(g, p, 0);
    return g;
  }
  function look(ud, p, working) {
    const PG = PGEO, can = ud.can;
    const skin = can ? '#b9b0a2' : (p.skin || '#d8a47a'), hair = p.hair || '#2a1a10', tun = can ? '#2a1e16' : tunicOf(p), hurt = p.hurtT > 0;
    const key = skin + hair + tun + (hurt ? 1 : 0);
    if (ud.lk !== key) {
      ud.lk = key;
      const mSkin = hurt && can ? FLASH : tint(skin), mTun = hurt ? FLASH : tint(tun), mSl = hurt ? FLASH : tint('#' + shd(tun, -0.14).getHexString()), mPant = can ? mSkin : tint('#' + shd(tun, -0.45).getHexString());
      if (can) { ud.torso.material = hurt ? FLASH : VC; ud.head.material = hurt ? FLASH : VC; }
      else { ud.torso.material = mTun; ud.head.material = tint(skin); ud.hair.material = tint(hair); }
      for (const A of ud.arms) { A.u.material = can ? mSkin : mSl; A.f.material = mSkin; }
      for (const L of ud.legs) { L.th.material = mPant; L.sh.material = can ? mSkin : mPant; }
    }
    // alet
    const tk = toolOf(p, working);
    if (tk !== ud.toolK) { ud.toolK = tk; ud.tool.visible = !!tk; if (tk) ud.tool.geometry = toolGeo(tk); }
    // sırt yükü / sepet
    const eq = p.eq || {}, carry = p.carry > 0, bk = eq.sepet ? 2 : carry ? 1 : 0;
    if (bk !== (ud.bk || 0) || (carry && !ud.pack)) {
      ud.bk = bk;
      if (bk && !ud.pack) ud.pack = mesh(PG.pack, VC, ud.torso, -4.1, 7.2, 0);
      if (ud.pack) { ud.pack.visible = !!bk; ud.pack.geometry = bk === 2 ? PG.basket : PG.pack; ud.pack.position.x = bk === 2 ? -5.2 : -4.1; }
      if (bk === 2 && !ud.fill) ud.fill = mesh(PG.basketFill, VC, ud.pack);
    }
    if (ud.pack && ud.pack.visible) {
      let bc = '#ccbbaa'; if (carry && p.bag) { for (const k in p.bag) { bc = BAGCOL[k] || bc; break; } }
      if (ud.bc !== bc + bk) { ud.bc = bc + bk; if (bk === 2) ud.pack.material = VC; else ud.pack.material = tint(bc); if (ud.fill) ud.fill.material = tint(bc); }
      if (ud.fill) ud.fill.visible = bk === 2 && carry;
    }
    // lider: pelerin + alın bandı
    if (!!p.leader !== !!ud.ldr) {
      ud.ldr = !!p.leader;
      if (ud.ldr && !ud.cloak) { ud.cloak = mesh(PG.cloak, VC, ud.torso); ud.band = mesh(PG.band, VC, ud.head); }
      if (ud.cloak) ud.cloak.visible = ud.band.visible = ud.ldr;
    }
    const arm = !!eq.zirh && !can;
    if (arm !== !!ud.arm) { ud.arm = arm; if (arm && !ud.armor) ud.armor = mesh(PG.armor, VC, ud.torso); if (ud.armor) ud.armor.visible = arm; }
    // meşale
    const torch = !!(p.torch || (p.leader && typeof G !== 'undefined' && G && G.torchOn));
    if (torch !== !!ud.tch) {
      ud.tch = torch;
      if (torch && !ud.torch) { ud.torch = mesh(toolGeo('torch'), VC, ud.arms[0].f, 0.3, -6.0, -0.2); ud.flame = mesh(flameGeo(), glow('#ff9030'), ud.torch, 9.5, 0, 0); ud.flame.rotation.z = -PI / 2; }
      if (ud.torch) ud.torch.visible = torch;
    }
  }
  function updPerson(g, p, t) {
    const ud = g && g.userData; if (!ud || ud.kind !== 'person') return;
    p = p || {}; t = t || 0;
    const dt = ud.lt < 0 ? 0.016 : cl(t - ud.lt, 0, 0.1); ud.lt = t;
    const id = p.id || 0, mvB = !!p.moving, ph = p.anim || 0, s = Math.sin(ph), c = Math.cos(ph), can = ud.can;
    const lying = p.downed > 0 || !!p.bed || !!p.carriedBy || !!p.dead || !!p.grabbed;
    const working = !lying && !mvB && !p.child && p.work > 0.05 && !can;
    look(ud, p, working);
    const root = ud.root, sc = p.child ? 0.6 : can ? 1.04 : 1;
    if (ud.sc !== sc) { ud.sc = sc; root.scale.setScalar(sc); if (ud.head) ud.head.scale.setScalar(p.child ? 1.3 : 1); }
    const A = ud.arms, Lg = ud.legs, torso = ud.torso, head = ud.head;
    let aL = 0, eL = 0.15, aR = 0, eR = 0.15, xL = 0, xR = 0, lean = 0, hz = 0, hy = 0, toolPsi = null, toolLoc = 0;
    if (lying) {
      const yaw = p.bed ? 0 : (id % 3) * 0.4 - 0.4, lift = p.carriedBy ? 24 : p.grabbed ? 20 : 2.9;
      const flail = (p.grabbed && !p.dead) ? 1 : 0, alive = p.dead ? 0 : 1;
      root.rotation.set(0, yaw, PI / 2);
      root.position.set(Math.cos(yaw) * 17 * sc, lift * (lift < 3 ? sc : 1), -Math.sin(yaw) * 17 * sc);
      torso.position.y = 15.5; torso.rotation.set(0, 0, p.carriedBy ? 0.25 : 0);
      head.rotation.set(flail * Math.sin(t * 9 + id) * 0.3, alive * Math.sin(t * 0.7 + id) * 0.15 + (id % 2 ? 0.5 : -0.5) * (1 - flail), p.carriedBy ? 0.3 : -0.1);
      const wv = p.downed > 0 && !p.dead ? Math.sin(t * 3 + id) : 0;
      A[0].u.rotation.set(-0.9 - wv * 0.25 - flail * Math.sin(t * 11) * 0.6, 0, 1.3 + wv * 0.5 + flail * Math.sin(t * 13 + 1) * 0.8); A[0].f.rotation.z = 0.5 + wv * 0.4;
      A[1].u.rotation.set(0.5 + flail * Math.sin(t * 12 + 2) * 0.6, 0, -0.2 + flail * Math.sin(t * 10) * 0.8); A[1].f.rotation.z = 0.4;
      for (let i = 0; i < 2; i++) { const L = Lg[i]; L.th.position.y = 15.5; L.th.rotation.set(0, 0, (i ? 0.12 : 0.55) * (p.carriedBy ? 2 : 1) + flail * Math.sin(t * 12 + i * 3) * 0.7); L.sh.rotation.z = -(i ? 0.2 : 0.95) - flail * 0.4; L.th.rotation.x = (i ? 0.12 : -0.2); }
      if (ud.tool) ud.tool.visible = false; ud.toolK = undefined;
      if (ud.cloak) ud.cloak.rotation.z = 0.25;
      return;
    }
    root.rotation.set(0, 0, 0); root.position.set(0, 0, 0);
    const stride = mvB ? 1 : 0, br = Math.sin(t * 1.7 + id);
    const bob = mvB ? Math.abs(c) * 0.9 : br * 0.12;
    const fear = cl(((p.fear || 0) - 45) / 40, 0, 1), sick = p.sick ? 1 : 0;
    const thr = p.swing > 0 ? cl(p.swing / 0.2, 0, 1) : 0;
    ud.thr += (thr - ud.thr) * Math.min(1, dt * 30);
    const k = ud.thr;
    // bacaklar
    for (let i = 0; i < 2; i++) {
      const L = Lg[i], sg = i ? -1 : 1, a = stride * s * sg * 0.62 + (1 - stride) * (i ? -0.04 : 0.05) + k * (i ? -0.35 : 0.45);
      const kn = stride * Math.max(0, -Math.cos(ph) * sg) * 1.1 + stride * 0.12 + k * (i ? 0.2 : 0.5) + (can ? 0.25 : 0) + sick * 0.15 + fear * 0.25;
      L.th.rotation.set(0, 0, a + (can ? 0.2 : 0) + (kn - stride * 0.12) * 0.25); L.sh.rotation.z = -kn;
      L.th.position.y = 15.5 + bob - k * 0.9 - (can ? 0.5 : 0) - fear * 0.6;
    }
    torso.position.y = 15.5 + bob - k * 0.9 - (can ? 0.5 : 0) - fear * 0.6;
    lean = -(stride * 0.1) - (can ? 0.32 : 0) - sick * 0.22 - fear * 0.25 - k * 0.3;
    // kollar
    const tk = ud.toolK, armed = tk && tk.charAt(0) === 's' || tk === 'club';
    if (working) {
      const w = Math.sin(t * 11 + id), grp = p.group;
      if (grp === 'odun' || grp === 'tas') { aR = 1.55 + w * 0.85; eR = 0.75 - w * 0.35; aL = 1.25 + w * 0.8; eL = 0.9 - w * 0.3; xL = 0.35; xR = -0.2; lean += -0.12 + w * -0.14; toolLoc = 0.25; }
      else if (WTOOL[grp]) { aR = 0.75 + w * 0.4; eR = 1.0 - w * 0.3; aL = 0.5; eL = 1.1; lean += -0.2; toolLoc = 0.2; }
      else { aR = 0.9 + w * 0.3; eR = 0.6; aL = 0.9 - w * 0.3; eL = 0.6; lean += -0.3; hz = -0.2; }
    } else {
      const sw = stride * s * 0.7;
      aL = -sw + 0.04 + br * 0.03; aR = sw + 0.04 - br * 0.03; eL = 0.15 + stride * (0.35 + Math.max(0, -s) * 0.3); eR = 0.15 + stride * (0.35 + Math.max(0, s) * 0.3);
      if (p.carrying) { aL = aR = 2.55; eL = eR = 0.85; xL = 0.25; xR = -0.25; lean -= 0.12; }
      else if (fear > 0 && !armed) { aL = aL * (1 - fear) + 0.7 * fear; aR = aR * (1 - fear) + 0.7 * fear; eL += fear * 1.7; eR += fear * 1.7; hz -= fear * 0.2; }
      if (tk === 'club') { aR = 0.5 + sw * 0.3 + k * 1.3 - (k > 0 ? 0 : 0); eR = 1.25 - k * 0.9; toolPsi = 1.3 - k * 1.5 + Math.sin(t * 2 + id) * 0.08; aL = -sw * 0.6 + 0.35; eL = 0.7; }
      else if (tk === 'bow') { aR = 1.35 + k * 0.15; eR = 0.15; toolPsi = 0; aL = 0.9; eL = 1.6 - k * 0.6; }
      else if (armed) { aR = 0.12 + sw * 0.15 + k * 0.95; eR = 1.1 - k * 0.75; toolPsi = 1.2 * (1 - k) - 0.02 + stride * c * 0.04; }
      else if (tk) { aR = sw * 0.5 + 0.1; eR = 0.5; toolPsi = 0.5; }
      if (ud.tch) { aL = 1.0 + br * 0.03; eL = 0.9; }
    }
    torso.rotation.set(0, stride * s * 0.1 + k * 0.25, lean);
    head.rotation.set(0, hy + (1 - stride) * Math.sin(t * 0.5 + id * 1.3) * 0.25 * (working ? 0 : 1), hz - lean * 0.7 + (can ? 0.1 + Math.sin(t * 5 + id) * 0.04 : 0) - sick * 0.2);
    if (can) head.rotation.x = Math.sin(t * 0.9 + id) * 0.18;
    else if (p.tilt) head.rotation.x = p.tilt * 0.5; else head.rotation.x = 0;
    A[0].u.rotation.set(-0.07 - xL, 0, aL); A[0].f.rotation.z = eL;
    A[1].u.rotation.set(0.07 - xR, 0, aR); A[1].f.rotation.z = eR;
    if (ud.tool.visible) { ud.tool.rotation.z = toolPsi == null ? toolLoc : toolPsi - (aR + eR + lean); ud.tool.position.x = 0.3 + k * 5; }
    if (ud.torch && ud.torch.visible) { ud.torch.rotation.z = 1.35 - (aL + eL + lean); const f = 0.85 + 0.25 * Math.sin(t * 23 + id) * Math.sin(t * 7.1); ud.flame.scale.set(f, 0.8 + 0.4 * Math.abs(Math.sin(t * 17)), f); }
    if (ud.cloak && ud.cloak.visible) ud.cloak.rotation.z = 0.06 + stride * (0.22 + s * 0.06) + Math.sin(t * 1.3) * 0.02;
    if (ud.pack && ud.pack.visible) ud.pack.rotation.z = 0.08 + stride * s * 0.03;
  }

  // =============================================================
  //  YARATIK GİRİŞ NOKTALARI
  // =============================================================
  const QUADS = { boynuzlu: 1, zirhli: 1, ordek: 1, uzunboyun: 1 };
  function fakeOf(d, ud) {
    const f = ud.fake || (ud.fake = { eq: {}, bag: {}, carry: 0, work: 0 });
    f.id = d.id; f.anim = d.anim; f.moving = d.moving; f.hurtT = d.hurt; f.swing = d.swing || 0;
    if (ud.kind === 'cannibal') { f.cannibal = true; f.carrying = d.carry || null; }
    else { const g = d.disguise || {}; f.skin = g.skin || '#d8a47a'; f.hair = g.hair || '#2a1a10'; f.group = g.group || 'bos'; f.tilt = d.tilt || 0; f.swing = 0; }
    return f;
  }
  function dino(d) {
    d = d || {};
    const T = d.type, def = defOf(T), g = new T3.Group(), ud = g.userData;
    ud.lt = -1; ud.meshes = []; ud.fl = 0; ud.mv = d.moving ? 1 : 0; ud.jawK = 0; ud.hidK = d.hidden ? 1 : 0; ud.type = T;
    if (T === 'yamyam') { ud.kind = 'cannibal'; ud.pg = person(fakeOf(d, ud)); g.add(ud.pg); updDino(g, d, 0); return g; }
    if (T === 'taklitci') { ud.kind = 'mimic'; updDino(g, d, 0); return g; }
    const colHex = '#' + col(d.col || def.col || '#586').getHexString();
    const root = grp(g); ud.root = root;
    let S;
    if (T === 'batakci') { S = crocSpec(colHex); rigCroc(S, root, ud); }
    else if (T === 'kanatli') { S = flySpec(colHex); rigFly(S, root, ud); }
    else if (QUADS[T]) { S = quadSpec(T, colHex); rigQuad(S, root, ud); }
    else { S = theroSpec(TP[T] ? T : 'yirtici', colHex); rigThero(S, root, ud); }
    ud.S = S; ud.kind = S.kind; ud.r = 0;
    updDino(g, d, 0);
    return g;
  }
  function setFlash(ud, f) {
    if (ud.fl === f) return; ud.fl = f;
    const m = f === 1 ? FLASH : f === 2 ? POIS : VC;
    for (const x of ud.meshes) x.material = m;
  }
  function updDino(g, d, t) {
    const ud = g && g.userData; if (!ud || !ud.kind) return;
    d = d || {}; t = t || 0;
    const dt = ud.lt < 0 ? 0.016 : cl(t - ud.lt, 0, 0.1); ud.lt = t;
    if (ud.kind === 'cannibal') { updPerson(ud.pg, fakeOf(d, ud), t); return; }
    if (ud.kind === 'mimic') {
      const rev = !!d.revealed;
      if (rev && !ud.mon) { ud.mon = rigMimic(g, ud); }
      if (!rev && !ud.pg) { ud.pg = person(fakeOf(d, ud)); g.add(ud.pg); ud.tell = mesh(geo('mm_tell', pb => { for (const s of [-1, 1]) pb.ball(3.2, 4.15, s * 1.25, 0.42, 0.42, 0.5, '#fff', { d: 0 }); }), glow('#ffffff'), ud.pg.userData.head); }
      if (ud.pg) ud.pg.visible = !rev;
      if (ud.mon) ud.mon.root.visible = rev;
      if (rev) { updMimic(ud.mon, d, t); setFlash(ud, d.hurt > 0 ? 1 : 0); }
      else { updPerson(ud.pg, fakeOf(d, ud), t); ud.tell.visible = Math.sin(t * 2 + (d.id || 0)) > 0.85; }
      return;
    }
    const def = defOf(d.type), root = ud.root;
    const r = (d.r > 0 ? d.r : def.r) || 20;
    if (ud.r !== r) { ud.r = r; root.scale.setScalar(r); }
    ud.mv += ((d.moving ? 1 : 0) - ud.mv) * Math.min(1, dt * 9);
    setFlash(ud, d.hurt > 0 ? 1 : d.poison > 0 ? 2 : 0);
    if (ud.kind === 'thero') updThero(ud, d, t, dt, def);
    else if (ud.kind === 'quad') updQuad(ud, d, t, dt, def);
    else if (ud.kind === 'croc') updCroc(ud, d, t, dt, def);
    else updFly(ud, d, t, dt);
    // bayılma / ölüm: yana devril
    const down = (d.ko > 0 || d.dead) && ud.kind !== 'fly' ? 1 : 0;
    if (down || ud.downK > 0.001) {
      ud.downK = (ud.downK || 0) + (down - (ud.downK || 0)) * Math.min(1, dt * 5);
      if (ud.lt === 0 || dt === 0.016 && down && ud.first !== false) ud.downK = down;
      const k = ud.downK;
      root.rotation.x = k * 1.42; root.position.y = k * ud.side * r * 0.9; root.position.z = -k * (ud.body.position.y * r) * 0.9;
      if (ud.legs && ud.kind !== 'croc') for (let i = 0; i < ud.legs.length; i++) { const L = ud.legs[i], u = L.th || L.u; u.rotation.z += k * (0.5 - u.rotation.z) * 0.8 + k * (i % 2 ? 0.25 : -0.1); }
    }
    ud.first = false;
    // evcil: boyun bandı
    if (ud.neckBase) {
      const want = !!d.tamed;
      if (want && !ud.collar) { const nb = ud.neckBase; ud.collar = mesh(geo('collar', pb => { pb.tube([0, -0.5, 0], [0, 0.5, 0], 1, 1, '#b02a1a', { n: 7 }); pb.ball(0.2, -0.9, 0, 0.5, 0.6, 0.5, '#d8b050', { d: 0 }); }), VC, nb.n, nb.x, nb.y, 0); ud.collar.scale.set(nb.r, 0.09, nb.r * 0.9); const S = ud.S; ud.collar.rotation.z = (S.kind === 'thero' ? S.P.nA : 0) - PI / 2; }
      if (ud.collar) ud.collar.visible = want;
    }
  }
  const _w = new T3.Vector3();
  function nodePos(g, key, out) {
    out = out || new T3.Vector3(); const ud = g && g.userData, n = ud && ud[key];
    if (!n) { if (g) { g.updateWorldMatrix(true, false); out.setFromMatrixPosition(g.matrixWorld); out.y += 20; } return out; }
    n.n.updateWorldMatrix(true, false);
    return out.set(n.x, n.y, 0).applyMatrix4(n.n.matrixWorld);
  }

  return {
    person, updPerson, dino, updDino, FLY_H,
    mouthPos: (g, out) => nodePos(g, 'mouth', out),
    seatPos: (g, out) => nodePos(g, 'seat', out)
  };
})();
