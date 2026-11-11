'use strict';
// =============================================================
//  ÜÇ BOYUT — birinci şahıs çizici (THREE r149)
//  Benzetim 2B kalır: dünya (x, y) -> three (x, yükseklik, y).
//  render3D(dt) her karede cizim.js/render() içinden çağrılır; #c3 tuvaline çizer.
//  w2s(x, y, h) dünya noktasını ekran (CSS px) koordinatına çevirir (2B kaplamalar için).
// =============================================================
const U3 = {
  ok: null, r: null, scene: null, cam: null, w: 0, h: 0,
  world: null, worldKey: null, inst: null, instX: 1e9, instY: 1e9, sig: '', sigT: 0,
  ents: new Map(), builds: new Map(), carcs: new Map(), camps: new Map(),
  flames: [], frame: 0, bob: 0, LS: [], fogK: 1, eye: 30, dk: 0
};
const EYE = 30, EYE_SNEAK = 18, MAXL = 5, TREE_R = 2000, ROCK_R = 1600, BUSH_R = 1000, DECO_R = 700, SEA_Y = 0, VIEW_FAR = 9000;
// ---- arazi API'si (dunya.js): yoksa düz dünya
function gh(x, y) { if (typeof groundH !== 'function') return 0; const h = groundH(x, y); return h === h && h < 1e5 && h > -1e5 ? h : 0; }
const ghE = (x, y) => Math.max(gh(x, y), SEA_Y - 1);   // canlılar denizde yüzeyde kalsın
function bioAt(x, y) { if (typeof biomeFast !== 'function') return 0; const b = biomeFast(x, y); return b >= 0 && b < 8 ? b : 0; }
function seaAt(x, y) { return typeof isSea === 'function' ? !!isSea(x, y) : gh(x, y) < 0; }
// basit 2B/3B değer gürültüsü (tohumlu, sürekli)
function _hn(i, j, k) { let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul((k | 0) + 1013, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise3(x, y, z) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = x - i, fy = y - j, fz = z - k;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(_hn(i, j, k), _hn(i + 1, j, k), u), l(_hn(i, j + 1, k), _hn(i + 1, j + 1, k), u), v), l(l(_hn(i, j, k + 1), _hn(i + 1, j, k + 1), u), l(_hn(i, j + 1, k + 1), _hn(i + 1, j + 1, k + 1), u), v), w);
}
const fbm3 = (x, y, z) => vnoise3(x, y, z) * 0.55 + vnoise3(x * 2.03, y * 2.03, z * 2.03) * 0.3 + vnoise3(x * 4.1, y * 4.1, z * 4.1) * 0.15;

// ---- küçük yardımcılar
const _c3cache = new Map();
function c3(s) {
  let c = _c3cache.get(s);
  if (!c) {
    c = new THREE.Color();
    if (typeof s === 'number') c.setHex(s);
    else { const m = /^rgba\(([^,]+),([^,]+),([^,]+),/.exec(s); if (m) c.setRGB(+m[1] / 255, +m[2] / 255, +m[3] / 255); else c.setStyle(s); }
    _c3cache.set(s, c);
  }
  return c;
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _v2 = new THREE.Vector3(), _col = new THREE.Color();
function mat4(x, y, z, sx, sy, sz, rx, ry, rz) {
  _e.set(rx || 0, ry || 0, rz || 0, 'YXZ'); _q.setFromEuler(_e);
  return _m4.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
}
const hash2 = (x, y) => { let h = Math.imul(Math.floor(x * 13.7) ^ 0x9e3779b9, 2654435761) ^ Math.imul(Math.floor(y * 7.3) + 0x7f4a7c15, 1597334677); h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; return (h >>> 0) / 4294967296; };

// ---- ortak birim geometriler (tabanı y=0'da)
const GEO = {};
function initGeo() {
  GEO.box = new THREE.BoxGeometry(1, 1, 1);
  GEO.cyl = new THREE.CylinderGeometry(1, 1, 1, 6); GEO.cyl.translate(0, 0.5, 0);
  GEO.trunk = new THREE.CylinderGeometry(0.55, 1, 1, 6); GEO.trunk.translate(0, 0.5, 0);
  GEO.cone = new THREE.ConeGeometry(1, 1, 7); GEO.cone.translate(0, 0.5, 0);
  GEO.cone4 = new THREE.ConeGeometry(1, 1, 4); GEO.cone4.translate(0, 0.5, 0);
  GEO.ico = new THREE.IcosahedronGeometry(1, 0);
  GEO.ico1 = new THREE.IcosahedronGeometry(1, 1);
  GEO.dod = new THREE.DodecahedronGeometry(1, 0);
  GEO.sph = new THREE.SphereGeometry(1, 8, 6);
  GEO.disc = new THREE.CircleGeometry(1, 20); GEO.disc.rotateX(-Math.PI / 2);
  GEO.ring = new THREE.RingGeometry(0.86, 1, 28); GEO.ring.rotateX(-Math.PI / 2);
  GEO.torus = new THREE.TorusGeometry(1, 0.3, 5, 12); GEO.torus.rotateX(Math.PI / 2);
  GEO.rib = new THREE.TorusGeometry(1, 0.09, 4, 7, Math.PI);
  GEO.arch = new THREE.CircleGeometry(1, 12, 0, Math.PI);
  // üçgen prizma: kesit x-y düzleminde (taban genişliği 1, tepe y=1), z boyunca 1
  { const p = [-.5, 0, .5, .5, 0, .5, 0, 1, .5, .5, 0, -.5, -.5, 0, -.5, 0, 1, -.5,
      -.5, 0, -.5, -.5, 0, .5, 0, 1, .5, -.5, 0, -.5, 0, 1, .5, 0, 1, -.5,
      .5, 0, .5, .5, 0, -.5, 0, 1, -.5, .5, 0, .5, 0, 1, -.5, 0, 1, .5];
    GEO.prism = new THREE.BufferGeometry(); GEO.prism.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); GEO.prism.computeVertexNormals(); }
  // eğrelti: merkezden yayılan 6 yaprak
  { const p = [];
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU, ca = Math.cos(a), sa = Math.sin(a), w = 0.17;
      const lx = ca * 0.5 - sa * w, lz = sa * 0.5 + ca * w, rx = ca * 0.5 + sa * w, rz = sa * 0.5 - ca * w;
      p.push(0, 0, 0, lx, 0.5, lz, rx, 0.5, rz, lx, 0.5, lz, ca, 0.3, sa, rx, 0.5, rz);
    }
    GEO.fern = new THREE.BufferGeometry(); GEO.fern.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); GEO.fern.computeVertexNormals(); }
  // palmiye yaprağı: +x boyunca kavisli, ortası katlı şerit
  { const p = [], S = 7, pt = t => [t, 0.28 * Math.sin(Math.PI * t * 0.75) - 0.42 * t * t, 0.03 + 0.15 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.35)];
    for (let i = 0; i < S; i++) { const [x0, y0, w0] = pt(i / S), [x1, y1, w1] = pt((i + 1) / S);
      for (const sd of [-1, 1]) p.push(x0, y0 + 0.03, 0, x1, y1 + 0.03, 0, x0, y0 - w0 * 0.3, sd * w0, x1, y1 + 0.03, 0, x1, y1 - w1 * 0.3, sd * w1, x0, y0 - w0 * 0.3, sd * w0); }
    GEO.frond = new THREE.BufferGeometry(); GEO.frond.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); GEO.frond.computeVertexNormals(); }
}

// Daha ayrıntılı ağaç silueti; simülasyon/çarpışma geometrisine dokunmaz.
function initTreeArt() {
  GEO.treeTrunk = new THREE.CylinderGeometry(0.55, 1, 1, 12, 5);
  const tp = GEO.treeTrunk.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i), a = Math.atan2(z, x);
    const k = 1 + 0.045 * Math.cos(a * 6) + 0.018 * Math.sin(y * 17 + a * 3);
    tp.setXYZ(i, x * k, y + 0.5, z * k);
  }
  GEO.treeTrunk.computeVertexNormals();
  GEO.treeCrown = new THREE.ConeGeometry(1, 1, 14, 9);
  const cp = GEO.treeCrown.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), z = cp.getZ(i), y = cp.getY(i) + 0.5, a = Math.atan2(z, x);
    const k = 1 + 0.11 * Math.cos(a * 7 + y * 2) + 0.07 * Math.sin(y * 38 + a * 2);
    cp.setXYZ(i, x * k, y, z * k);
  }
  GEO.treeCrown.computeVertexNormals();
  GEO.treeLeaf = new THREE.IcosahedronGeometry(1, 2);
  const lp = GEO.treeLeaf.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    const x = lp.getX(i), y = lp.getY(i), z = lp.getZ(i);
    const k = 1 + 0.075 * Math.sin(x * 9 + z * 3) * Math.cos(y * 7 - z * 4);
    lp.setXYZ(i, x * k, y * k, z * k);
  }
  GEO.treeLeaf.computeVertexNormals();
}
function treeWindMaterial(base, kind) {
  const m = base.clone();
  if (!U3.artWind) U3.artWind = { value: new THREE.Vector3(1, 0, 0.25) };
  m.onBeforeCompile = sh => {
    sh.uniforms.uTreeTime = U3.uTime; sh.uniforms.uTreeWind = U3.artWind;
    sh.vertexShader = 'uniform float uTreeTime;\nuniform vec3 uTreeWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      {
        vec3 ip = instanceMatrix[3].xyz;
        float w = ${kind === 2 ? 'clamp(abs(position.x), 0.0, 1.0)' : kind === 1 ? 'smoothstep(-0.6, 0.9, position.y)' : 'smoothstep(0.0, 1.0, position.y)'};
        float phase = uTreeTime * 1.2 - dot(ip.xz, uTreeWind.xy) * 0.008;
        float gust = sin(phase) * 0.65 + sin(phase * 1.73 + ip.x * 0.03) * 0.35;
        float height = length(instanceMatrix[1].xyz);
        vec3 bend = vec3(uTreeWind.x, 0.0, uTreeWind.y) * (height * 0.018 * uTreeWind.z * gust * w * w);
        transformed.x += dot(bend, instanceMatrix[0].xyz) / max(dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz), 0.0001);
        transformed.z += dot(bend, instanceMatrix[2].xyz) / max(dot(instanceMatrix[2].xyz, instanceMatrix[2].xyz), 0.0001);
      }
      #endif`);
  };
  m.customProgramCacheKey = () => 'son-ates-tree-wind-v1-' + kind;
  return m;
}
function updateTreeWind() {
  if (!U3.artWind) return;
  const w = G.wind, a = w && Number.isFinite(w.a) ? w.a : 0;
  const s = w && Number.isFinite(w.s) ? clamp(w.s, 0, 1) : 0.25;
  const storm = G.weather && G.weather.type === 'firtina' ? 1.45 : 1;
  U3.artWind.value.set(Math.cos(a), Math.sin(a), s * storm);
}

// ---- geometri birleştirici: tek ağ, köşe renkli
class GB {
  constructor() { this.p = []; this.c = []; }
  add(geo, col, x, y, z, sx, sy, sz, rx, ry, rz, cf) {
    const g = geo.index ? (geo._ni || (geo._ni = geo.toNonIndexed())) : geo, a = g.attributes.position, m = mat4(x, y, z, sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz, rx, ry, rz);
    const c = c3(col);
    for (let i = 0; i < a.count; i += 3) {
      let r = c.r, gg = c.g, b = c.b;
      if (cf) { const o = cf((a.getX(i) + a.getX(i + 1) + a.getX(i + 2)) / 3, (a.getY(i) + a.getY(i + 1) + a.getY(i + 2)) / 3, (a.getZ(i) + a.getZ(i + 1) + a.getZ(i + 2)) / 3, c); r = o.r; gg = o.g; b = o.b; }
      for (let k = 0; k < 3; k++) { _v2.fromBufferAttribute(a, i + k).applyMatrix4(m); this.p.push(_v2.x, _v2.y, _v2.z); this.c.push(r, gg, b); }
    }
    return this;
  }
  box(col, x, y, z, sx, sy, sz, ry, rx, rz) { return this.add(GEO.box, col, x, y, z, sx, sy, sz, rx, ry, rz); }
  cyl(col, x, y, z, r, h, rx, rz) { return this.add(GEO.cyl, col, x, y, z, r, h, r, rx, 0, rz); }
  cone(col, x, y, z, r, h, rx, rz) { return this.add(GEO.cone, col, x, y, z, r, h, r, rx, 0, rz); }
  sph(col, x, y, z, sx, sy, sz) { return this.add(GEO.sph, col, x, y, z, sx, sy, sz); }
  dod(col, x, y, z, sx, sy, sz, ry) { return this.add(GEO.dod, col, x, y, z, sx, sy, sz, 0, ry || 0, 0); }
  mesh(ghost, dbl) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeVertexNormals();
    return new THREE.Mesh(g, ghost ? MAT.ghost : dbl ? MAT.vd : MAT.v);
  }
}

