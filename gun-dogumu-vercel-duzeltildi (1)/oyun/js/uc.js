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
const EYE = 30, MAXL = 5, TREE_R = 1800, ROCK_R = 1500, BUSH_R = 1000, DECO_R = 700;

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
    let p = g.parent, live = false; while (p) { if (p === U3.scene) { live = true; break; } p = p.parent; }
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
  sc.fog = new THREE.Fog(0x9fbcd0, 400, 1700);
  U3.cam = new THREE.PerspectiveCamera(75, 1, 1, 4200); U3.cam.rotation.order = 'YXZ'; sc.add(U3.cam);
  U3.hemi = new THREE.HemisphereLight(0xcfe3ff, 0x4a5a30, 0.9); sc.add(U3.hemi);
  U3.sun = new THREE.DirectionalLight(0xfff0d0, 0.9); sc.add(U3.sun); sc.add(U3.sun.target);
  U3.pl = []; for (let i = 0; i < MAXL; i++) { const l = new THREE.PointLight(0xff9a40, 0, 300, 1.25); sc.add(l); U3.pl.push(l); }
  U3.self = new THREE.PointLight(0x8090b8, 0, 150, 1.4); sc.add(U3.self);

  // gökyüzü: kubbe + yıldızlar + güneş/ay
  const sky = U3.sky = new THREE.Group(); sc.add(sky);
  const dg = new THREE.SphereGeometry(3600, 20, 10); dg.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(dg.attributes.position.count * 3), 3));
  U3.dome = new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); U3.dome.renderOrder = -10; U3.dome.frustumCulled = false; sky.add(U3.dome);
  { const n = 420, p = new Float32Array(n * 3), R = mulberry32(99);
    for (let i = 0; i < n; i++) { const a = R() * TAU, y = 0.06 + R() * 0.94, h = Math.sqrt(1 - y * y); p[i * 3] = Math.cos(a) * h * 3300; p[i * 3 + 1] = y * 3300; p[i * 3 + 2] = Math.sin(a) * h * 3300; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    U3.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); U3.stars.renderOrder = -9; U3.stars.frustumCulled = false; sky.add(U3.stars); }
  U3.sunS = sprite(TEX.glow, 0xfff2c0, true, false); U3.sunS.scale.set(620, 620, 1); U3.sunS.renderOrder = -8; sky.add(U3.sunS);
  U3.moonS = sprite(TEX.moon, 0xffffff, false, false); U3.moonS.scale.set(330, 330, 1); U3.moonS.renderOrder = -8; sky.add(U3.moonS);

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

  buildViewModel();
  U3.ok = true; return true;
}
function mkInst(geo, mat, max) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, max)); m.userData.max = Math.max(1, max); m.count = 0; m.frustumCulled = false;
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
//  DÜNYA (durağan içerik) — yeni oyun / yükleme olduğunda yeniden kurulur
// =============================================================
const BIOME_COL = ['#42632e', '#7b7566', '#3b4826', '#4b5258'];
function buildWorld() {
  if (U3.world) { U3.scene.remove(U3.world); disposeTree(U3.world, true); }
  for (const m of [U3.ents, U3.builds, U3.carcs, U3.camps]) { for (const e of m.values()) { if (m === U3.ents) dropEnt(e); else dropStatic(e); } m.clear(); }
  const W = U3.world = new THREE.Group(); U3.scene.add(W);
  // zemin: biyom renkleri köşe renginde, üstünde yinelenen ayrıntı dokusu
  const N = MAPN, pg = new THREE.PlaneGeometry(WORLD, WORLD, N, N); pg.rotateX(-Math.PI / 2); pg.translate(WORLD / 2, 0, WORLD / 2);
  const pos = pg.attributes.position, col = new Float32Array(pos.count * 3), cs = BIOME_COL.map(c => c3(c)), dirt = c3('#74593a'), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getZ(i);
    // köşe çevresindeki 4 hücrenin ortalaması: yumuşak biyom geçişi
    let r = 0, g = 0, b = 0;
    for (const [ox, oy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const c = cs[biomeFast(x + ox * MAPC * 0.5, y + oy * MAPC * 0.5)]; r += c.r; g += c.g; b += c.b; }
    tmp.setRGB(r / 4, g / 4, b / 4);
    const d = Math.hypot(x - CAMP.x, y - CAMP.y); if (d < 300) tmp.lerp(dirt, clamp(1 - d / 300, 0, 1) * 0.85);
    for (const l of G.lakes) { const dl = Math.hypot(x - l.x, y - l.y); if (dl < l.r + 70) tmp.lerp(c3('#8a7a52'), clamp(1 - (dl - l.r) / 70, 0, 1) * 0.7); }
    const n = 0.86 + hash2(x, y) * 0.28;
    col[i * 3] = tmp.r * n; col[i * 3 + 1] = tmp.g * n; col[i * 3 + 2] = tmp.b * n;
  }
  pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  W.add(new THREE.Mesh(pg, MAT.ground));
  { const o = new THREE.Mesh(new THREE.PlaneGeometry(WORLD * 4, WORLD * 4), new THREE.MeshLambertMaterial({ color: 0x18260f })); o.rotation.x = -Math.PI / 2; o.position.set(WORLD / 2, -1.2, WORLD / 2); W.add(o); }
  // göller ve bataklık havuzları
  for (const l of G.lakes) { const m = new THREE.Mesh(GEO.disc, MAT.water); m.scale.set(l.r, 1, l.r); m.position.set(l.x, 0.7, l.y); W.add(m); const s = new THREE.Mesh(GEO.disc, MAT.sand); s.scale.set(l.r + 12, 1, l.r + 12); s.position.set(l.x, 0.3, l.y); W.add(s); }
  for (const p of G.pools) { const m = new THREE.Mesh(GEO.disc, MAT.swamp); m.scale.set(p.r, 1, p.r); m.position.set(p.x, 0.5, p.y); W.add(m); }
  // örnekli ağlar
  const I = U3.inst = {};
  const nT = G.trees.length + G.deco.length;
  I.trunk = mkInst(GEO.trunk, MAT.inst, nT * 2 + 8); I.cone = mkInst(GEO.cone, MAT.inst, G.trees.length * 2 + 8); I.blob = mkInst(GEO.ico1, MAT.inst, G.trees.length * 2 + 8);
  I.tshadow = mkInst(GEO.disc, MAT.shadow, G.trees.length + 8);
  I.rock = mkInst(GEO.dod, MAT.inst, G.rocks.length + G.deco.length + 8);
  I.bush = mkInst(GEO.ico, MAT.inst, G.bushes.length + (G.herbs.length + G.poisons.length) + 8);
  I.berry = mkInst(GEO.ico, MAT.inst, 900);
  I.fern = mkInst(GEO.fern, MAT.instD, G.deco.length + 8);
  I.box = mkInst(GEO.box, MAT.inst, G.deco.length + 8);
  I.reed = mkInst(GEO.cone, MAT.inst, 700);
  I.crystal = mkInst(GEO.cone4, MAT.crystal, G.crystals.length * 4 + 8);
  for (const k in I) W.add(I[k]);
  U3.instX = 1e9; U3.sig = '';
  // yuvalar
  U3.nests = new THREE.Group(); W.add(U3.nests); U3.nestSig = -1;
  // yarık
  { const g = U3.riftG = new THREE.Group(); g.position.set(G.rift.x, 0, G.rift.y); W.add(g); U3.riftRings = [];
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.TorusGeometry(46 - i * 7, 1.6 - i * 0.2, 5, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL((200 + i * 12) / 360, 0.9, 0.6 + i * 0.05), fog: false })); m.position.y = 52; g.add(m); U3.riftRings.push(m); }
    const core = sprite(TEX.glow, 0xbfe0ff, true, false); core.scale.set(120, 170, 1); core.position.y = 52; g.add(core); U3.riftCore = core;
    const gb = new GB(), R = mulberry32(31); for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + R(), d = 50 + R() * 22, s = 8 + R() * 12; gb.dod('#5a5e6a', Math.cos(a) * d, s * 0.3, Math.sin(a) * d, s, s * (0.8 + R()), s, R() * 6); }
    g.add(gb.mesh()); }
  // kamp ateşi
  { const f = G.fire, g = U3.fireG = new THREE.Group(); g.position.set(f.x, 0, f.y); W.add(g);
    const gb = new GB();
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; gb.dod(i % 2 ? '#6a625a' : '#565048', Math.cos(a) * 24, 2.5, Math.sin(a) * 24, 6.5, 5, 6.5, a * 3); }
    gb.add(GEO.disc, '#16100c', 0, 0.5, 0, 21, 1, 21);
    for (const a of [0.6, 2.2, 3.7]) gb.add(GEO.cyl, '#4a2a14', Math.cos(a) * -15, 4, Math.sin(a) * -15, 3, 32, 3, 0, -a, -Math.PI / 2 + 0.2);
    g.add(gb.mesh());
    U3.fireFl = mkFlame(30, g, 0, 3, 0);
    U3.fireGlow = sprite(TEX.glow, 0xff8a30, true, false); U3.fireGlow.position.y = 22; g.add(U3.fireGlow);
    U3.eggI = mkInst(GEO.sph, new THREE.MeshLambertMaterial({ color: 0xefe4c8 }), 6); g.add(U3.eggI); U3.eggN = -1; }
}
function rebuildNests() {
  const g = U3.nests; while (g.children.length) { const c = g.children.pop(); c.geometry.dispose(); }
  for (const n of G.nests) {
    const gb = new GB();
    gb.add(GEO.torus, '#6a5030', n.x, 3, n.y, 15, 12, 15);
    gb.add(GEO.torus, '#54401f', n.x, 1.5, n.y, 20, 9, 20, 0, 1);
    for (let i = 0; i < n.eggs; i++) gb.sph('#efe6cc', n.x - 7 + i * 7, 5.5, n.y + (i % 2) * 3, 4.2, 5.8, 4.2);
    g.add(gb.mesh());
  }
}
const TREE_C = {};
function treeCols(b, tone) {
  const key = b + '_' + Math.floor(tone * 6);
  let o = TREE_C[key]; if (o) return o;
  const pals = TREE_PAL[b] || TREE_PAL[0], pal = pals[Math.floor(tone * pals.length) % pals.length], v = 0.9 + (Math.floor(tone * 6) % 3) * 0.1;
  o = TREE_C[key] = { a: new THREE.Color(pal[1]).multiplyScalar(v * 1.15), b: new THREE.Color(pal[2]).multiplyScalar(v), t: new THREE.Color(b === 3 ? '#4a443e' : b === 2 ? '#4a3a26' : '#5a3d26').multiplyScalar(0.85 + (Math.floor(tone * 6) % 2) * 0.2) };
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
  const stumpC = c3('#8a6a44'), col = _col;
  for (const t of G.trees) {
    if (!near(t, TREE_R)) continue;
    if (t.stump) { instAdd(I.trunk, t.x, 0, t.y, 9, 7, 9, t.sw, stumpC); continue; }
    const C = treeCols(t.b, t.tone), k = (t.cr - 36) / 26, H = 125 + k * 120 + ((t.tone * 37) % 1) * 30, cr = t.cr;
    const conifer = t.b === 1 || t.b === 3 || (t.b === 0 && ((t.tone * 13) % 1) < 0.55);
    instAdd(I.tshadow, t.x, 0.35, t.y, cr * 0.95, 1, cr * 0.95, 0);
    if (conifer) {
      const base = Math.max(46, H * 0.3), thin = t.b === 3 ? 0.7 : 1;
      instAdd(I.trunk, t.x, 0, t.y, 8.5, H * 0.75, 8.5, t.sw, C.t);
      instAdd(I.cone, t.x, base, t.y, cr * 0.8 * thin, H * 0.5, cr * 0.8 * thin, t.sw, C.a);
      instAdd(I.cone, t.x, base + H * 0.27, t.y, cr * 0.58 * thin, H - base - H * 0.27, cr * 0.58 * thin, t.sw + 0.5, C.b);
    } else {
      const th = H * 0.62;
      instAdd(I.trunk, t.x, 0, t.y, 9.5, th, 9.5, t.sw, C.t, Math.sin(t.sw) * 0.04, Math.cos(t.sw) * 0.04);
      instAdd(I.blob, t.x, th + cr * 0.25, t.y, cr * 1.05, H * 0.27, cr * 1.05, t.sw, C.a);
      instAdd(I.blob, t.x + Math.cos(t.sw) * cr * 0.4, th + H * 0.2, t.y + Math.sin(t.sw) * cr * 0.4, cr * 0.72, H * 0.2, cr * 0.72, t.sw * 2, C.b);
    }
  }
  for (const r of G.rocks) {
    if (r.dead || !near(r, ROCK_R)) continue;
    const g = (112 * r.shade) / 255, mtn = biomeFast(r.x, r.y) === 1, h = hash2(r.x, r.y);
    col.setRGB(g + 0.05, g + 0.03, g); if (!mtn && h > 0.5) col.lerp(c3('#5a7a3a'), 0.25);
    instAdd(I.rock, r.x, r.r * 0.2, r.y, r.r * 1.15, r.r * (mtn ? 1.3 + h * 1.4 : 0.75 + h * 0.5), r.r * 1.1, h * 6, col, h * 0.4, 0);
  }
  for (const b of G.bushes) {
    if (!near(b, BUSH_R)) continue;
    const h = hash2(b.x, b.y);
    col.set('#2f5a24').multiplyScalar(0.85 + h * 0.4);
    instAdd(I.bush, b.x, b.r * 0.45, b.y, b.r * 1.15, b.r * 0.8, b.r * 1.15, h * 6, col);
    instAdd(I.bush, b.x - 7, b.r * 0.4, b.y - 4, b.r * 0.75, b.r * 0.6, b.r * 0.75, h * 9, col);
    if (near(b, 520)) { const n = Math.min(7, b.amt + Math.floor(b.amt / 2)), bc = c3(b.col); for (let i = 0; i < n; i++) { const q = b.berries[i], rr = (q[0] * q[0] + q[1] * q[1]) / (b.r * b.r * 1.3); instAdd(I.berry, b.x + q[0], b.r * 0.45 + Math.sqrt(Math.max(0.05, 1 - rr)) * b.r * 0.8, b.y + q[1], 2.3, 2.3, 2.3, i, bc); } }
  }
  for (const h of G.herbs) {
    if (!near(h, BUSH_R)) continue;
    instAdd(I.fern, h.x, 0, h.y, 11, 9, 11, h.x, c3('#4c8a3a'));
    if (near(h, 520)) for (let i = 0; i < h.amt; i++) instAdd(I.berry, h.x + Math.cos(i * 2.1) * 6, 6, h.y + Math.sin(i * 2.1) * 6, 2.2, 1.6, 2.2, i, c3('#f4f8ff'));
  }
  for (const h of G.poisons) {
    if (!near(h, BUSH_R)) continue;
    instAdd(I.fern, h.x, 0, h.y, 13, 11, 13, h.x, c3('#7a3aa0'));
    instAdd(I.bush, h.x, 2, h.y, 6, 4, 6, 0, c3('#4a2262'));
    if (near(h, 520)) for (let i = 0; i < h.amt; i++) instAdd(I.berry, h.x - 3 + i * 6, 7, h.y - 2, 2, 2, 2, i, c3('#c6f04a'));
  }
  for (const d of G.deco) {
    if (!near(d, DECO_R)) continue;
    const s = d.s;
    if (d.t === 'fern') { col.set('#356a2a').multiplyScalar(0.8 + ((d.a * 3) % 1) * 0.5); instAdd(I.fern, d.x, 0, d.y, 16 * s, 15 * s, 16 * s, d.a, col); }
    else if (d.t === 'bone') { instAdd(I.box, d.x, 1.2, d.y, 15 * s, 2.2, 2.6, -d.a, c3('#d8d0ba')); instAdd(I.box, d.x + Math.cos(d.a) * 4, 1.6, d.y + Math.sin(d.a) * 4, 2.2, 2.2, 9 * s, -d.a + 0.5, c3('#cfc6ae')); }
    else if (d.t === 'reed') { for (let i = -1; i <= 1; i++) instAdd(I.reed, d.x + i * 4, 0, d.y + (i * i) * 3, 1.3, (20 + i * 4) * s, 1.3, 0, c3(i ? '#6a7a3a' : '#7a8a44'), 0, i * 0.08); }
    else if (d.t === 'pebble') { instAdd(I.rock, d.x, 1, d.y, 4 * s, 2.6 * s, 3.6 * s, d.a, c3('#857d70')); instAdd(I.rock, d.x + 6, 0.6, d.y + 2, 2.4 * s, 1.6 * s, 2.4 * s, d.a * 2, c3('#a49c8e')); }
    else if (d.t === 'deadtree') { const cg = c3('#4a4540'); instAdd(I.trunk, d.x, 0, d.y, 5 * s, 62 * s, 5 * s, d.a, cg, 0.06, 0.05); instAdd(I.trunk, d.x, 34 * s, d.y, 2.2 * s, 30 * s, 2.2 * s, d.a, cg, 0, 0.9); instAdd(I.trunk, d.x, 46 * s, d.y, 1.8 * s, 24 * s, 1.8 * s, d.a + 2.4, cg, 0, 0.8); }
  }
  for (const c of G.crystals) {
    if (c.dead || !near(c, ROCK_R)) continue;
    for (let i = 0; i < 4; i++) { col.setHSL(c.hue / 360, 0.8, 0.5 + i * 0.06); const a = c.x + i * 1.9; instAdd(I.crystal, c.x + Math.cos(a) * 4, 0, c.y + Math.sin(a) * 4, 4.2 - i * 0.5, 30 - Math.abs(i - 1.5) * 8, 4.2 - i * 0.5, a, col, Math.sin(a) * 0.3, Math.cos(a) * 0.3); }
  }
  for (const k in I) instDone(I[k]);
}

