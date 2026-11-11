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
  MAT.crystal = L_({ flatShading: true, emissive: 0x2a6f9a });
  MAT.rock = triPatch(L_({ flatShading: true }), 0.031, 0.5);
  MAT.rockV = triPatch(L_({ vertexColors: true, flatShading: true }), 0.045, 0.45);
  MAT.ground = L_({ map: TEX.ground, vertexColors: true });
  MAT.water = L_({ color: 0x2a6a88, emissive: 0x06141c, transparent: true, opacity: 0.9 });
  MAT.sand = L_({ color: 0x968258 });
  MAT.swamp = L_({ color: 0x2f3a22, emissive: 0x040603 });
  MAT.shadow = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false });
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
  TEX.noise.wrapS = TEX.noise.wrapT = THREE.RepeatWrapping;
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
  initGeo(); initMat();
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
  U3.entShadow = mkInst(GEO.disc, MAT.shadow, 160); dyn.add(U3.entShadow);
  U3.stainI = mkInst(GEO.disc, MAT.blood, 40); dyn.add(U3.stainI);
  U3.trackI = mkInst(GEO.disc, MAT.track, 60); dyn.add(U3.trackI);
  U3.arrowI = mkInst(GEO.cyl, new THREE.MeshLambertMaterial({ color: 0x6a4a26, emissive: 0x1a1208 }), 24); dyn.add(U3.arrowI);
  U3.spitI = mkInst(GEO.ico, new THREE.MeshBasicMaterial({ color: 0xb8e04a }), 24); dyn.add(U3.spitI);
  { const n = 500, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    U3.parts = new THREE.Points(g, new THREE.PointsMaterial({ size: 3.2, vertexColors: true, sizeAttenuation: true, transparent: true, depthWrite: false })); U3.parts.frustumCulled = false; U3.partN = n; dyn.add(U3.parts); }
  { const n = 36, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), R = mulberry32(5); U3.flySeed = [];
    for (let i = 0; i < n; i++) U3.flySeed.push([R() * 700 - 350, 6 + R() * 50, R() * 700 - 350, R() * 9]);
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    U3.flies = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xd2ff78, size: 2.4, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); U3.flies.frustumCulled = false; dyn.add(U3.flies); }
  U3.eyes = []; for (let i = 0; i < 40; i++) { const s = sprite(TEX.glow, 0xffffff, true, false); s.visible = false; dyn.add(s); U3.eyes.push(s); }
  U3.smoke = []; for (let i = 0; i < 6; i++) { const s = sprite(TEX.soft, 0x8a8782, false, true); s.visible = false; dyn.add(s); U3.smoke.push(s); }
  U3.ghost = new THREE.Group(); U3.ghostMat = new THREE.MeshBasicMaterial({ color: 0x77cc66, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
  { const d = new THREE.Mesh(GEO.disc, U3.ghostMat); d.position.y = 0.9; U3.ghost.add(d); const w = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), U3.ghostMat); w.position.y = 0.5; U3.ghost.add(w); }
  U3.ghost.visible = false; dyn.add(U3.ghost);
  U3.huntRing = new THREE.Mesh(GEO.ring, new THREE.MeshBasicMaterial({ color: 0xff5028, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, fog: false })); U3.huntRing.visible = false; dyn.add(U3.huntRing);
  U3.lookRing = new THREE.Group(); { const r1 = new THREE.Mesh(GEO.ring, MAT.ring); U3.lookRing.add(r1); const ar = new THREE.Mesh(GEO.cone4, MAT.ring); ar.rotation.x = Math.PI; ar.scale.set(2.6, 5, 2.6); ar.position.y = 52; U3.lookRing.add(ar); } U3.lookRing.visible = false; dyn.add(U3.lookRing);
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