// ---- malzemeler ve dokular
const MAT = {}, TEX = {};
function canvasTex(S, fn) { const c = document.createElement('canvas'); c.width = c.height = S; fn(c.getContext('2d'), S); const t = new THREE.CanvasTexture(c); return t; }
function initMat() {
  TEX.glow = canvasTex(64, (g, S) => { const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); });
  TEX.soft = canvasTex(64, (g, S) => { const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); gr.addColorStop(0, 'rgba(255,255,255,.8)'); gr.addColorStop(0.6, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); });
  TEX.moon = canvasTex(64, (g, S) => { const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); gr.addColorStop(0, 'rgba(240,240,225,1)'); gr.addColorStop(0.42, 'rgba(225,228,220,1)'); gr.addColorStop(0.5, 'rgba(180,195,230,.25)'); gr.addColorStop(1, 'rgba(120,150,220,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); g.fillStyle = 'rgba(150,155,150,.5)'; for (const [x, y, r] of [[26, 26, 5], [38, 34, 4], [30, 40, 3]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } });
  TEX.ground = canvasTex(512, (g, S) => {
    const R = mulberry32(7);
    g.fillStyle = '#cfcfc6'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 220; i++) {
      const x = R() * S, y = R() * S, r = 20 + R() * 60, light = R() < 0.5;
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, light ? 'rgba(255,255,235,.2)' : 'rgba(60,70,50,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); }
    }
    for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(150,120,90,.22)'; g.beginPath(); g.ellipse(R() * S, R() * S, 8 + R() * 26, 5 + R() * 14, R() * 3, 0, TAU); g.fill(); }
    const bl = ['#b9c4a8', '#8f9a82', '#e2e8cf', '#a3ae92', '#f1f3df', '#7d8872', '#d5dcc0'];
    g.lineCap = 'round';
    for (let i = 0; i < 9000; i++) { const x = R() * S, y = R() * S, a = R() * TAU, l = 2 + R() * 6; g.strokeStyle = bl[Math.floor(R() * bl.length)]; g.globalAlpha = 0.45 + R() * 0.5; g.lineWidth = 0.8 + R() * 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    g.globalAlpha = 1;
  });
  TEX.ground.wrapS = TEX.ground.wrapT = THREE.RepeatWrapping; TEX.ground.repeat.set(WORLD / 190, WORLD / 190);
  TEX.ground.anisotropy = Math.min(4, U3.r.capabilities.getMaxAnisotropy());
  const L_ = o => new THREE.MeshLambertMaterial(o);
  MAT.v = L_({ vertexColors: true, flatShading: true });
  MAT.vd = L_({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  MAT.ghost = L_({ vertexColors: true, flatShading: true, transparent: true, opacity: 0.42, depthWrite: false, emissive: 0x2a3a48 });
  MAT.inst = L_({ flatShading: true });
  MAT.instD = L_({ flatShading: true, side: THREE.DoubleSide });
  MAT.treeCone = treeWindMaterial(MAT.inst, 0);
  MAT.treeLeaf = treeWindMaterial(MAT.inst, 1);
  MAT.treeFrond = treeWindMaterial(MAT.instD, 2);
  MAT.crystal = L_({ flatShading: true, emissive: 0x2a6f9a });
  MAT.rock = triPatch(L_({ flatShading: true }), 0.031, 0.5);
  MAT.rockV = triPatch(L_({ vertexColors: true, flatShading: true }), 0.045, 0.45);
  MAT.ground = L_({ map: TEX.ground, vertexColors: true });
  MAT.water = L_({ color: 0x2a6a88, emissive: 0x06141c, transparent: true, opacity: 0.9 });
  MAT.ice = L_({ color: 0x80a4bc, emissive: 0x060e14 });
  MAT.sand = L_({ color: 0x968258 });
  MAT.swamp = L_({ color: 0x2f3a22, emissive: 0x040603 });
  // yumuşak leke gölge: merkezde koyu, kenara doğru sönen radyal geçiş (alphaMap = G kanalı)
  TEX.shadow = canvasTex(64, (g, S) => { g.fillStyle = '#000'; g.fillRect(0, 0, S, S); const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2 - 1); gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, '#e8e8e8'); gr.addColorStop(0.7, '#6a6a6a'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, S, S); });
  const shM = o => new THREE.MeshBasicMaterial(Object.assign({ color: 0x000000, transparent: true, alphaMap: TEX.shadow, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, o));
  MAT.shadow = shM({ opacity: 0.5 }); MAT.tshadow = shM({ opacity: 0.42 }); MAT.inShadow = shM({ opacity: 0.55, fog: false });
  MAT.blood = new THREE.MeshBasicMaterial({ color: 0x3a0303, transparent: true, opacity: 0.6, depthWrite: false });
  MAT.track = new THREE.MeshBasicMaterial({ color: 0x120c06, transparent: true, opacity: 0.5, depthWrite: false });
  MAT.fl0 = new THREE.MeshBasicMaterial({ color: 0xff5a14, fog: false });
  MAT.fl1 = new THREE.MeshBasicMaterial({ color: 0xffa028, fog: false });
  MAT.fl2 = new THREE.MeshBasicMaterial({ color: 0xffe890, fog: false });
  MAT.dark = new THREE.MeshBasicMaterial({ color: 0x030202 });
  MAT.ring = new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, fog: false });
  // taş/kaya ayrıntı dokusu (üç düzlemli örnekleme için gri gürültü + çatlaklar)
  TEX.noise = canvasTex(256, (g, S) => {
    const R = mulberry32(17); g.fillStyle = '#b0b0b0'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 260; i++) { const x = R() * S, y = R() * S, r = 6 + R() * 40, l = R() < 0.5; for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, l ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); } }
    g.lineCap = 'round';
    for (let i = 0; i < 46; i++) { let x = R() * S, y = R() * S, a = R() * TAU; g.strokeStyle = `rgba(30,30,30,${0.25 + R() * 0.3})`; g.lineWidth = 0.6 + R() * 1.3; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { a += (R() - 0.5) * 1.2; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); } g.stroke(); }
    const id = g.getImageData(0, 0, S, S), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * 34; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(id, 0, 0);
  });
  TEX.noise.wrapS = TEX.noise.wrapT = THREE.RepeatWrapping; TEX.noise.anisotropy = Math.min(4, U3.r.capabilities.getMaxAnisotropy());
  TEX.cloud = canvasTex(256, (g, S) => {
    const R = mulberry32(23);
    for (let i = 0; i < 26; i++) { const x = S * (0.2 + R() * 0.6), y = S * (0.42 + (R() - 0.5) * 0.22), r = S * (0.08 + R() * 0.14); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(0.6, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); }
  });
  TEX.disc = canvasTex(64, (g, S) => { const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.62, 'rgba(255,255,250,1)'); gr.addColorStop(0.72, 'rgba(255,250,230,.35)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); });
  TEX.shaft = canvasTex(64, (g, S) => { const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, 'rgba(255,255,255,.0)'); gr.addColorStop(0.25, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); const g2 = g.createLinearGradient(0, 0, S, 0); g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(0.3, 'rgba(0,0,0,0)'); g2.addColorStop(0.7, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = g2; g.fillRect(0, 0, S, S); });
  U3.uTime = { value: 0 };
}
// dünya-uzayı ayrıntı dokusu: üç düzlemli (yön: türevlerden). k = ölçek, s = şiddet
function triPatch(mat, k, s, extra) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.tNoise = { value: TEX.noise };
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n#ifdef USE_INSTANCING\nvWP = (modelMatrix * instanceMatrix * vec4(transformed,1.0)).xyz;\n#else\nvWP = (modelMatrix * vec4(transformed,1.0)).xyz;\n#endif');
    sh.fragmentShader = 'varying vec3 vWP;\nuniform sampler2D tNoise;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      { vec3 wn = normalize(cross(dFdx(vWP), dFdy(vWP))); vec3 bw = abs(wn); bw /= (bw.x + bw.y + bw.z + 1e-4);
        float dd = texture2D(tNoise, vWP.yz * ${k.toFixed(4)}).r * bw.x + texture2D(tNoise, vWP.xz * ${k.toFixed(4)}).r * bw.y + texture2D(tNoise, vWP.xy * ${k.toFixed(4)}).r * bw.z;
        diffuseColor.rgb *= 1.0 + (dd - 0.69) * ${(s * 2.2).toFixed(3)}; ${extra || ''} }`);
  };
  mat.extensions = mat.extensions || {}; mat.extensions.derivatives = true;
  return mat;
}
function sprite(tex, color, add, fog) {
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, fog: !!fog }));
}
function disposeTree(o, mats) {
  o.traverse(m => { if (m.geometry && !Object.values(GEO).includes(m.geometry)) m.geometry.dispose(); if (mats && m.material && !Object.values(MAT).includes(m.material)) { if (m.material.map && !Object.values(TEX).includes(m.material.map)) m.material.map.dispose(); m.material.dispose(); } });
}

// ---- alev (yapılar, kamp ateşi, el meşalesi)
function mkFlame(s, parent, x, y, z) {
  const g = new THREE.Group();
  // [malzeme, yarıçap, boy, merkezden uzaklık, açı]
  [[MAT.fl0, 0.34, 1.0, 0, 0], [MAT.fl0, 0.26, 0.72, 0.3, 0.5], [MAT.fl0, 0.25, 0.64, 0.3, 2.6], [MAT.fl0, 0.24, 0.58, 0.3, 4.6], [MAT.fl1, 0.24, 0.72, 0.05, 1], [MAT.fl1, 0.17, 0.46, 0.2, 3.5], [MAT.fl2, 0.13, 0.42, 0, 0]].forEach(([m, r, h, d, a], i) => {
    const c = new THREE.Mesh(GEO.cone4, m); c.userData.h = h * s; c.userData.r = r * s; c.userData.i = i; c.userData.x = Math.cos(a) * d * s; c.position.z = Math.sin(a) * d * s; c.position.y = m === MAT.fl0 ? 0 : s * 0.04; g.add(c);
  });
  g.position.set(x, y, z); g.userData.ph = Math.random() * 9; g.userData.k = 1;
  parent.add(g); U3.flames.push(g); return g;
}
function updFlames(t) {
  for (let i = U3.flames.length - 1; i >= 0; i--) {
    const g = U3.flames[i];
    let p = g.parent, live = false; while (p) { if (p === U3.scene || p === IN.scene) { live = true; break; } p = p.parent; }
    if (!live) { U3.flames.splice(i, 1); continue; }
    if (!g.visible) continue;
    const ph = g.userData.ph, k = g.userData.k;
    for (const c of g.children) {
      const j = c.userData.i, f = 1 + Math.sin(t * (8 + j * 1.9) + ph + j * 1.3) * 0.22 + Math.sin(t * 21 + ph * 2 + j * 2.1) * 0.1;
      c.scale.set(c.userData.r * (1.08 - (f - 1) * 0.5) * k, c.userData.h * f * k, c.userData.r * (1.08 - (f - 1) * 0.5) * k);
      c.position.x = c.userData.x * k + Math.sin(t * 6 + ph + j * 2) * c.userData.r * 0.3; c.rotation.y = t * (0.8 + j * 0.37) + j;
      c.rotation.z = Math.sin(t * 4.3 + ph + j) * 0.09;
    }
  }
}

// =============================================================
//  KURULUM
// =============================================================
function init3D() {
  if (U3.ok !== null) return U3.ok;
  try {
    if (typeof THREE === 'undefined') throw new Error('THREE yok');
    const canvas = document.getElementById('c3');
    U3.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { console.warn('WebGL açılamadı, 2B çizime dönülüyor:', e); U3.ok = false; return false; }
  const r = U3.r;
  r.setClearColor(0x000000, 1);
  initGeo(); initTreeArt(); initMat();
  const sc = U3.scene = new THREE.Scene();
  sc.fog = new THREE.Fog(0x9fbcd0, 400, 2300);
  U3.cam = new THREE.PerspectiveCamera(75, 1, 1.5, VIEW_FAR); U3.cam.rotation.order = 'YXZ'; sc.add(U3.cam);
  U3.hemi = new THREE.HemisphereLight(0xcfe3ff, 0x4a5a30, 0.9); sc.add(U3.hemi);
  U3.sun = new THREE.DirectionalLight(0xfff0d0, 0.9); sc.add(U3.sun); sc.add(U3.sun.target);
  U3.pl = []; for (let i = 0; i < MAXL; i++) { const l = new THREE.PointLight(0xff9a40, 0, 300, 1.25); sc.add(l); U3.pl.push(l); }
  U3.self = new THREE.PointLight(0x8090b8, 0, 150, 1.4); sc.add(U3.self);

  // gökyüzü: kubbe + yıldızlar + güneş/ay
  const sky = U3.sky = new THREE.Group(); sc.add(sky);
  const dg = new THREE.SphereGeometry(7000, 24, 14); dg.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(dg.attributes.position.count * 3), 3));
  U3.dome = new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); U3.dome.renderOrder = -10; U3.dome.frustumCulled = false; sky.add(U3.dome);
  { const n = 420, p = new Float32Array(n * 3), R = mulberry32(99);
    for (let i = 0; i < n; i++) { const a = R() * TAU, y = 0.04 + Math.pow(R(), 0.8) * 0.96, h = Math.sqrt(1 - y * y); p[i * 3] = Math.cos(a) * h * 6500; p[i * 3 + 1] = y * 6500; p[i * 3 + 2] = Math.sin(a) * h * 6500; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    U3.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); U3.stars.renderOrder = -9; U3.stars.frustumCulled = false; sky.add(U3.stars); }
  U3.sunS = sprite(TEX.glow, 0xfff2c0, true, false); U3.sunS.scale.set(1500, 1500, 1); U3.sunS.renderOrder = -8; sky.add(U3.sunS);
  U3.sunD = sprite(TEX.disc, 0xfffbe8, true, false); U3.sunD.scale.set(260, 260, 1); U3.sunD.renderOrder = -8; sky.add(U3.sunD);
  U3.moonS = sprite(TEX.moon, 0xffffff, false, false); U3.moonS.scale.set(560, 560, 1); U3.moonS.renderOrder = -8; sky.add(U3.moonS);
  U3.moonG = sprite(TEX.glow, 0x8aa0d8, true, false); U3.moonG.scale.set(1300, 1300, 1); U3.moonG.renderOrder = -9; sky.add(U3.moonG);

  // dinamik havuzlar
  const dyn = U3.dyn = new THREE.Group(); sc.add(dyn);
  U3.entShadow = mkInst(GEO.disc, MAT.shadow, 700); U3.entShadow.renderOrder = 1; dyn.add(U3.entShadow);
  U3.stainI = mkInst(GEO.disc, MAT.blood, 240); dyn.add(U3.stainI);
  U3.trackI = mkInst(GEO.disc, MAT.track, 60); dyn.add(U3.trackI);
  U3.arrowI = mkInst(GEO.cyl, new THREE.MeshLambertMaterial({ color: 0x6a4a26, emissive: 0x1a1208 }), 24); dyn.add(U3.arrowI);
  U3.spitI = mkInst(GEO.ico, new THREE.MeshBasicMaterial({ color: 0xb8e04a }), 24); dyn.add(U3.spitI);
  { const n = 500, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    U3.parts = new THREE.Points(g, new THREE.PointsMaterial({ map: TEX.soft, size: 3.6, vertexColors: true, sizeAttenuation: true, transparent: true, depthWrite: false })); U3.parts.frustumCulled = false; U3.partN = n; dyn.add(U3.parts); }
  { const n = 36, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), R = mulberry32(5); U3.flySeed = [];
    for (let i = 0; i < n; i++) U3.flySeed.push([R() * 700 - 350, 6 + R() * 50, R() * 700 - 350, R() * 9]);
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    U3.flies = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xd2ff78, size: 2.4, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); U3.flies.frustumCulled = false; dyn.add(U3.flies); }
  { const n = 400, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    U3.bloodP = new THREE.Points(g, new THREE.PointsMaterial({ map: TEX.soft, color: 0x6a0606, size: 3.4, transparent: true, depthWrite: false, alphaTest: 0.05 })); U3.bloodP.frustumCulled = false; U3.bloodN = n; dyn.add(U3.bloodP); }
  U3.eyes = []; for (let i = 0; i < 40; i++) { const s = sprite(TEX.glow, 0xffffff, true, false); s.visible = false; dyn.add(s); U3.eyes.push(s); }
  U3.smoke = []; for (let i = 0; i < 6; i++) { const s = sprite(TEX.soft, 0x8a8782, false, true); s.visible = false; dyn.add(s); U3.smoke.push(s); }
  U3.ghost = new THREE.Group(); U3.ghostMat = new THREE.MeshBasicMaterial({ color: 0x77cc66, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
  { const d = new THREE.Mesh(GEO.disc, U3.ghostMat); d.position.y = 0.9; U3.ghost.add(d); const w = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), U3.ghostMat); w.position.y = 0.5; U3.ghost.add(w); }
  U3.ghost.visible = false; dyn.add(U3.ghost);
  U3.huntRing = new THREE.Mesh(GEO.ring, new THREE.MeshBasicMaterial({ color: 0xff5028, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, fog: false })); U3.huntRing.visible = false; dyn.add(U3.huntRing);
  U3.lookRing = new THREE.Group(); { const r1 = new THREE.Mesh(GEO.ring, MAT.ring); U3.lookRing.add(r1); const ar = new THREE.Mesh(GEO.cone4, MAT.ring); ar.rotation.x = Math.PI; ar.scale.set(2.6, 5, 2.6); ar.position.y = 52; U3.lookRing.add(ar); } U3.lookRing.visible = false; dyn.add(U3.lookRing);
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 4 * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(24 * 4 * 3), 3));
    U3.fish = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true })); U3.fish.frustumCulled = false; dyn.add(U3.fish); }
  initTerrainMat(); initGrass(); dyn.add(U3.grB); dyn.add(U3.grF); dyn.add(U3.grE); initWeather();

  buildViewModel();
  U3.ok = true; return true;
}
function mkInst(geo, mat, max) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, max)); m.userData.max = Math.max(1, max); m.count = 0; m.frustumCulled = false;
  // her örnekli ağın renk tamponu olsun: aynı malzemeyi paylaşanlar aynı gölgelendirici türevini kullanır
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(m.userData.max * 3).fill(1), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); return m;
}
function instAdd(m, x, y, z, sx, sy, sz, ry, col, rx, rz) {
  const i = m.count; if (i >= m.userData.max) return;
  m.setMatrixAt(i, mat4(x, y, z, sx, sy, sz, rx || 0, ry || 0, rz || 0));
  if (col) m.setColorAt(i, col);
  m.count = i + 1;
}
function instDone(m) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }

// ---- birinci şahıs: eller, mızrak, yay, meşale
function buildViewModel() {
  const vm = U3.vm = new THREE.Group(); U3.cam.add(vm);
  const M = (c, e) => new THREE.MeshLambertMaterial({ color: c, emissive: e || 0x000000, flatShading: true, transparent: true, depthTest: false, depthWrite: false, fog: false });
  let ord = 0;
  const part = (geo, mat, parent, x, y, z, sx, sy, sz, rx, ry, rz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx || 0, ry || 0, rz || 0); m.renderOrder = 1000 + (ord++); m.frustumCulled = false; parent.add(m); return m; };
  const wood = M(0x7a5a34, 0x0c0906), wood2 = M(0x5a3e22, 0x080604), skin = M(0xc99068, 0x160e0a), skin2 = M(0xb07a56, 0x120c08), stone = M(0xb8b4a8, 0x101010), hide = M(0x6a3a1c, 0x0a0402), wrap = M(0x8a6a40, 0x0a0806), str = M(0xd8ccb0, 0x202020);
  // el: kol + bilek sargısı + avuç + sapı kavrayan parmaklar (sap yerel +Y boyunca)
  const hand = (parent, side) => {
    part(GEO.cyl, hide, parent, 1.0 * side, -18, -0.8, 1.45, 12, 1.45, 0, 0, 0.05 * side);
    part(GEO.cyl, wrap, parent, 0.6 * side, -7.4, -0.3, 1.32, 2.2, 1.32);
    part(GEO.ico, skin, parent, 0.5 * side, -4.6, -0.2, 1.25, 2.0, 1.15);
    for (let i = 0; i < 4; i++) part(GEO.box, i % 2 ? skin2 : skin, parent, -0.15 * side, -2.4 - i * 0.95, 0.95, 1.5, 0.8, 0.75, 0, 0, 0);
    part(GEO.box, skin, parent, 0.95 * side, -2.6, 0.5, 0.6, 1.6, 0.7, 0.3, 0, 0.4 * side);
  };
  // sağ el + mızrak
  const sp = U3.spear = new THREE.Group(); vm.add(sp);
  hand(sp, 1);
  part(GEO.cyl, wood, sp, 0, -16, 0, 0.32, 38, 0.32);
  part(GEO.cyl, wrap, sp, 0, 17.8, 0, 0.46, 2.4, 0.46);
  part(GEO.cone, stone, sp, 0, 19.6, 0, 0.85, 5.2, 0.42);
  part(GEO.box, M(0xd8d0ba, 0x101010), sp, 0.5, 17.5, 0, 0.12, 2.4, 0.9, 0, 0, 0.5);
  // sol el + meşale
  const tc = U3.torch = new THREE.Group(); vm.add(tc);
  hand(tc, -1);
  part(GEO.cyl, wood2, tc, 0, -6, 0, 0.45, 12.5, 0.45);
  part(GEO.cyl, M(0x2a1a0c, 0x1a0c04), tc, 0, 5, 0, 0.8, 2.6, 0.8);
  const fm = [0xff5a14, 0xffa028, 0xffe890].map(c => new THREE.MeshBasicMaterial({ color: c, transparent: true, depthTest: false, depthWrite: false, fog: false }));
  U3.torchFl = fm.map((m, i) => part(GEO.cone4, m, tc, 0, 6.8, 0, 1.15 - i * 0.34, 5 - i * 1.3, 1.15 - i * 0.34));
  U3.torchGlow = sprite(TEX.glow, 0xff9a40, true, false); U3.torchGlow.material.depthTest = false; U3.torchGlow.renderOrder = 999; U3.torchGlow.position.set(0, 9, 0); U3.torchGlow.scale.set(14, 14, 1); tc.add(U3.torchGlow);
  // yay (sol el) + kiriş + ok (sağ el kirişi çeker)
  const bw = U3.bow = new THREE.Group(); vm.add(bw); bw.visible = false;
  const limb = new THREE.TorusGeometry(15, 0.42, 4, 16, Math.PI * 0.62); limb.rotateZ(-Math.PI * 0.31); limb.translate(-12.2, 0, 0); limb.scale(-1, 1, 1);
  part(limb, wood, bw, 0, 0, 0, 1, 1, 1);
  part(GEO.cyl, wrap, bw, -2.8, -2, 0, 0.75, 4, 0.75);
  hand(bw, -1); bw.children.slice(-7).forEach(m => { m.position.x -= 2.8; m.position.y += 1.5; });
  const s1 = U3.bowS1 = part(GEO.cyl, str, bw, 0, 0, 0, 0.12, 1, 0.12), s2 = U3.bowS2 = part(GEO.cyl, str, bw, 0, 0, 0, 0.12, 1, 0.12);
  const ar = U3.arrowVM = new THREE.Group(); bw.add(ar);
  part(GEO.cyl, wood, ar, 0, 0, 0, 0.22, 26, 0.22, 0, 0, Math.PI / 2);
  part(GEO.cone, stone, ar, -26, 0, 0, 0.6, 3.2, 0.3, 0, 0, Math.PI / 2);
  part(GEO.box, M(0xc8483a, 0x100404), ar, -1.5, 0.5, 0, 4, 0.9, 0.08); part(GEO.box, M(0xe8e0d0, 0x101010), ar, -1.5, -0.5, 0, 4, 0.9, 0.08);
  const rh = U3.bowHand = new THREE.Group(); bw.add(rh); hand(rh, 1); rh.scale.setScalar(0.8);
  U3.vmLag = { y: 0, p: 0, py: G.yaw || 0, pp: G.pitch || 0 }; U3.bowK = 0; U3.bowShow = 0; U3.lastCd = 0;
}
function updViewModel(dt, t) {
  const vm = U3.vm, mv = L.moving ? 1 : 0, lag = U3.vmLag;
  U3.vmSway = (U3.vmSway || 0) + (mv - (U3.vmSway || 0)) * Math.min(1, dt * 8);
  const sw = U3.vmSway, run = L.sprinting && L.moving ? 1.6 : 1, bx = Math.sin(U3.bob * 0.5) * 0.55 * sw * run, by = Math.abs(Math.cos(U3.bob * 0.5)) * 0.5 * sw * run + Math.sin(t * 1.6) * 0.1;
  // bakış gecikmesi: kamera dönerken eller hafifçe geride kalır
  const yaw = G.yaw || 0, pitch = G.pitch || 0; let dy = yaw - lag.py; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  lag.y = clamp(lag.y * Math.pow(0.0008, dt) + dy * 0.6, -0.12, 0.12); lag.p = clamp(lag.p * Math.pow(0.0008, dt) + (pitch - lag.pp) * 0.6, -0.1, 0.1); lag.py = yaw; lag.pp = pitch;
  vm.rotation.set(-lag.p * 0.8, -lag.y * 0.9, lag.y * 0.4);
  vm.position.set(0, L.sneak ? -0.8 : 0, 0);
  const narrow = U3.cam.aspect < 1 ? 0.62 : U3.cam.aspect > 1.9 ? 0.92 : 1;
  vm.visible = !(L.hp <= 0) && !G.sleep;
  // yay: elde yay varsa ve ok atılıyorsa / az önce atıldıysa
  const hold = (typeof keys !== 'undefined' && keys.KeyF) || (typeof mouse !== 'undefined' && mouse.right) || (typeof touch !== 'undefined' && touch.shoot);
  const hasBow = !!(L.eq && L.eq.yay), cd = G.shootCd || 0, shot = cd > U3.lastCd + 0.3; U3.lastCd = cd;
  if (hasBow && (hold || shot)) U3.bowShow = 2.2; else U3.bowShow -= dt;
  const bowOn = hasBow && U3.bowShow > 0;
  if (shot) U3.bowK = 0;
  const want = bowOn && cd < 0.25 ? 1 : 0; U3.bowK += (want - U3.bowK) * Math.min(1, dt * (want ? 4 : 30));
  U3.bowVis = (U3.bowVis || 0) + ((bowOn ? 1 : 0) - (U3.bowVis || 0)) * Math.min(1, dt * 8);
  const sp = U3.spear, bw = U3.bow, bv = U3.bowVis;
  // mızrak dürtüşü: geri çek -> ileri sapla -> toparla
  const k = clamp((L.swing || 0) / 0.2, 0, 1), ph = 1 - k;
  const back = ph < 0.25 ? ph / 0.25 : 0, th = ph < 0.25 ? -back * 0.35 : Math.sin(clamp((ph - 0.25) / 0.75, 0, 1) * Math.PI);
  sp.visible = bv < 0.98;
  sp.position.set(7.6 * narrow + bx - th * 2.6, -7.2 - by + th * 1.8 - bv * 14, -11 - th * 12);
  sp.rotation.set(-1.47 + th * 0.08, 0.05 + th * 0.07, 0.05 - th * 0.05, 'YXZ');
  bw.visible = bv > 0.02;
  if (bw.visible) {
    const bk = U3.bowK, vib = shot || (U3.bowK < 0.05 && cd > 0.4) ? Math.sin(t * 60) * Math.max(0, cd - 0.4) * 1.5 : 0;
    bw.position.set(-3.2 * narrow + bx * 0.6, -3.6 - by * 0.6 - (1 - bv) * 14, -15 + bk * 1.0); bw.rotation.set(-0.32, -Math.PI / 2 + 0.08, 0, 'YXZ'); bw.scale.setScalar(0.62);
    const top = new THREE.Vector3(12.2 - 15 * Math.cos(Math.PI * 0.31), 15 * Math.sin(Math.PI * 0.31), 0), bot = top.clone().setY(-top.y), nock = new THREE.Vector3(top.x + 0.6 + bk * 12 + vib, 0, 0);
    const seg = (m, a, b) => { m.position.copy(a).add(b).multiplyScalar(0.5); m.position.y -= 0; const d = b.clone().sub(a); m.scale.y = d.length(); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.position.addScaledVector(d, -m.scale.y * 0.5); };
    seg(U3.bowS1, bot, nock); seg(U3.bowS2, nock, top);
    U3.arrowVM.visible = cd < 0.35; U3.arrowVM.position.set(nock.x, 0.3, 0.6);
    U3.bowHand.position.set(nock.x + 4.5, 0, 1.2); U3.bowHand.rotation.set(0, 0, Math.PI / 2);
  }
  const tc = U3.torch;
  tc.visible = !!G.torchOn && bv < 0.5;
  if (tc.visible) {
    tc.position.set(-7.4 * narrow - bx, -6.2 - by * 0.8, -11.5); tc.rotation.set(-0.3 + Math.sin(t * 1.3) * 0.02, 0, 0.2 + Math.sin(U3.bob * 0.5) * 0.04 * sw);
    U3.torchFl.forEach((m, i) => { const f = 1 + Math.sin(t * (11 + i * 3) + i) * 0.2 + Math.sin(t * 27 + i * 2) * 0.08; m.scale.y = (5 - i * 1.3) * f; m.position.x = Math.sin(t * 8 + i) * 0.25; m.rotation.y = t * 2; });
    const gs = 13 + Math.sin(t * 13) * 1.2; U3.torchGlow.scale.set(gs, gs, 1); U3.torchGlow.material.opacity = 0.25 + 0.3 * (U3.dk || 0);
  }
}

// =============================================================
//  ARAZİ — kamerayı izleyen dörtlü ağaç parçaları (yakında sık, uzakta seyrek)
//  Her parça (N+1)^2 köşe + çatlakları örten etek; normal ve renk groundH'den.
// =============================================================
const TER = { N: 20, MIN: 512, ROOT: 32768, K: 1.2, FAR: 7200, nodes: new Map(), want: null, wantSet: null, shown: null, wx: 1e9, wz: 1e9, idx: null, group: null };
// biyom renkleri: 0 orman, 1 dağ, 2 bataklık, 3 sisli vadi, 4 çayır, 5 kumsal
const BIOME_COL = ['#3b5a28', '#6c675d', '#3a4426', '#4a5550', '#6f8e3a', '#cbb98a', '#8f8058', '#3b5a28'];
const BIOME_GR = [1, 0.25, 0.8, 0.7, 1, 0, 0, 1];
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
let TC = null;
function terColor(x, z, h, ny, out) {
  if (!TC) TC = { b: BIOME_COL.map(c => new THREE.Color(c)), rock: new THREE.Color('#6b655c'), rock2: new THREE.Color('#57524b'), snow: new THREE.Color('#f2f5f8'), sand: new THREE.Color('#e6d3a2'), wet: new THREE.Color('#a8946a'), deep: new THREE.Color('#1f4250'), dirt: new THREE.Color('#6e5638'), litter: new THREE.Color('#5a4a2c'), au1: new THREE.Color('#8a6a2c'), au2: new THREE.Color('#7a4a24'), straw: new THREE.Color('#7e7452'), fresh: new THREE.Color('#5c9a30'), t: new THREE.Color() };
  let r = 0, g = 0, b = 0, gr = 0;
  for (let k = 0; k < 4; k++) { const bi = bioAt(x + (k & 1 ? 55 : -55), z + (k & 2 ? 55 : -55)), c = TC.b[bi]; r += c.r; g += c.g; b += c.b; gr += BIOME_GR[bi]; }
  out.setRGB(r / 4, g / 4, b / 4); gr /= 4;
  const n1 = vnoise3(x * 0.0035, z * 0.0035, 3.7), n2 = vnoise3(x * 0.017, z * 0.017, 8.1);
  out.multiplyScalar(0.78 + n1 * 0.3 + n2 * 0.16);
  if (gr > 0.5 && n2 > 0.62) out.lerp(TC.litter, (n2 - 0.62) * 1.2 * gr);           // yaprak döküntüsü / çıplak toprak lekeleri
  const slope = 1 - ny;
  const rk = Math.max(smooth(0.2, 0.42, slope), smooth(360, 470, h) * 0.85);
  if (rk > 0) { TC.t.copy(n2 > 0.5 ? TC.rock : TC.rock2).multiplyScalar(0.85 + n1 * 0.3); out.lerp(TC.t, rk); gr *= 1 - rk; }
  const sn = smooth(430, 500, h + (n1 - 0.5) * 140 + (n2 - 0.5) * 40) * (1 - smooth(0.5, 0.75, slope));
  if (sn > 0) { out.lerp(TC.snow, sn); gr *= 1 - sn; }
  { const S = U3.sl;                                                                 // mevsim: bitki örtüsü rengi
    if (S && gr > 0.05) { const k = Math.min(1, gr * 1.3);
      if (S.au > 0.01) out.lerp(n1 > 0.5 ? TC.au1 : TC.au2, S.au * 0.5 * k);
      if (S.wi > 0.01) out.lerp(TC.straw, S.wi * 0.5 * k);
      if (S.sp > 0.01) out.lerp(TC.fresh, S.sp * 0.22 * k); }
    TC.sc = snowCover(x, z, h, n2) * (1 - smooth(0.5, 0.75, slope)); }                 // kar örtüsü (derinlik alanından, yamalı) — sonda uygulanır
  TC.sk = 0; { const bs = bioAt(x, z) === 5 ? 1 : 0, s = Math.max(h < 8 ? smooth(8, 1.2, h + (n2 - 0.5) * 3) : 0, bs * (1 - rk)); if (s > 0) { out.lerp(TC.sand, s * 0.92); gr *= 1 - s; TC.sk = s; } }
  if (h < SEA_Y + 0.6) { out.lerp(TC.wet, smooth(SEA_Y + 0.6, -3, h)); out.lerp(TC.deep, smooth(-2, -45, h)); gr = 0; }
  const dc = Math.hypot(x - CAMP.x, z - CAMP.y); if (dc < 320) { out.lerp(TC.dirt, smooth(320, 60, dc) * (0.75 + n2 * 0.2)); gr *= 0.4 + 0.6 * smooth(60, 320, dc); }
  if (G.lakes) for (const l of G.lakes) { const dl = Math.hypot(x - l.x, z - l.y); if (dl < l.r + 70) { const s = smooth(l.r + 70, l.r, dl) * 0.75; out.lerp(TC.wet, s); gr *= 1 - s; } }
  if (TC.sc > 0 && h > SEA_Y + 0.6) { const sc = TC.sc * (dc < 320 ? 0.6 + 0.4 * smooth(60, 320, dc) : 1) * (1 - TC.sk * 0.5); out.lerp(TC.snow, sc * 0.97); gr *= 1 - sc; if (sc > 0.3) TC.sk = 0; }
  return gr;
}
// kar örtüsü 0..1: dunya.js derinlik bantlarından (U3.sl.snow, yeniden boyama anındaki kopya); az karda yamalı
function snowCover(x, z, h, n) {
  const S = U3.sl; if (!S || h < 1) return 0;
  const B = S.snow, f = clamp(h / 100, 0, B.length - 1), i = Math.min(B.length - 2, f | 0), u = f - i;
  let d = B[i] + (B[i + 1] - B[i]) * u; if (d < 0.01) return 0;
  const b = bioAt(x, z); d *= b === 5 ? 0.55 : b === 2 ? 0.75 : b === 6 ? 0 : 1;
  if (n === undefined) n = vnoise3(x * 0.017, z * 0.017, 8.1);
  const th = 0.04 + n * 0.32; return smooth(th, th + 0.22, d);
}
// mevsim/kar değişince görünen parçaları yeniden boya: kare başına birkaç parça, en yakından başlayarak
function terColorsOf(x0, z0, size, geo) {
  const N = TER.N, V = (N + 1) * (N + 1), pos = geo.attributes.position.array, nor = geo.attributes.normal.array, col = geo.attributes.color.array, grs = geo.attributes.aG.array;
  for (let v = 0; v < V; v++) {
    const gx = x0 + pos[v * 3], gz = z0 + pos[v * 3 + 2], g = terColor(gx, gz, pos[v * 3 + 1], nor[v * 3 + 1], _col), n = 0.92 + hash2(gx, gz) * 0.16;
    col[v * 3] = _col.r * n; col[v * 3 + 1] = _col.g * n; col[v * 3 + 2] = _col.b * n; grs[v] = g > 0.02 ? g : -TC.sk;
  }
  const ed = [[0, 1], [N * (N + 1), 1], [0, N + 1], [N, N + 1]];
  ed.forEach(([s, st], q) => { for (let k = 0; k <= N; k++) { const a = s + k * st, b = V + q * (N + 1) + k; col[b * 3] = col[a * 3]; col[b * 3 + 1] = col[a * 3 + 1]; col[b * 3 + 2] = col[a * 3 + 2]; grs[b] = grs[a]; } });
  geo.attributes.color.needsUpdate = true; geo.attributes.aG.needsUpdate = true;
}
function seasonSync(dt, cx, cz) {
  const now = performance.now();
  if (!U3.sl || !(now < U3.slT)) {
    U3.slT = now + 500;
    const n = seasonLook(), o = U3.sl;
    let ch = !o, chI = !o;
    if (o) { const dS = Math.max(Math.abs(n.sp - o.sp), Math.abs(n.au - o.au), Math.abs(n.wi - o.wi)); let dN = 0; for (let i = 0; i < n.snow.length; i++) dN = Math.max(dN, Math.abs(n.snow[i] - o.snow[i])); ch = dS > 0.04 || dN > 0.03; }
    if (ch) { U3.sl = n; TER.gen = (TER.gen || 0) + 1; GR.gen = (GR.gen || 0) + 1; U3.instX = 1e9; }
  }
  // en fazla 3 parça / ~3 ms; o karede yeni parça kurulduysa yalnız 1 (yeni parçalar asla bekletilmez)
  const t0 = performance.now(), lim = TER.builtLast ? 1 : 3; let done = 0;
  while (done < lim && performance.now() - t0 < 3) {
    let best = null, bd = 1e18;
    for (const k of TER.want || []) { const nd = TER.nodes.get(k); if (!nd || nd.gen === TER.gen || !nd.m.visible) continue; const x0 = nd.x0 + nd.s / 2 - cx, z0 = nd.z0 + nd.s / 2 - cz, d = x0 * x0 + z0 * z0; if (d < bd) { bd = d; best = nd; } }
    if (!best) break;
    terColorsOf(best.x0, best.z0, best.s, best.m.geometry); best.gen = TER.gen; done++;
  }
  U3.recolN = done;
  grassReseason(2);
}
function terIndex() {
  if (TER.idx) return TER.idx;
  const N = TER.N, V = (N + 1) * (N + 1), ix = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; if ((i + j) & 1) ix.push(a, c, b, b, c, d); else ix.push(a, c, d, a, d, b); }
  // etekler: kenar köşesi -> aşağı kopyası (iki yüzlü)
  const edges = [[0, 1, 0], [N * (N + 1), 1, N + 1], [0, N + 1, 2 * (N + 1)], [N, N + 1, 3 * (N + 1)]];
  for (const [s, st, o] of edges) for (let k = 0; k < N; k++) { const a = s + k * st, b = s + (k + 1) * st, c = V + o + k, d = V + o + k + 1; ix.push(a, b, c, b, d, c, a, c, b, b, c, d); }
  return (TER.idx = new THREE.BufferAttribute(new Uint16Array(ix), 1));
}
function terBuild(key) {
  const [x0, z0, size] = key.split(',').map(Number), N = TER.N, c = size / N, E = N + 3, H = new Float32Array(E * E);
  for (let j = 0; j < E; j++) for (let i = 0; i < E; i++) H[j * E + i] = gh(x0 + (i - 1) * c, z0 + (j - 1) * c);
  const V = (N + 1) * (N + 1), T = V + 4 * (N + 1), pos = new Float32Array(T * 3), nor = new Float32Array(T * 3), col = new Float32Array(T * 3), grs = new Float32Array(T);
  let ymin = 1e9, ymax = -1e9;
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const v = j * (N + 1) + i, e = (j + 1) * E + i + 1, h = H[e];
    let nx = (H[e - 1] - H[e + 1]) / (2 * c), nz = (H[e - E] - H[e + E]) / (2 * c), nl = Math.hypot(nx, 1, nz);
    nx /= nl; nz /= nl; const ny = 1 / nl;
    pos[v * 3] = i * c; pos[v * 3 + 1] = h; pos[v * 3 + 2] = j * c;
    nor[v * 3] = nx; nor[v * 3 + 1] = ny; nor[v * 3 + 2] = nz;
    const gx = x0 + i * c, gz = z0 + j * c, g = terColor(gx, gz, h, ny, _col), n = 0.92 + hash2(gx, gz) * 0.16;
    col[v * 3] = _col.r * n; col[v * 3 + 1] = _col.g * n; col[v * 3 + 2] = _col.b * n; grs[v] = g > 0.02 ? g : -TC.sk;
    if (h < ymin) ymin = h; if (h > ymax) ymax = h;
  }
  const sk = 6 + size * 0.03, ed = [[0, 1], [N * (N + 1), 1], [0, N + 1], [N, N + 1]];
  ed.forEach(([s, st], q) => { for (let k = 0; k <= N; k++) { const a = s + k * st, b = V + q * (N + 1) + k; for (let m = 0; m < 3; m++) { pos[b * 3 + m] = pos[a * 3 + m]; nor[b * 3 + m] = nor[a * 3 + m]; col[b * 3 + m] = col[a * 3 + m]; } pos[b * 3 + 1] -= sk; grs[b] = grs[a]; } });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('aG', new THREE.BufferAttribute(grs, 1));
  geo.setIndex(terIndex());
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(size / 2, (ymin + ymax) / 2, size / 2), Math.hypot(size * 0.71, (ymax - ymin) / 2 + sk));
  const m = new THREE.Mesh(geo, MAT.terrain); m.position.set(x0, 0, z0); m.matrixAutoUpdate = false; m.updateMatrix(); m.visible = false;
  TER.group.add(m);
  return { m, used: 0, gen: TER.gen || 0, x0, z0, s: size };
}
function terWant(cx, cz) {
  const out = [], R = TER.ROOT, o = WORLD / 2 - R / 2, M = 2600;
  const rec = (x0, z0, s) => {
    if (x0 + s < -M || z0 + s < -M || x0 > WORLD + M || z0 > WORLD + M) return;
    const dx = Math.max(x0 - cx, 0, cx - x0 - s), dz = Math.max(z0 - cz, 0, cz - z0 - s), d = Math.hypot(dx, dz);
    if (d > TER.FAR) return;
    if (s > TER.MIN && d < s * TER.K) { const h = s / 2; rec(x0, z0, h); rec(x0 + h, z0, h); rec(x0, z0 + h, h); rec(x0 + h, z0 + h, h); }
    else out.push(x0 + ',' + z0 + ',' + s);
  };
  rec(o, o, R); return out;
}
function terUpdate(cx, cz, budget) {
  if (!TER.want || Math.abs(cx - TER.wx) + Math.abs(cz - TER.wz) > 40) { TER.want = terWant(cx, cz); TER.wantSet = new Set(TER.want); TER.wx = cx; TER.wz = cz; }
  let built = 0, ready = true;
  for (const k of TER.want) {
    let n = TER.nodes.get(k);
    if (!n) { if (built >= budget) { ready = false; continue; } n = terBuild(k); TER.nodes.set(k, n); built++; }
    n.used = U3.frame;
  }
  TER.builtLast = built;
  if (ready && TER.shown !== TER.wantSet) {
    TER.shown = TER.wantSet;
    for (const [k, n] of TER.nodes) n.m.visible = TER.shown.has(k);
  }
  if (TER.nodes.size > 260) for (const [k, n] of TER.nodes) if (!n.m.visible && U3.frame - n.used > 300) { TER.group.remove(n.m); n.m.geometry.dispose(); TER.nodes.delete(k); }
}
function terReset() {
  if (TER.group) for (const n of TER.nodes.values()) { TER.group.remove(n.m); n.m.geometry.dispose(); }
  TER.nodes.clear(); TER.want = TER.wantSet = TER.shown = null; TER.wx = 1e9;
}
function initTerrainMat() {
  const m = MAT.terrain = new THREE.MeshLambertMaterial({ vertexColors: true });
  U3.fogCap = { value: 0.86 }; U3.fogLift = { value: 0.3 };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { tGround: { value: TEX.ground }, tNoise: { value: TEX.noise }, uTime: U3.uTime, uFogCap: U3.fogCap, uFogLift: U3.fogLift });
    sh.vertexShader = 'attribute float aG;\nvarying float vG;\nvarying float vSlope;\nvarying vec3 vWP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvG = aG; vSlope = clamp(1.0 - abs(normal.y), 0.0, 1.0); vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying float vG;\nvarying float vSlope;\nvarying vec3 vWP;\nuniform sampler2D tGround;\nuniform sampler2D tNoise;\nuniform float uTime;\nuniform float uFogCap;\nuniform float uFogLift;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        float g1 = texture2D(tGround, vWP.xz / 150.0).r;
        float g2 = texture2D(tNoise, vWP.xz / 64.0).r;
        float g3 = texture2D(tNoise, vWP.xz / 1100.0 + 0.37).r;
        float g4 = texture2D(tNoise, vWP.xz / 13.0).r;
        float gk = clamp(vG, 0.0, 1.0), sk = clamp(-vG, 0.0, 1.0);
        float det = mix(mix(1.0 + (g2 - 0.69) * 0.95 + (g4 - 0.69) * 0.35, 1.02 + (g4 - 0.69) * 0.22 + (g3 - 0.69) * 0.2, sk), 0.5 + g1 * 0.62, gk);
        diffuseColor.rgb *= det * (1.0 + (g3 - 0.69) * 1.1);
        float cliff = smoothstep(0.12, 0.45, vSlope) * (1.0 - sk);
        float strata = 0.5 + 0.5 * sin(vWP.y * 0.13 + g2 * 3.0 + g3 * 5.0);
        vec3 rock = mix(vec3(0.30, 0.285, 0.25), vec3(0.49, 0.46, 0.39), smoothstep(0.25, 0.75, strata));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.55 + rock * 0.45, cliff);
        float wl = 0.25 * sin(uTime * 0.9 + (vWP.x + vWP.z * 0.6) * 0.012);
        float shr = 1.0 - smoothstep(0.0, 0.45, abs(vWP.y - wl));
        float fw = 0.5 + 0.5 * sin(uTime * 1.3 + (vWP.x * 0.7 + vWP.z) * 0.05 + g2 * 9.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.96, 0.96), shr * smoothstep(0.35, 0.9, fw) * 0.7);`)
      .replace('#include <fog_fragment>', `#ifdef USE_FOG
        float fogF = smoothstep(fogNear, fogFar, vFogDepth);
        fogF = min(fogF, uFogCap - clamp(vWP.y / 900.0, 0.0, 1.0) * uFogLift);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogF);
        #endif`);
  };
  // deniz: dalga normalleri dünya koordinatında (kayma yok), kıyıdan bakınca yarı saydam
  const s = MAT.sea = new THREE.MeshPhongMaterial({ color: 0x1e5a6e, specular: 0x9fb4c0, shininess: 70, transparent: true, opacity: 0.8, emissive: 0x03121a });
  U3.seaSky = { value: new THREE.Color() };
  s.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uTime: U3.uTime, uSky: U3.seaSky });
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vWP;\nuniform float uTime;\nuniform vec3 uSky;\n' + sh.fragmentShader
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        { vec2 p = vWP.xz; float t = uTime;
          vec3 nw = normalize(vec3(0.07 * sin(p.x * 0.021 + t * 1.1) + 0.05 * sin((p.x + p.y) * 0.043 - t * 1.7) + 0.035 * sin(p.y * 0.11 + p.x * 0.03 + t * 2.6) + 0.02 * sin(p.x * 0.31 - t * 3.1),
            1.0, 0.07 * cos(p.y * 0.019 - t * 0.9) + 0.05 * cos((p.x - p.y) * 0.047 + t * 1.3) + 0.035 * sin(p.x * 0.097 - p.y * 0.05 - t * 2.2) + 0.02 * cos(p.y * 0.29 + t * 2.7)));
          normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz); }`)
      .replace('#include <fog_fragment>', `{ vec3 vd = normalize(cameraPosition - vWP); float fr = pow(1.0 - clamp(dot(vd, vec3(0.0, 1.0, 0.0)), 0.0, 1.0), 4.0);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uSky, fr * 0.55); gl_FragColor.a = mix(gl_FragColor.a, 1.0, fr); }
        #include <fog_fragment>`);
  };
}