// =============================================================
//  YAPILAR
// =============================================================
function buildMesh(b) {
  const T = b.type, r = b.r, g = new THREE.Group(), gb = new GB(), R = mulberry32(Math.floor(b.x * 3 + b.y * 7) + 1), ghost = !b.built;
  let fl = null;
  if (T === 'magara') {
    const cf = (x, y, z, c) => { const n = hash2(x * 40 + 3, z * 40 + y * 17); _col.copy(c).multiplyScalar(0.72 + n * 0.5); if (y > 0.35 && hash2(x * 23, z * 31) > 0.45) _col.lerp(c3('#4f6f34'), 0.6); return _col; };
    const mg = new THREE.IcosahedronGeometry(1, 2), mp = mg.attributes.position;
    for (let i = 0; i < mp.count; i++) { const x = mp.getX(i), y = mp.getY(i), z = mp.getZ(i), f = 1 + 0.16 * Math.sin(x * 5.1 + 1.3) * Math.sin(z * 4.3 + y * 3.7) + 0.09 * Math.sin(y * 9 + x * 7 + z * 3); mp.setXYZ(i, x * f, Math.max(-0.05, y) * f, z * f); }
    gb.add(mg, '#77726a', 0, 0, -r * 0.12, r * 1.4, r * 1.15, r * 1.02, 0, 0, 0, cf); mg.dispose();
    gb.add(GEO.dod, '#6a665e', -r * 0.95, 8, r * 0.45, 30, 38, 28, 0, 1, 0, cf).add(GEO.dod, '#6f6a60', r * 1.0, 6, r * 0.35, 28, 30, 30, 0, 2, 0, cf).add(GEO.dod, '#5f5b54', -r * 0.5, 4, -r * 0.95, 34, 30, 30, 0, 3, 0, cf);
    // giriş: güney yüzünde taş çerçeveli karanlık kemer (b.x, b.y + r*0.85)
    const ez = r * 0.92;
    gb.add(GEO.dod, '#8a8478', -30, 14, ez, 13, 30, 15, 0, 0.4, 0.08).add(GEO.dod, '#827c70', 30, 14, ez, 13, 30, 15, 0, 1.1, -0.08);
    gb.add(GEO.dod, '#8f897c', -17, 45, ez - 2, 18, 11, 15, 0, 0.7, 0.3).add(GEO.dod, '#8a8478', 17, 45, ez - 2, 18, 11, 15, 0, 0.2, -0.3).add(GEO.dod, '#958f82', 0, 50, ez - 2, 15, 10, 15, 0, 1.6, 0);
    gb.box('#5a554c', 0, 0.6, ez + 14, 44, 1.2, 26);
    g.add(gb.mesh(ghost));
    const d1 = new THREE.Mesh(GEO.box, MAT.dark); d1.scale.set(42, 30, 20); d1.position.set(0, 15, ez - 6); g.add(d1);
    const d2 = new THREE.Mesh(GEO.arch, MAT.dark); d2.scale.set(21, 16, 1); d2.position.set(0, 30, ez + 4.05); g.add(d2);
    const gl = new THREE.Mesh(GEO.arch, new THREE.MeshBasicMaterial({ map: TEX.glow, color: 0xff8a3a, transparent: true, opacity: 0, depthWrite: false, fog: false })); gl.scale.set(19, 30, 1); gl.position.set(0, 0, ez + 4.3); g.add(gl); g.userData.glow = gl;
    return g;
  }
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
const buildSig = b => (b.built ? 1 : 0) + (b.type === 'tarla' ? '_' + (b.planted ? 1 + Math.min(4, Math.floor(b.g * 4)) : 0) : '');
function syncBuilds(dk) {
  const M = U3.builds, f = U3.frame;
  for (const b of G.builds) {
    if (b.dead) continue;
    let e = M.get(b); const sig = buildSig(b);
    if (!e || e.sig !== sig) { if (e) { U3.scene.remove(e.g); disposeTree(e.g, true); } e = { g: buildMesh(b), sig }; e.g.position.set(b.x, 0, b.y); U3.scene.add(e.g); M.set(b, e); }
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
    if (!e || e.sig !== sig) { if (e) { U3.scene.remove(e.g); disposeTree(e.g); } e = { g: carcMesh(c), sig }; e.g.position.set(c.x, 0, c.y); U3.scene.add(e.g); M.set(c, e); }
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
    if (!e || e.sig !== sig) { if (e) dropStatic(e); e = { g: campMesh(c), sig }; e.g.position.set(c.x, 0, c.y); U3.scene.add(e.g); M.set(c, e); }
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
  const camX = U3.cam.position.x, camZ = U3.cam.position.z, far2 = 2000 * 2000;
  const nearCam = o => { const dx = o.x - camX, dy = o.y - camZ; return dx * dx + dy * dy < far2; };
  let towerOf = null;
  for (const b of G.builds) if (b.type === 'kule' && b.guard && dist(b.guard, b) < 12) (towerOf || (towerOf = new Map())).set(b.guard, b);
  for (const p of G.people) {
    const show = p !== L && !p.inHut && !p.insideB && !p.dead && nearCam(p);
    const e = put(p, 'p', () => M3.person(p), show); if (!e) continue;
    const up = towerOf && towerOf.has(p) ? 62.5 : 0;
    e.g.position.set(p.x, up, p.y); e.g.rotation.y = -p.ang;
    M3.updPerson(e.g, p, t);
    if (!up) instAdd(sh, p.x, 0.4, p.y, p.child ? 7 : 10, 1, p.child ? 7 : 10, 0);
  }
  for (const d of G.dinos) {
    if (d.dead) continue;
    const vis = !d.hidden && nearCam(d) && (d.tamed || visible(d.x, d.y, d.r + 160 * (1 - dk)));
    if (d.type === 'yamyam') {
      const e = put(d, 'c', () => { const v = cannibalView(d); const g = M3.person(v); g.userData.view = v; return g; }, vis); if (!e) continue;
      const v = Object.assign(e.g.userData.view, cannibalView(d));
      e.g.position.set(d.x, 0, d.y); e.g.rotation.y = -d.ang; M3.updPerson(e.g, v, t);
      instAdd(sh, d.x, 0.4, d.y, 10, 1, 10, 0);
    } else if (d.type === 'taklitci' && !d.revealed) {
      const e = put(d, 'm', () => { const v = mimicView(d); const g = M3.person(v); g.userData.view = v; return g; }, vis); if (!e) continue;
      const v = mimicView(d, e.g.userData.view);
      e.g.position.set(d.x, 0, d.y); e.g.rotation.y = -v.ang; M3.updPerson(e.g, v, t);
      instAdd(sh, d.x, 0.4, d.y, 10, 1, 10, 0);
    } else {
      const e = put(d, 'd', () => M3.dino(d), vis); if (!e) continue;
      e.g.position.set(d.x, d.fly ? (d.alt || 0) * 85 : 0, d.y); e.g.rotation.y = -d.ang;
      M3.updDino(e.g, d, t);
      instAdd(sh, d.x, 0.4, d.y, d.r * (d.fly ? 0.9 : 1.2), 1, d.r * (d.fly ? 0.9 : 0.9), -d.ang);
    }
  }
  if (G.rescue) {
    const q = G.rescue, e = put(q, 'p', () => M3.person(q), visible(q.x, q.y, 120));
    if (e) { e.g.position.set(q.x, 0, q.y); e.g.rotation.y = -(q.ang || 0); M3.updPerson(e.g, q, t); }
  }
  for (const [k, e] of M) if (e.f !== f) { dropEnt(e); M.delete(k); }
  MAT.shadow.opacity = 0.26 * shA;
  instDone(sh);
}

// ---- karanlıkta parlayan gözler
function syncEyes(dk, LS) {
  let n = 0; const E = U3.eyes, cp = U3.cam.position;
  if (dk > 0.5) for (const d of G.dinos) {
    if (n >= E.length - 1) break;
    if (d.tamed || d.blink < 0 || d.ko > 0 || d.hidden || d.fly || d.silent || d.dead || d.type === 'yamyam' || (d.type === 'taklitci' && !d.revealed)) continue;
    if (!(visibleK(d.x, d.y, 1.8) || d.scouted > 0)) continue;
    const lv = lightLevel(d.x, d.y, LS); if (lv > 0.35) continue;
    const toL = Math.cos(d.ang - angTo(d, L)); if (toL < -0.2 && !(d.scouted > 0)) continue;
    const big = d.type === 'geceavcisi' ? 1.8 : 1, hx = d.x + Math.cos(d.ang) * d.r * 1.05, hz = d.y + Math.sin(d.ang) * d.r * 1.05;
    const hy = d.type === 'uzunboyun' ? d.r * 2.6 : d.r > 45 ? d.r * 1.45 : Math.max(9, d.r * 1.15);
    const sep = Math.max(1.6, d.r * 0.2), px = -Math.sin(d.ang) * sep, pz = Math.cos(d.ang) * sep;
    const dd = Math.hypot(hx - cp.x, hz - cp.z), sz = Math.max((d.r * 0.09 + 1.2) * big * 3.2, dd * 0.011 * big);
    const a = d.scouted > 0 ? 0.95 : clamp(0.45 + 0.55 * toL * (1 - lv), 0, 1), col = c3(DINO[d.type].eye);
    for (const s of [-1, 1]) { const sp = E[n++]; sp.visible = true; sp.position.set(hx + px * s, hy, hz + pz * s); sp.scale.set(sz, sz, 1); sp.material.color.copy(col); sp.material.opacity = a; }
  }
  for (let i = n; i < E.length; i++) E[i].visible = false;
}

// ---- küçük hareketliler: oklar, tükürük, parçacıklar, lekeler, izler
function syncSmall(t, dk) {
  const A = U3.arrowI; A.count = 0;
  for (const q of G.proj) instAdd(A, q.x - Math.cos(q.ang) * 16, 24, q.y - Math.sin(q.ang) * 16, 0.55, 18, 0.55, -q.ang, null, 0, -Math.PI / 2);
  instDone(A);
  const S = U3.spitI; S.count = 0;
  for (const q of G.eproj) instAdd(S, q.x, 18, q.y, 3.4, 3.4, 3.4, t * 9);
  instDone(S);
  const P = U3.parts, pa = P.geometry.attributes.position, ca = P.geometry.attributes.color; let n = 0;
  for (const q of G.parts) {
    if (n >= U3.partN) break;
    if (q._y0 === undefined) { q._y0 = q.y; q._up = q.vy < -24 && Math.abs(q.vx) < 46; q._h = 6 + Math.random() * 16; }
    const c = c3(q.col), a = clamp(q.life * 1.5, 0, 1);
    if (q._up) pa.setXYZ(n, q.x, 6 + (q._y0 - q.y) * 0.8, q._y0); else pa.setXYZ(n, q.x, 2 + q._h * clamp(q.life, 0, 1), q.y);
    ca.setXYZ(n, c.r * a, c.g * a, c.b * a); n++;
  }
  P.geometry.setDrawRange(0, n); pa.needsUpdate = true; ca.needsUpdate = true;
  const cx = L.x, cy = L.y;
  const ST = U3.stainI; ST.count = 0;
  for (const s of G.stains) { if (Math.abs(s.x - cx) > 900 || Math.abs(s.y - cy) > 900) continue; instAdd(ST, s.x, 0.42 + (ST.count % 5) * 0.02, s.y, s.r, 1, s.r * 0.8, s.x); }
  instDone(ST);
  const TR = U3.trackI; TR.count = 0;
  for (const s of G.tracks) { if (Math.abs(s.x - cx) > 500 || Math.abs(s.y - cy) > 500 || !exploredAt(s.x, s.y)) continue; instAdd(TR, s.x, 0.38, s.y, 13, 1, 8, -s.a); }
  instDone(TR);
  // ateş böcekleri
  const F = U3.flies, fa = clamp((baseDark() - 0.25) * 2, 0, 1) * 0.85; F.visible = fa > 0.02;
  if (F.visible) {
    const p = F.geometry.attributes.position; F.material.opacity = fa;
    U3.flySeed.forEach((s, i) => { const bx = Math.floor((cx - s[0]) / 700 + 0.5) * 700 + s[0], bz = Math.floor((cy - s[2]) / 700 + 0.5) * 700 + s[2], bl = Math.sin(t * 1.7 + s[3] * 3) > -0.2 ? 1 : 0; p.setXYZ(i, bx + Math.sin(t * 0.4 + s[3]) * 30, bl ? s[1] + Math.sin(t * 0.7 + s[3] * 2) * 8 : -50, bz + Math.cos(t * 0.33 + s[3]) * 30); });
    p.needsUpdate = true;
  }
  // duman
  const fuel = G.fire.fuel > 0;
  U3.smoke.forEach((s, i) => { s.visible = fuel; if (!fuel) return; const k = (t * 0.16 + i / U3.smoke.length) % 1; s.position.set(G.fire.x + Math.sin(t * 0.5 + i * 2) * 6 + k * 34, 40 + k * 190, G.fire.y + Math.cos(t * 0.4 + i) * 6 + k * 10); const sz = 22 + k * 70; s.scale.set(sz, sz, 1); s.material.opacity = Math.sin(k * Math.PI) * 0.3 * (1 - dk * 0.75); });
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
  const dn = clamp(dk / 0.95, 0, 1), far = (1700 + (500 - 1700) * dn) * (U3.fogK + (0.6 + U3.fogK * 0.4 - U3.fogK) * dn);
  U3.scene.fog.far = far; U3.scene.fog.near = far * (0.22 - 0.16 * dn) * (1 - grayK * 0.6);
  U3.r.setClearColor(SKY.h, 1);
  // kubbe renkleri
  const dc = U3.dome.geometry.attributes.color, dp = U3.dome.geometry.attributes.position;
  for (let i = 0; i < dp.count; i++) { const k = Math.pow(clamp(dp.getY(i) / 3600, 0, 1), 0.55); dc.setXYZ(i, SKY.h.r + (SKY.z.r - SKY.h.r) * k, SKY.h.g + (SKY.z.g - SKY.h.g) * k, SKY.h.b + (SKY.z.b - SKY.h.b) * k); }
  dc.needsUpdate = true;
  U3.sky.position.set(cp.x, 0, cp.z);
  U3.stars.material.opacity = clamp((dk - 0.45) / 0.4, 0, 1) * 0.9 * clamp(U3.fogK * 1.6 - 0.6, 0, 1);
  U3.stars.visible = U3.stars.material.opacity > 0.01; U3.stars.rotation.y = G.t / CYCLE * 0.6;
  // güneş ve ay
  const ts = clamp(p / 0.5, 0, 1), sx = -Math.cos(ts * Math.PI), sy = Math.sin(ts * Math.PI) * 0.85 + 0.06;
  _v.set(sx, sy, 0.38).normalize();
  U3.sunS.position.copy(_v).multiplyScalar(3200); U3.sunS.material.opacity = clamp(1 - dk * 2.2, 0, 1) * clamp(U3.fogK * 1.4 - 0.4, 0, 1); U3.sunS.visible = U3.sunS.material.opacity > 0.01;
  U3.sunS.material.color.copy(c3(0xfff2c0)).lerp(c3(0xff9a50), warm * 0.7);
  U3.sun.position.copy(cp).addScaledVector(_v, 1000); U3.sun.target.position.copy(cp);
  const tn = clamp((p - 0.5) / 0.5, 0, 1);
  _v2.set(Math.cos(tn * Math.PI) * 0.8, Math.sin(tn * Math.PI) * 0.7 + 0.12, -0.5).normalize();
  U3.moonS.position.copy(_v2).multiplyScalar(3200); U3.moonS.material.opacity = clamp((dk - 0.4) / 0.4, 0, 1) * clamp(U3.fogK * 1.6 - 0.6, 0, 1); U3.moonS.visible = U3.moonS.material.opacity > 0.01;
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
    const l = e[1], mine = G.torchOn && l.x === L.x && l.y === L.y && !l.safe, tall = l.r / lightMul() > 188;
    pl.color.set(l.blue ? 0x4f86ff : l.red ? 0xff4a22 : mine ? 0xffa050 : 0xff9a40);
    pl.distance = l.r * (l.safe ? 1.9 : 1.75);
    pl.intensity = (l.safe ? 2.5 : l.blue ? 2.2 : mine ? 2.0 : 1.9) * lk;
    if (mine) { _v.set(-5, -1, -6).applyQuaternion(cam.quaternion); pl.position.set(cp.x + _v.x, cp.y + _v.y, cp.z + _v.z); }
    else pl.position.set(l.x, l.safe ? 26 : l.blue ? 50 : l.red ? 22 : tall ? 80 : 38, l.safe || l.blue || l.red ? l.y : l.y + (tall ? 10 : 20));
  }
  U3.self.position.copy(cp); U3.self.intensity = 0.55 * clamp((dk - 0.3) / 0.5, 0, 1);
  return dk;
}
function updFire(t, dk) {
  const f = G.fire, on = f.fuel > 0, s = 0.55 + f.fuel / 100;
  U3.fireG.position.set(f.x, 0, f.y);
  U3.fireFl.visible = on; U3.fireFl.userData.k = s;
  U3.fireGlow.visible = on;
  if (on) { const gs = 90 * s * (1 + Math.sin(t * 11) * 0.05); U3.fireGlow.scale.set(gs, gs, 1); U3.fireGlow.material.opacity = 0.28 + 0.4 * dk; }
  if (U3.eggN !== G.eggs.length) { U3.eggN = G.eggs.length; U3.eggI.count = 0; for (let i = 0; i < Math.min(6, G.eggs.length); i++) instAdd(U3.eggI, 32 + (i % 3) * 9, 5.5, 18 + Math.floor(i / 3) * 9, 4.6, 6.2, 4.6, i); instDone(U3.eggI); }
  // yarık
  U3.riftRings.forEach((m, i) => { m.rotation.y = t * (0.3 + i * 0.15) * (i % 2 ? -1 : 1); m.rotation.x = Math.sin(t * 0.7 + i) * 0.25; const k = 1 + Math.sin(t * 2 + i) * 0.05; m.scale.set(k, k * 1.25, k); });
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
  // yeni oyun / yükleme: dünya dizileri değişti
  if (U3.worldKey !== G.trees || U3.worldSeed !== G.seed || U3.worldFire !== G.fire) { U3.worldKey = G.trees; U3.worldSeed = G.seed; U3.worldFire = G.fire; buildWorld(); }
  // ---- kamera
  if (L.moving && !G.sleep) U3.bob += dt * (L.sprinting ? 15 : 10.5);
  const eyeT = G.mount ? EYE + G.mount.r * 1.75 : L.hp <= 0 ? 7 : EYE;
  U3.eye += (eyeT - U3.eye) * Math.min(1, dt * 6);
  const mvK = U3.vmSway || 0, bobY = Math.sin(U3.bob) * 1.0 * mvK, sh = Math.min(G.shake || 0, 20);
  let yaw = G.yaw === undefined ? (L.ang || 0) : G.yaw, pitch = G.pitch || 0, px = L.x, py = L.y;
  if (G.sleep && G.sleep.b) { const b = G.sleep.b; px = b.x; py = b.y + b.r + 16; yaw = Math.PI / 2; pitch = 0.05; }
  cam.position.set(px + (Math.random() - 0.5) * sh * 0.3, U3.eye + bobY + (Math.random() - 0.5) * sh * 0.22, py + (Math.random() - 0.5) * sh * 0.3);
  cam.rotation.set(clamp(pitch, -1.45, 1.45), -yaw - Math.PI / 2, (Math.random() - 0.5) * sh * 0.004 + Math.sin(U3.bob * 0.5) * 0.006 * mvK + (L.hp <= 0 ? 0.5 : 0));
  const fov = U3.baseFov / (1 + (G.scare || 0) * 0.14);
  if (cam.fov !== fov || cam.aspect !== U3.camA) { cam.fov = fov; U3.camA = cam.aspect; cam.updateProjectionMatrix(); }
  cam.updateMatrixWorld();
  // ---- ışık ve hava
  const LS = U3.LS = lights();
  const dk = U3.dk = updAtmos(dt, t, LS);
  // ---- durağan dünya örnekleri
  U3.sigT -= dt;
  if (U3.sigT <= 0) { U3.sigT = 0.4; const s = worldSig(); if (s !== U3.sig) { U3.sig = s; U3.instX = 1e9; const ns = G.nests.reduce((a, n) => a + n.eggs, 0) + G.nests.length * 100; if (ns !== U3.nestSig) { U3.nestSig = ns; rebuildNests(); } } }
  if (Math.abs(px - U3.instX) + Math.abs(py - U3.instY) > 200) rebuildInst(px, py);
  U3.inst.tshadow.visible = dk < 0.7;
  // ---- dinamik içerik
  syncBuilds(dk); syncCarcs(); syncCamps();
  syncEnts(t, dk); syncEyes(dk, LS); syncSmall(t, dk);
  updFire(t, dk); updFlames(t); updViewModel(dt, t);
  // yerleştirme hayaleti ve av hedefi
  if (G.placing) {
    const p = placePos(), ok = placeOk(G.placing, p), r = BUILD[G.placing].r, gh = U3.ghost;
    gh.visible = true; gh.position.set(p.x, 0, p.y); gh.children[0].scale.set(r, 1, r); gh.children[1].scale.set(r, BUILD[G.placing].flat ? 5 : 30, r); gh.children[1].position.y = (BUILD[G.placing].flat ? 5 : 30) / 2;
    U3.ghostMat.color.set(ok ? 0x77cc66 : 0xcc4444); U3.ghostMat.opacity = 0.28 + Math.sin(t * 5) * 0.06;
  } else U3.ghost.visible = false;
  const ht = G.hunt && G.hunt.t && !G.hunt.t.dead && visible(G.hunt.t.x, G.hunt.t.y, 60) ? G.hunt.t : null;
  U3.huntRing.visible = !!ht;
  if (ht) { const rr = ht.r + 12 + Math.sin(t * 5) * 2; U3.huntRing.position.set(ht.x, 1.2, ht.y); U3.huntRing.scale.set(rr, 1, rr); }
  U3.r.render(U3.scene, cam);
  return true;
}

// dünya noktası -> ekran (CSS px). z: kameranın önündeyse > 0 (uzaklık), arkadaysa < 0
function w2s(x, y, h) {
  const cam = U3.cam; if (!cam) return null;
  _v.set(x, h || 0, y).applyMatrix4(cam.matrixWorldInverse);
  const z = -_v.z; _v.applyMatrix4(cam.projectionMatrix);
  return { x: (_v.x * 0.5 + 0.5) * VW, y: (-_v.y * 0.5 + 0.5) * VH, z, on: z > 1 && _v.x > -1 && _v.x < 1 && _v.y > -1 && _v.y < 1 };
}
