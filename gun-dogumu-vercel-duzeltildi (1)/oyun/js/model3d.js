'use strict';
// =============================================================
//  MODEL3D — insan ve yaratık 3B modelleri (THREE global)
//  Koordinat: dünya (x,y) -> three (x, yükseklik, y). 1 dünya birimi = 1 three birimi.
//  Modeller +X yönüne bakacak şekilde kurulur; çizici group.rotation.y = -ang yapar.
//  API:
//    M3.person(p)            -> THREE.Group (ayaklar y=0'da, boy ~34)
//    M3.updPerson(g, p, t)   -> her karede: yürüyüş, çalışma, yere düşme, taşınma vb.
//    M3.dino(d)              -> THREE.Group (boyut d.r ile orantılı)
//    M3.updDino(g, d, t)     -> her karede animasyon
// =============================================================
const M3 = {
  person(p) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 34, 8), new THREE.MeshLambertMaterial({ color: p.leader ? 0xa33 : 0x9a7 }));
    m.position.y = 17; g.add(m); return g;
  },
  updPerson(g, p, t) {},
  dino(d) {
    const g = new THREE.Group(), r = d.r || 20;
    const m = new THREE.Mesh(new THREE.BoxGeometry(r * 2.4, r * 1.2, r), new THREE.MeshLambertMaterial({ color: 0x586 }));
    m.position.y = r; g.add(m); return g;
  },
  updDino(g, d, t) {},
};