// ---- yakın çevre otları: kamerayı izleyen karo halkası; her karonun örnekli ağda sabit yuvası var
const GR = { T: 80, R: 4, nB: 30, nF: 10, nE: 3, slots: new Map(), free: [], cx: 1e9, cz: 1e9, sg: new Map(), gen: 0 };
function initGrass() {
  // ot öbeği: dışa eğik 5 yaprak, dipte koyu
  { const p = [], c = [];
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.4, ca = Math.cos(a), sa = Math.sin(a), w = 0.09, lx = -sa * w, lz = ca * w, tl = 0.85 + (i % 3) * 0.15;
      p.push(ca * 0.08 + lx, 0, sa * 0.08 + lz, ca * 0.08 - lx, 0, sa * 0.08 - lz, ca * 0.42, tl, sa * 0.42); c.push(0.42, 0.45, 0.4, 0.42, 0.45, 0.4, 1.1, 1.1, 1.0); }
    const g = GEO.blade = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(p.length).fill(0).map((_, i) => i % 3 === 1 ? 1 : 0), 3)); }
  { const p = [];
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU, b = a + 0.5, c = a - 0.5; p.push(0, 1, 0, Math.cos(c) * 0.7, 1.15, Math.sin(c) * 0.7, Math.cos(b) * 0.7, 1.15, Math.sin(b) * 0.7); }
    p.push(-0.06, 0, 0, 0.06, 0, 0, 0, 1, 0);
    GEO.flower = new THREE.BufferGeometry(); GEO.flower.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); GEO.flower.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(p.length).fill(0).map((_, i) => i % 3 === 1 ? 1 : 0), 3)); }
  const sway = m => { m.onBeforeCompile = sh => { sh.uniforms.uTime = U3.uTime; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      { vec3 ip = instanceMatrix[3].xyz; float ph = uTime * 1.6 + ip.x * 0.045 + ip.z * 0.03; transformed.x += (sin(ph) * 0.12 + sin(ph * 2.3 + ip.z) * 0.05) * position.y; transformed.z += cos(ph * 0.8 + ip.x * 0.1) * 0.07 * position.y; }
      #endif`); }; return m; };
  MAT.grass = sway(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  MAT.grassF = sway(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }));
  const n = (2 * GR.R + 1) ** 2;
  U3.grB = mkInst(GEO.blade, MAT.grass, n * GR.nB); U3.grF = mkInst(GEO.flower, MAT.grassF, n * GR.nF); U3.grE = mkInst(GEO.fern, MAT.grassF, n * GR.nE);
  for (const m of [U3.grB, U3.grF, U3.grE]) { m.count = m.userData.max; m.instanceMatrix.setUsage(THREE.StaticDrawUsage); for (let i = 0; i < m.count; i++) { m.setMatrixAt(i, _zeroM); m.setColorAt(i, _col.set(0xffffff)); } m.instanceMatrix.needsUpdate = true; }
  GR.free = []; for (let i = 0; i < n; i++) GR.free.push(i); GR.slots.clear();
}
const _zeroM = new THREE.Matrix4().makeScale(0, 0, 0);
const GR_COL = [['#4f7a30', '#5d8a36', '#3f6a2a'], ['#7a8050', '#8a8a5a', '#6a7048'], ['#4a5a2a', '#56622e', '#3d4a22'], ['#5a6a56', '#4e5e4a', '#66705e'], ['#86a63e', '#9ab448', '#74963a', '#a8b85a'], ['#b8b07a', '#a8a070', '#c4bb88']];
const FL_COL = ['#f4f0e8', '#f2d03a', '#b46ad8', '#e8584a', '#f0a8c8', '#7a9cf0'];
function grassFill(ti, tj, slot) {
  const T = GR.T, R = mulberry32(((ti * 73856093) ^ (tj * 19349663) ^ (G.seed || 1)) >>> 0), x0 = ti * T, z0 = tj * T;
  const blk = []; for (const b of G.builds) if (!b.dead && Math.abs(b.x - x0 - T / 2) < T + b.r && Math.abs(b.y - z0 - T / 2) < T + b.r) blk.push(b);
  const ok = (x, z) => { if (Math.hypot(x - G.fire.x, z - G.fire.y) < 130) return false; for (const b of blk) if ((x - b.x) ** 2 + (z - b.y) ** 2 < (b.r + 6) ** 2) return false; return true; };
  const B = U3.grB, F = U3.grF, E = U3.grE;
  let ib = slot * GR.nB, ifl = slot * GR.nF, ie = slot * GR.nE;
  const eB = ib + GR.nB, eF = ifl + GR.nF, eE = ie + GR.nE;
  for (let k = 0; k < GR.nB; k++) {
    const x = x0 + R() * T, z = z0 + R() * T, r1 = R(), r2 = R(), r3 = R();
    const b = bioAt(x, z), h = gh(x, z);
    const dens = [0.6, 0.3, 0.75, 0.55, 1, 0.14][b] || 0.6;
    if (r1 > dens || h < 2 || h > 470 || !ok(x, z)) continue;
    const sc = snowCover(x, z, h); if (sc > 0.45 + r2 * 0.4) continue;                // karın altında kalan ot
    const pal = GR_COL[b] || GR_COL[0], meadow = b === 4, s = (meadow ? 9 : b === 2 ? 8 : b === 5 ? 7 : 5.5) * (0.65 + r2 * 0.7) * (1 - sc * 0.4);
    B.setMatrixAt(ib, mat4(x, h - 0.5, z, s * 1.1, s * (meadow ? 1.5 : 1.1), s * 1.1, 0, r3 * TAU, 0)); B.setColorAt(ib, seaTint(_col.set(pal[Math.floor(r3 * pal.length)]).multiplyScalar(0.85 + r2 * 0.3), 2, r3, sc * 0.6)); ib++;
    const flOk = !U3.sl || (U3.sl.au + U3.sl.wi < r2 * 1.4 && sc < 0.1);              // sonbahar/kışta çiçek yok
    if (ifl < eF && flOk && (meadow ? R() < 0.42 : b === 0 ? R() < 0.06 : b === 3 ? R() < 0.04 : false)) {
      const fc = meadow ? FL_COL[Math.floor(R() * FL_COL.length)] : '#eeeadf', fs = 1.3 + R() * 0.9, fh = s * (meadow ? 1.05 : 0.8);
      F.setMatrixAt(ifl, mat4(x + 2, h, z + 1, fs, fh, fs, 0, r1 * 9, 0)); F.setColorAt(ifl, _col.set(fc)); ifl++;
    }
    if (ie < eE && (b === 0 || b === 2) && R() < 0.12) {
      const fs = 10 + R() * 8; E.setMatrixAt(ie, mat4(x, h - 0.5, z, fs, fs * 0.9, fs, 0, r2 * 9, 0)); E.setColorAt(ie, seaTint(_col.set(b === 2 ? '#4a5a2a' : '#3c6e2c').multiplyScalar(0.8 + r3 * 0.4), 2, r3, sc * 0.6)); ie++;
    }
  }
  for (; ib < eB; ib++) B.setMatrixAt(ib, _zeroM);
  for (; ifl < eF; ifl++) F.setMatrixAt(ifl, _zeroM);
  for (; ie < eE; ie++) E.setMatrixAt(ie, _zeroM);
}
// mevsim/kar değişince ot karolarını yavaşça (kare başına birkaç) yeniden doldur
function grassReseason(budget) {
  let n = 0;
  for (const [k, sl] of GR.slots) { if (GR.sg.get(k) === GR.gen) continue; if (n >= budget) break; const [i, j] = k.split(',').map(Number); grassFill(i, j, sl); GR.sg.set(k, GR.gen); n++; }
  if (n) for (const m of [U3.grB, U3.grF, U3.grE]) instDone(m);
}
function grassUpdate(cx, cz, budget) {
  const T = GR.T, ci = Math.floor(cx / T), cj = Math.floor(cz / T);
  if (ci === GR.cx && cj === GR.cz && !GR.pend) return;
  GR.cx = ci; GR.cz = cj;
  const want = new Set();
  for (let j = -GR.R; j <= GR.R; j++) for (let i = -GR.R; i <= GR.R; i++) if (i * i + j * j <= GR.R * GR.R + 2) want.add((ci + i) + ',' + (cj + j));
  for (const [k, s] of GR.slots) if (!want.has(k)) { GR.slots.delete(k); GR.free.push(s); for (const [m, n] of [[U3.grB, GR.nB], [U3.grF, GR.nF], [U3.grE, GR.nE]]) for (let i = s * n; i < s * n + n; i++) m.setMatrixAt(i, _zeroM); }
  let done = 0; GR.pend = false;
  const order = [...want].filter(k => !GR.slots.has(k)).sort((a, b) => { const [ai, aj] = a.split(',').map(Number), [bi, bj] = b.split(',').map(Number); return ((ai - ci) ** 2 + (aj - cj) ** 2) - ((bi - ci) ** 2 + (bj - cj) ** 2); });
  for (const k of order) {
    if (done >= budget || !GR.free.length) { GR.pend = true; break; }
    const [i, j] = k.split(',').map(Number), s = GR.free.pop(); GR.slots.set(k, s); grassFill(i, j, s); GR.sg.set(k, GR.gen); done++;
  }
  if (done || order.length) for (const m of [U3.grB, U3.grF, U3.grE]) instDone(m);
}