// ---- birinci şahıs: mızrak ve meşale
function buildViewModel() {
  const vm = U3.vm = new THREE.Group(); U3.cam.add(vm);
  const M = (c, e) => new THREE.MeshLambertMaterial({ color: c, emissive: e || 0x000000, flatShading: true, transparent: true, depthTest: false, depthWrite: false, fog: false });
  const part = (geo, mat, order, parent, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.renderOrder = 1000 + order; m.frustumCulled = false; parent.add(m); return m; };
  const wood = M(0x7a5a34, 0x0c0906), skin = M(0xc99068, 0x140e0a), stone = M(0xb8b4a8, 0x101010), hide = M(0x6a2412, 0x0a0402);
  // sağ el + mızrak (mızrak yerel +Y ekseni boyunca; grup öne doğru yatırılır)
  const sp = U3.spear = new THREE.Group(); vm.add(sp);
  part(GEO.cyl, hide, 0, sp, 0.9, -17, -0.6, 1.25, 13, 1.25);
  part(GEO.cyl, wood, 1, sp, 0, -16, 0, 0.3, 36, 0.3);
  part(GEO.cyl, hide, 2, sp, 0, 18.6, 0, 0.44, 1.6, 0.44);
  part(GEO.cone, stone, 3, sp, 0, 20, 0, 0.8, 4.6, 0.42);
  part(GEO.ico, skin, 4, sp, 0.1, -4.4, 0.1, 0.95, 1.25, 1.0);
  // sol el + meşale
  const tc = U3.torch = new THREE.Group(); vm.add(tc);
  part(GEO.cyl, skin, 5, tc, -0.7, -14, 0.4, 1.2, 11, 1.2);
  part(GEO.cyl, wood, 6, tc, 0, -6, 0, 0.42, 12, 0.42);
  part(GEO.cyl, M(0x2a1a0c, 0x1a0c04), 7, tc, 0, 5, 0, 0.75, 2.4, 0.75);
  part(GEO.ico, skin, 8, tc, 0, -3.2, 0.2, 0.95, 1.25, 1.0);
  const fm = [0xff5a14, 0xffa028, 0xffe890].map(c => new THREE.MeshBasicMaterial({ color: c, transparent: true, depthTest: false, depthWrite: false, fog: false }));
  U3.torchFl = fm.map((m, i) => part(GEO.cone4, m, 9 + i, tc, 0, 6.6, 0, 1.15 - i * 0.34, 5 - i * 1.3, 1.15 - i * 0.34));
}
function updViewModel(dt, t) {
  const vm = U3.vm, mv = L.moving ? 1 : 0;
  U3.vmSway = (U3.vmSway || 0) + (mv - (U3.vmSway || 0)) * Math.min(1, dt * 8);
  const sw = U3.vmSway, bx = Math.sin(U3.bob * 0.5) * 0.5 * sw, by = Math.abs(Math.cos(U3.bob * 0.5)) * 0.45 * sw + Math.sin(t * 1.6) * 0.08;
  const k = clamp((L.swing || 0) / 0.2, 0, 1), th = Math.sin(k * Math.PI);
  const narrow = U3.cam.aspect < 1 ? 0.62 : 1;
  vm.visible = !(L.hp <= 0) && !G.sleep;
  const sp = U3.spear;
  sp.position.set(7.6 * narrow + bx - th * 2.4, -7.2 - by + th * 1.6, -11 - th * 10);
  sp.rotation.set(-1.47 + th * 0.07, 0.05 + th * 0.06, 0.05, 'YXZ');
  const tc = U3.torch;
  tc.visible = !!G.torchOn;
  if (tc.visible) {
    tc.position.set(-7.4 * narrow - bx, -6.2 - by * 0.8, -11.5); tc.rotation.set(-0.3, 0, 0.2);
    U3.torchFl.forEach((m, i) => { const f = 1 + Math.sin(t * (11 + i * 3) + i) * 0.2 + Math.sin(t * 27 + i * 2) * 0.08; m.scale.y = (5 - i * 1.3) * f; m.position.x = Math.sin(t * 8 + i) * 0.25; m.rotation.y = t * 2; });
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
  if (!TC) TC = { b: BIOME_COL.map(c => new THREE.Color(c)), rock: new THREE.Color('#6b655c'), rock2: new THREE.Color('#57524b'), snow: new THREE.Color('#e9eef3'), sand: new THREE.Color('#cdbb8c'), wet: new THREE.Color('#8f8058'), deep: new THREE.Color('#1f4250'), dirt: new THREE.Color('#6e5638'), litter: new THREE.Color('#5a4a2c'), t: new THREE.Color() };
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
  if (h < 8) { const s = smooth(8, 1.2, h + (n2 - 0.5) * 3); out.lerp(TC.sand, s * 0.92); gr *= 1 - s; }
  if (h < SEA_Y + 0.6) { out.lerp(TC.wet, smooth(SEA_Y + 0.6, -3, h)); out.lerp(TC.deep, smooth(-2, -45, h)); gr = 0; }
  const dc = Math.hypot(x - CAMP.x, z - CAMP.y); if (dc < 320) { out.lerp(TC.dirt, smooth(320, 60, dc) * (0.75 + n2 * 0.2)); gr *= 0.4 + 0.6 * smooth(60, 320, dc); }
  if (G.lakes) for (const l of G.lakes) { const dl = Math.hypot(x - l.x, z - l.y); if (dl < l.r + 70) { const s = smooth(l.r + 70, l.r, dl) * 0.75; out.lerp(TC.wet, s); gr *= 1 - s; } }
  return gr;
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
    col[v * 3] = _col.r * n; col[v * 3 + 1] = _col.g * n; col[v * 3 + 2] = _col.b * n; grs[v] = g;
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
  return { m, used: 0 };
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
    sh.vertexShader = 'attribute float aG;\nvarying float vG;\nvarying vec3 vWP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvG = aG; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying float vG;\nvarying vec3 vWP;\nuniform sampler2D tGround;\nuniform sampler2D tNoise;\nuniform float uTime;\nuniform float uFogCap;\nuniform float uFogLift;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        float g1 = texture2D(tGround, vWP.xz / 150.0).r;
        float g2 = texture2D(tNoise, vWP.xz / 64.0).r;
        float g3 = texture2D(tNoise, vWP.xz / 1100.0 + 0.37).r;
        float g4 = texture2D(tNoise, vWP.xz / 13.0).r;
        float det = mix(1.0 + (g2 - 0.69) * 1.5 + (g4 - 0.69) * 0.6, 0.5 + g1 * 0.62, vG);
        diffuseColor.rgb *= det * (1.0 + (g3 - 0.69) * 1.1);
        float shr = smoothstep(-2.4, -0.3, vWP.y) * (1.0 - smoothstep(0.2, 2.2, vWP.y));
        float fw = 0.5 + 0.5 * sin(uTime * 1.3 + (vWP.x * 0.7 + vWP.z) * 0.03 + g2 * 7.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.96, 0.96), shr * smoothstep(0.45, 0.92, fw) * 0.85);`)
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
const GR = { T: 80, R: 4, nB: 30, nF: 10, nE: 3, slots: new Map(), free: [], cx: 1e9, cz: 1e9 };
function initGrass() {
  // ot öbeği: dışa eğik 5 yaprak, dipte koyu
  { const p = [], c = [];
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.4, ca = Math.cos(a), sa = Math.sin(a), w = 0.09, lx = -sa * w, lz = ca * w, tl = 0.85 + (i % 3) * 0.15;
      p.push(ca * 0.08 + lx, 0, sa * 0.08 + lz, ca * 0.08 - lx, 0, sa * 0.08 - lz, ca * 0.42, tl, sa * 0.42); c.push(0.42, 0.45, 0.4, 0.42, 0.45, 0.4, 1.1, 1.1, 1.0); }
    const g = GEO.blade = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(p.length).fill(0).map((_, i) => i % 3 === 1 ? 1 : 0), 3)); }
  const sway = m => { m.onBeforeCompile = sh => { sh.uniforms.uTime = U3.uTime; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      { vec3 ip = instanceMatrix[3].xyz; float ph = uTime * 1.6 + ip.x * 0.045 + ip.z * 0.03; transformed.x += (sin(ph) * 0.12 + sin(ph * 2.3 + ip.z) * 0.05) * position.y; transformed.z += cos(ph * 0.8 + ip.x * 0.1) * 0.07 * position.y; }
      #endif`); }; return m; };
  MAT.grass = sway(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  MAT.grassF = sway(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }));
  const n = (2 * GR.R + 1) ** 2;
  U3.grB = mkInst(GEO.blade, MAT.grass, n * GR.nB); U3.grF = mkInst(GEO.ico, MAT.grassF, n * GR.nF); U3.grE = mkInst(GEO.fern, MAT.grassF, n * GR.nE);
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
    const pal = GR_COL[b] || GR_COL[0], meadow = b === 4, s = (meadow ? 9 : b === 2 ? 8 : b === 5 ? 7 : 5.5) * (0.65 + r2 * 0.7);
    B.setMatrixAt(ib, mat4(x, h - 0.5, z, s * 1.1, s * (meadow ? 1.5 : 1.1), s * 1.1, 0, r3 * TAU, 0)); B.setColorAt(ib, _col.set(pal[Math.floor(r3 * pal.length)]).multiplyScalar(0.85 + r2 * 0.3)); ib++;
    if (ifl < eF && (meadow ? R() < 0.42 : b === 0 ? R() < 0.06 : b === 3 ? R() < 0.04 : false)) {
      const fc = meadow ? FL_COL[Math.floor(R() * FL_COL.length)] : '#eeeadf', fs = 1.1 + R() * 0.8;
      F.setMatrixAt(ifl, mat4(x + 1, h + s * (meadow ? 1.2 : 0.9), z, fs, fs * 0.7, fs, 0, r1 * 9, 0)); F.setColorAt(ifl, _col.set(fc)); ifl++;
    }
    if (ie < eE && (b === 0 || b === 2) && R() < 0.12) {
      const fs = 10 + R() * 8; E.setMatrixAt(ie, mat4(x, h - 0.5, z, fs, fs * 0.9, fs, 0, r2 * 9, 0)); E.setColorAt(ie, _col.set(b === 2 ? '#4a5a2a' : '#3c6e2c').multiplyScalar(0.8 + r3 * 0.4)); ie++;
    }
  }
  for (; ib < eB; ib++) B.setMatrixAt(ib, _zeroM);
  for (; ifl < eF; ifl++) F.setMatrixAt(ifl, _zeroM);
  for (; ie < eE; ie++) E.setMatrixAt(ie, _zeroM);
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
    const [i, j] = k.split(',').map(Number), s = GR.free.pop(); GR.slots.set(k, s); grassFill(i, j, s); done++;
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
  terReset(); TER.group = new THREE.Group(); W.add(TER.group);
  U3.sea = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), MAT.sea); U3.sea.rotation.x = -Math.PI / 2; U3.sea.scale.set(30000, 30000, 1); U3.sea.renderOrder = 2; W.add(U3.sea);
  // göller ve bataklık havuzları: kıyı yüksekliklerinin en düşüğüne oturan düz su
  const waterY = (o, r) => { let m = 1e9; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; m = Math.min(m, gh(o.x + Math.cos(a) * r, o.y + Math.sin(a) * r)); } return Math.max(m, gh(o.x, o.y)) + 0.8; };
  for (const l of G.lakes) { const m = new THREE.Mesh(GEO.disc, MAT.water); m.scale.set(l.r + 6, 1, l.r + 6); m.position.set(l.x, l.h !== undefined ? l.h : waterY(l, l.r), l.y); W.add(m); }
  for (const p of G.pools) { const m = new THREE.Mesh(GEO.disc, MAT.swamp); m.scale.set(p.r + 4, 1, p.r + 4); m.position.set(p.x, p.h !== undefined ? p.h : waterY(p, p.r) - 0.3, p.y); W.add(m); }
  U3.grassN = -1; GR.cx = 1e9; GR.slots.clear(); GR.free = []; for (let i = 0; i < (2 * GR.R + 1) ** 2; i++) GR.free.push(i);
  for (const m of [U3.grB, U3.grF, U3.grE]) { for (let i = 0; i < m.count; i++) m.setMatrixAt(i, _zeroM); instDone(m); }
  // örnekli ağlar
  const I = U3.inst = {};
  const nT = G.trees.length + G.deco.length;
  I.trunk = mkInst(GEO.trunk, MAT.inst, nT * 4 + 8); I.cone = mkInst(GEO.cone, MAT.inst, G.trees.length * 3 + 8); I.blob = mkInst(GEO.ico1, MAT.inst, G.trees.length * 3 + 8);
  I.moss = mkInst(GEO.cone4, MAT.instD, G.trees.length * 3 + 8); I.frond = mkInst(GEO.frond, MAT.instD, G.trees.length * 2 + 8);
  I.tshadow = mkInst(GEO.disc, MAT.shadow, G.trees.length + 8);
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
const TREE_C = {};
function treeCols(b, tone) {
  const key = b + '_' + Math.floor(tone * 6);
  let o = TREE_C[key]; if (o) return o;
  const pals = TREE_PAL[b] || TREE_PAL[0], pal = pals[Math.floor(tone * pals.length) % pals.length], v = 0.9 + (Math.floor(tone * 6) % 3) * 0.1;
  o = TREE_C[key] = { a: new THREE.Color(pal[1]).multiplyScalar(v * 1.15), b: new THREE.Color(pal[2]).multiplyScalar(v), c: new THREE.Color(pal[3] || pal[2]).multiplyScalar(v * 0.95), t: new THREE.Color(b === 3 ? '#4a443e' : b === 2 ? '#4a3a26' : b === 5 ? '#7a6448' : '#5a3d26').multiplyScalar(0.85 + (Math.floor(tone * 6) % 2) * 0.2) };
  return o;
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
  U3.instX = cx; U3.instY = cy;
  const near = (o, R) => { const dx = o.x - cx, dy = o.y - cy; return dx * dx + dy * dy < R * R; };
  const stumpC = c3('#8a6a44'), col = _col, snowC = c3('#e8eef2'), mossC = c3('#7d8c5a'), deadC = c3('#4e4740');
  for (const t of G.trees) {
    if (!near(t, TREE_R)) continue;
    const y0 = gh(t.x, t.y) - 1.5;
    if (t.stump) { instAdd(I.trunk, t.x, y0, t.y, 9, 8.5, 9, t.sw, stumpC); continue; }
    const b = t.b === undefined ? bioAt(t.x, t.y) : t.b, C = treeCols(b, t.tone), k = (t.cr - 36) / 26, H = (125 + k * 120 + ((t.tone * 37) % 1) * 30) * (t.dark ? 1.35 : 1), cr = t.cr, r2 = (t.tone * 13) % 1;
    instAdd(I.tshadow, t.x, y0 + 1.9, t.y, cr * 0.95, 1, cr * 0.95, 0);
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
      const thin = b === 3 ? 0.7 : b === 1 ? 0.82 : 1, base = Math.max(40, H * 0.22), sn = y0 > 400 ? clamp((y0 - 400) / 120, 0, 0.7) : 0;
      instAdd(I.trunk, t.x, y0, t.y, 8, H * 0.8, 8, t.sw, C.t);
      const cs = [C.a, C.b, C.c];
      for (let i = 0; i < 3; i++) { const yy = base + i * (H - base) * 0.27, rr = cr * (0.86 - i * 0.2) * thin, hh = (H - base) * (0.52 - i * 0.07); col.copy(cs[i]); if (sn) col.lerp(snowC, sn * (0.5 + i * 0.2)); instAdd(I.cone, t.x, y0 + yy, t.y, rr, hh, rr, t.sw + i * 0.7, col); }
    } else {                                             // geniş yapraklı (çayırda tek, iri)
      const lone = b === 4, th = H * (lone ? 0.5 : 0.62), cw = lone ? 1.45 : 1.05, tw = lone ? 12 : 9.5;
      instAdd(I.trunk, t.x, y0, t.y, tw, th, tw, t.sw, C.t, Math.sin(t.sw) * 0.04, Math.cos(t.sw) * 0.04);
      if (lone) for (let i = 0; i < 3; i++) { const a = t.sw + i * 2.1; instAdd(I.trunk, t.x, y0 + th * 0.7, t.y, 4, cr * 0.7, 4, a, C.t, 0, 0.9); }
      instAdd(I.blob, t.x, y0 + th + cr * 0.25, t.y, cr * 1.05 * cw, H * (lone ? 0.22 : 0.27), cr * 1.05 * cw, t.sw, C.a);
      instAdd(I.blob, t.x + Math.cos(t.sw) * cr * 0.45 * cw, y0 + th + H * 0.18, t.y + Math.sin(t.sw) * cr * 0.45 * cw, cr * 0.72 * cw, H * 0.2, cr * 0.72 * cw, t.sw * 2, C.b);
      instAdd(I.blob, t.x - Math.cos(t.sw + 0.8) * cr * 0.5 * cw, y0 + th + H * 0.08, t.y - Math.sin(t.sw + 0.8) * cr * 0.5 * cw, cr * 0.62 * cw, H * 0.17, cr * 0.62 * cw, t.sw * 3, C.c);
    }
  }
  for (const r of G.rocks) {
    if (r.dead || !near(r, ROCK_R)) continue;
    const g = (112 * r.shade) / 255, b = bioAt(r.x, r.y), mtn = b === 1, h = hash2(r.x, r.y), y0 = gh(r.x, r.y);
    col.setRGB(g + 0.05, g + 0.03, g); if (b === 5) col.lerp(c3('#b0a080'), 0.4); else if (!mtn && h > 0.5) col.lerp(c3('#5a7a3a'), 0.25);
    instAdd(I.rock, r.x, y0 + r.r * 0.15, r.y, r.r * 1.15, r.r * (mtn ? 1.3 + h * 1.4 : 0.75 + h * 0.5), r.r * 1.1, h * 6, col, h * 0.4, 0);
    if (h > 0.55) instAdd(I.rock, r.x + r.r * 0.9, y0, r.y - r.r * 0.4, r.r * 0.45, r.r * 0.35, r.r * 0.5, h * 9, col);
  }
  for (const b of G.bushes) {
    if (!near(b, BUSH_R)) continue;
    const h = hash2(b.x, b.y), y0 = gh(b.x, b.y);
    col.set('#2f5a24').multiplyScalar(0.85 + h * 0.4);
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
  for (let i = 0; i < nr; i++) { const t = (i + 1) / 14, x = -L / 2 + t * L, w = wf(t); for (const sd of [-1, 1]) for (let j = 0; j < 4; j++) { const a0 = j / 4, a1 = (j + 1) / 4, z0 = sd * w * Math.sin(a0 * Math.PI / 2), z1 = sd * w * Math.sin(a1 * Math.PI / 2), yy0 = y0 + H * (1 - Math.cos(a0 * Math.PI / 2)) * 0.9, yy1 = y0 + H * (1 - Math.cos(a1 * Math.PI / 2)) * 0.9; const mz = (z0 + z1) / 2, my = (yy0 + yy1) / 2, len = Math.hypot(z1 - z0, yy1 - yy0); gb.add(GEO.box, '#7a5632', x, my, mz, 3, len + 1.5, 3, -Math.atan2(z1 - z0, yy1 - yy0) * 1, 0, 0); } }
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
  if (ghost) { for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; gb.cyl('#b89a6a', Math.cos(a) * r, 0, Math.sin(a) * r, 1.2, 26, Math.sin(a) * 0.25, -Math.cos(a) * 0.25); } gb.add(GEO.ring, '#bfdcff', 0, 0.8, 0, r + 4, 1, r + 4); }
  const m = gb.mesh(ghost, T === 'tarla' || T === 'tuzak'); g.add(m);
  if (T === 'cadir' || T === 'cit' || T === 'duvar') g.rotation.y = -(b.ang || 0);
  return g;
}
// yapı tabanı: ayak izi içindeki en alçak noktaya otur (yamaçta havada kalmasın)
function buildY(b) { const r = Math.min(b.r || 20, 60) * 0.6, fl = (BUILD[b.type] || {}).flat; let m = gh(b.x, b.y); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, h = gh(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r); m = fl ? Math.max(m, h) : Math.min(m, h); } return b.type === 'gemi' ? Math.max(m, SEA_Y) : m; }
const buildSig = b => (b.built ? 1 : 0) + (b.type === 'tarla' ? '_' + (b.planted ? 1 + Math.min(4, Math.floor(b.g * 4)) : 0) : '') + (b.type === 'gemi' && !b.built ? '_' + Math.floor(clamp((b.prog || 0) / (b.need || 1), 0, 1) * 12) : '');
function syncBuilds(dk) {
  const M = U3.builds, f = U3.frame;
  for (const b of G.builds) {
    if (b.dead) continue;
    let e = M.get(b); const sig = buildSig(b);
    if (!e || e.sig !== sig) { if (e) { U3.scene.remove(e.g); disposeTree(e.g, true); } e = { g: buildMesh(b), sig }; e.g.position.set(b.x, buildY(b), b.y); U3.scene.add(e.g); M.set(b, e); }
    e.f = f;
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
    e.f = f;
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
function syncEnts(t, dk) {
  const M = U3.ents, f = U3.frame, sh = U3.entShadow; sh.count = 0;
  const shA = 1 - dk * 0.8;
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
  const guard = U3.dk > 0.3 && typeof doorGuard === 'function' ? doorGuard() : null;
  for (const p of G.people) {
    const show = p !== L && !p.inHut && !p.insideB && !p.dead && nearCam(p);
    const e = put(p, 'p', () => M3.person(p), show); if (!e) continue;
    const tw = towerOf && towerOf.get(p), y0 = tw ? buildY(tw) + 62.5 : ghE(p.x, p.y);
    e.g.position.set(p.x, y0, p.y); e.g.rotation.y = -p.ang;
    if (p === guard && !p.torch) { const v = e.gv || (e.gv = {}); for (const k in v) delete v[k]; Object.assign(v, p); v.torch = true; M3.updPerson(e.g, v, t); }
    else M3.updPerson(e.g, p, t);
    if (!tw) instAdd(sh, p.x, y0 + 0.5, p.y, p.child ? 7 : 10, 1, p.child ? 7 : 10, 0);
  }
  for (const d of G.dinos) {
    if (d.dead) continue;
    const dd = Math.hypot(d.x - L.x, d.y - L.y);
    const vis = !d.hidden && nearCam(d) && (d.tamed || dd < 260 + d.r || visible(d.x, d.y, d.r + 160 * (1 - dk)));
    const y0 = ghE(d.x, d.y);
    if (d.type === 'yamyam') {
      const e = put(d, 'c', () => { const v = cannibalView(d); const g = M3.person(v); g.userData.view = v; return g; }, vis); if (!e) continue;
      const v = Object.assign(e.g.userData.view, cannibalView(d));
      e.g.position.set(d.x, y0, d.y); e.g.rotation.y = -d.ang; M3.updPerson(e.g, v, t);
      instAdd(sh, d.x, y0 + 0.5, d.y, 10, 1, 10, 0);
    } else if (d.type === 'taklitci' && !d.revealed) {
      const e = put(d, 'm', () => { const v = mimicView(d); const g = M3.person(v); g.userData.view = v; return g; }, vis); if (!e) continue;
      const v = mimicView(d, e.g.userData.view);
      e.g.position.set(d.x, y0, d.y); e.g.rotation.y = -v.ang; M3.updPerson(e.g, v, t);
      instAdd(sh, d.x, y0 + 0.5, d.y, 10, 1, 10, 0);
    } else {
      const e = put(d, 'd', () => M3.dino(d), vis); if (!e) continue;
      e.g.position.set(d.x, y0 + (d.fly ? (d.alt || 0) * 85 : 0), d.y); e.g.rotation.y = -d.ang;
      M3.updDino(e.g, d, t);
      instAdd(sh, d.x, y0 + 0.5, d.y, d.r * (d.fly ? 0.9 : 1.2), 1, d.r * (d.fly ? 0.9 : 0.9), -d.ang);
    }
  }
  if (G.rescue) {
    const q = G.rescue, e = put(q, 'p', () => M3.person(q), visible(q.x, q.y, 120));
    if (e) { e.g.position.set(q.x, ghE(q.x, q.y), q.y); e.g.rotation.y = -(q.ang || 0); M3.updPerson(e.g, q, t); }
  }
  for (const [k, e] of M) if (e.f !== f) { dropEnt(e); M.delete(k); }
  MAT.shadow.opacity = 0.26 * shA;
  instDone(sh);
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
  for (const q of G.parts) {
    if (n >= U3.partN) break;
    if (q._y0 === undefined) { q._y0 = q.y; q._up = q.vy < -24 && Math.abs(q.vx) < 46; q._h = 6 + Math.random() * 16; q._g = ghE(q.x, q.y); }
    const c = c3(q.col), a = clamp(q.life * 1.5, 0, 1);
    if (q._up) pa.setXYZ(n, q.x, q._g + 6 + (q._y0 - q.y) * 0.8, q._y0); else pa.setXYZ(n, q.x, q._g + 2 + q._h * clamp(q.life, 0, 1), q.y);
    ca.setXYZ(n, c.r * a, c.g * a, c.b * a); n++;
  }
  P.geometry.setDrawRange(0, n); pa.needsUpdate = true; ca.needsUpdate = true;
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
  U3.mist = []; for (let i = 0; i < 12; i++) { const s = sprite(TEX.soft, 0xffffff, false, true); s.visible = false; U3.scene.add(s); U3.mist.push(s); }
  U3.clouds = []; const C = mulberry32(57);
  for (let i = 0; i < 11; i++) { const s = sprite(TEX.cloud, 0xffffff, false, false); s.renderOrder = -7; s.userData = { a: C() * TAU, d: 3000 + C() * 2200, h: 900 + C() * 900, w: 1400 + C() * 1600, sp: 0.5 + C() }; U3.scene.add(s); U3.clouds.push(s); }
}
function updWeather3D(dt, t, dk) {
  const w = G.weather.type, cp = U3.cam.position, wet = w === 'yagmur' || w === 'firtina', st = w === 'firtina';
  U3.rainK = (U3.rainK || 0) + ((wet && !G.inside ? 1 : 0) - (U3.rainK || 0)) * Math.min(1, dt * 1.5);
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
    if (wet || w === 'sis') s.material.color.multiplyScalar(0.72);
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
  const tk = (w === 'sis' ? 0.4 : w === 'firtina' ? 0.6 : w === 'yagmur' ? 0.72 : 1) * (bm === 3 ? 0.42 : bm === 2 ? 0.8 : 1);
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
  _v.set(sx, sy, 0.38).normalize();
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
  U3.uTime.value = t;
  // yeni oyun / yükleme: dünya dizileri değişti
  if (U3.worldKey !== G.trees || U3.worldSeed !== G.seed || U3.worldFire !== G.fire) { U3.worldKey = G.trees; U3.worldSeed = G.seed; U3.worldFire = G.fire; buildWorld(); }
  // ---- kamera (göz yüksekliği: arazi + duruş)
  if (L.moving && !G.sleep) U3.bob += dt * (L.sprinting ? 15 : L.sneak ? 7 : 10.5);
  const eyeT = G.mount ? EYE + G.mount.r * 1.75 : L.hp <= 0 ? 7 : L.sneak ? EYE_SNEAK : EYE;
  U3.eye += (eyeT - U3.eye) * Math.min(1, dt * 7);
  const mvK = U3.vmSway || 0, bobY = Math.sin(U3.bob) * (L.sneak ? 0.6 : 1.0) * mvK, sh = Math.min(G.shake || 0, 20);
  let yaw = G.yaw === undefined ? (L.ang || 0) : G.yaw, pitch = G.pitch || 0, px = L.x, py = L.y;
  if (G.inside) return renderInterior(dt, t, yaw, pitch, bobY, sh);
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
  terUpdate(cam.position.x, cam.position.z, U3.frame < 3 ? 1e9 : 8);
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
  U3.inst.tshadow.visible = dk < 0.7;
  // ---- dinamik içerik
  syncBuilds(dk); syncCarcs(); syncCamps(); syncWrecks(t);
  syncEnts(t, dk); syncEyes(dk, LS); syncSmall(t, dk);
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
//  İÇ MEKÂN (geçici)
// =============================================================
const IN = { b: null };
function inFloorY(x, y) { return 0; }
function interiorExit() { IN.b = null; }
function renderInterior() { return true; }