// =============================================================
//  DÜNYA (durağan içerik) — yeni oyun / yükleme olduğunda yeniden kurulur
// =============================================================
function buildWorld() {
  if (U3.world) { U3.scene.remove(U3.world); disposeTree(U3.world, true); }
  for (const m of [U3.ents, U3.builds, U3.carcs, U3.camps]) { for (const e of m.values()) { if (m === U3.ents) dropEnt(e); else dropStatic(e); } m.clear(); }
  const W = U3.world = new THREE.Group(); U3.scene.add(W);
  // zemin: dörtlü ağaç arazi + deniz (her karede terUpdate ile güncellenir)
  terReset(); TER.group = new THREE.Group(); W.add(TER.group); U3.sl = typeof seasonLook === 'function' ? seasonLook() : null;
  U3.sea = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), MAT.sea); U3.sea.rotation.x = -Math.PI / 2; U3.sea.scale.set(30000, 30000, 1); U3.sea.renderOrder = 2; W.add(U3.sea);
  // göller ve bataklık havuzları: kıyı yüksekliklerinin en düşüğüne oturan düz su
  const waterY = (o, r) => { let m = 1e9; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; m = Math.min(m, gh(o.x + Math.cos(a) * r, o.y + Math.sin(a) * r)); } return Math.max(m, gh(o.x, o.y)) + 0.8; };
  U3.lakeM = []; for (const l of G.lakes) { const m = new THREE.Mesh(GEO.disc, l.frozen ? MAT.ice : MAT.water); m.scale.set(l.r + 6, 1, l.r + 6); m.position.set(l.x, l.h !== undefined ? l.h : waterY(l, l.r), l.y); W.add(m); U3.lakeM.push([l, m]); }
  for (const p of G.pools) { const m = new THREE.Mesh(GEO.disc, MAT.swamp); m.scale.set(p.r + 4, 1, p.r + 4); m.position.set(p.x, p.h !== undefined ? p.h : waterY(p, p.r) - 0.3, p.y); W.add(m); }
  U3.grassN = -1; GR.cx = 1e9; GR.slots.clear(); GR.free = []; for (let i = 0; i < (2 * GR.R + 1) ** 2; i++) GR.free.push(i);
  for (const m of [U3.grB, U3.grF, U3.grE]) { for (let i = 0; i < m.count; i++) m.setMatrixAt(i, _zeroM); instDone(m); }
  // örnekli ağlar
  const I = U3.inst = {};
  const nT = G.trees.length + G.deco.length;
  I.trunk = mkInst(GEO.treeTrunk, MAT.inst, nT * 5 + 8); I.cone = mkInst(GEO.treeCrown, MAT.treeCone, G.trees.length * 3 + 8); I.blob = mkInst(GEO.treeLeaf, MAT.treeLeaf, G.trees.length * 3 + 8);
  I.moss = mkInst(GEO.cone4, MAT.instD, G.trees.length * 3 + 8); I.frond = mkInst(GEO.frond, MAT.treeFrond, G.trees.length * 9 + 8);
  I.tshadow = mkInst(GEO.disc, MAT.tshadow, G.trees.length + G.rocks.length + 8); I.tshadow.renderOrder = 1;
  I.rock = mkInst(GEO.dod, MAT.rock, G.rocks.length * 2 + G.deco.length + 8);
  I.bush = mkInst(GEO.ico, MAT.inst, G.bushes.length * 2 + (G.herbs.length + G.poisons.length) + 8);
  I.berry = mkInst(GEO.ico, MAT.inst, 900);
  I.fern = mkInst(GEO.fern, MAT.instD, G.deco.length + G.herbs.length + G.poisons.length + 8);
  I.box = mkInst(GEO.box, MAT.inst, G.deco.length * 2 + 8);
  I.reed = mkInst(GEO.cone, MAT.inst, 900);
  I.tgrass = mkInst(GEO.blade, MAT.grass, G.deco.length * 3 + 8);
  I.crystal = mkInst(GEO.cone4, MAT.crystal, G.crystals.length * 4 + 8);
  for (const k in I) W.add(I[k]);
  U3.instX = 1e9; U3.sig = '';
  // yuvalar
  U3.nests = new THREE.Group(); W.add(U3.nests); U3.nestSig = -1;
  // yarık
  { const g = U3.riftG = new THREE.Group(); g.position.set(G.rift.x, gh(G.rift.x, G.rift.y), G.rift.y); W.add(g); U3.riftRings = [];
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.TorusGeometry(46 - i * 7, 1.6 - i * 0.2, 5, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL((200 + i * 12) / 360, 0.9, 0.6 + i * 0.05), fog: false })); m.position.y = 52; g.add(m); U3.riftRings.push(m); }
    const core = sprite(TEX.glow, 0xbfe0ff, true, false); core.scale.set(120, 170, 1); core.position.y = 52; g.add(core); U3.riftCore = core;
    const gb = new GB(), R = mulberry32(31); for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + R(), d = 50 + R() * 22, s = 8 + R() * 12; gb.dod('#5a5e6a', Math.cos(a) * d, s * 0.3, Math.sin(a) * d, s, s * (0.8 + R()), s, R() * 6); }
    g.add(gb.mesh()); }
  // kamp ateşi: taş halka, kütükler, kor, kıvılcımlar
  { const f = G.fire, g = U3.fireG = new THREE.Group(); g.position.set(f.x, gh(f.x, f.y), f.y); W.add(g);
    const gb = new GB(), R = mulberry32(77);
    for (let i = 0; i < 13; i++) { const a = i / 13 * TAU + R() * 0.2, s = 5.5 + R() * 2.5; gb.dod(i % 3 ? '#6a625a' : '#58524a', Math.cos(a) * 25, 2, Math.sin(a) * 25, s, s * 0.75, s, a * 3); }
    gb.add(GEO.disc, '#120c08', 0, 0.5, 0, 22, 1, 22);
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.3; gb.add(GEO.cyl, i % 2 ? '#4a2a14' : '#3a2010', Math.cos(a) * 3, 2, Math.sin(a) * 3, 2.6, 30, 2.6, 0, -a, -Math.PI / 2 + 0.55); }
    for (let i = 0; i < 9; i++) { const a = R() * TAU, d = 4 + R() * 12; gb.dod(R() < 0.5 ? '#2a1a12' : '#3a2418', Math.cos(a) * d, 1.2, Math.sin(a) * d, 2.4, 1.4, 2.4, a); }
    // yakacak odun yığını
    for (let i = 0; i < 6; i++) gb.add(GEO.cyl, '#5a3a1e', 44 + (i % 3) * 5.4 - (i > 2 ? 2.7 : 0), 2.8 + (i > 2 ? 4.8 : 0), -30, 2.7, 22, 2.7, 0, 0.5, Math.PI / 2);
    g.add(gb.mesh());
    const em = new THREE.Mesh(GEO.disc, new THREE.MeshBasicMaterial({ map: TEX.glow, color: 0xff5a10, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    em.position.y = 1.2; em.scale.set(20, 1, 20); g.add(em); U3.fireEmber = em;
    const pool = new THREE.Mesh(GEO.disc, new THREE.MeshBasicMaterial({ map: TEX.glow, color: 0xff7a28, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.position.y = 0.9; pool.scale.set(150, 1, 150); g.add(pool); U3.firePool = pool;
    U3.fireFl = mkFlame(30, g, 0, 3, 0);
    U3.fireGlow = sprite(TEX.glow, 0xff8a30, true, false); U3.fireGlow.position.y = 22; g.add(U3.fireGlow);
    { const n = 56, pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); pg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      U3.sparks = new THREE.Points(pg, new THREE.PointsMaterial({ map: TEX.glow, size: 3.2, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); U3.sparks.frustumCulled = false; g.add(U3.sparks); }
    U3.eggI = mkInst(GEO.sph, new THREE.MeshLambertMaterial({ color: 0xefe4c8 }), 6); g.add(U3.eggI); U3.eggN = -1; }
  // gemi enkazları ve dünya ekleri (dünya ajanı oluşturur)
  U3.wrecks = new Map();
}
// ---- kıvılcımlar: her biri kendi evresinde yükselir, savrulur, söner
function updSparks(t, k, on) {
  const P = U3.sparks; P.visible = on; if (!on) return;
  const pa = P.geometry.attributes.position, ca = P.geometry.attributes.color, n = pa.count;
  for (let i = 0; i < n; i++) {
    const sp = 0.35 + (i * 0.618 % 1) * 0.5, ph = (t * sp + i * 0.137) % 1, s = i * 12.9898;
    const r = ph * (8 + (i % 5) * 5) * k, a = s + t * (0.6 + (i % 3) * 0.3);
    pa.setXYZ(i, Math.cos(a) * r + Math.sin(t * 2.1 + s) * ph * 8, 12 * k + ph * (70 + (i % 7) * 14) * k, Math.sin(a) * r);
    const f = (1 - ph) * (ph < 0.08 ? ph / 0.08 : 1) * (0.6 + 0.4 * Math.sin(t * 25 + s));
    ca.setXYZ(i, f, f * (0.45 + (1 - ph) * 0.35), f * 0.12);
  }
  pa.needsUpdate = true; ca.needsUpdate = true;
}
function rebuildNests() {
  const g = U3.nests; while (g.children.length) { const c = g.children.pop(); c.geometry.dispose(); }
  for (const n of G.nests) {
    const gb = new GB();
    const h = gh(n.x, n.y);
    gb.add(GEO.torus, '#6a5030', n.x, h + 3, n.y, 15, 12, 15);
    gb.add(GEO.torus, '#54401f', n.x, h + 1.5, n.y, 20, 9, 20, 0, 1);
    for (let i = 0; i < 8; i++) { const a = i * 0.8; gb.add(GEO.cyl, '#7a6040', n.x + Math.cos(a) * 17, h + 4, n.y + Math.sin(a) * 17, 0.8, 14, 0.8, 0, a, 1.3); }
    for (let i = 0; i < n.eggs; i++) gb.sph('#efe6cc', n.x - 7 + i * 7, h + 5.5, n.y + (i % 2) * 3, 4.2, 5.8, 4.2);
    g.add(gb.mesh());
  }
}
const TREE_C = {}, _fa = new THREE.Color(), _fb = new THREE.Color(), _fc = new THREE.Color();
function treeCols(b, tone) {
  const key = b + '_' + Math.floor(tone * 6);
  let o = TREE_C[key]; if (o) return o;
  const pals = TREE_PAL[b] || TREE_PAL[0], pal = pals[Math.floor(tone * pals.length) % pals.length], v = 0.9 + (Math.floor(tone * 6) % 3) * 0.1;
  o = TREE_C[key] = { a: new THREE.Color(pal[1]).multiplyScalar(v * 1.15), b: new THREE.Color(pal[2]).multiplyScalar(v), c: new THREE.Color(pal[3] || pal[2]).multiplyScalar(v * 0.95), t: new THREE.Color(b === 3 ? '#4a443e' : b === 2 ? '#4a3a26' : b === 5 ? '#7a6448' : '#5a3d26').multiplyScalar(0.85 + (Math.floor(tone * 6) % 2) * 0.2) };
  return o;
}
// mevsim rengi: kind 0 iğne yapraklı, 1 geniş yapraklı, 2 ot/çalı; sc = kar örtüsü (beyazlatma)
const SEA_C = { au: ['#c8782a', '#b04a22', '#d4aa3a'].map(c => new THREE.Color(c)), sp: new THREE.Color('#72b442'), bare: new THREE.Color('#6a5c4e'), straw: new THREE.Color('#a39462'), snow: new THREE.Color('#eef2f6') };
function seaTint(col, kind, tone, sc) {
  const S = U3.sl;
  if (S) {
    if (kind === 1) { if (S.au > 0.01) col.lerp(SEA_C.au[Math.floor(tone * 3) % 3], S.au * 0.85); if (S.wi > 0.01) col.lerp(SEA_C.bare, S.wi * 0.9); if (S.sp > 0.01) col.lerp(SEA_C.sp, S.sp * 0.3); }
    else if (kind === 2) { if (S.au > 0.01) col.lerp(SEA_C.straw, S.au * 0.45); if (S.wi > 0.01) col.lerp(SEA_C.straw, S.wi * 0.6); if (S.sp > 0.01) col.lerp(SEA_C.sp, S.sp * 0.25); }
    else if (S.wi > 0.01) col.multiplyScalar(1 - S.wi * 0.12);
  }
  if (sc > 0) col.lerp(SEA_C.snow, Math.min(1, sc));
  return col;
}
function worldSig() {
  let s = 0, r = 0, c = 0, b = 0, h = 0, n = 0;
  for (const t of G.trees) if (t.stump) s++;
  for (const o of G.rocks) if (o.dead) r++;
  for (const o of G.crystals) if (o.dead) c++;
  for (const o of G.bushes) b += o.amt;
  for (const o of G.herbs) h += o.amt; for (const o of G.poisons) h += o.amt * 7;
  for (const o of G.nests) n += o.eggs;
  return s + '_' + r + '_' + c + '_' + b + '_' + h + '_' + n;
}
function rebuildInst(cx, cy) {
  const I = U3.inst; for (const k in I) I[k].count = 0;
  const TS = U3.tsh = [];   // ağaç/kaya gölgeleri: [x, z, yarıçap, gölge yüksekliği] — güneş yönüne göre fillTreeShadows yerleştirir
  U3.instX = cx; U3.instY = cy;
  const near = (o, R) => { const dx = o.x - cx, dy = o.y - cy; return dx * dx + dy * dy < R * R; };
  const stumpC = c3('#8a6a44'), col = _col, snowC = c3('#e8eef2'), mossC = c3('#7d8c5a'), deadC = c3('#4e4740');
  for (const t of G.trees) {
    if (!near(t, TREE_R)) continue;
    const y0 = gh(t.x, t.y) - 1.5;
    if (t.stump) { instAdd(I.trunk, t.x, y0, t.y, 9, 8.5, 9, t.sw, stumpC); continue; }
    const b = t.b === undefined ? bioAt(t.x, t.y) : t.b, C = treeCols(b, t.tone), k = (t.cr - 36) / 26, H = (125 + k * 120 + ((t.tone * 37) % 1) * 30) * (t.dark ? 1.35 : 1), cr = t.cr, r2 = (t.tone * 13) % 1;
    TS.push([t.x, t.y, cr * (b === 5 ? 0.9 : 1.05), b === 5 ? H * 0.7 : H * 0.55]);
    if (b === 5) {                                       // palmiye: kıvrık gövde + taç yaprakları
      let x = t.x, y = y0, z = t.y; const seg = 5, L = (H * 0.75) / seg, lean = 0.25 + r2 * 0.35;
      for (let i = 0; i < seg; i++) { const rz = lean * (i + 1) / seg, w = 5.2 - i * 0.55; instAdd(I.trunk, x, y, z, w, L * 1.06, w, t.sw, C.t, 0, rz); x += -Math.sin(rz) * Math.cos(t.sw) * L; y += Math.cos(rz) * L; z += Math.sin(rz) * Math.sin(t.sw) * L; }
      for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + t.sw, l = cr * (0.95 + ((i * 7) % 3) * 0.12); instAdd(I.frond, x, y - 1, z, l, l * 0.9, l * 0.85, a, i % 2 ? C.a : C.b, 0, -0.1 + (i % 3) * 0.12); }
      instAdd(I.blob, x, y - 4, z, 6, 6, 6, 0, C.t);
    } else if (b === 2 && r2 < 0.65) {                   // bataklık: kurumuş, yosun sarkan eğri ağaç
      const th = H * 0.55; instAdd(I.trunk, t.x, y0, t.y, 8, th, 8, t.sw, deadC, 0.08, 0.1);
      for (let i = 0; i < 4; i++) { const a = t.sw + i * 1.7, by = th * (0.55 + i * 0.12), bl = cr * (0.9 + (i % 2) * 0.4), rz = 0.85 + (i % 2) * 0.3;
        instAdd(I.trunk, t.x, y0 + by, t.y, 3.2 - i * 0.3, bl, 3.2 - i * 0.3, a, deadC, 0, rz);
        const ex = t.x - Math.sin(rz) * Math.cos(a) * bl * 0.8, ey = y0 + by + Math.cos(rz) * bl * 0.8, ez = t.y + Math.sin(rz) * Math.sin(a) * bl * 0.8;
        for (let m = 0; m < 3; m++) instAdd(I.moss, ex + (m - 1) * 3, ey, ez + ((m * 5) % 3 - 1) * 3, 2.6, 16 + ((i + m) % 3) * 9, 2.6, a + m, mossC, Math.PI, 0); }
      if (r2 < 0.3) instAdd(I.blob, t.x, y0 + th + 6, t.y, cr * 0.6, H * 0.12, cr * 0.6, t.sw, C.b);
    } else if (b === 1 || b === 3 || (b === 0 && r2 < 0.55)) {   // iğne yapraklı: üç kat
      const thin = b === 3 ? 0.7 : b === 1 ? 0.82 : 1, base = Math.max(40, H * 0.22), sn = Math.max(y0 > 400 ? clamp((y0 - 400) / 120, 0, 0.7) : 0, snowCover(t.x, t.y, y0) * 0.75);
      instAdd(I.trunk, t.x, y0, t.y, 8, H * 0.8, 8, t.sw, C.t);
      const cs = [C.a, C.b, C.c];
      for (let i = 0; i < 3; i++) { const yy = base + i * (H - base) * 0.27, rr = cr * (0.86 - i * 0.2) * thin, hh = (H - base) * (0.52 - i * 0.07); col.copy(cs[i]); seaTint(col, 0, t.tone, 0); if (sn) col.lerp(snowC, sn * (0.5 + i * 0.2)); instAdd(I.cone, t.x, y0 + yy, t.y, rr, hh, rr, t.sw + i * 0.7, col); }
    } else {                                             // geniş yapraklı (çayırda tek, iri)
      const lone = b === 4, th = H * (lone ? 0.5 : 0.62), wi = U3.sl ? U3.sl.wi : 0, cw = (lone ? 1.45 : 1.05) * (1 - wi * 0.35), tw = lone ? 12 : 9.5, tsc = snowCover(t.x, t.y, y0) * 0.55;
      const fa = seaTint(_fa.copy(C.a), 1, t.tone, tsc), fb = seaTint(_fb.copy(C.b), 1, (t.tone * 3.7) % 1, tsc), fc = seaTint(_fc.copy(C.c), 1, (t.tone * 7.3) % 1, tsc);
      instAdd(I.trunk, t.x, y0, t.y, tw, th, tw, t.sw, C.t, Math.sin(t.sw) * 0.04, Math.cos(t.sw) * 0.04);
      if (lone) for (let i = 0; i < 3; i++) { const a = t.sw + i * 2.1; instAdd(I.trunk, t.x, y0 + th * 0.7, t.y, 4, cr * 0.7, 4, a, C.t, 0, 0.9); }
      instAdd(I.blob, t.x, y0 + th + cr * 0.25, t.y, cr * 1.05 * cw, H * (lone ? 0.22 : 0.27) * (1 - wi * 0.3), cr * 1.05 * cw, t.sw, fa);
      instAdd(I.blob, t.x + Math.cos(t.sw) * cr * 0.45 * cw, y0 + th + H * 0.18, t.y + Math.sin(t.sw) * cr * 0.45 * cw, cr * 0.72 * cw, H * 0.2 * (1 - wi * 0.3), cr * 0.72 * cw, t.sw * 2, fb);
      instAdd(I.blob, t.x - Math.cos(t.sw + 0.8) * cr * 0.5 * cw, y0 + th + H * 0.08, t.y - Math.sin(t.sw + 0.8) * cr * 0.5 * cw, cr * 0.62 * cw, H * 0.17 * (1 - wi * 0.3), cr * 0.62 * cw, t.sw * 3, fc);
    }
  }
  for (const r of G.rocks) {
    if (r.dead || !near(r, ROCK_R)) continue;
    const g = (112 * r.shade) / 255, b = bioAt(r.x, r.y), mtn = b === 1, h = hash2(r.x, r.y), y0 = gh(r.x, r.y);
    col.setRGB(g + 0.05, g + 0.03, g); if (b === 5) col.lerp(c3('#b0a080'), 0.4); else if (!mtn && h > 0.5) col.lerp(c3('#5a7a3a'), 0.25);
    instAdd(I.rock, r.x, y0 + r.r * 0.15, r.y, r.r * 1.15, r.r * (mtn ? 1.3 + h * 1.4 : 0.75 + h * 0.5), r.r * 1.1, h * 6, col, h * 0.4, 0);
    TS.push([r.x, r.y, r.r * 1.35, r.r * (mtn ? 1.0 + h : 0.5)]);
    if (h > 0.55) instAdd(I.rock, r.x + r.r * 0.9, y0, r.y - r.r * 0.4, r.r * 0.45, r.r * 0.35, r.r * 0.5, h * 9, col);
  }
  for (const b of G.bushes) {
    if (!near(b, BUSH_R)) continue;
    const h = hash2(b.x, b.y), y0 = gh(b.x, b.y);
    seaTint(col.set('#2f5a24').multiplyScalar(0.85 + h * 0.4), 2, h, snowCover(b.x, b.y, y0) * 0.6);
    instAdd(I.bush, b.x, y0 + b.r * 0.45, b.y, b.r * 1.15, b.r * 0.8, b.r * 1.15, h * 6, col);
    instAdd(I.bush, b.x - 7, y0 + b.r * 0.4, b.y - 4, b.r * 0.75, b.r * 0.6, b.r * 0.75, h * 9, col);
    if (near(b, 520)) { const n = Math.min(7, b.amt + Math.floor(b.amt / 2)), bc = c3(b.col); for (let i = 0; i < n; i++) { const q = b.berries[i], rr = (q[0] * q[0] + q[1] * q[1]) / (b.r * b.r * 1.3); instAdd(I.berry, b.x + q[0], y0 + b.r * 0.45 + Math.sqrt(Math.max(0.05, 1 - rr)) * b.r * 0.8, b.y + q[1], 2.3, 2.3, 2.3, i, bc); } }
  }
  for (const h of G.herbs) {
    if (!near(h, BUSH_R)) continue;
    const y0 = gh(h.x, h.y);
    instAdd(I.fern, h.x, y0, h.y, 11, 9, 11, h.x, c3('#4c8a3a'));
    if (near(h, 520)) for (let i = 0; i < h.amt; i++) instAdd(I.berry, h.x + Math.cos(i * 2.1) * 6, y0 + 6, h.y + Math.sin(i * 2.1) * 6, 2.2, 1.6, 2.2, i, c3('#f4f8ff'));
  }
  for (const h of G.poisons) {
    if (!near(h, BUSH_R)) continue;
    const y0 = gh(h.x, h.y);
    instAdd(I.fern, h.x, y0, h.y, 13, 11, 13, h.x, c3('#7a3aa0'));
    instAdd(I.bush, h.x, y0 + 2, h.y, 6, 4, 6, 0, c3('#4a2262'));
    if (near(h, 520)) for (let i = 0; i < h.amt; i++) instAdd(I.berry, h.x - 3 + i * 6, y0 + 7, h.y - 2, 2, 2, 2, i, c3('#c6f04a'));
  }
  for (const d of G.deco) {
    if (!near(d, DECO_R)) continue;
    const s = d.s, y0 = gh(d.x, d.y);
    if (d.t === 'fern') { col.set('#356a2a').multiplyScalar(0.8 + ((d.a * 3) % 1) * 0.5); instAdd(I.fern, d.x, y0, d.y, 16 * s, 15 * s, 16 * s, d.a, col); }
    else if (d.t === 'bone') { instAdd(I.box, d.x, y0 + 1.2, d.y, 15 * s, 2.2, 2.6, -d.a, c3('#d8d0ba')); instAdd(I.box, d.x + Math.cos(d.a) * 4, y0 + 1.6, d.y + Math.sin(d.a) * 4, 2.2, 2.2, 9 * s, -d.a + 0.5, c3('#cfc6ae')); }
    else if (d.t === 'reed') { for (let i = -1; i <= 1; i++) instAdd(I.reed, d.x + i * 4, y0, d.y + (i * i) * 3, 1.3, (20 + i * 4) * s, 1.3, 0, c3(i ? '#6a7a3a' : '#7a8a44'), 0, i * 0.08); }
    else if (d.t === 'pebble') { instAdd(I.rock, d.x, y0 + 1, d.y, 4 * s, 2.6 * s, 3.6 * s, d.a, c3('#857d70')); instAdd(I.rock, d.x + 6, y0 + 0.6, d.y + 2, 2.4 * s, 1.6 * s, 2.4 * s, d.a * 2, c3('#a49c8e')); }
    else if (d.t === 'deadtree') { const cg = c3('#4a4540'); instAdd(I.trunk, d.x, y0, d.y, 5 * s, 62 * s, 5 * s, d.a, cg, 0.06, 0.05); instAdd(I.trunk, d.x, y0 + 34 * s, d.y, 2.2 * s, 30 * s, 2.2 * s, d.a, cg, 0, 0.9); instAdd(I.trunk, d.x, y0 + 46 * s, d.y, 1.8 * s, 24 * s, 1.8 * s, d.a + 2.4, cg, 0, 0.8); }
    else if (d.t === 'flower') { const fc = c3(FL_COL[Math.floor((d.a * 7) % 1 * FL_COL.length)]); for (let i = 0; i < 5; i++) instAdd(I.berry, d.x + Math.cos(i * 2.4) * 5 * s, y0 + 5 + (i % 2) * 2, d.y + Math.sin(i * 2.4) * 5 * s, 1.8, 1.3, 1.8, i, fc); }
    else if (d.t === 'grass') { const gc = c3(['#86a63e', '#9ab448', '#a8b85a', '#7c9a38'][Math.floor(((d.a * 5) % 1) * 4)]); for (let i = 0; i < 3; i++) instAdd(I.tgrass, d.x + Math.cos(d.a + i * 2.1) * 6 * s, y0 - 0.5, d.y + Math.sin(d.a + i * 2.1) * 6 * s, 13 * s, 22 * s * (0.8 + i * 0.15), 13 * s, d.a + i, gc); }
    else if (d.t === 'shell' || d.t === 'driftwood' || d.t === 'drift') { instAdd(I.trunk, d.x, y0 + 1.2, d.y, 2.6 * s, 38 * s, 2.6 * s, d.a, c3('#a89a84'), 0, Math.PI / 2 - 0.05); instAdd(I.trunk, d.x + Math.cos(d.a) * 8, y0 + 1, d.y - Math.sin(d.a) * 8, 1.4 * s, 14 * s, 1.4 * s, d.a + 0.8, c3('#9a8c76'), 0, Math.PI / 2); }
    else if (d.t === 'shell') { instAdd(I.trunk, d.x, y0 + 1.5, d.y, 2.4 * s, 34 * s, 2.4 * s, d.a, c3('#a89a84'), 0, Math.PI / 2); }
  }
  for (const c of G.crystals) {
    if (c.dead || !near(c, ROCK_R)) continue;
    const y0 = gh(c.x, c.y);
    for (let i = 0; i < 4; i++) { col.setHSL(c.hue / 360, 0.8, 0.5 + i * 0.06); const a = c.x + i * 1.9; instAdd(I.crystal, c.x + Math.cos(a) * 4, y0, c.y + Math.sin(a) * 4, 4.2 - i * 0.5, 30 - Math.abs(i - 1.5) * 8, 4.2 - i * 0.5, a, col, Math.sin(a) * 0.3, Math.cos(a) * 0.3); }
  }
  for (const k in I) instDone(I[k]);
  U3.shK = null; fillTreeShadows();
}

// ---- gölge yönü: güneşin tersine, alçak güneşte uzun (yükseklik başına x/z kayması)
function u3ShadowDir() {
  const v = U3.sunV, o = U3.shO || (U3.shO = { x: 0, z: 0 });
  if (!v) { o.x = 0.15; o.z = -0.1; return o; }
  const k = 1 / Math.max(v.y, 0.3); o.x = -v.x * k * 0.55; o.z = -v.z * k * 0.55; return o;
}
function fillTreeShadows() {
  const m = U3.inst && U3.inst.tshadow; if (!m || !U3.tsh) return;
  const o = u3ShadowDir(); U3.shK = o.x * 1000 + o.z;
  m.count = 0;
  for (const q of U3.tsh) {
    let ox = o.x * q[3], oz = o.z * q[3]; const L0 = Math.hypot(ox, oz), cap = q[2] * 2.2; if (L0 > cap) { ox *= cap / L0; oz *= cap / L0; }
    const L = Math.min(L0, cap), x = q[0] + ox * 0.75, z = q[1] + oz * 0.75;
    instAdd(m, x, gh(x, z) + 1.6, z, q[2] + L * 0.35, 1, q[2] * 0.92, -Math.atan2(oz, ox));
  }
  instDone(m);
}
// dinamik leke gölge (kişi, yaratık, yapı, leş): h = gölgeyi atan yükseklik
function blobShadow(x, y0, z, rx, rz, ry, h) {
  const o = U3.shO || u3ShadowDir(), k = Math.min(h || 0, rx * 3) * 0.6;
  instAdd(U3.entShadow, x + o.x * k, y0 + 0.6, z + o.z * k, rx + Math.hypot(o.x, o.z) * k * 0.25, 1, rz, ry || 0);
}

// =============================================================
//  YAPILAR
// =============================================================
// ---- mağara: üst üste binmiş kaya kütleleri, +y yönüne bakan karanlık ağız
function rockBlob(gb, col, x, y, z, sx, sy, sz, seed, det) {
  const g = new THREE.IcosahedronGeometry(1, det === undefined ? 1 : det), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i), f = 0.78 + 0.42 * fbm3(vx * 1.7 + seed, vy * 1.7, vz * 1.7 - seed); p.setXYZ(i, vx * f, vy * f, vz * f); }
  const cf = (cx, cy, cz, c) => { const n = hash2(cx * 31 + seed, cz * 17 + cy * 13); _col.copy(c).multiplyScalar(0.74 + n * 0.42); if (cy > 0.45 && hash2(cx * 23 + seed, cz * 31) > 0.5) _col.lerp(c3('#56703a'), 0.55); else if (cy < -0.2) _col.multiplyScalar(0.8); return _col; };
  gb.add(g, col, x, y, z, sx, sy, sz, 0, seed % 6, 0, cf); g.dispose();
}
function caveMesh(b, ghost) {
  const r = b.r, g = new THREE.Group(), gb = new GB(), R = mulberry32(Math.floor(b.x * 3 + b.y * 7) + 1);
  const ez = r * 0.92;                                   // ağız (stnPos: b.y + r*0.85)
  // ana kütle: arka tarafta yüksek sırt, öne doğru alçalan omuzlar
  rockBlob(gb, '#77726a', 0, -10, -r * 0.35, r * 1.5, r * 1.5, r * 1.05, 3, 2);
  rockBlob(gb, '#6f6a62', -r * 0.85, -6, -r * 0.1, r * 0.9, r * 1.05, r * 0.85, 7);
  rockBlob(gb, '#736e64', r * 0.9, -8, -r * 0.05, r * 0.85, r * 0.95, r * 0.9, 11);
  rockBlob(gb, '#68645c', -r * 0.3, r * 0.9, -r * 0.7, r * 0.7, r * 0.75, r * 0.6, 13);
  rockBlob(gb, '#7a756c', r * 0.45, r * 1.15, -r * 0.55, r * 0.5, r * 0.65, r * 0.45, 17);
  rockBlob(gb, '#625e57', 0, r * 1.55, -r * 0.6, r * 0.32, r * 0.5, r * 0.3, 19);
  rockBlob(gb, '#6c6860', -r * 0.2, r * 1.2, -r * 1.25, r * 1.25, r * 1.3, r * 0.85, 43, 2);
  rockBlob(gb, '#757067', r * 0.75, r * 0.9, -r * 1.05, r * 0.8, r * 1.1, r * 0.7, 47);
  rockBlob(gb, '#5f5b54', -r * 0.95, r * 0.7, -r * 0.95, r * 0.7, r * 0.95, r * 0.65, 53);
  rockBlob(gb, '#807a70', -r * 0.1, r * 2.25, -r * 1.2, r * 0.45, r * 0.6, r * 0.4, 59);
  // ağzın iki yanında ve üstünde çıkıntılı kayalar (lento)
  rockBlob(gb, '#8a8478', -36, 10, ez - 8, 22, 38, 20, 23); rockBlob(gb, '#827c70', 36, 8, ez - 8, 22, 36, 20, 29);
  rockBlob(gb, '#8f897c', 0, 62, ez - 14, 46, 18, 22, 31);
  rockBlob(gb, '#6a665e', -r * 1.15, -2, r * 0.55, 30, 26, 28, 37); rockBlob(gb, '#6f6a60', r * 1.12, -2, r * 0.5, 28, 22, 30, 41);
  for (let i = 0; i < 12; i++) { const a = R() * Math.PI - Math.PI, d = r * (1.05 + R() * 0.5), s = 4 + R() * 9; gb.dod(R() < 0.5 ? '#6a665e' : '#5a564f', Math.cos(a) * d * 1.2, s * 0.3, Math.sin(a) * d * 0.9 + r * 0.25, s, s * 0.7, s, R() * 6); }
  for (let i = 0; i < 7; i++) gb.dod('#7a746a', -50 + R() * 100, 1, ez + 14 + R() * 26, 2 + R() * 4, 1.5 + R() * 2, 2 + R() * 4, R() * 6);
  // ağız önü: basılmış toprak, kemik ve boynuz süsü
  gb.add(GEO.disc, '#5a4a36', 0, 0.6, ez + 18, 40, 1, 24);
  gb.box('#d8d0ba', -30, 46, ez + 6, 2.2, 2.2, 14, 0.3).box('#d8d0ba', 30, 44, ez + 6, 2.2, 2.2, 14, -0.3);
  gb.sph('#e4dcc6', 0, 72, ez + 6, 6, 5, 6).box('#cfc6ae', -9, 77, ez + 6, 14, 1.6, 1.6, 0, 0, 0.6).box('#cfc6ae', 9, 77, ez + 6, 14, 1.6, 1.6, 0, 0, -0.6);
  g.add(gb.mesh(ghost)); g.children[0].material = ghost ? MAT.ghost : MAT.rockV;
  // karanlık ağız: kemerli kesit + derinlik kutusu
  const d1 = new THREE.Mesh(GEO.box, MAT.dark); d1.scale.set(54, 40, 26); d1.position.set(0, 20, ez - 12); g.add(d1);
  const d2 = new THREE.Mesh(GEO.arch, MAT.dark); d2.scale.set(27, 22, 1); d2.position.set(0, 40, ez + 1.2); g.add(d2);
  const d3 = new THREE.Mesh(new THREE.PlaneGeometry(54, 40), MAT.dark); d3.position.set(0, 20, ez + 1.15); g.add(d3);
  const gl = new THREE.Mesh(GEO.arch, new THREE.MeshBasicMaterial({ map: TEX.glow, color: 0xff8a3a, transparent: true, opacity: 0, depthWrite: false, fog: false })); gl.scale.set(26, 44, 1); gl.position.set(0, 0, ez + 1.5); g.add(gl); g.userData.glow = gl;
  return g;
}
// ---- gemi: kıyıda kızaklar üstünde; ilerlemeye göre omurga -> kaburga -> kaplama -> direk/yelken
function hullPts(L, W, H) { return t => { const u = t * 2 - 1, w = W * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 2.2)), 0.55); return w; }; }
function shipMesh(b) {
  const g = new THREE.Group(), gb = new GB(), L = 210, W = 46, H = 40, k = b.built ? 1 : clamp((b.prog || 0) / (b.need || 1), 0, 1), wf = hullPts(L, W, H);
  // kızaklar
  for (let i = -3; i <= 3; i++) { gb.box('#5a4026', i * 30, 4, 0, 8, 8, W * 1.6); gb.box('#4a3420', i * 30, 9, -W * 0.55, 4, 14, 4, 0, 0, 0.3).box('#4a3420', i * 30, 9, W * 0.55, 4, 14, 4, 0, 0, -0.3); }
  const y0 = 14;
  // omurga ve baş/kıç bodoslaması
  gb.box('#6a4a2a', 0, y0, 0, L * Math.min(1, 0.4 + k * 3), 5, 5);
  if (k > 0.12) { gb.add(GEO.cyl, '#6a4a2a', L / 2 - 4, y0, 0, 3, H * 1.25, 3, 0, 0, -0.45); gb.add(GEO.cyl, '#6a4a2a', -L / 2 + 4, y0, 0, 3, H * 1.05, 3, 0, 0, 0.35); }
  // kaburgalar
  const nr = Math.floor(clamp((k - 0.1) / 0.3, 0, 1) * 13);
  for (let i = 0; i < nr; i++) { const t = (i + 1) / 14, x = -L / 2 + t * L, w = wf(t); gb.add(GEO.rib, '#7a5632', x, y0 + H * 0.9, 0, Math.max(4, w), H * 0.9, 34, 0, Math.PI / 2, Math.PI); }
  // kaplama tahtaları (alt sıradan yukarı)
  const np = Math.floor(clamp((k - 0.4) / 0.4, 0, 1) * 7);
  for (let j = 0; j < np; j++) { const a = (j + 0.5) / 7, yy = y0 + H * (1 - Math.cos(a * Math.PI / 2)) * 0.9, seg = 14;
    for (const sd of [-1, 1]) for (let i = 0; i < seg; i++) { const t0 = i / seg, t1 = (i + 1) / seg, x0 = -L / 2 + t0 * L, x1 = -L / 2 + t1 * L, z0 = sd * wf(t0) * Math.sin(a * Math.PI / 2), z1 = sd * wf(t1) * Math.sin(a * Math.PI / 2);
      gb.add(GEO.box, j % 2 ? '#8a6438' : '#7e5a32', (x0 + x1) / 2, yy, (z0 + z1) / 2, Math.hypot(x1 - x0, z1 - z0) + 1, H / 7 + 1, 2, 0, -Math.atan2(z1 - z0, x1 - x0), sd * (0.3 + a * 0.9)); } }
  if (k > 0.8) { gb.box('#6a4a2a', 0, y0 + H * 0.88, 0, L * 0.82, 2, W * 1.5); }
  if (k > 0.9) { gb.cyl('#5a3a1e', 10, y0 + H * 0.5, 0, 3, 150); gb.box('#5a3a1e', 10, y0 + 130, 0, 3, 3, 90); }
  g.add(gb.mesh(false, true));
  if (k >= 1) { const sail = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 6, 6), new THREE.MeshLambertMaterial({ color: 0xd8c8a0, side: THREE.DoubleSide })); const p = sail.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getY(i) + 0.5) * Math.PI) * 0.12); sail.geometry.computeVertexNormals(); sail.scale.set(86, 100, 86); sail.rotation.y = Math.PI / 2; sail.position.set(12, y0 + 80, 0); g.add(sail); }
  g.rotation.y = -(b.ang || 0);
  return g;
}
function wreckMesh(w) {
  const g = new THREE.Group(), gb = new GB(), R = mulberry32(Math.floor(w.x * 7 + w.y * 3)), L = (w.r || 60) * 2.2, W = L * 0.24;
  gb.box('#3e2e1e', 0, 2, 0, L, 5, 5, 0, 0, 0.04);
  for (let i = 0; i < 11; i++) { if (R() < 0.25) continue; const t = (i + 1) / 12, x = -L / 2 + t * L, ww = W * Math.sqrt(Math.max(0.05, 1 - Math.pow(t * 2 - 1, 2))), hh = (12 + R() * 22) * (i % 3 ? 1 : 0.6);
    for (const sd of [-1, 1]) if (R() < 0.85) gb.add(GEO.box, '#4a3826', x, hh * 0.45, sd * ww * 0.85, 3, hh, 3, sd * (0.35 + R() * 0.2), 0, 0); }
  for (let i = 0; i < 9; i++) { const x = -L / 2 + R() * L; gb.add(GEO.box, R() < 0.5 ? '#5a4430' : '#4a3a2a', x, 2 + R() * 6, (R() - 0.5) * W * 1.6, 18 + R() * 30, 1.6, 5, 0, R() * 0.6, (R() - 0.5) * 0.5); }
  gb.add(GEO.cyl, '#4a3624', L * 0.1, 1, 0, 2.6, L * 0.55, 2.6, 0, 0.3, -Math.PI / 2 + 0.35);
  gb.add(GEO.box, '#bfb294', L * 0.25, 22, 6, 1, 26, 30, 0, 0.3, 0.6);
  for (let i = 0; i < 5; i++) gb.dod('#6a625a', (R() - 0.5) * L, 0.5, (R() - 0.5) * W * 2, 3 + R() * 5, 2 + R() * 3, 3 + R() * 5, R() * 6);
  g.add(gb.mesh(false, true)); g.rotation.y = R() * TAU;
  return g;
}
function syncWrecks(t) {
  if (!G.wrecks || !U3.wrecks) return;
  for (const w of G.wrecks) {
    let e = U3.wrecks.get(w);
    if (!e) { e = { g: wreckMesh(w) }; e.g.position.set(w.x, gh(w.x, w.y) - 2, w.y); U3.world.add(e.g); U3.wrecks.set(w, e);
      const sp = sprite(TEX.glow, 0x9fd0ff, true, false); sp.scale.set(30, 30, 1); sp.position.y = 30; e.g.add(sp); e.sp = sp; }
    e.sp.visible = !w.found; if (!w.found) e.sp.material.opacity = 0.35 + Math.sin(t * 2.5) * 0.15;
  }
}
function buildMesh(b) {
  const T = b.type, r = b.r, g = new THREE.Group(), gb = new GB(), R = mulberry32(Math.floor(b.x * 3 + b.y * 7) + 1), ghost = !b.built;
  let fl = null;
  if (T === 'magara') return caveMesh(b, ghost);
  if (T === 'gemi') return shipMesh(b);
  if (T === 'kulube') {
    const w = r * 1.6, d = r * 1.25;
    gb.box('#8a6a40', 0, 16, 0, w, 32, d);
    for (let i = -4; i <= 4; i++) gb.box('#6a4e2a', i * w / 9, 16, d / 2 + 0.3, 1.2, 32, 0.8);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) gb.cyl('#4a3218', sx * w / 2, 0, sz * d / 2, 2.6, 34);
    gb.add(GEO.prism, '#6e5a2e', 0, 32, 0, w + 12, 26, d + 12);
    gb.box('#4a3a1c', 0, 58.5, 0, 3, 2.4, d + 16);
    gb.box('#140b05', 0, 13, d / 2 + 0.6, 17, 26, 1.2);
    gb.box('#5a4020', 0, 27, d / 2 + 1, 21, 2.4, 1.6);
    gb.box('#1a1008', w * 0.3, 20, d / 2 + 0.5, 10, 8, 1);
  } else if (T === 'cadir') {
    gb.add(GEO.cone, '#9a7a52', 0, 0, 0, r, 36, r * 0.95, 0, 0, 0, (x, y, z, c) => _col.copy(c).multiplyScalar(0.82 + hash2(Math.atan2(z, x) * 9, 1) * 0.3));
    gb.add(GEO.prism, '#160d06', r * 0.66, 0, 0, 13, 22, r * 0.62, 0, Math.PI / 2, 0);
    gb.cyl('#3a2410', 0, 33, 0, 0.8, 9, 0.3, 0).cyl('#3a2410', 0, 33, 0, 0.8, 9, -0.3, 0.2);
  } else if (T === 'atolye') {
    gb.box('#6a4a2a', 0, 1, 0, 56, 2, 44);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) gb.cyl('#3a2410', sx * 26, 0, sz * 20, 2.2, sz < 0 ? 42 : 34);
    gb.box('#7a6234', 0, 39, 0, 62, 2, 52, 0, 0.19, 0);
    gb.box('#8a6a44', -3, 7, -6, 30, 14, 11).box('#a08258', -3, 14.6, -6, 34, 1.4, 14);
    gb.box('#999999', -8, 16.2, -6, 9, 1.6, 2.4).box('#5a4a3a', 4, 16.6, -5, 3, 2.4, 6);
    for (let i = 0; i < 4; i++) gb.add(GEO.cyl, '#5a3a1e', 14, 3 + (i >> 1) * 5.4, 6 + (i % 2) * 6 - (i >> 1) * 0, 2.8, 16, 2.8, 0, 0, Math.PI / 2);
  } else if (T === 'kasaphane') {
    gb.box('#7a5a36', 0, 15, 0, 40, 3, 20);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) gb.box('#5a3a1e', sx * 17, 7, sz * 8, 3, 14, 3);
    gb.sph('#8a1a14', -6, 18, 0, 7, 3, 4).sph('#a02a1e', 8, 18, 2, 5, 2.5, 3).box('#bbbbbb', 14, 17.4, -4, 6, 0.8, 1.6);
    gb.cyl('#4a3018', -22, 0, -14, 1.8, 40).cyl('#4a3018', 22, 0, -14, 1.8, 40).box('#4a3018', 0, 39, -14, 48, 2, 2);
    for (let i = -1; i <= 1; i++) gb.sph('#9a2a1a', i * 12, 31, -14, 3.4, 7, 3.4);
    gb.add(GEO.disc, '#4a0a08', 0, 0.5, 14, 14, 1, 6);
  } else if (T === 'tarla') {
    gb.add(GEO.disc, '#5a3e22', 0, 0.6, 0, r, 1, r * 0.8);
    for (let i = -r * 0.8 + 6; i < r * 0.8; i += 9) { const hw = r * Math.sqrt(Math.max(0, 1 - (i * i) / (r * r * 0.64))); if (hw > 5) gb.box('#463018', 0, 1.6, i, hw * 1.9, 2.4, 4.5); }
    if (b.planted) {
      const gr = b.g;
      for (let i = -r * 0.8 + 6; i < r * 0.8; i += 9) for (let j = -r + 5; j < r; j += 8) {
        if ((j * j) / (r * r) + (i * i) / (r * r * 0.64) > 0.8) continue;
        if (gr < 0.35) gb.sph('#6aa040', j, 3, i, 1.4 + gr * 3);
        else if (gr < 1) gb.cone('#5a9a30', j, 2, i, 2.2, 5 + 10 * gr);
        else { gb.cone('#8a8a34', j, 2, i, 1.6, 15); gb.sph('#e8c04a', j, 17, i, 1.7, 3.6, 1.7); }
      }
    }
  } else if (T === 'sifahane') {
    const hw = r, hd = r * 0.65;
    gb.box('#7a6a4a', 0, 0.8, 0, hw * 2, 1.6, hd * 2);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) gb.cyl('#4a3018', sx * hw, 0, sz * hd, 2.2, 38);
    gb.box('#d8d0b8', 0, 38.5, 0, hw * 2 + 8, 1.6, hd * 2 + 8);
    gb.add(GEO.prism, '#c8c0a8', 0, 39, 0, hw * 2 + 8, 9, hd * 2 + 8);
    for (let i = 0; i < 4; i++) { const p = bedPos(b, i), x = p.x - b.x, z = p.y - b.y; gb.box('#8a6a44', x, 3.4, z, 27, 3.6, 12).box('#c8b898', x, 5.8, z, 26, 1.6, 11).box('#e8e0d0', x - 9.5, 7, z, 7, 1.6, 9); }
    gb.box('#e8e4da', 0, 30, hd + 4.4, 18, 14, 1).box('#2a8a5a', 0, 30, hd + 5, 4, 10, 0.8).box('#2a8a5a', 0, 30, hd + 5, 12, 4, 0.8);
  } else if (T === 'cit') {
    for (let i = -2; i <= 2; i++) { const h = 24 + R() * 6; gb.cyl(i % 2 ? '#8a6a40' : '#7a5a34', R() - 0.5, 0, i * 8, 3.3, h, (R() - 0.5) * 0.1, (R() - 0.5) * 0.1); gb.cone('#a88a5a', 0, h - 0.5, i * 8, 3.3, 7); }
    gb.box('#4a3018', -3.2, 15, 0, 2, 2.6, 38).box('#4a3018', 3.2, 8, 0, 2, 2.6, 38);
  } else if (T === 'duvar') {
    for (let i = -1; i <= 1; i++) for (let k = 0; k < 2; k++) { const v = 0.82 + R() * 0.3; _col.set('#8a867c').multiplyScalar(v); gb.box('#' + _col.getHexString(), (R() - 0.5) * 1.5, 8 + k * 16, i * 13, 17, 15.5, 12.6); }
    gb.box('#77736a', 0, 33.5, 0, 14, 3, 40);
  } else if (T === 'mesale') {
    gb.cyl('#4a3018', 0, 0, 0, 2.3, 34).cyl('#2a1a0c', 0, 30, 0, 3.4, 5);
    gb.dod('#6a625a', 0, 1.5, 0, 6, 3.5, 6);
    if (b.built) fl = mkFlame(11, g, 0, 34, 0);
  } else if (T === 'kule') {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { gb.cyl('#3a2410', sx * 17, 0, sz * 17, 2.6, 96); }
    for (const s of [-1, 1]) { gb.box('#4a3018', 0, 30, s * 17, 40, 2, 2, 0, 0, 0.9).box('#4a3018', s * 17, 30, 0, 2, 2, 40, 0, 0.9, 0); }
    gb.box('#8a6a3e', 0, 61, 0, 48, 3, 48);
    for (const s of [-1, 1]) { gb.box('#5a3e22', 0, 73, s * 23, 48, 2.4, 2).box('#5a3e22', s * 23, 73, 0, 2, 2.4, 48).box('#6a4a28', 0, 67, s * 23, 48, 6, 1).box('#6a4a28', s * 23, 67, 0, 1, 6, 48); }
    gb.add(GEO.cone4, '#6e5a2e', 0, 96, 0, 40, 20, 40, 0, Math.PI / 4, 0);
    for (let i = 0; i < 9; i++) gb.box('#5a3e22', 26, 4 + i * 7, 6, 2, 1.6, 10);
    gb.box('#4a3018', 26, 30, 1.5, 1.8, 62, 1.8).box('#4a3018', 26, 30, 10.5, 1.8, 62, 1.8);
    if (b.built) fl = mkFlame(10, g, 19, 76, 19);
  } else if (T === 'raf') {
    gb.cyl('#5a3d22', 0, 0, -14, 1.7, 32).cyl('#5a3d22', 0, 0, 14, 1.7, 32).box('#5a3d22', 0, 30, 0, 2, 2, 34).box('#5a3d22', 0, 20, 0, 1.6, 1.6, 30);
    for (let i = -2; i <= 2; i++) { gb.box('#8a2a1a', 0, 24.5, i * 5.5, 1.4, 9, 3.6); gb.box('#7a3a22', 0, 15.5, i * 5.5 + 1, 1.2, 7, 3); }
  } else if (T === 'tuzak') {
    gb.add(GEO.disc, '#2e2214', 0, 0.5, 0, r, 1, r);
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, d = i === 6 ? 0 : 9; gb.cone('#7a5a30', Math.cos(a) * d, 0, Math.sin(a) * d, 1.8, 10 + R() * 4, Math.sin(a) * 0.35, -Math.cos(a) * 0.35); }
  }
  else if (T === 'oktezgah') {
    // deri tente altında tezgâh, raf: yaylar ve ok gövdeleri
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) gb.cyl('#4a3018', sx * 20, 0, sz * 14, 1.6, sz < 0 ? 40 : 34);
    gb.add(GEO.box, '#9a6a40', 0, 37, 0, 46, 1.2, 34, 0.18, 0, 0);
    gb.box('#7a5a36', 0, 10, 2, 32, 3, 13).box('#5a3e22', -12, 5, 2, 3, 10, 10).box('#5a3e22', 12, 5, 2, 3, 10, 10);
    for (let i = 0; i < 7; i++) gb.add(GEO.cyl, '#b89a6a', -10 + i * 2.2, 11.6, 2, 0.35, 16, 0.35, 0, 0.2, Math.PI / 2);
    gb.box('#5a3e22', 0, 26, -13, 36, 1.6, 2);
    for (let i = 0; i < 3; i++) gb.add(GEO.torus, '#6a4a28', -10 + i * 10, 15, -13, 9, 1.4, 2.5, 0, 0, Math.PI / 2);
  } else if (T === 'tabakhane') {
    // germe çerçevesinde deri + sıyırma kütüğü
    gb.cyl('#4a3018', -16, 0, 0, 1.8, 40).cyl('#4a3018', 16, 0, 0, 1.8, 40).box('#4a3018', 0, 38, 0, 38, 2.4, 2.4).box('#4a3018', 0, 6, 0, 38, 2.4, 2.4);
    gb.box('#a0703e', 0, 22, 0, 26, 28, 0.8);
    for (let i = 0; i < 6; i++) gb.box('#d8c8a0', -13 + (i % 2) * 26, 10 + Math.floor(i / 2) * 12, 0, 3, 0.4, 0.4);
    gb.add(GEO.cyl, '#6a4a2a', 0, 4, 16, 4, 30, 4, 0, 0.3, Math.PI / 2).sph('#8a5a34', 6, 9, 16, 9, 2, 6);
  } else if (!buildMesh.known.has(T)) {
    // bilinmeyen yapı: basit tezgâh
    gb.box('#7a5a36', 0, 10, 0, Math.min(40, r * 1.4), 3, Math.min(20, r)).box('#5a3e22', -Math.min(16, r * 0.5), 5, 0, 3, 10, 10).box('#5a3e22', Math.min(16, r * 0.5), 5, 0, 3, 10, 10);
  }
  if (ghost) { for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; gb.cyl('#b89a6a', Math.cos(a) * r, 0, Math.sin(a) * r, 1.2, 26, Math.sin(a) * 0.25, -Math.cos(a) * 0.25); } gb.add(GEO.ring, '#bfdcff', 0, 0.8, 0, r + 4, 1, r + 4); }
  const m = gb.mesh(ghost, T === 'tarla' || T === 'tuzak'); g.add(m);
  if (T === 'cadir' || T === 'cit' || T === 'duvar') g.rotation.y = -(b.ang || 0);
  return g;
}
// yapı tabanı: ayak izi içindeki en alçak noktaya otur (yamaçta havada kalmasın)
function buildY(b) { const r = Math.min(b.r || 20, 60) * 0.6, fl = (BUILD[b.type] || {}).flat; let m = gh(b.x, b.y); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, h = gh(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r); m = fl ? Math.max(m, h) : Math.min(m, h); } return b.type === 'gemi' ? Math.max(m, SEA_Y) : m; }
buildMesh.known = new Set(['magara', 'gemi', 'kulube', 'cadir', 'atolye', 'kasaphane', 'tarla', 'sifahane', 'cit', 'duvar', 'mesale', 'kule', 'raf', 'tuzak', 'oktezgah', 'tabakhane']);
const buildSig = b => (b.built ? 1 : 0) + (b.type === 'tarla' ? '_' + (b.planted ? 1 + Math.min(4, Math.floor(b.g * 4)) : 0) : '') + (b.type === 'gemi' && !b.built ? '_' + Math.floor(clamp((b.prog || 0) / (b.need || 1), 0, 1) * 12) : '');
function syncBuilds(dk) {
  const M = U3.builds, f = U3.frame;
  for (const b of G.builds) {
    if (b.dead) continue;
    let e = M.get(b); const sig = buildSig(b);
    if (!e || e.sig !== sig) { if (e) { U3.scene.remove(e.g); disposeTree(e.g, true); } e = { g: buildMesh(b), sig }; e.g.position.set(b.x, buildY(b), b.y); U3.scene.add(e.g); M.set(b, e); }
    e.f = f;
    if (!(BUILD[b.type] || {}).flat && b.type !== 'gemi') { const br = b.type === 'magara' ? b.r * 1.05 : b.type === 'cit' || b.type === 'duvar' ? b.r * 0.7 : b.type === 'mesale' ? 9 : b.r * 0.95; blobShadow(b.x, buildY(b), b.y, br * 1.1, br, 0, b.type === 'kule' ? 120 : b.type === 'mesale' ? 40 : br * 0.8); }
    if (e.g.userData.glow) e.g.userData.glow.material.opacity = clamp(Math.max(dk * 1.1, (b.occ || []).length ? 0.35 : 0) * (0.75 + Math.sin(G.now * 5) * 0.08), 0, 0.85);
  }
  for (const [b, e] of M) if (e.f !== f) { U3.scene.remove(e.g); disposeTree(e.g, true); M.delete(b); }
}

// ---- leşler
function carcMesh(c) {
  const k = clamp(c.meat / (DINO[c.type].drop.meat || 1), 0, 1), r = c.r, col = c.rotten ? '#5a5a3a' : DINO[c.type].col, gb = new GB();
  gb.add(GEO.disc, '#3a0505', 0, 0.45, 0, r * 1.3, 1, r * 0.8);
  if (k > 0.05) {
    _col.set(col).multiplyScalar(0.8); const hc = '#' + _col.getHexString();
    gb.sph(hc, 0, r * 0.22 * (0.5 + k * 0.5), 0, r * 0.95 * (0.6 + k * 0.4), r * 0.42 * (0.4 + k * 0.6), r * 0.55 * (0.5 + k * 0.5));
    gb.add(GEO.cone, hc, -r * 0.7, r * 0.1, 0, r * 0.16, r * 1.0, r * 0.16, 0, 0, Math.PI / 2);
    gb.sph(hc, r * 0.98, r * 0.14, 0, r * 0.36, r * 0.2, r * 0.25);
    gb.sph('#9a1a12', r * 0.1, r * 0.3 * k + 1, 0, r * 0.3 * k, r * 0.14 * k, r * 0.2 * k);
  }
  for (let i = -3; i <= 3; i++) { if (k > 0.6 && Math.abs(i) < 2) continue; gb.add(GEO.rib, '#e8e0cc', i * r * 0.18, 0, 0, r * 0.38, r * 0.5, r * 0.38, 0, Math.PI / 2, 0); }
  gb.box('#e8e0cc', 0, r * 0.06 + 1, 0, r * 1.5, Math.max(1, r * 0.07), Math.max(1, r * 0.07));
  const m = gb.mesh(); m.rotation.y = -c.ang; return m;
}
function syncCarcs() {
  const M = U3.carcs, f = U3.frame;
  for (const c of G.carcs) {
    if (c.dead) continue;
    const sig = Math.floor(clamp(c.meat / (DINO[c.type].drop.meat || 1), 0, 1) * 4) + (c.rotten ? 10 : 0);
    let e = M.get(c);
    if (!e || e.sig !== sig) { if (e) { U3.scene.remove(e.g); disposeTree(e.g); } e = { g: carcMesh(c), sig }; e.g.position.set(c.x, gh(c.x, c.y), c.y); U3.scene.add(e.g); M.set(c, e); }
    e.f = f; blobShadow(c.x, gh(c.x, c.y), c.y, c.r * 1.25, c.r * 0.7, -c.ang, c.r * 0.4);
  }
  for (const [c, e] of M) if (e.f !== f) { U3.scene.remove(e.g); disposeTree(e.g); M.delete(c); }
}

// ---- yamyam kampları
function campMesh(c) {
  const g = new THREE.Group(), gb = new GB(), R = mulberry32(c.i * 17 + 3);
  gb.add(GEO.disc, '#2a1c12', 0, 0.4, 0, c.r + 30, 1, c.r + 14);
  for (const [hx, hy] of c.huts) {
    gb.add(GEO.cone, c.alive ? '#3a2a1e' : '#1e1a16', hx, 0, hy, 24, 42, 24, 0, R() * 6, 0, (x, y, z, cc) => _col.copy(cc).multiplyScalar(0.8 + hash2(Math.atan2(z, x) * 9, 2) * 0.45));
    gb.sph('#e8e0cc', hx, 44, hy, 3.4, 3.8, 3.4).box('#d8ccb4', hx, 36, hy, 18, 1.4, 1.4, R() * 3);
    const a = Math.atan2(-hy, -hx); gb.add(GEO.prism, '#0c0806', hx + Math.cos(a) * 16, 0, hy + Math.sin(a) * 16, 12, 20, 14, 0, Math.PI / 2 - a, 0);
  }
  for (let i = 0; i < 10; i++) { const a = i * 0.8 + c.i, rr = 40 + (i * 13) % 50; gb.box('#cfc6b0', Math.cos(a) * rr, 1, Math.sin(a) * rr * 0.8, 9, 1.8, 2, a * 3); }
  if (c.alive) {
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; gb.dod('#2a1a10', 30 + Math.cos(a) * 10, 2, -10 + Math.sin(a) * 10, 4, 3.5, 4, a); }
    mkFlame(20, g, 30, 2, -10);
    gb.cyl('#4a321a', 0, 0, 0, 5, 64);
    for (let i = 0; i < 3; i++) { const y = 22 + i * 15; gb.sph('#e8e0cc', 0, y, 4.5, 6, 6.5, 5.5).box('#111111', -2.2, y + 1, 9.6, 1.8, 1.8, 1).box('#111111', 2.2, y + 1, 9.6, 1.8, 1.8, 1).box('#111111', 0, y - 3, 9.4, 4, 1, 1); }
    gb.box('#4a321a', 0, 52, 0, 34, 3, 3).sph('#e8e0cc', -17, 47, 0, 4, 4.4, 4).sph('#e8e0cc', 17, 47, 0, 4, 4.4, 4);
  } else { gb.dod('#1a1410', 30, 2, -10, 12, 3, 12); gb.add(GEO.cyl, '#3a2a1a', -18, 3, -4, 5, 50, 5, 0, 1.2, Math.PI / 2 - 0.06); }
  c.captives.forEach((cp, k) => {
    const x = -30 + k * 24, z = 34;
    gb.cyl('#5a3a1a', x, 0, z - 5, 2.2, 44);
    if (cp.p && typeof M3 !== 'undefined') { try { const pg = M3.person(cp.p); pg.position.set(x, 0, z); pg.rotation.y = -Math.PI / 2; M3.updPerson(pg, Object.assign({}, cp.p, { x: c.x + x, y: c.y + z, ang: Math.PI / 2, moving: false, downed: 0, bed: null, carriedBy: 0, work: 0, swing: 0 }), 0); pg.userData.m3 = true; g.add(pg); } catch (e) { /* model hazır değilse geç */ } }
    gb.box('#c8b080', x, 20, z - 1, 13, 1.4, 11).box('#c8b080', x, 14, z - 1, 13, 1.4, 11);
  });
  g.add(gb.mesh()); return g;
}
function syncCamps() {
  const M = U3.camps;
  for (const c of G.ccamps || []) {
    const sig = (c.alive ? 1 : 0) + '_' + c.captives.length; let e = M.get(c);
    if (!e || e.sig !== sig) { if (e) dropStatic(e); e = { g: campMesh(c), sig }; e.g.position.set(c.x, gh(c.x, c.y), c.y); U3.scene.add(e.g); M.set(c, e); }
  }
}

// =============================================================
//  CANLILAR (M3 modelleri)
// =============================================================
function dropStatic(e) {
  U3.scene.remove(e.g);
  for (const o of e.g.children.slice()) if (o.userData.m3) { e.g.remove(o); if (M3.dispose) M3.dispose(o); }
  disposeTree(e.g, true);
}
function dropEnt(e) {
  U3.scene.remove(e.g);
  if (typeof M3 !== 'undefined' && M3.dispose) M3.dispose(e.g);
}
function mimicView(d, v) {
  return Object.assign(v || {}, { x: d.x, y: d.y, ang: d.ang + (d.tilt || 0) * 0.15, anim: d.anim, moving: d.moving, skin: d.disguise.skin, hair: d.disguise.hair, group: d.disguise.group, name: d.disguise.name, hurtT: d.hurt, id: d.id, hp: 1, maxhp: 1, carry: 0, bag: {}, eq: {}, swing: 0, work: 0 });
}
// ---- taşınan yük: omuzda kütük, kucakta taş, sırtta sepet, elde et, diğerleri bohça
const HAUL = {};
function haulGeo(k) {
  if (HAUL[k]) return HAUL[k];
  const gb = new GB();
  if (k === 'wood') { gb.add(GEO.cyl, '#6a4a2a', 4, 33, 4.5, 2.6, 34, 2.6, 0, 0, Math.PI / 2).add(GEO.disc, '#b08a5a', 21.1, 33, 4.5, 2.4, 1, 2.4, 0, 0, Math.PI / 2); gb.add(GEO.cyl, '#4a3018', 10, 33, 4.5, 0.6, 5, 0.6, 0.6, 0, 0); }
  else if (k === 'stone') gb.dod('#8a857c', 6.5, 19, 0, 5.2, 4.4, 5.6, 0.7);
  else if (k === 'meyve' || k === 'herb' || k === 'poison') { gb.add(GEO.cyl, '#a08050', -5.2, 18, 0, 4.4, 9, 4.4).add(GEO.torus, '#7a5a30', -5.2, 21, 0, 4.6, 1.2, 4.6); const c = k === 'meyve' ? '#b3243a' : k === 'herb' ? '#4c8a3a' : '#7a3aa0'; for (let i = 0; i < 4; i++) gb.sph(c, -5.2 + Math.cos(i * 1.6) * 2.2, 27.5, Math.sin(i * 1.6) * 2.2, 1.8); }
  else if (k === 'et' || k === 'cigEt') gb.sph(k === 'et' ? '#8a3a1e' : '#a02a1e', 6, 18, 2, 5.5, 2.6, 4).box('#e4dcc6', 8, 18, 2, 9, 1.2, 1.2);
  else gb.sph('#8a7050', -5, 24, 0, 4.6, 5.4, 4.6).box('#5a3e22', -5, 24, 0, 1, 11, 9.6);
  return (HAUL[k] = gb.mesh().geometry);
}
function haulProp(e, p) {
  const k = p.haul || null;
  if (e.hk === k) return;
  e.hk = k;
  if (e.hm) { e.g.remove(e.hm); e.hm = null; }
  if (k) { e.hm = new THREE.Mesh(haulGeo(k), MAT.v); e.g.add(e.hm); }
}
function syncEnts(t, dk) {
  const M = U3.ents, f = U3.frame;
  const put = (key, kind, mk, show) => {
    let e = M.get(key);
    if (e && e.kind !== kind) { dropEnt(e); e = null; }
    if (!e) { if (!show) return null; e = { g: mk(), kind }; U3.scene.add(e.g); M.set(key, e); }
    e.f = f; e.g.visible = show; return show ? e : null;
  };
  if (!G.vis && typeof visionSources === 'function') G.vis = visionSources();   // duraklatılmışken de görüş hesaplı olsun
  const camX = U3.cam.position.x, camZ = U3.cam.position.z, far2 = 2200 * 2200;
  const nearCam = o => { const dx = o.x - camX, dy = o.y - camZ; return dx * dx + dy * dy < far2; };
  let towerOf = null;
  for (const b of G.builds) if (b.type === 'kule' && b.guard && dist(b.guard, b) < 12) (towerOf || (towerOf = new Map())).set(b.guard, b);
  const guard = U3.dk > 0.3 && typeof doorGuard === 'function' ? doorGuard() : null; let nf = 0;
  for (const p of G.people) {
    const show = p !== L && !p.inHut && !p.insideB && !p.dead && nearCam(p);
    const e = put(p, 'p', () => M3.person(p), show); if (!e) continue;
    const tw = towerOf && towerOf.get(p), y0 = tw ? buildY(tw) + 62.5 : ghE(p.x, p.y);
    e.g.position.set(p.x, y0, p.y); e.g.rotation.y = -p.ang;
    if (p === guard && !p.torch) { const v = e.gv || (e.gv = {}); for (const k in v) delete v[k]; Object.assign(v, p); v.torch = true; M3.updPerson(e.g, v, t); }
    else M3.updPerson(e.g, p, t);
    if (!tw) blobShadow(p.x, y0, p.y, p.child ? 6 : 8.5, p.child ? 5.5 : 7.5, -p.ang, p.child ? 20 : 32);
    if (p.group === 'balik' && p.work && !p.moving && nf < 24) {   // olta: elden uca kamış, uçtan suya ip
      const c = Math.cos(p.ang), sn = Math.sin(p.ang), hx = p.x + c * 6 - sn * 4, hz = p.y + sn * 6 + c * 4, tx = p.x + c * 44, tz = p.y + sn * 44, ty = y0 + 40 + Math.sin(t * 1.3 + p.id) * 1.5;
      const wx = p.x + c * 62, wz = p.y + sn * 62, wy = Math.max(gh(wx, wz), SEA_Y) + 0.5 + Math.sin(t * 2.1 + p.id) * 0.6;
      const P = U3.fish.geometry.attributes.position, C = U3.fish.geometry.attributes.color, o = nf * 4;
      P.setXYZ(o, hx, y0 + 22, hz); P.setXYZ(o + 1, tx, ty, tz); P.setXYZ(o + 2, tx, ty, tz); P.setXYZ(o + 3, wx, wy, wz);
      C.setXYZ(o, 0.35, 0.24, 0.12); C.setXYZ(o + 1, 0.35, 0.24, 0.12); C.setXYZ(o + 2, 0.85, 0.85, 0.8); C.setXYZ(o + 3, 0.85, 0.85, 0.8); nf++;
    }
  }
  U3.fish.geometry.setDrawRange(0, nf * 4); U3.fish.geometry.attributes.position.needsUpdate = true; U3.fish.geometry.attributes.color.needsUpdate = true;
  for (const d of G.dinos) {
    if (d.dead) continue;
    const dd = Math.hypot(d.x - L.x, d.y - L.y);
    const vis = !d.hidden && nearCam(d) && (d.tamed || dd < 260 + d.r || visible(d.x, d.y, d.r + 160 * (1 - dk)));
    const y0 = ghE(d.x, d.y);
    if (d.type === 'yamyam') {
      const e = put(d, 'c', () => { const v = cannibalView(d); const g = M3.person(v); g.userData.view = v; return g; }, vis); if (!e) continue;
      const v = Object.assign(e.g.userData.view, cannibalView(d));
      e.g.position.set(d.x, y0, d.y); e.g.rotation.y = -d.ang; M3.updPerson(e.g, v, t);
      blobShadow(d.x, y0, d.y, 8.5, 7.5, -d.ang, 32);
    } else if (d.type === 'taklitci' && !d.revealed) {
      const e = put(d, 'm', () => { const v = mimicView(d); const g = M3.person(v); g.userData.view = v; return g; }, vis); if (!e) continue;
      const v = mimicView(d, e.g.userData.view);
      e.g.position.set(d.x, y0, d.y); e.g.rotation.y = -v.ang; M3.updPerson(e.g, v, t);
      blobShadow(d.x, y0, d.y, 8.5, 7.5, -d.ang, 32);
    } else {
      const e = put(d, 'd', () => M3.dino(d), vis); if (!e) continue;
      e.g.position.set(d.x, y0 + (d.fly ? (d.alt || 0) * 85 : 0), d.y); e.g.rotation.y = -d.ang;
      M3.updDino(e.g, d, t);
      const fl = d.fly ? clamp(1 - (d.alt || 0) * 0.6, 0.3, 1) : 1; blobShadow(d.x, y0, d.y, d.r * (d.fly ? 1.1 : 1.45) * fl, d.r * (d.fly ? 1.4 : 0.85) * fl, -d.ang, d.fly ? 0 : d.r * 1.6);
    }
  }
  if (G.rescue) {
    const q = G.rescue, e = put(q, 'p', () => M3.person(q), visible(q.x, q.y, 120));
    if (e) { e.g.position.set(q.x, ghE(q.x, q.y), q.y); e.g.rotation.y = -(q.ang || 0); M3.updPerson(e.g, q, t); }
  }
  for (const [k, e] of M) if (e.f !== f) { dropEnt(e); M.delete(k); }
  // muhafızın elindeki meşalenin ışığı modelin elinden gelsin
  U3.guardPos = null;
  if (guard) { const e = M.get(guard); if (e && e.g.visible && e.g.userData.flame) { e.g.userData.flame.updateWorldMatrix(true, false); U3.guardPos = new THREE.Vector3().setFromMatrixPosition(e.g.userData.flame.matrixWorld); } else if (e) U3.guardPos = new THREE.Vector3(guard.x + Math.cos(guard.ang + 1.2) * 8, ghE(guard.x, guard.y) + 30, guard.y + Math.sin(guard.ang + 1.2) * 8); }
}

// ---- karanlıkta parlayan gözler
function syncEyes(dk, LS) {
  let n = 0; const E = U3.eyes, cp = U3.cam.position;
  if (dk > 0.5) for (const d of G.dinos) {
    if (n >= E.length - 1) break;
    if (d.tamed || d.blink < 0 || d.ko > 0 || d.hidden || d.fly || d.silent || d.dead || d.type === 'yamyam' || (d.type === 'taklitci' && !d.revealed)) continue;
    const wt = d.watcher > 0;
    if (!(wt || visibleK(d.x, d.y, 1.8) || d.scouted > 0)) continue;
    const lv = lightLevel(d.x, d.y, LS); if (lv > 0.35) continue;
    const toL = wt ? 1 : Math.cos(d.ang - angTo(d, L)); if (toL < -0.2 && !(d.scouted > 0)) continue;
    const big = d.type === 'geceavcisi' ? 1.8 : 1, hx = d.x + Math.cos(d.ang) * d.r * 1.05, hz = d.y + Math.sin(d.ang) * d.r * 1.05;
    const hy = d.type === 'uzunboyun' ? d.r * 2.6 : d.r > 45 ? d.r * 1.45 : Math.max(9, d.r * 1.15);
    const sep = Math.max(1.6, d.r * 0.2), px = -Math.sin(d.ang) * sep, pz = Math.cos(d.ang) * sep;
    const dd = Math.hypot(hx - cp.x, hz - cp.z), sz = Math.max((d.r * 0.09 + 1.2) * big * 3.2, dd * 0.011 * big);
    const a = d.scouted > 0 ? 0.95 : clamp(0.45 + 0.55 * toL * (1 - lv), 0, 1), col = c3(DINO[d.type].eye);
    const gy = ghE(d.x, d.y); for (const s of [-1, 1]) { const sp = E[n++]; sp.visible = true; sp.position.set(hx + px * s, gy + hy, hz + pz * s); sp.scale.set(sz, sz, 1); sp.material.color.copy(col); sp.material.opacity = a; }
  }
  for (let i = n; i < E.length; i++) E[i].visible = false;
}

// ---- küçük hareketliler: oklar, tükürük, parçacıklar, lekeler, izler
function syncSmall(t, dk) {
  const A = U3.arrowI; A.count = 0;
  for (const q of G.proj) instAdd(A, q.x - Math.cos(q.ang) * 16, ghE(q.x, q.y) + 24, q.y - Math.sin(q.ang) * 16, 0.55, 18, 0.55, -q.ang, null, 0, -Math.PI / 2);
  instDone(A);
  const S = U3.spitI; S.count = 0;
  for (const q of G.eproj) instAdd(S, q.x, ghE(q.x, q.y) + 18, q.y, 3.4, 3.4, 3.4, t * 9);
  instDone(S);
  const P = U3.parts, pa = P.geometry.attributes.position, ca = P.geometry.attributes.color; let n = 0;
  const BP = U3.bloodP.geometry.attributes.position, dt = Math.min(0.05, U3.dt || 0.016); let nb = 0;
  for (const q of G.parts) {
    if (q.blood) {   // kan: hayvanın gövde yüksekliğinden yerçekimiyle yay çizerek düşen damlalar
      if (nb >= U3.bloodN) continue;
      if (q._z === undefined) { let r = 14; for (const d of G.dinos) if (Math.abs(d.x - q.x) < d.r + 30 && Math.abs(d.y - q.y) < d.r + 30) { r = d.r; break; } q._g = ghE(q.x, q.y); q._z = r * (q.drip ? 0.8 : 1.0); q._vz = q.drip ? 0 : 40 + Math.random() * 90; }
      if (q._z > 0) { q._vz -= 520 * dt; q._z = Math.max(0, q._z + q._vz * dt); }
      BP.setXYZ(nb++, q.x, q._g + q._z + 0.6, q.y); continue;
    }
    if (n >= U3.partN) break;
    if (q._y0 === undefined) { q._y0 = q.y; q._up = q.vy < -24 && Math.abs(q.vx) < 46; q._h = 6 + Math.random() * 16; q._g = ghE(q.x, q.y); }
    const c = c3(q.col), a = clamp(q.life * 1.5, 0, 1);
    if (q._up) pa.setXYZ(n, q.x, q._g + 6 + (q._y0 - q.y) * 0.8, q._y0); else pa.setXYZ(n, q.x, q._g + 2 + q._h * clamp(q.life, 0, 1), q.y);
    ca.setXYZ(n, c.r * a, c.g * a, c.b * a); n++;
  }
  P.geometry.setDrawRange(0, n); pa.needsUpdate = true; ca.needsUpdate = true;
  U3.bloodP.geometry.setDrawRange(0, nb); BP.needsUpdate = true;
  const cx = L.x, cy = L.y;
  const ST = U3.stainI; ST.count = 0;
  for (const s of G.stains) { if (Math.abs(s.x - cx) > 900 || Math.abs(s.y - cy) > 900) continue; if (s._g === undefined) s._g = gh(s.x, s.y); instAdd(ST, s.x, s._g + 0.5 + (ST.count % 5) * 0.03, s.y, s.r, 1, s.r * 0.8, s.x); }
  instDone(ST);
  const TR = U3.trackI; TR.count = 0;
  for (const s of G.tracks) { if (Math.abs(s.x - cx) > 500 || Math.abs(s.y - cy) > 500 || !exploredAt(s.x, s.y)) continue; if (s._g === undefined) s._g = gh(s.x, s.y); instAdd(TR, s.x, s._g + 0.45, s.y, 13, 1, 8, -s.a); }
  instDone(TR);
  // ateş böcekleri
  const F = U3.flies, fa = clamp((baseDark() - 0.25) * 2, 0, 1) * 0.85; F.visible = fa > 0.02;
  if (F.visible) {
    const p = F.geometry.attributes.position; F.material.opacity = fa;
    U3.flySeed.forEach((s, i) => { const bx = Math.floor((cx - s[0]) / 700 + 0.5) * 700 + s[0], bz = Math.floor((cy - s[2]) / 700 + 0.5) * 700 + s[2], bl = Math.sin(t * 1.7 + s[3] * 3) > -0.2 ? 1 : 0, x = bx + Math.sin(t * 0.4 + s[3]) * 30, z = bz + Math.cos(t * 0.33 + s[3]) * 30; p.setXYZ(i, x, bl ? gh(x, z) + s[1] + Math.sin(t * 0.7 + s[3] * 2) * 8 : -900, z); });
    p.needsUpdate = true;
  }
  // duman
  const fuel = G.fire.fuel > 0, fy = U3.fireG.position.y;
  U3.smoke.forEach((s, i) => { s.visible = fuel; if (!fuel) return; const k = (t * 0.16 + i / U3.smoke.length) % 1; s.position.set(G.fire.x + Math.sin(t * 0.5 + i * 2) * 6 + k * 34, fy + 40 + k * 190, G.fire.y + Math.cos(t * 0.4 + i) * 6 + k * 10); const sz = 22 + k * 70; s.scale.set(sz, sz, 1); s.material.opacity = Math.sin(k * Math.PI) * 0.3 * (1 - dk * 0.75); });
}

// ---- hava: 3B yağmur çizgileri, yer sisi, bulutlar
function initWeather() {
  const n = 900, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  U3.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xaab8cc, transparent: true, opacity: 0.4, depthWrite: false })); U3.rain.frustumCulled = false; U3.rain.visible = false; U3.scene.add(U3.rain);
  U3.rainSeed = []; const R = mulberry32(41); for (let i = 0; i < n; i++) U3.rainSeed.push([R(), R(), R(), R()]);
  { const ns = 1400, sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ns * 3), 3));
    U3.snowP = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.6, map: TEX.soft, alphaTest: 0.05, transparent: true, opacity: 0.85, depthWrite: false, fog: true })); U3.snowP.frustumCulled = false; U3.snowP.visible = false; U3.scene.add(U3.snowP); }
  U3.mist = []; for (let i = 0; i < 12; i++) { const s = sprite(TEX.soft, 0xffffff, false, true); s.visible = false; U3.scene.add(s); U3.mist.push(s); }
  U3.clouds = []; const C = mulberry32(57);
  for (let i = 0; i < 11; i++) { const s = sprite(TEX.cloud, 0xffffff, false, false); s.renderOrder = -7; s.userData = { a: C() * TAU, d: 3000 + C() * 2200, h: 900 + C() * 900, w: 1400 + C() * 1600, sp: 0.5 + C() }; U3.scene.add(s); U3.clouds.push(s); }
}
function updWeather3D(dt, t, dk) {
  const w = G.weather.type, cp = U3.cam.position, lp = precipAt(L.x, L.y), wet = lp === 'yagmur', st = w === 'firtina' || (w === 'kar' && G.weather.heavy);
  U3.rainK = (U3.rainK || 0) + ((wet && !G.inside ? 1 : 0) - (U3.rainK || 0)) * Math.min(1, dt * 1.5);
  // kar taneleri: yavaş düşer, salınır; tipide yana savrulur
  U3.snowK = (U3.snowK || 0) + ((lp === 'kar' && !G.inside ? 1 : 0) - (U3.snowK || 0)) * Math.min(1, dt * 1.2);
  { const SP = U3.snowP; SP.visible = U3.snowK > 0.02;
    if (SP.visible) {
      const pa = SP.geometry.attributes.position, n = pa.count, B = 260, H = 220, act = Math.floor(n * U3.snowK * (st ? 1 : 0.6)), wx = st ? 60 : 8;
      for (let i = 0; i < n; i++) {
        const q = U3.rainSeed[i % U3.rainSeed.length], q3 = (q[3] + i * 0.618) % 1;
        if (i >= act) { pa.setXYZ(i, 0, -9999, 0); continue; }
        const ph = (t * (st ? 70 : 38) / H + q[2] + q3) % 1, dx = Math.sin(t * 0.9 + q3 * 20) * 6 + wx * ph * 3, dz = Math.cos(t * 0.7 + q[0] * 20) * 6;
        const x = cp.x + ((((q[0] + q3 * 0.37) % 1) * B * 2 - (cp.x % (B * 2)) + B * 4) % (B * 2)) - B, z = cp.z + ((((q[1] + q3 * 0.71) % 1) * B * 2 - (cp.z % (B * 2)) + B * 4) % (B * 2)) - B;
        pa.setXYZ(i, x + dx, cp.y + H * 0.55 - ph * H, z + dz);
      }
      pa.needsUpdate = true; SP.material.opacity = 0.9 * U3.snowK * (1 - dk * 0.55); SP.material.size = st ? 4.6 : 3.8;
    } }
  const RN = U3.rain; RN.visible = U3.rainK > 0.02;
  if (RN.visible) {
    const pa = RN.geometry.attributes.position, n = pa.count / 2, B = 420, H = 300, wx = st ? 0.35 : 0.08, sp = st ? 1300 : 950, len = st ? 30 : 22, act = Math.floor(n * U3.rainK * (st ? 1 : 0.7));
    for (let i = 0; i < n; i++) {
      const q = U3.rainSeed[i];
      if (i >= act) { pa.setXYZ(i * 2, 0, -9999, 0); pa.setXYZ(i * 2 + 1, 0, -9999, 0); continue; }
      const ph = (t * sp / H + q[2]) % 1, x = cp.x + ((q[0] * B * 2 - (cp.x % (B * 2)) + B * 4) % (B * 2)) - B, z = cp.z + ((q[1] * B * 2 - (cp.z % (B * 2)) + B * 4) % (B * 2)) - B, y = cp.y + H * 0.6 - ph * H;
      pa.setXYZ(i * 2, x + wx * len * (1 - ph) * 10, y, z); pa.setXYZ(i * 2 + 1, x + wx * len * (1 - ph) * 10 - wx * len, y - len, z);
    }
    pa.needsUpdate = true; RN.material.opacity = 0.32 * U3.rainK * (1 - dk * 0.5); RN.material.color.copy(U3.scene.fog.color).lerp(c3(0xc8d4e4), 0.6);
  }
  // yer sisi: sisli hava ya da sisli vadi ya da bataklık
  const bm = bioAt(L.x, L.y), mk = G.inside ? 0 : Math.max(w === 'sis' ? 1 : 0, bm === 3 ? 0.9 : 0, bm === 2 ? 0.45 : 0, isNight() ? 0.25 : 0);
  U3.mistK = (U3.mistK || 0) + (mk - (U3.mistK || 0)) * Math.min(1, dt * 0.6);
  U3.mist.forEach((s, i) => {
    s.visible = U3.mistK > 0.03; if (!s.visible) return;
    const a = i / U3.mist.length * TAU + t * 0.01, d = 160 + (i % 4) * 110, x = cp.x + Math.cos(a) * d + Math.sin(t * 0.05 + i) * 40, z = cp.z + Math.sin(a) * d;
    s.position.set(x, gh(x, z) + 22 + (i % 3) * 10, z); s.scale.set(420 + (i % 3) * 160, 90 + (i % 2) * 40, 1);
    s.material.color.copy(U3.scene.fog.color).lerp(c3(0xffffff), 0.25 * (1 - dk)); s.material.opacity = 0.3 * U3.mistK;
  });
  // bulutlar: gökyüzünde yavaşça sürüklenir; gece koyu ve seyrek
  const cl = 1 - dk, over = w === 'acik' ? 0.65 : 1;
  U3.clouds.forEach((s, i) => {
    const u = s.userData, a = u.a + t * 0.0025 * u.sp;
    s.visible = !G.inside; s.position.set(cp.x + Math.cos(a) * u.d, u.h, cp.z + Math.sin(a) * u.d); s.scale.set(u.w, u.w * 0.42, 1);
    s.material.color.copy(c3(0xffffff)).lerp(U3.scene.fog.color, 0.35 + (1 - cl) * 0.4).lerp(c3(0x1a1e26), clamp(dk * 1.1, 0, 0.85));
    if (wet || w === 'sis' || w === 'kar') s.material.color.multiplyScalar(0.72);
    s.material.opacity = (0.55 + cl * 0.35) * over * (i % 3 === 2 && w === 'acik' ? 0.4 : 1);
  });
}

// =============================================================
//  IŞIK, GÖK, SİS
// =============================================================
const SKY = { dayZ: new THREE.Color(0x4a86c8), dayH: new THREE.Color(0xb4cbd8), nightZ: new THREE.Color(0x02030a), nightH: new THREE.Color(0x05070e), dusk: new THREE.Color(0xff9448), mist: new THREE.Color(0x9aa0a8), storm: new THREE.Color(0x565c66), z: new THREE.Color(), h: new THREE.Color(), t: new THREE.Color() };
function updAtmos(dt, t, LS) {
  const dk = darkness(), p = phase(), w = G.weather.type, cam = U3.cam, cp = cam.position;
  const bm = biomeFast(L.x, L.y);
  // sis yoğunluğu hedefi (hava + sisli vadi), yumuşak geçiş
  const tk = (w === 'sis' ? 0.4 : w === 'firtina' ? 0.6 : w === 'yagmur' ? 0.72 : w === 'kar' ? (G.weather.heavy ? 0.45 : 0.7) : 1) * (bm === 3 ? 0.42 : bm === 2 ? 0.8 : 1);
  U3.fogK += (tk - U3.fogK) * Math.min(1, dt * 0.8);
  const grayK = clamp((1 - U3.fogK) * 1.5, 0, 1);
  let warm = 0;
  if (p < 0.1) warm = 1 - p / 0.1; else if (p > 0.34 && p < 0.6) warm = Math.min(1, (p - 0.34) / 0.1) * clamp(1 - (dk - 0.3) / 0.5, 0, 1); else if (p > 0.9) warm = (p - 0.9) / 0.1;
  const dayH = SKY.t.copy(SKY.dayH).lerp(w === 'sis' || bm === 3 ? SKY.mist : SKY.storm, grayK * 0.9);
  SKY.h.copy(dayH).lerp(SKY.dusk, warm * 0.5 * (1 - grayK * 0.7)).lerp(SKY.nightH, clamp(dk * 1.04, 0, 1));
  if (dk > 0.3 && grayK > 0) SKY.h.lerp(c3(0x1a1d24), grayK * 0.35 * dk);
  SKY.z.copy(SKY.dayZ).lerp(dayH, grayK * 0.85).lerp(SKY.nightZ, clamp(dk * 1.04, 0, 1));
  if (G.finale) { SKY.h.lerp(c3(0x16306a), 0.35); SKY.z.lerp(c3(0x0a1840), 0.3); }
  if (G.flash > 0) { const k = clamp(G.flash * 3, 0, 0.8); SKY.h.lerp(c3(0xdfe8ff), k); SKY.z.lerp(c3(0xc8d4f4), k); }
  U3.scene.fog.color.copy(SKY.h);
  const dn = clamp(dk / 0.95, 0, 1), far = (2300 + (520 - 2300) * dn) * (U3.fogK + (0.6 + U3.fogK * 0.4 - U3.fogK) * dn);
  U3.scene.fog.far = far; U3.scene.fog.near = far * (0.2 - 0.14 * dn) * (1 - grayK * 0.6);
  U3.fogCap.value = 1 - (1 - dn) * clamp(U3.fogK * 1.6 - 0.55, 0, 1) * 0.2; U3.fogLift.value = 0.32 * (1 - dn) * U3.fogK;
  U3.seaSky.value.copy(SKY.h).lerp(SKY.z, 0.25);
  U3.r.setClearColor(SKY.h, 1);
  // kubbe renkleri
  const dc = U3.dome.geometry.attributes.color, dp = U3.dome.geometry.attributes.position;
  for (let i = 0; i < dp.count; i++) { const k = Math.pow(clamp(dp.getY(i) / 7000, 0, 1), 0.5); dc.setXYZ(i, SKY.h.r + (SKY.z.r - SKY.h.r) * k, SKY.h.g + (SKY.z.g - SKY.h.g) * k, SKY.h.b + (SKY.z.b - SKY.h.b) * k); }
  dc.needsUpdate = true;
  U3.sky.position.set(cp.x, 0, cp.z);
  U3.stars.material.opacity = clamp((dk - 0.45) / 0.4, 0, 1) * 0.9 * clamp(U3.fogK * 1.6 - 0.6, 0, 1);
  U3.stars.visible = U3.stars.material.opacity > 0.01; U3.stars.rotation.y = G.t / CYCLE * 0.6;
  // güneş ve ay
  const ts = clamp(p / 0.5, 0, 1), sx = -Math.cos(ts * Math.PI), sy = Math.sin(ts * Math.PI) * 0.85 + 0.06;
  _v.set(sx, sy, 0.38).normalize(); (U3.sunV || (U3.sunV = new THREE.Vector3())).copy(_v);
  U3.sunS.position.copy(_v).multiplyScalar(6200); U3.sunS.material.opacity = clamp(1 - dk * 2.2, 0, 1) * clamp(U3.fogK * 1.4 - 0.4, 0, 1) * 0.8; U3.sunS.visible = U3.sunS.material.opacity > 0.01;
  U3.sunS.material.color.copy(c3(0xfff2c0)).lerp(c3(0xff9a50), warm * 0.7);
  U3.sunD.position.copy(U3.sunS.position); U3.sunD.visible = U3.sunS.visible; U3.sunD.material.opacity = U3.sunS.material.opacity; U3.sunD.material.color.copy(c3(0xfffbe8)).lerp(c3(0xffb070), warm * 0.8);
  U3.sun.position.copy(cp).addScaledVector(_v, 1000); U3.sun.target.position.copy(cp);
  const tn = clamp((p - 0.5) / 0.5, 0, 1);
  _v2.set(Math.cos(tn * Math.PI) * 0.8, Math.sin(tn * Math.PI) * 0.7 + 0.12, -0.5).normalize();
  U3.moonS.position.copy(_v2).multiplyScalar(6200); U3.moonS.material.opacity = clamp((dk - 0.4) / 0.4, 0, 1) * clamp(U3.fogK * 1.6 - 0.6, 0, 1); U3.moonS.visible = U3.moonS.material.opacity > 0.01;
  U3.moonG.position.copy(U3.moonS.position); U3.moonG.visible = U3.moonS.visible; U3.moonG.material.opacity = U3.moonS.material.opacity * 0.35;
  // ortam ışığı
  const day = 1 - clamp(dk / 0.95, 0, 1), dim = 0.55 + U3.fogK * 0.45;
  U3.hemi.intensity = (0.1 + 0.82 * day) * (dk > 0.5 ? 1 : dim) + (G.flash > 0 ? G.flash * 5 : 0);
  U3.hemi.color.copy(c3(0x6a7cae)).lerp(c3(0xd4e4ff), day).lerp(SKY.dusk, warm * 0.25);
  U3.hemi.groundColor.copy(c3(0x0c0e16)).lerp(c3(0x56603a), day);
  if (day > 0.05) { U3.sun.intensity = 0.95 * day * (0.35 + 0.65 * clamp(sy * 2.5, 0, 1)) * dim * dim; U3.sun.color.copy(c3(0xfff0d0)).lerp(c3(0xff9a50), warm * 0.7); }
  else { U3.sun.intensity = 0.1 * U3.moonS.material.opacity; U3.sun.color.set(0x8fa6e0); U3.sun.position.copy(cp).addScaledVector(_v2, 1000); }
  // nokta ışıkları: lights() içinden en yakın MAXL tanesi
  const arr = [];
  for (const l of LS) { const d = Math.hypot(l.x - cp.x, l.y - cp.z); if (d < 1500) arr.push([d - l.r, l]); }
  arr.sort((a, b) => a[0] - b[0]);
  const lk = 0.12 + 0.88 * clamp(dk / 0.9, 0, 1);
  for (let i = 0; i < MAXL; i++) {
    const pl = U3.pl[i], e = arr[i];
    if (!e) { pl.intensity = 0; continue; }
    const l = e[1], mine = G.torchOn && l.x === L.x && l.y === L.y && !l.safe, tall = l.r / lightMul() > 188, ly = gh(l.x, l.y);
    pl.color.set(l.blue ? 0x4f86ff : l.red ? 0xff4a22 : mine ? 0xffa050 : 0xff9a40);
    pl.distance = l.r * (l.safe ? 1.9 : 1.75);
    pl.intensity = (l.safe ? 2.5 : l.blue ? 2.2 : mine ? 2.0 : 1.9) * lk;
    if (mine) { _v.set(-5, -1, -6).applyQuaternion(cam.quaternion); pl.position.set(cp.x + _v.x, cp.y + _v.y, cp.z + _v.z); }
    else if (l.guard && U3.guardPos) pl.position.copy(U3.guardPos).y += 4;
    else pl.position.set(l.x, ly + (l.safe ? 26 : l.blue ? 50 : l.red ? 22 : tall ? 80 : 38), l.safe || l.blue || l.red ? l.y : l.y + (tall ? 10 : 20));
  }
  U3.self.position.copy(cp); U3.self.intensity = 0.55 * clamp((dk - 0.3) / 0.5, 0, 1);
  return dk;
}
function updFire(t, dk) {
  const f = G.fire, on = f.fuel > 0, s = 0.55 + f.fuel / 100;
  U3.fireG.position.set(f.x, gh(f.x, f.y), f.y);
  U3.fireFl.visible = on; U3.fireFl.userData.k = s;
  U3.fireGlow.visible = on;
  const fl = 1 + Math.sin(t * 11) * 0.05 + Math.sin(t * 23.7) * 0.03;
  if (on) { const gs = 90 * s * fl; U3.fireGlow.scale.set(gs, gs, 1); U3.fireGlow.material.opacity = 0.22 + 0.4 * dk; }
  U3.fireEmber.material.opacity = on ? 0.55 + 0.3 * Math.sin(t * 3.1) * Math.sin(t * 1.7) : 0.15; U3.fireEmber.scale.set(20 * (on ? s : 0.8), 1, 20 * (on ? s : 0.8));
  U3.firePool.material.opacity = on ? clamp(dk * 1.2, 0, 1) * 0.32 * fl : 0; U3.firePool.visible = U3.firePool.material.opacity > 0.01;
  updSparks(t, s, on && Math.hypot(f.x - L.x, f.y - L.y) < 1400);
  if (U3.eggN !== G.eggs.length) { U3.eggN = G.eggs.length; U3.eggI.count = 0; for (let i = 0; i < Math.min(6, G.eggs.length); i++) instAdd(U3.eggI, 32 + (i % 3) * 9, 5.5, 18 + Math.floor(i / 3) * 9, 4.6, 6.2, 4.6, i); instDone(U3.eggI); }
  // yarık
  U3.riftRings.forEach((m, i) => { m.rotation.y = t * (0.3 + i * 0.15) * (i % 2 ? -1 : 1); m.rotation.x = Math.sin(t * 0.7 + i) * 0.25; const k = 1 + Math.sin(t * 2 + i) * 0.05; m.scale.set(k, k * 1.25, k); });
  U3.riftG.position.y = gh(G.rift.x, G.rift.y);
  const fk = G.finale ? 1.6 : 1; U3.riftCore.scale.set(120 * fk * (1 + Math.sin(t * 4) * 0.08), 170 * fk, 1); U3.riftCore.material.opacity = 0.75 + Math.sin(t * 4) * 0.15;
}

// =============================================================
//  ANA 3B ÇİZİM
// =============================================================
function resize3D() {
  if (U3.w === VW && U3.h === VH) return;
  U3.w = VW; U3.h = VH;
  U3.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  U3.r.setSize(VW, VH, false);
  const a = VW / Math.max(1, VH);
  U3.cam.aspect = a; U3.baseFov = a < 1 ? Math.min(98, 2 * Math.atan(Math.tan(33 * Math.PI / 180) / a) * 180 / Math.PI) : 75;
}
function render3D(dt) {
  if (!init3D()) return false;
  if (!L || !G.trees) return true;
  resize3D();
  const t = G.now, cam = U3.cam; U3.frame++;
  U3.uTime.value = t; U3.dt = dt; updateTreeWind();
  // yeni oyun / yükleme: dünya dizileri değişti
  if (U3.worldKey !== G.trees || U3.worldSeed !== G.seed || U3.worldFire !== G.fire) { U3.worldKey = G.trees; U3.worldSeed = G.seed; U3.worldFire = G.fire; buildWorld(); }
  // ---- kamera (göz yüksekliği: arazi + duruş)
  if (L.moving && !G.sleep) U3.bob += dt * (L.sprinting ? 15 : L.sneak ? 7 : 10.5);
  const eyeT = G.mount ? EYE + G.mount.r * 1.75 : L.hp <= 0 ? 7 : L.sneak ? EYE_SNEAK : EYE;
  U3.eye += (eyeT - U3.eye) * Math.min(1, dt * 7);
  const mvK = U3.vmSway || 0, bobY = Math.sin(U3.bob) * (L.sneak ? 0.6 : 1.0) * mvK, sh = Math.min(G.shake || 0, 20);
  let yaw = G.yaw === undefined ? (L.ang || 0) : G.yaw, pitch = G.pitch || 0, px = L.x, py = L.y;
  if (G.inside) return render3DInterior(dt, t, yaw, pitch, bobY, sh);
  if (IN.b) interiorExit();
  if (G.sleep && G.sleep.b) { const b = G.sleep.b; px = b.x; py = b.y + b.r + 16; yaw = Math.PI / 2; pitch = 0.05; }
  const gT = ghE(px, py);
  if (U3.gY === undefined || Math.abs(gT - U3.gY) > 40) U3.gY = gT; else U3.gY += (gT - U3.gY) * Math.min(1, dt * 14);
  cam.position.set(px + (Math.random() - 0.5) * sh * 0.3, U3.gY + U3.eye + bobY + (Math.random() - 0.5) * sh * 0.22, py + (Math.random() - 0.5) * sh * 0.3);
  cam.rotation.set(clamp(pitch, -1.45, 1.45), -yaw - Math.PI / 2, (Math.random() - 0.5) * sh * 0.004 + Math.sin(U3.bob * 0.5) * 0.006 * mvK + (L.hp <= 0 ? 0.5 : 0));
  const fov = U3.baseFov / (1 + (G.scare || 0) * 0.14) * (L.sprinting && L.moving ? 1.04 : 1);
  if (Math.abs(cam.fov - fov) > 0.01 || cam.aspect !== U3.camA) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 6); if (Math.abs(cam.fov - fov) < 0.05) cam.fov = fov; U3.camA = cam.aspect; cam.updateProjectionMatrix(); }
  cam.updateMatrixWorld();
  // ---- arazi, deniz, otlar
  if (!U3.sl) U3.sl = seasonLook();
  terUpdate(cam.position.x, cam.position.z, U3.frame < 3 ? 1e9 : 8);
  seasonSync(dt, cam.position.x, cam.position.z);
  if (U3.lakeM) { const sk = Math.min(1, ((U3.sl && U3.sl.snow[0]) || 0) * 1.4); MAT.ice.color.setRGB(0.5 + 0.25 * sk, 0.64 + 0.18 * sk, 0.74 + 0.12 * sk); for (const [l, m] of U3.lakeM) { const mt = l.frozen ? MAT.ice : MAT.water; if (m.material !== mt) m.material = mt; } }
  U3.sea.position.set(Math.round(cam.position.x / 500) * 500, SEA_Y, Math.round(cam.position.z / 500) * 500);
  { const nb = G.builds.reduce((a, b) => a + (b.dead ? 0 : 1), 0); if (nb !== U3.grassN) { U3.grassN = nb; GR.slots.clear(); GR.free = []; for (let i = 0; i < (2 * GR.R + 1) ** 2; i++) GR.free.push(i); GR.cx = 1e9; } }
  grassUpdate(cam.position.x, cam.position.z, U3.frame < 3 ? 1e9 : 10);
  // ---- ışık ve hava
  const LS = U3.LS = lights();
  const dk = U3.dk = updAtmos(dt, t, LS);
  updWeather3D(dt, t, dk);
  // ---- durağan dünya örnekleri
  U3.sigT -= dt;
  if (U3.sigT <= 0) { U3.sigT = 0.4; const s = worldSig(); if (s !== U3.sig) { U3.sig = s; U3.instX = 1e9; const ns = G.nests.reduce((a, n) => a + n.eggs, 0) + G.nests.length * 100; if (ns !== U3.nestSig) { U3.nestSig = ns; rebuildNests(); } } }
  if (Math.abs(px - U3.instX) + Math.abs(py - U3.instY) > 200) rebuildInst(px, py);
  // ---- gölgeler: gece ve kapalı havada söner; ağaç gölgeleri güneşle döner
  { const day = clamp(1 - dk / 0.75, 0, 1), soft = 0.55 + 0.45 * clamp(U3.fogK, 0, 1);
    MAT.shadow.opacity = 0.5 * day * soft + 0.1 * (1 - day); MAT.tshadow.opacity = 0.42 * day * soft;
    U3.inst.tshadow.visible = MAT.tshadow.opacity > 0.01;
    const o = u3ShadowDir(); if (U3.inst.tshadow.visible && Math.abs(o.x * 1000 + o.z - (U3.shK || 0)) > 25) fillTreeShadows(); }
  U3.entShadow.count = 0;
  // ---- dinamik içerik
  syncBuilds(dk); syncCarcs(); syncCamps(); syncWrecks(t);
  syncEnts(t, dk); instDone(U3.entShadow); syncEyes(dk, LS); syncSmall(t, dk);
  updFire(t, dk); updFlames(t); updViewModel(dt, t);
  // yerleştirme hayaleti, av hedefi, bakılan kişi
  if (G.placing) {
    const p = placePos(), ok = placeOk(G.placing, p), r = BUILD[G.placing].r, gh0 = gh(p.x, p.y), gh_ = U3.ghost;
    gh_.visible = true; gh_.position.set(p.x, gh0, p.y); gh_.children[0].scale.set(r, 1, r); gh_.children[1].scale.set(r, BUILD[G.placing].flat ? 5 : 30, r); gh_.children[1].position.y = (BUILD[G.placing].flat ? 5 : 30) / 2;
    U3.ghostMat.color.set(ok ? 0x77cc66 : 0xcc4444); U3.ghostMat.opacity = 0.28 + Math.sin(t * 5) * 0.06;
  } else U3.ghost.visible = false;
  const ht = G.hunt && G.hunt.t && !G.hunt.t.dead && visible(G.hunt.t.x, G.hunt.t.y, 60) ? G.hunt.t : null;
  U3.huntRing.visible = !!ht;
  if (ht) { const rr = (ht.r || 12) + 12 + Math.sin(t * 5) * 2; U3.huntRing.position.set(ht.x, ghE(ht.x, ht.y) + 1.2, ht.y); U3.huntRing.scale.set(rr, 1, rr); U3.huntRing.rotation.y = t * 0.8; }
  const lp = G.lookP && !G.lookP.dead && G.lookP !== L ? G.lookP : null;
  U3.lookRing.visible = !!lp;
  if (lp) { const rr = (lp.child ? 9 : 13) + Math.sin(t * 6) * 0.8; U3.lookRing.position.set(lp.x, ghE(lp.x, lp.y) + 1, lp.y); U3.lookRing.children[0].scale.set(rr, 1, rr); U3.lookRing.children[1].position.y = (lp.child ? 34 : 50) + Math.sin(t * 4) * 2; U3.lookRing.children[1].rotation.y = t * 2; MAT.ring.opacity = 0.65 + Math.sin(t * 6) * 0.15; }
  U3.r.render(U3.scene, cam);
  return true;
}

// dünya noktası -> ekran (CSS px). z: kameranın önündeyse > 0 (uzaklık), arkadaysa < 0
// h zeminden yüksekliktir; içerideyken (G.inside) x,y iç koordinattır.
function w2s(x, y, h) {
  const cam = U3.cam; if (!cam) return null;
  _v.set(x, (h || 0) + (G.inside ? inFloorY(x, y) : ghE(x, y)), y).applyMatrix4(cam.matrixWorldInverse);
  const z = -_v.z; _v.applyMatrix4(cam.projectionMatrix);
  return { x: (_v.x * 0.5 + 0.5) * VW, y: (-_v.y * 0.5 + 0.5) * VH, z, on: z > 1 && _v.x > -1 && _v.x < 1 && _v.y > -1 && _v.y < 1 };
}

// =============================================================
//  İÇ MEKÂN — mağara / kulübe / çadır içinde birinci şahıs
//  İç koordinat (x, y) -> three (x, zemin, y). Kapı y = h kenarında, dışarı +z.
//  G.inside varken dış dünya yerine bu sahne çizilir; kamera bu sahneye taşınır.
// =============================================================
const IN = { b: null, key: '', scene: null, root: null, ppl: new Map(), lights: [], flick: [], kind: '', D: null };
function inKind() { const b = (G.inside && G.inside.b) || IN.b; return b ? b.type : ''; }
function inFloorY(x, y) {
  const k = inKind();
  if (k === 'magara') return 2.2 + 1.6 * Math.sin(x * 0.045 + 1.3) * Math.sin(y * 0.038) + 1.1 * Math.sin(x * 0.11 + y * 0.09);
  return k === 'kulube' ? 2 : 0.8;
}
function inInit() {
  if (IN.scene) return;
  const sc = IN.scene = new THREE.Scene();
  sc.fog = new THREE.Fog(0x0b0806, 160, 820);
  IN.hemi = new THREE.HemisphereLight(0x9a8878, 0x1c140e, 0.2); sc.add(IN.hemi);
  IN.pl = []; for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(0xff9a40, 0, 400, 1.5); sc.add(l); IN.pl.push(l); }
  const n = 240, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  IN.dust = new THREE.Points(g, new THREE.PointsMaterial({ map: TEX.soft, color: 0xffd8a8, size: 1.6, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })); IN.dust.frustumCulled = false; sc.add(IN.dust);
  const R = mulberry32(9); IN.dustSeed = []; for (let i = 0; i < n; i++) IN.dustSeed.push([R(), R(), R(), R() * 9]);
  MAT.caveRock = triPatch(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }), 0.05, 0.55);
  MAT.caveFloor = triPatch(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.07, 0.45);
  MAT.inV = triPatch(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), 0.11, 0.3);
  MAT.inVD = triPatch(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }), 0.11, 0.3);
  TEX.paint = paintTex(); TEX.hide = hideTex(); TEX.outside = canvasTex(64, (g, S) => { const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#e8eef4'); gr.addColorStop(0.62, '#a8b890'); gr.addColorStop(1, '#6a7a50'); g.fillStyle = gr; g.fillRect(0, 0, S, S); });
  MAT.hide = new THREE.MeshLambertMaterial({ map: TEX.hide, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
}
// ---- mağara resimleri: aşı boyası hayvanlar, el izleri, avcılar
function paintTex() {
  return canvasTex(1024, (g, S) => {
    const R = mulberry32(1234), H = S / 2; g.clearRect(0, 0, S, S);
    const ochre = ['rgba(150,58,26,', 'rgba(176,92,36,', 'rgba(120,40,22,', 'rgba(40,26,20,', 'rgba(190,120,60,'];
    const C = (i, a) => ochre[i] + a + ')';
    g.save(); g.translate(0, S * 0.25);                   // kullanılan alan: üst yarı (1024x512)
    // el izleri: püskürtme halesi + el boşluğu
    for (let k = 0; k < 7; k++) {
      const x = 60 + R() * 900, y = 40 + R() * 420, s = 0.8 + R() * 0.5, c = Math.floor(R() * 3), a = (R() - 0.5) * 0.8;
      for (let i = 0; i < 260; i++) { const rr = 50 * s * Math.sqrt(R()), aa = R() * TAU; g.fillStyle = C(c, 0.06 + R() * 0.08); g.beginPath(); g.arc(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr, 2 + R() * 4, 0, TAU); g.fill(); }
      g.save(); g.translate(x, y); g.rotate(a); g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,.85)';
      g.beginPath(); g.ellipse(0, 8 * s, 15 * s, 18 * s, 0, 0, TAU); g.fill();
      [[-15, -8, 0.5], [-7, -22, 0.15], [1, -26, 0], [9, -23, -0.12], [16, -14, -0.35]].forEach(([fx, fy, fa]) => { g.save(); g.translate(fx * s, fy * s); g.rotate(fa); g.beginPath(); g.ellipse(0, 0, 4 * s, 12 * s, 0, 0, TAU); g.fill(); g.restore(); });
      g.restore();
    }
    // hayvanlar: uzun boyunlu otçul, yırtıcı, boynuzlu, sürü
    const beast = (x, y, s, kind, c) => {
      g.save(); g.translate(x, y); g.scale(s * (R() < 0.5 ? -1 : 1), s); g.fillStyle = C(c, 0.78); g.strokeStyle = C(3, 0.75); g.lineWidth = 3 / s; g.lineCap = 'round';
      g.beginPath();
      if (kind === 0) { g.ellipse(0, 0, 60, 28, 0, 0, TAU); g.moveTo(40, -10); g.quadraticCurveTo(80, -60, 95, -110); g.lineTo(108, -108); g.quadraticCurveTo(95, -50, 55, 8); g.moveTo(-50, -5); g.quadraticCurveTo(-110, 0, -150, 30); g.lineTo(-52, 12); }
      else if (kind === 1) { g.ellipse(0, 0, 40, 18, -0.2, 0, TAU); g.moveTo(30, -12); g.lineTo(62, -30); g.lineTo(80, -24); g.lineTo(66, -12); g.lineTo(36, 4); g.moveTo(-30, 0); g.lineTo(-95, -20); g.lineTo(-34, 10); }
      else { g.ellipse(0, 0, 50, 26, 0, 0, TAU); g.moveTo(42, -6); g.lineTo(70, -8); g.lineTo(74, 10); g.lineTo(44, 14); }
      g.fill(); g.stroke();
      g.beginPath(); const legs = kind === 1 ? [[14, 14], [-14, 14]] : [[34, 18], [18, 22], [-18, 22], [-36, 18]];
      for (const [lx, ly] of legs) { g.moveTo(lx, ly); g.lineTo(lx + (R() - 0.5) * 12, ly + (kind === 1 ? 48 : 40)); }
      g.lineWidth = (kind === 1 ? 7 : 9) / 1; g.strokeStyle = C(c, 0.8); g.stroke();
      if (kind === 2) { g.beginPath(); g.moveTo(68, -8); g.lineTo(90, -36); g.moveTo(70, -2); g.lineTo(98, -18); g.moveTo(40, -24); g.lineTo(46, -46); g.lineWidth = 4; g.strokeStyle = C(3, 0.8); g.stroke(); }
      g.restore();
    };
    beast(250, 230, 1.15, 0, 0); beast(640, 190, 0.9, 2, 1); beast(830, 300, 0.7, 2, 0); beast(470, 340, 0.85, 1, 2); beast(120, 380, 0.55, 1, 3); beast(760, 410, 0.5, 2, 2);
    // avcılar: çöp adam, mızrak
    for (let k = 0; k < 6; k++) {
      const x = 380 + k * 40 + R() * 20, y = 420 + R() * 30, s = 0.8 + R() * 0.3;
      g.strokeStyle = C(3, 0.82); g.lineWidth = 3.5; g.lineCap = 'round'; g.beginPath();
      g.arc(x, y - 44 * s, 5 * s, 0, TAU); g.moveTo(x, y - 38 * s); g.lineTo(x, y - 14 * s); g.lineTo(x - 9 * s, y); g.moveTo(x, y - 14 * s); g.lineTo(x + 9 * s, y);
      g.moveTo(x, y - 32 * s); g.lineTo(x + 14 * s, y - 24 * s); g.moveTo(x - 10 * s, y - 10 * s); g.lineTo(x + 36 * s, y - 52 * s); g.stroke();
    }
    // güneş sarmalı ve nokta dizileri
    g.strokeStyle = C(4, 0.7); g.lineWidth = 4; g.beginPath(); for (let a = 0; a < 18; a += 0.15) { const rr = a * 3.2; g.lineTo(900 + Math.cos(a) * rr, 90 + Math.sin(a) * rr); } g.stroke();
    for (let k = 0; k < 40; k++) { g.fillStyle = C(Math.floor(R() * 3), 0.7); g.beginPath(); g.arc(40 + k * 22, 30 + Math.sin(k * 0.7) * 10, 4, 0, TAU); g.fill(); }
    g.restore();
    // eskime: rastgele aşınma
    g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(0,0,0,${R() * 0.35})`; g.fillRect(R() * S, R() * S, 1 + R() * 5, 1 + R() * 3); }
  });
}
function hideTex() {
  return canvasTex(128, (g, S) => {
    const R = mulberry32(55); g.fillStyle = '#9a6a40'; g.beginPath();
    for (let i = 0; i <= 24; i++) { const a = i / 24 * TAU, r = S * (0.38 + 0.08 * Math.sin(a * 3) + R() * 0.05) * (Math.abs(Math.cos(a)) > 0.9 ? 1.15 : 1); g.lineTo(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r * 1.15); }
    g.fill();
    for (let i = 0; i < 70; i++) { g.fillStyle = R() < 0.5 ? 'rgba(60,34,18,.35)' : 'rgba(200,160,110,.25)'; g.beginPath(); g.arc(S * (0.2 + R() * 0.6), S * (0.15 + R() * 0.7), 2 + R() * 6, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(40,24,12,.6)'; g.lineWidth = 2; g.stroke();
  });
}
// ---- kaya kabuğu (mağara): süper-elips kubbe, gürültüyle bozulmuş; kapı deliği kesik
function caveShell(W, H, hz) {
  const cx = W / 2, cz = H / 2, A = W / 2 + 50, Bb = H / 2 + 52, Bf = H / 2 + 24, Hc = 150, NT = 84, NP = 18;
  const V = [];
  for (let j = 0; j <= NP; j++) {
    const ph = -0.2 + (Math.PI / 2 + 0.2) * j / NP, row = [];
    for (let i = 0; i <= NT; i++) {
      const th = (i % NT) / NT * TAU, c = Math.cos(th), sn = Math.sin(th), n = 5;
      const sx = Math.sign(c) * Math.pow(Math.abs(c), 2 / n), sz = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n);
      const k = Math.pow(Math.max(0, Math.cos(ph)), 0.42);
      let x = cx + sx * A * k, z = cz + sz * (sn > 0 ? Bf : Bb) * k, y = Hc * Math.sin(ph);
      const nn = fbm3(x * 0.021, y * 0.03 + 3, z * 0.021), big = fbm3(x * 0.006 + 5, y * 0.008, z * 0.006 + 2), wk = Math.max(0, Math.cos(ph));
      const dx = x - cx, dz = z - cz, dl = Math.hypot(dx, dz) || 1, disp = (nn - 0.42) * 38 + (big - 0.5) * 56;
      x += dx / dl * disp * wk; z += dz / dl * disp * wk;
      y += (1 - wk) * ((nn - 0.5) * 34 - (big - 0.5) * 40) + (j === NP ? -18 : 0);
      // yürünen alana taşmasın (göz hizasının altında)
      if (y < 85 && x > -18 && x < W + 18 && z > -18 && z < H + 18) { const m = [x + 18, W + 18 - x, z + 18, H + 18 - z], q = m.indexOf(Math.min(...m)); if (q === 0) x = -18; else if (q === 1) x = W + 18; else if (q === 2) z = -18; else z = H + 18; }
      row.push([x, y, z, nn, big]);
    }
    V.push(row);
  }
  const pos = [], col = [], cc = new THREE.Color(), base = c3('#4c4038'), wet = c3('#3a3634'), soot = c3('#151210');
  const vcol = q => { cc.copy(base).multiplyScalar(0.55 + q[3] * 0.75 + (q[4] - 0.5) * 0.3); if (q[1] < 20) cc.multiplyScalar(0.75); if (Math.sin(q[0] * 0.09 + q[3] * 9) > 0.86) cc.lerp(wet, 0.5); const hd = Math.hypot(q[0] - cx, q[2] - hz); if (q[1] > 60 && hd < 220) cc.lerp(soot, (1 - hd / 220) * 0.75); return cc; };
  const tri = (a, b, c) => {
    const my = (a[1] + b[1] + c[1]) / 3, mz = (a[2] + b[2] + c[2]) / 3, mx = (a[0] + b[0] + c[0]) / 3;
    if (mz > H - 4 && Math.abs(mx - cx) < 46 && my < 78) return;   // mağara ağzı
    for (const q of [a, b, c]) { pos.push(q[0], q[1], q[2]); const k = vcol(q); col.push(k.r, k.g, k.b); }
  };
  for (let j = 0; j < NP; j++) for (let i = 0; i < NT; i++) { const a = V[j][i], b = V[j][i + 1], c = V[j + 1][i], d = V[j + 1][i + 1]; tri(a, c, b); tri(b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  return new THREE.Mesh(g, MAT.caveRock);
}
// ---- ağız tüneli: kemer biçimli kısa geçit, ucunda dış dünya ışığı
function caveTunnel(W, H) {
  const cx = W / 2, pos = [], col = [], NU = 12, NV = 6, P = [];
  for (let v = 0; v <= NV; v++) { const z = H - 6 + v * 22, row = []; for (let u = 0; u <= NU; u++) { const a = u / NU * Math.PI, n = fbm3(u * 0.7, v * 0.6, 4.2); row.push([cx + Math.cos(a) * (50 + (n - 0.5) * 22 + v * 3), Math.sin(a) * (78 + (n - 0.5) * 18 + v * 2) - 4, z + (n - 0.5) * 8, n]); } P.push(row); }
  const cc = new THREE.Color(), base = c3('#5e5148');
  const add = q => { pos.push(q[0], q[1], q[2]); cc.copy(base).multiplyScalar(0.55 + q[3] * 0.7); col.push(cc.r, cc.g, cc.b); };
  for (let v = 0; v < NV; v++) for (let u = 0; u < NU; u++) { const a = P[v][u], b = P[v][u + 1], c = P[v + 1][u], d = P[v + 1][u + 1]; [a, c, b, b, c, d].forEach(add); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  return new THREE.Mesh(g, MAT.caveRock);
}
function caveFloor(W, H, hx, hz) {
  const pg = new THREE.PlaneGeometry(W + 180, H + 260, 54, 46); pg.rotateX(-Math.PI / 2); pg.translate(W / 2, 0, H / 2 + 40);
  const p = pg.attributes.position, col = new Float32Array(p.count * 3), cc = new THREE.Color(), dirt = c3('#4c3e32'), ash = c3('#5c5752'), path = c3('#6a5a48'), stone = c3('#5a524a');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), out = Math.max(0, -x, x - W, -z, z - H - 20);
    const y = 2.2 + 1.6 * Math.sin(x * 0.045 + 1.3) * Math.sin(z * 0.038) + 1.1 * Math.sin(x * 0.11 + z * 0.09) + out * 0.45 + (out > 0 ? fbm3(x * 0.05, 0, z * 0.05) * 12 : 0);
    p.setY(i, y);
    const n = fbm3(x * 0.03, 1, z * 0.03);
    cc.copy(dirt).multiplyScalar(0.7 + n * 0.6); if (n > 0.62) cc.lerp(stone, 0.6);
    const pd = Math.abs(x - W / 2); if (pd < 60 && z > hz) cc.lerp(path, (1 - pd / 60) * 0.35);
    const ad = Math.hypot(x - hx, z - hz); if (ad < 70) cc.lerp(ash, (1 - ad / 70) * 0.7);
    if (z > H) cc.lerp(c3('#6a6048'), clamp((z - H) / 120, 0, 0.6));
    col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
  }
  pg.setAttribute('color', new THREE.BufferAttribute(col, 3)); pg.computeVertexNormals();
  return new THREE.Mesh(pg, MAT.caveFloor);
}
const _rc = new THREE.Raycaster(), _rv = new THREE.Vector3(), _rd = new THREE.Vector3();
function inRay(meshes, x, y, z, dx, dy, dz, far) {
  _rc.set(_rv.set(x, y, z), _rd.set(dx, dy, dz).normalize()); _rc.far = far || 2000;
  const h = _rc.intersectObjects(meshes, false); return h.length ? h[0] : null;
}
// ---- eşyalar (tek birleşik ağda); stil: cave | hut | tent
function inFurniture(gb, f, R, st, X) {
  const x = f.x, z = f.y, y0 = inFloorY(x, z), wood = st === 'cave' ? '#5a3c22' : '#7a5632', fur = ['#6a4a30', '#8a6a48', '#5a4232', '#a08060'];
  const flame = (fx, fy, fz, s, li) => { X.flames.push([fx, fy, fz, s]); if (li) X.lights.push(Object.assign({ x: fx, y: fy + s * 0.6, z: fz }, li)); };
  switch (f.k) {
    case 'bed': {
      if (st === 'hut') { gb.box(wood, x, y0 + 5, z, 46, 5, 24); for (const sx of [-1, 1]) for (const sz of [-1, 1]) gb.box('#4a3018', x + sx * 21, y0 + 2.5, z + sz * 10, 3, 5, 3); }
      const yb = y0 + (st === 'hut' ? 8 : 0);
      for (let i = 0; i < 5; i++) gb.add(GEO.ico1, fur[(i + Math.floor(R() * 4)) % 4], x - 12 + i * 6 + (R() - 0.5) * 3, yb + 2.5, z + (R() - 0.5) * 5, 9 + R() * 3, 3.6 + R() * 1.6, 9 + R() * 2, 0, R() * 6, 0);
      gb.add(GEO.ico1, '#d0bea0', x - 17, yb + 5, z, 5, 3, 8, 0, 0.2, 0);
      gb.add(GEO.ico1, fur[Math.floor(R() * 4)], x + 6, yb + 6, z, 15, 2.2, 11, 0, R(), 0.05);
      if (R() < 0.5) gb.sph('#e4dcc6', x + 26, y0 + 2, z + 8, 2.6, 2, 2.6);
      break;
    }
    case 'mat': {
      const c = R() < 0.5 ? '#a89060' : '#8a7a48';
      gb.box(c, x, y0 + 0.9, z, 36, 1.6, 18, (f.ang || 0) + (R() - 0.5) * 0.2);
      for (let i = 0; i < 5; i++) gb.box(i % 2 ? '#b8a070' : '#7a6a3a', x - 14 + i * 7, y0 + 1.9, z + (R() - 0.5) * 4, 5, 0.6, 16, (R() - 0.5) * 0.3);
      gb.add(GEO.ico1, '#6a8a3a', x - 15, y0 + 2.5, z, 4, 2, 7, 0, R(), 0);
      break;
    }
    case 'healbed': {
      for (const sx of [-1, 1]) gb.dod('#6a645c', x + sx * 16, y0 + 4, z, 7, 6, 9, sx);
      gb.box(wood, x, y0 + 9, z, 44, 3, 22).box('#d8d0b8', x, y0 + 11.5, z, 40, 2.4, 19).box('#ece6d6', x - 15, y0 + 13.5, z, 8, 2.6, 13);
      gb.add(GEO.cyl, '#8a7050', x + 28, y0, z + 10, 4.5, 3.5, 4.5).sph('#3a6a2a', x + 28, y0 + 3.5, z + 10, 3.2, 1.2, 3.2);
      break;
    }
    case 'crate': {
      const v = Math.floor(R() * 3);
      if (v === 0) { for (let i = 0; i < 6; i++) { const row = i < 3 ? 0 : i < 5 ? 1 : 2, k = i - [0, 3, 5][row]; gb.add(GEO.cyl, i % 2 ? '#6a4a2a' : '#5a3c20', x - 6 + k * 6.4 + row * 3.2, y0 + 3.2 + row * 5.6, z, 3.1, 30, 3.1, Math.PI / 2, 0, 0); } }
      else if (v === 1) { for (let i = 0; i < 3; i++) { const px = x + (i - 1) * 11, pz = z + (i % 2) * 6, s = 0.8 + R() * 0.4; gb.sph(i % 2 ? '#9a5a34' : '#8a4a2a', px, y0 + 7 * s, pz, 6.5 * s, 7.5 * s, 6.5 * s).cyl('#7a4024', px, y0 + 13 * s, pz, 2.6 * s, 3 * s); } }
      else { if (st === 'cave') { gb.add(GEO.cyl, '#a08050', x, y0, z, 10, 14, 10).add(GEO.torus, '#7a5a30', x, y0 + 4, z, 10.3, 2, 10.3).add(GEO.torus, '#7a5a30', x, y0 + 10, z, 10.3, 2, 10.3).sph('#b02a2a', x - 2, y0 + 14, z, 3, 2, 3).sph('#c4382a', x + 3, y0 + 14, z + 2, 3, 2, 3); }
        else { gb.box('#8a6a40', x, y0 + 8, z, 20, 16, 20, f.ang).box('#6a4a28', x, y0 + 24, z, 16, 16, 16, f.ang + 0.4); } }
      if (R() < 0.6) gb.sph('#7a5236', x + 14, y0 + 2, z - 8, 9, 2.4, 7);
      break;
    }
    case 'rack': {
      gb.cyl(wood, x - 22, y0, z, 1.8, 56).cyl(wood, x + 22, y0, z, 1.8, 56).add(GEO.cyl, wood, x, y0 + 52, z, 1.5, 48, 1.5, 0, 0, Math.PI / 2);
      for (let i = 0; i < 5; i++) {
        const hx = x - 16 + i * 8;
        if (f.t === 'kasap') { gb.cyl('#ccc0a0', hx, y0 + 44, z, 0.3, 8); gb.sph(i % 2 ? '#8a1a14' : '#a02a1e', hx, y0 + 36, z, 3.2, 7.5, 2.8); }
        else if (f.t === 'atolye') { gb.add(GEO.cyl, '#7a5a34', hx, y0, z - 6, 0.9, 64, 0.9, -0.2, 0, 0); gb.add(GEO.cone, '#9a958a', hx, y0 + 63 * Math.cos(0.2), z - 6 - 64 * Math.sin(0.2), 1.6, 6, 0.8, -0.2, 0, 0); }
        else gb.box(i % 2 ? '#7a5030' : '#8a6240', hx, y0 + 38, z, 7, 26 - (i % 3) * 4, 0.8, 0, 0, (R() - 0.5) * 0.2);
      }
      break;
    }
    case 'hearth': {
      const big = !!f.main, r = big ? 26 : 16;
      for (let i = 0; i < (big ? 13 : 9); i++) { const a = i / (big ? 13 : 9) * TAU; gb.dod(i % 2 ? '#5a524a' : '#6a625a', x + Math.cos(a) * r, y0 + 2, z + Math.sin(a) * r, big ? 6.5 : 4.5, big ? 5 : 3.5, big ? 6.5 : 4.5, a * 3); }
      gb.add(GEO.disc, '#120c08', x, y0 + 0.4, z, r - 3, 1, r - 3);
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.3; gb.add(GEO.cyl, '#3a2010', x + Math.cos(a) * 2, y0 + 1.5, z + Math.sin(a) * 2, big ? 2.4 : 1.7, big ? 26 : 16, big ? 2.4 : 1.7, 0, -a, -Math.PI / 2 + 0.55); }
      flame(x, y0 + 2, z, big ? 24 : 14, { col: 0xff8a38, int: big ? 2.8 : 1.9, dist: big ? 440 : 260, pri: big ? 0 : 2, fl: 1 });
      X.embers.push([x, y0, z, r]);
      if (f.t === 'mutfak' && !big) {   // üç ayak + çömlek
        for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; gb.add(GEO.cyl, '#3a2a1a', x + Math.cos(a) * (r + 2), y0, z + Math.sin(a) * (r + 2), 1, 46, 1, Math.sin(a) * 0.36, 0, -Math.cos(a) * 0.36); }
        gb.cyl('#2a2018', x, y0 + 36, z, 0.4, 7).sph('#4a3a30', x, y0 + 30, z, 6, 5, 6).cyl('#3a2c22', x, y0 + 34, z, 4.6, 1.6);
      }
      if (big) {   // şiş: iki çatal ve kızaran et
        for (const sx of [-1, 1]) { gb.add(GEO.cyl, '#4a3018', x + sx * (r + 3), y0, z, 1.3, 30, 1.3, 0, 0, sx * 0.08); gb.add(GEO.cyl, '#4a3018', x + sx * (r + 3), y0 + 28, z, 0.9, 6, 0.9, 0, 0, sx * 0.7); }
        gb.add(GEO.cyl, '#5a4028', x - r - 8, y0 + 30, z, 0.8, 2 * r + 16, 0.8, 0, 0, -Math.PI / 2).sph('#7a2a16', x, y0 + 30, z, 9, 5.5, 5.5).sph('#5a1e10', x + 6, y0 + 31, z + 1, 4, 4, 4);
      }
      if (big) { for (const [a, l] of [[0.5, 46], [2.6, 40], [4.2, 44]]) gb.add(GEO.cyl, '#5a3c22', x + Math.cos(a) * 48, y0 + 4, z + Math.sin(a) * 48, 4, l, 4, 0, -a + Math.PI / 2, Math.PI / 2); for (let i = 0; i < 3; i++) { const a = 1.2 + i * 1.6; gb.sph(fur[i], x + Math.cos(a) * 62, y0 + 1.6, z + Math.sin(a) * 62, 13, 2, 9); } }
      break;
    }
    case 'table': {
      gb.add(GEO.cyl, '#5a3c22', x, y0 + 4, z - 8, 4, 50, 4, 0, 0, Math.PI / 2).add(GEO.cyl, '#5a3c22', x, y0 + 4, z + 8, 4, 50, 4, 0, 0, Math.PI / 2);
      gb.box('#7a5a36', x, y0 + 9.5, z, 56, 3, 30);
      for (let i = 0; i < 5; i++) { const bx = x - 20 + i * 10, bz = z + (i % 2 ? 7 : -7); gb.sph('#8a6040', bx, y0 + 11.8, bz, 4, 1.8, 4).sph(['#a02a1e', '#c4882a', '#6a3a1a'][i % 3], bx, y0 + 12.8, bz, 2.6, 1.2, 2.6); }
      gb.sph('#9a2a1e', x + 2, y0 + 13, z, 8, 3.2, 5).box('#e4dcc6', x + 10, y0 + 13, z, 9, 1.4, 1.4, 0.3);
      for (const sz of [-1, 1]) gb.add(GEO.cyl, '#5a3c22', x, y0 + 3.5, z + sz * 30, 3.5, 44, 3.5, 0, 0, Math.PI / 2);
      break;
    }
    case 'bench': {
      gb.dod('#6a645c', x - 16, y0 + 7, z, 9, 8, 10, 1).dod('#625c54', x + 16, y0 + 7, z, 9, 8, 10, 2).box('#7a746a', x, y0 + 15, z, 50, 5, 24, 0.05);
      gb.add(GEO.cyl, '#7a5a34', x - 10, y0 + 18.5, z + 3, 0.9, 16, 0.9, 0, 0.4, Math.PI / 2).dod('#4a4848', x - 2, y0 + 19, z + 6, 2.6, 2, 3.4, 1);
      for (let i = 0; i < 6; i++) gb.dod('#3a3a3c', x + 6 + R() * 14, y0 + 18, z - 6 + R() * 10, 1.2, 0.6, 1.4, R() * 6);
      gb.add(GEO.cyl, '#7a5a34', x + 2, y0 + 18.3, z - 7, 0.7, 30, 0.7, 0, -0.1, Math.PI / 2).add(GEO.cone, '#9a958a', x + 17, y0 + 18.3, z - 8.5, 1.4, 5, 0.7, 0, -0.1, -Math.PI / 2);
      gb.sph('#7a5236', x + 30, y0 + 1.6, z + 16, 10, 1.6, 7);
      break;
    }
    case 'block': {
      gb.cyl('#6a4a2a', x, y0, z, 12, 20).add(GEO.disc, '#8a6a44', x, y0 + 20.1, z, 11, 1, 11).sph('#9a1a14', x + 2, y0 + 22, z, 6, 2.5, 4);
      gb.box('#b8b4a8', x - 6, y0 + 21, z + 5, 8, 0.8, 4, 0.4).add(GEO.cyl, '#5a3a1e', x - 12, y0 + 21, z + 7.5, 0.8, 7, 0.8, 0, 0.4 + Math.PI / 2, Math.PI / 2);
      X.decals.push([x + 10, z + 8, 16, '#3a0606']); X.decals.push([x - 8, z - 10, 9, '#2a0404']);
      for (let i = 0; i < 4; i++) gb.box('#e4dcc6', x + 20 + R() * 14, y0 + 1, z - 10 + R() * 20, 10, 1.6, 1.6, R() * 3);
      break;
    }
    case 'herbs': {
      gb.cyl(wood, x - 24, y0, z, 1.4, 50).cyl(wood, x + 24, y0, z, 1.4, 50).add(GEO.cyl, wood, x, y0 + 47, z, 1.2, 52, 1.2, 0, 0, Math.PI / 2);
      for (let i = 0; i < 7; i++) { const hx = x - 19 + i * 6.3, c = ['#4a7a34', '#6a7a3a', '#7a6a3a', '#3e6a2c'][i % 4]; gb.cyl('#c8b080', hx, y0 + 42, z, 0.25, 5); gb.add(GEO.cone, c, hx, y0 + 43, z, 2.4, 13, 2.4, Math.PI, 0, 0); }
      gb.cyl('#7a746a', x - 6, y0, z + 16, 5, 6).cyl('#3a3634', x - 6, y0 + 6, z + 16, 4, 0.5).add(GEO.cyl, '#8a8478', x - 4, y0 + 6, z + 16, 1, 9, 1, 0.5, 0, 0);
      gb.add(GEO.cyl, '#a08050', x + 10, y0, z + 16, 7, 7, 7).sph('#5a8a3a', x + 10, y0 + 7, z + 16, 6, 2.5, 6);
      break;
    }
    case 'torch': {
      const lean = st === 'cave' ? 0.18 : 0;
      gb.add(GEO.cyl, '#4a3018', x, y0, z, 1.6, 54, 1.6, lean, 0, 0).dod('#5a524a', x, y0 + 2, z, 5, 3, 5).add(GEO.cyl, '#2a1a0c', x, y0 + 52 * Math.cos(lean), z + 52 * Math.sin(lean), 2.6, 5, 2.6, lean, 0, 0);
      flame(x, y0 + 57 * Math.cos(lean), z + 57 * Math.sin(lean), 7, { col: 0xff9a48, int: 1.6, dist: 230, pri: 1, fl: 1 });
      break;
    }
  }
}
// ---- oda bölmeleri: mağarada alçak kaya sırtları + sütunlar, kulübede hasır paravanlar
// ---- oda bölmesi düzeni (deterministik): sahne kurulmadan çarpışma için de kullanılır
function inLayout(b) {
  const rooms = inRooms(b), D = inDims(b), W = D.w, H = D.h, walls = [], pts = new Map();
  for (const r of rooms) {
    const left = r.x < 2, right = r.x + r.w > W - 2, back = !left && !right && r.y < 2;
    // komşu odayla ortak kenar: duvardan içeri doğru %65
    if (left || right) { const z = r.y + r.h + 4, x0 = left ? 0 : W, x1 = left ? r.w * 0.68 : W - r.w * 0.68; if (z < H - 70 && rooms.some(o => o !== r && Math.abs(o.y - z) < 14 && Math.abs(o.x - r.x) < 2)) walls.push([x0, z, x1, z]); }
    if (back) { const x = r.x + r.w + 4; if (rooms.some(o => o !== r && Math.abs(o.x - x) < 14 && o.y < 2)) walls.push([x, 0, x, r.h * 0.68]); }
    // girişin iki ucunda sütun
    const ends = left ? [[r.x + r.w, r.y], [r.x + r.w, r.y + r.h]] : right ? [[r.x, r.y], [r.x, r.y + r.h]] : [[r.x, r.y + r.h], [r.x + r.w, r.y + r.h]];
    for (const [px, pz] of ends) { const k = Math.round(px / 30) + ',' + Math.round(pz / 30); if (!pts.has(k) && pz < H - 60) pts.set(k, [px, pz]); }
  }
  return { walls, pts };
}
// ---- iç mekân çarpışması (ic.js inMove çağırır): katı daireler + yürünebilir alanın sınırı
const INCOL = new Map();
function inColKey(b) { return b.type + '|' + ((typeof roomsOf === 'function' ? roomsOf(b) : b.rooms) || []).join() + '|' + inDims(b).w; }
function inCol(b) {
  const key = inColKey(b); let c = INCOL.get(b);
  if (c && c.key === key) return c;
  const D = inDims(b), W = D.w, H = D.h, st = b.type === 'magara' ? 'cave' : b.type === 'kulube' ? 'hut' : 'tent', lay = inLayout(b), sol = [];
  if (st !== 'tent') for (const [x0, z0, x1, z1] of lay.walls) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = st === 'cave' ? Math.max(2, Math.round(len / 14)) : Math.max(2, Math.round(len / 9));
    for (let i = 0; i <= n; i++) { const t = i / n; sol.push({ x: x0 + (x1 - x0) * t, y: z0 + (z1 - z0) * t, r: st === 'cave' ? 10 * (1 - t * 0.25) : 4 }); }
  }
  if (st === 'cave') {
    for (const [px, pz] of lay.pts.values()) sol.push({ x: px, y: pz, r: 13 });
    const hz = H * 0.62, hx = W / 2;   // büyük ocak çevresindeki oturak kütükleri
    for (const [a, l] of [[0.5, 46], [2.6, 40], [4.2, 44]]) { const px = hx + Math.cos(a) * 48, pz = hz + Math.sin(a) * 48; for (const t of [0.15, 0.5, 0.85]) sol.push({ x: px - Math.sin(a) * l * t, y: pz + Math.cos(a) * l * t, r: 5 }); }
  }
  if (st === 'tent') for (let i = 0; i < 3; i++) sol.push({ x: W / 2 - 70 + i * 34, y: 8, r: 13 });
  // yürünebilir sınır: mağarada kubbe duvarının zemin halkası (caveShell ile aynı formül) eksi moloz payı
  let ring = null;
  if (st === 'cave') {
    const cx = W / 2, cz = H / 2, A = W / 2 + 50, Bb = H / 2 + 52, Bf = H / 2 + 24, NT = 84, ph = 0.05, k = Math.pow(Math.cos(ph), 0.42), y = 150 * Math.sin(ph); ring = [];
    for (let i = 0; i < NT; i++) {
      const th = i / NT * TAU, c = Math.cos(th), sn = Math.sin(th);
      let x = cx + Math.sign(c) * Math.pow(Math.abs(c), 0.4) * A * k, z = cz + Math.sign(sn) * Math.pow(Math.abs(sn), 0.4) * (sn > 0 ? Bf : Bb) * k;
      const nn = fbm3(x * 0.021, y * 0.03 + 3, z * 0.021), big = fbm3(x * 0.006 + 5, y * 0.008, z * 0.006 + 2), wk = Math.cos(ph);
      const dx = x - cx, dz = z - cz, dl = Math.hypot(dx, dz) || 1, disp = (nn - 0.42) * 38 + (big - 0.5) * 56;
      x += dx / dl * disp * wk; z += dz / dl * disp * wk;
      if (x > -18 && x < W + 18 && z > -18 && z < H + 18) { const m = [x + 18, W + 18 - x, z + 18, H + 18 - z], q = m.indexOf(Math.min(...m)); if (q === 0) x = -18; else if (q === 1) x = W + 18; else if (q === 2) z = -18; else z = H + 18; }
      ring.push([Math.atan2(z - cz, x - cx), Math.hypot(x - cx, z - cz) - 26]);
    }
    ring.sort((a, c) => a[0] - c[0]);
  } else if (st === 'tent') ring = 'circle';
  c = { key, sol, ring, W, H }; INCOL.set(b, c); return c;
}
function inSolids(b) { return inCol(b).sol; }
function inWall(b, x, y) {
  const c = inCol(b), W = c.W, H = c.H;
  if (y > H - 50 && Math.abs(x - W / 2) < 50) return null;          // kapı / mağara ağzı geçidi
  if (!c.ring) return null;
  const cx = W / 2, cz = H / 2, dx = x - cx, dz = y - cz, d = Math.hypot(dx, dz) || 1e-6;
  let lim;
  if (c.ring === 'circle') lim = 164;
  else {
    const R = c.ring, a = Math.atan2(dz, dx); let i = 0; while (i < R.length && R[i][0] < a) i++;
    const p0 = R[(i - 1 + R.length) % R.length], p1 = R[i % R.length]; let a0 = p0[0], a1 = p1[0]; if (a1 < a0) a1 += TAU; let aa = a; if (aa < a0) aa += TAU;
    lim = p0[1] + (p1[1] - p0[1]) * clamp((aa - a0) / Math.max(1e-6, a1 - a0), 0, 1);
  }
  if (d <= lim) return null;
  return { x: cx + dx / d * lim, y: cz + dz / d * lim };
}
function inDividers(gb, b, D, st, R, X, ceil) {
  const W = D.w, H = D.h, lay = inLayout(b), pts = lay.pts; X.walls.push(...lay.walls);
  for (const [x0, z0, x1, z1] of X.walls) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(len / 14));
    for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, y0 = inFloorY(x, z), fall = 1 - t * 0.55;
      if (st === 'cave') gb.dod(R() < 0.5 ? '#5e554c' : '#544c44', x + (R() - 0.5) * 4, y0 + 4, z + (R() - 0.5) * 4, 8 + R() * 4, (14 + R() * 10) * fall, 8 + R() * 4, R() * 6);
      else { if (i % 2 === 0) gb.cyl('#5a3c20', x, y0, z, 1.8, 52); }
    }
    if (st !== 'cave') { const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, ang = Math.atan2(z1 - z0, x1 - x0); for (let k = 0; k < 5; k++) gb.box(k % 2 ? '#a08050' : '#8a6a3e', mx, 8 + k * 8.5, mz, len, 7, 1.6, -ang); }
  }
  if (st === 'cave') for (const [px, pz] of pts.values()) {
    const top = ceil(px, pz), y0 = inFloorY(px, pz), hh = top - y0;
    for (let i = 0; i < 4; i++) { const t = i / 3, rr = 11 - Math.sin(t * Math.PI) * 4 + R() * 3; gb.dod(i % 2 ? '#5a5048' : '#635850', px + (R() - 0.5) * 4, y0 + hh * t, pz + (R() - 0.5) * 4, rr, hh * 0.32, rr, R() * 6); }
    // boynuzlu kafatası süsü
    if (R() < 0.6) { const sy = y0 + 58; gb.sph('#e4dcc6', px, sy, pz + 9, 4.5, 4, 5).box('#d8d0ba', px - 6, sy + 4, pz + 9, 10, 1.2, 1.2, 0, 0, 0.6).box('#d8d0ba', px + 6, sy + 4, pz + 9, 10, 1.2, 1.2, 0, 0, -0.6).box('#d8d0ba', px - 10, sy + 9, pz + 9, 1.2, 7, 1.2, 0, 0, 0.3).box('#d8d0ba', px + 10, sy + 9, pz + 9, 1.2, 7, 1.2, 0, 0, -0.3); }
  }
}
// ---- iç sahneyi kur
function inBuild(b) {
  inInit();
  if (IN.root) { IN.scene.remove(IN.root); inDispose(); }
  const D = IN.D = inDims(b), W = D.w, H = D.h, st = b.type === 'magara' ? 'cave' : b.type === 'kulube' ? 'hut' : 'tent';
  IN.kind = b.type; IN.b = b;
  const root = IN.root = new THREE.Group(); IN.scene.add(root);
  const R = mulberry32(Math.floor(b.x * 7 + b.y * 13) + (b.rooms || []).length);
  const furn = inFurn(b), main = furn.find(f => f.main), X = { flames: [], lights: [], embers: [], decals: [], walls: [], hides: [] };
  const gb = new GB();
  let shell = null, ceil = () => D.wallH;
  if (st === 'cave') {
    const hz = main ? main.y : H * 0.6;
    shell = caveShell(W, H, hz); root.add(shell);
    root.add(caveTunnel(W, H)); root.add(caveFloor(W, H, main ? main.x : W / 2, hz));
    root.updateMatrixWorld(true);
    ceil = (x, z) => { const h = inRay([shell], x, 6, z, 0, 1, 0, 400); return h ? h.point.y : 140; };
    // sarkıt ve dikitler
    for (let i = 0; i < 70; i++) {
      const x = R() * W, z = R() * H * 0.95, c = ceil(x, z), len = 8 + R() * 30;
      if (c - len < 64) continue;
      const col = R() < 0.5 ? '#6a5e54' : '#5a5048', r = 2 + R() * 3.5;
      gb.add(GEO.cone, col, x, c + 5, z, r, len + 5, r, Math.PI, R() * 6, 0);
      if (R() < 0.35) gb.add(GEO.cone, col, x + r * 1.8, c + 4, z + r, r * 0.6, len * 0.6, r * 0.6, Math.PI, 0, 0);
    }
    // duvar dibinde moloz ve dikitler
    for (let i = 0; i < 90; i++) {
      const a = i / 90 * TAU, dx = Math.cos(a), dz = Math.sin(a), h = inRay([shell], W / 2, 8, H / 2, dx, 0, dz, 900);
      if (!h || (dz > 0.5 && Math.abs(h.point.x - W / 2) < 60)) continue;
      const p = h.point, k = 6 + R() * 10, x = p.x - dx * k, z = p.z - dz * k, s = 4 + R() * 9;
      gb.dod(R() < 0.5 ? '#5a5048' : '#4e463f', x, inFloorY(x, z) + s * 0.3, z, s, s * (0.5 + R() * 0.5), s, R() * 6);
      if (R() < 0.3) gb.add(GEO.cone, '#625850', x - dx * 4, inFloorY(x, z), z - dz * 4, 3 + R() * 3, 14 + R() * 26, 3 + R() * 3, 0, R() * 6, 0);
      if (R() < 0.25 && Math.abs(dz) < 0.95) X.hides.push([p.x - dx * 3, 34 + R() * 26, p.z - dz * 3, Math.atan2(dx, dz), 22 + R() * 10]);
      if (R() < 0.12) { const bx = p.x - dx * 14, bz = p.z - dz * 14; gb.box('#e4dcc6', bx, inFloorY(bx, bz) + 1, bz, 14, 2, 2.4, a).sph('#ddd4bc', bx + 6, inFloorY(bx, bz) + 3, bz + 2, 3.6, 3, 4); }
    }
    // mağara resmi: arka duvara yaslanmış, duvar biçimine uydurulmuş ızgara
    { const pw = W * 0.8, ph = 120, nx = 24, ny = 8, pg = new THREE.PlaneGeometry(pw, ph, nx, ny), pp = pg.attributes.position;
      for (let i = 0; i < pp.count; i++) { const x = W / 2 + pp.getX(i), y = 62 + pp.getY(i), h = inRay([shell], x, y, H * 0.4, 0, 0, -1, 900); pp.setXYZ(i, x, y, h ? h.point.z + 3.2 : 0); }
      pg.computeVertexNormals();
      const m = new THREE.Mesh(pg, new THREE.MeshLambertMaterial({ map: TEX.paint, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); root.add(m);
      X.lights.push({ x: W / 2, y: 70, z: 70, col: 0xffa860, int: 1.1, dist: 300, pri: 3, fl: 1 }); }
  } else if (st === 'hut') {
    const wh = D.wallH, lg = '#6a4a2a', lg2 = '#5a3e22';
    // döşeme tahtaları
    gb.box('#1e140c', W / 2, 0, H / 2, W + 30, 1, H + 30);
    for (let z = -6; z < H + 6; z += 16) { _col.set('#8a6640').multiplyScalar(0.8 + R() * 0.35); gb.box('#' + _col.getHexString(), W / 2, 1.2, z + 7.7, W + 26, 1.8, 15.2); }
    // kütük duvarlar (kapı boşluğu ön yüzde)
    for (let y = 6; y < wh + 4; y += 11) {
      const c = y % 22 < 11 ? lg : lg2;
      gb.add(GEO.cyl, c, -10, y, H / 2, 6, H + 34, 6, Math.PI / 2, 0, 0).add(GEO.cyl, c, W + 10, y, H / 2, 6, H + 34, 6, Math.PI / 2, 0, 0).add(GEO.cyl, c, W / 2, y, -10, 6, W + 34, 6, 0, 0, Math.PI / 2);
      if (y > 66) gb.add(GEO.cyl, c, W / 2, y, H + 10, 6, W + 34, 6, 0, 0, Math.PI / 2);
      else { const sl = (W - 60) / 2 + 17; gb.add(GEO.cyl, c, -17 + sl / 2, y, H + 10, 6, sl, 6, 0, 0, Math.PI / 2).add(GEO.cyl, c, W + 17 - sl / 2, y, H + 10, 6, sl, 6, 0, 0, Math.PI / 2); }
    }
    for (const sx of [-1, 1]) gb.box('#4a3018', W / 2 + sx * 32, 34, H + 8, 6, 68, 8); gb.box('#4a3018', W / 2, 70, H + 8, 72, 6, 8);
    // çatı: iki eğik yüzey, aşıklar, mertekler, alın üçgenleri
    const rh = 70, cz = H / 2, run = cz + 14, ang = Math.atan2(rh, run), sl = Math.hypot(rh, run);
    for (const sd of [-1, 1]) {
      const mz = sd < 0 ? -14 + run / 2 : H + 14 - run / 2;
      gb.add(GEO.box, '#6e5a2e', W / 2, wh + rh / 2 + 3, mz, W + 40, 3, sl + 6, sd < 0 ? -ang : ang, 0, 0);
      for (let x = 0; x <= W; x += 46) gb.add(GEO.box, '#4a3018', x, wh + rh / 2, mz, 5, 5, sl, sd < 0 ? -ang : ang, 0, 0);
    }
    gb.box('#3a2410', W / 2, wh + rh, cz, W + 40, 7, 7);
    for (const x of [W * 0.25, W * 0.75]) gb.box('#4a3018', x, wh + 4, cz, 6, 6, H + 30);
    for (const gx of [-12, W + 12]) gb.add(GEO.prism, lg2, gx, wh + 2, cz, H + 26, rh, 10, 0, Math.PI / 2, 0);
    // pencere
    gb.box('#3a2410', W + 4, 44, H * 0.4, 4, 30, 40);
    X.windows = [[W + 1.5, 44, H * 0.4, 22, 32]];
    for (let i = 0; i < 4; i++) gb.box('#5a3e22', W - 2, 30 + i * 9, H * 0.4 - 26, 2, 8, 12);
    // asılı otlar/aletler
    for (let i = 0; i < 6; i++) { const x = 40 + R() * (W - 80); gb.cyl('#c8b080', x, wh - 12, -2, 0.3, 14); gb.add(GEO.cone, ['#4a7a34', '#7a6a3a', '#6a4a2a'][i % 3], x, wh - 11, -2, 2.6, 12, 2.6, Math.PI, 0, 0); }
    X.lights.push({ x: W / 2, y: wh + 20, z: H / 2, col: 0xffb070, int: 0.9, dist: 380, pri: 4, fl: 0 });
  } else {
    // çadır: deri duvar + konik tavan, ortada ocak
    const cx = W / 2, cz = H / 2, rw = 172;
    const wall = new THREE.CylinderGeometry(rw, rw + 4, 54, 28, 1, true, 0.42, TAU - 0.84), cone = new THREE.ConeGeometry(rw, 120, 28, 3, true, 0.42, TAU - 0.84);
    wall.translate(cx, 27, cz); cone.translate(cx, 54 + 60, cz);
    const tm = triPatch(new THREE.MeshLambertMaterial({ color: 0x9a7650, side: THREE.DoubleSide, emissive: 0x000000, flatShading: true }), 0.06, 0.5);
    IN.tentMat = tm; root.add(new THREE.Mesh(wall, tm)); root.add(new THREE.Mesh(cone, tm));
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + 0.2, px = cx + Math.cos(a) * (rw - 6), pz = cz + Math.sin(a) * (rw - 6), dx = cx - px, dz = cz - pz, hz = Math.hypot(dx, dz);
      gb.cyl('#5a3c20', px, 0, pz, 1.6, 54); gb.add(GEO.cyl, '#4a3018', px, 52, pz, 1.5, Math.hypot(hz, 124) + 8, 1.5, Math.atan2(hz, 124), Math.atan2(dx, dz), 0); }
    gb.add(GEO.disc, '#4a3a2a', cx, 0.3, cz, rw, 1, rw);
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.8; gb.sph(['#6a4a30', '#8a6a48', '#5a4232', '#a08060'][i], cx + Math.cos(a) * 95, 2.2, cz + Math.sin(a) * 75, 26, 2.6, 15); gb.add(GEO.cyl, '#c8b490', cx + Math.cos(a) * 118, 5, cz + Math.sin(a) * 92, 3, 12, 3, Math.PI / 2, a, 0); }
    if (!furn.some(f => f.k === 'hearth')) {   // ocak yoksa direğe asılı yağ kandili
      gb.cyl('#2a2018', cx, 100, cz, 0.3, 70).sph('#5a4a3a', cx, 96, cz, 3.2, 2.4, 3.2);
      X.flames.push([cx, 98, cz, 3.2]); X.lights.push({ x: cx, y: 92, z: cz, col: 0xffa860, int: 1.5, dist: 320, pri: 0, fl: 1 });
    }
    for (let i = 0; i < 3; i++) inFurniture(gb, { k: 'crate', x: cx - 70 + i * 34, y: 8, ang: 0 }, R, 'tent', X);
  }
  for (const f of furn) inFurniture(gb, f, R, st, X);
  if (st !== 'tent') inDividers(gb, b, D, st, R, X, ceil);
  // oda zeminleri: yatak odasına post, mutfağa kül, depoya saman
  for (const r of inRooms(b)) {
    const mx = r.x + r.w / 2, mz = r.y + r.h / 2;
    if (r.t === 'yatak') gb.sph('#5a4030', mx, inFloorY(mx, mz) + 0.6, mz, r.w * 0.36, 0.9, r.h * 0.3);
    if (r.t === 'depo') X.decals.push([mx, mz, Math.min(r.w, r.h) * 0.4, '#8a7a4a']);
    if (r.t === 'kasap') X.decals.push([mx, mz, Math.min(r.w, r.h) * 0.25, '#3a1010']);
  }
  const mesh = gb.mesh(); mesh.material = MAT.inV; root.add(mesh);
  // leke gölgeler: eşyaların ve insanların altında, ana ateşin ters yönüne kaymış
  { IN.mainL = X.lights.filter(l => l.fl && !l.door).sort((a, c) => c.int - a.int)[0] || { x: W / 2, z: H / 2 };
    IN.shadow = mkInst(GEO.disc, MAT.inShadow, 160); IN.shadow.renderOrder = 1; root.add(IN.shadow); IN.fsh = [];
    const SZ = { bed: [27, 15], mat: [21, 12], healbed: [27, 15], crate: [17, 16], table: [34, 21], bench: [31, 16], block: [14, 14], rack: [27, 7], herbs: [29, 9] };
    for (const f of furn) { const z = SZ[f.k]; if (z) IN.fsh.push(inShadowArgs(f.x, f.y, z[0], z[1], f.ang || 0, 16)); } }
  // lekeler
  for (const [x, z, r, c] of X.decals) { const m = new THREE.Mesh(GEO.disc, new THREE.MeshBasicMaterial({ color: c3(c), transparent: true, opacity: 0.55, depthWrite: false })); m.scale.set(r, 1, r * 0.8); m.position.set(x, inFloorY(x, z) + 0.7, z); root.add(m); }
  // asılı postlar
  for (const [x, y, z, a, s] of X.hides) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.2), MAT.hide); m.scale.set(s, s, 1); m.position.set(x, y, z); m.rotation.y = a + Math.PI; root.add(m); }
  // alevler + korlar
  IN.flames = X.flames.map(([x, y, z, s]) => mkFlame(s, root, x, y, z));
  IN.embers = X.embers.map(([x, y, z, r]) => { const m = new THREE.Mesh(GEO.disc, new THREE.MeshBasicMaterial({ map: TEX.glow, color: 0xff5a10, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.position.set(x, y + 1.2, z); m.scale.set(r * 0.9, 1, r * 0.9); root.add(m);
    const g = sprite(TEX.glow, 0xff8a30, true, false); g.position.set(x, y + 22, z); g.scale.set(r * 4, r * 4, 1); root.add(g); return { m, g, r }; });
  // kapı / pencere: dış dünyanın ışığı
  const door = furn.find(f => f.k === 'door') || { x: W / 2, y: H };
  const ov = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: TEX.outside, fog: false }));
  if (st === 'cave') { ov.scale.set(150, 120, 1); ov.position.set(W / 2, 50, H + 128); }
  else if (st === 'hut') { ov.scale.set(80, 90, 1); ov.position.set(W / 2, 40, H + 40); }
  else { ov.scale.set(110, 120, 1); ov.position.set(W / 2, 50, H / 2 + 260); }
  ov.rotation.y = Math.PI; root.add(ov); IN.out = [ov];
  for (const [x, y, z, w, h] of X.windows || []) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ov.material); m.scale.set(h, w, 1); m.position.set(x, y, z); m.rotation.y = -Math.PI / 2; root.add(m); IN.out.push(m); }
  IN.mouthGlow = sprite(TEX.glow, 0xffffff, true, false); IN.mouthGlow.position.set(door.x, 44, st === 'tent' ? H / 2 + 180 : door.y + (st === 'cave' ? 40 : 14)); IN.mouthGlow.scale.set(260, 200, 1); root.add(IN.mouthGlow);
  // gün ışığı huzmeleri (mağara ağzından içeri)
  IN.shafts = [];
  if (false) for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: TEX.shaft, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, color: 0xfff0d8 }));
    m.scale.set(st === 'cave' ? 46 : 30, st === 'cave' ? 230 : 120, 1); m.position.set(door.x - 26 + i * 26, 36, (st === 'cave' ? door.y - 50 : door.y - 30) + i * 6); m.rotation.set(-1.15, (i - 1) * 0.22, 0); root.add(m); IN.shafts.push(m); }
  X.lights.push({ x: door.x, y: 58, z: st === 'tent' ? H / 2 + 150 : door.y + (st === 'cave' ? 30 : 4), col: 0xffffff, int: 0, dist: st === 'cave' ? 420 : 300, pri: 1.5, door: 1 });
  X.lights.sort((a, c) => a.pri - c.pri); IN.lights = X.lights.slice(0, 6);
  IN.ceil = ceil;
  root.updateMatrixWorld(true);
}
function inShadowArgs(x, z, rx, rz, ry, h) {
  const l = IN.mainL || { x, z: z + 1 }, dx = x - l.x, dz = z - l.z, d = Math.hypot(dx, dz) || 1, k = Math.min(h * 0.6, 1600 / (d + 40));
  return [x + dx / d * k, inFloorY(x, z) + 0.9, z + dz / d * k, rx + k * 0.3, 1, rz, ry];
}
function inDispose() {
  if (!IN.root) return;
  for (const g of IN.ppl.values()) { IN.root.remove(g); if (typeof M3 !== 'undefined' && M3.dispose) M3.dispose(g); }
  IN.ppl.clear();
  IN.root.traverse(m => { if (m.userData && m.userData.m3) return; if (m.geometry && !Object.values(GEO).includes(m.geometry)) m.geometry.dispose(); if (m.material && !Object.values(MAT).includes(m.material) && m.material !== MAT.fl0) { if (m.material.map && !Object.values(TEX).includes(m.material.map)) m.material.map.dispose(); m.material.dispose(); } });
  IN.root = null;
}
function interiorExit() {
  if (IN.root) { IN.scene.remove(IN.root); inDispose(); }
  IN.b = null; IN.key = '';
  if (U3.cam.parent !== U3.scene) U3.scene.add(U3.cam);
  U3.gY = undefined;
}
function render3DInterior(dt, t, yaw, pitch, bobY, sh) {
  const I = G.inside, b = I.b, cam = U3.cam;
  const key = b.type + '|' + (b.rooms || []).join() + '|' + Math.round(b.x) + ',' + Math.round(b.y);
  if (IN.b !== b || IN.key !== key) { if (IN.root) { IN.scene.remove(IN.root); inDispose(); } inBuild(b); IN.key = key; }
  if (cam.parent !== IN.scene) IN.scene.add(cam);
  const D = IN.D;
  cam.position.set(I.x + (Math.random() - 0.5) * sh * 0.3, inFloorY(I.x, I.y) + U3.eye + bobY, I.y + (Math.random() - 0.5) * sh * 0.3);
  cam.rotation.set(clamp(pitch, -1.45, 1.45), -yaw - Math.PI / 2, Math.sin(U3.bob * 0.5) * 0.006 * (U3.vmSway || 0));
  const fov = U3.baseFov / (1 + (G.scare || 0) * 0.14);
  if (cam.fov !== fov || cam.aspect !== U3.camA) { cam.fov = fov; U3.camA = cam.aspect; cam.updateProjectionMatrix(); }
  cam.updateMatrixWorld();
  // dış ışık: gündüz parlak, gece lacivert
  const dk = U3.dk = darkness(), day = 1 - clamp(dk / 0.95, 0, 1), ph = phase();
  let warm = 0; if (ph > 0.38 && ph < 0.6) warm = clamp((ph - 0.38) / 0.1, 0, 1) * day;
  _col.setRGB(0.14, 0.2, 0.42).lerp(c3(0xfff6e6), day).lerp(c3(0xffa860), warm * 0.5);
  for (const o of IN.out) o.material.color.copy(_col);
  IN.mouthGlow.material.color.copy(_col); IN.mouthGlow.material.opacity = 0.18 + day * 0.4;
  for (const m of IN.shafts) m.material.opacity = 0.05 + day * 0.13 + Math.sin(t * 0.7 + m.position.x) * 0.02 * day;
  if (IN.tentMat) IN.tentMat.emissive.setRGB(0.3 * day, 0.2 * day, 0.1 * day);
  IN.scene.fog.color.setRGB(0.04 + 0.04 * day, 0.03 + 0.03 * day, 0.025 + 0.03 * day);
  IN.hemi.intensity = 0.06 + day * 0.07;
  // ışıklar: ocak ve meşaleler titrer
  for (let i = 0; i < 6; i++) {
    const l = IN.lights[i], pl = IN.pl[i];
    if (!l) { pl.intensity = 0; continue; }
    if (l.door) { pl.color.copy(_col); pl.intensity = 0.25 + day * 1.4; }
    else { pl.color.setHex(l.col); const f = l.fl ? 0.86 + Math.sin(t * 9.3 + i * 2) * 0.07 + Math.sin(t * 23.1 + i) * 0.05 + Math.sin(t * 3.7 + i * 5) * 0.05 : 1; pl.intensity = l.int * f; }
    pl.distance = l.dist; pl.position.set(l.x + (l.fl ? Math.sin(t * 7 + i) * 1.5 : 0), l.y + (l.fl ? Math.sin(t * 11 + i) * 1.2 : 0), l.z);
  }
  for (const e of IN.embers) { e.m.material.opacity = 0.6 + 0.3 * Math.sin(t * 3.1 + e.r) * Math.sin(t * 1.7); const s = e.r * 4 * (1 + Math.sin(t * 11 + e.r) * 0.05); e.g.scale.set(s, s, 1); e.g.material.opacity = 0.4; }
  // toz zerreleri
  { const pa = IN.dust.geometry.attributes.position; const W = D.w, H = D.h;
    IN.dustSeed.forEach((q, i) => { pa.setXYZ(i, ((q[0] * W + Math.sin(t * 0.07 + q[3]) * 40) % W + W) % W, 8 + ((q[1] * 110 + t * (2 + q[2] * 3)) % 110), ((q[2] * H + Math.cos(t * 0.05 + q[3]) * 40) % H + H) % H); });
    pa.needsUpdate = true; IN.dust.material.opacity = 0.35 + day * 0.25; }
  // insanlar
  const list = typeof inPeople === 'function' ? inPeople(b) : [], seen = new Set();
  for (const q of list) {
    if (!q.p || q.p === L) continue;
    let g = IN.ppl.get(q.p);
    if (!g) { g = M3.person(q.p); g.userData.m3 = true; IN.root.add(g); IN.ppl.set(q.p, g); }
    seen.add(q.p);
    g.userData.pose = q.pose;
    M3.updPerson(g, q.p, t);
    g.position.set(q.x, inFloorY(q.x, q.y) + (q.pose === 'sleep' ? 2.5 : 0), q.y); g.rotation.y = -q.ang;
  }
  for (const [p, g] of IN.ppl) if (!seen.has(p)) { IN.root.remove(g); if (M3.dispose) M3.dispose(g); IN.ppl.delete(p); }
  if (IN.shadow) {
    const m = IN.shadow; m.count = 0; for (const a of IN.fsh) instAdd(m, ...a);
    for (const q of list) { if (!q.p || q.p === L) continue; const sl = q.pose === 'sleep'; instAdd(m, ...inShadowArgs(q.x, q.y, sl ? 17 : 8.5, sl ? 9 : 7.5, -q.ang, sl ? 4 : 30)); }
    instDone(m); MAT.inShadow.opacity = 0.5 - 0.15 * (1 - dk);
  }
  updFlames(t); updViewModel(dt, t);
  U3.r.setClearColor(0x000000, 1);
  U3.r.render(IN.scene, cam);
  return true;
}
