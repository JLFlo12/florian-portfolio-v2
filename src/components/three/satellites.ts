import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/* ───────────────────────────────────────────────────────────────
   Satellites 3D du menu, tous dans le même thème : métal sombre et chrome, l'orange seulement en touches.
   - Accueil : satellite classique à deux panneaux solaires ;
   - Projets : satellite à grande parabole ;
   - À propos : Spoutnik chromé et ses quatre antennes ;
   - Contact : satellite de télécommunication qui émet des ondes ;
   - Jarvis : sphère sombre au cœur orange, dans son anneau.
   Les modèles (makeSatelliteKit) servent au ciel de l'accueil, où ils tournent autour de la planète
   (three/Planet.tsx) ; metalEnvironment sert aussi aux boutons 3D (three/spaceControls.ts).
   Ils tournent lentement ; au survol, ils grossissent et tournent plus vite ; la page en cours
   porte une balise orange qui clignote (et Contact émet ses ondes).
   ─────────────────────────────────────────────────────────────── */

/* Place d'un objet dans une scène à caméra orthographique (px, depuis le centre du canvas ; y vers le bas), taille et inclinaison */
export type SatelliteSpot = { x: number; y: number; s: number; rz: number };
/* Un satellite monté : holder (position, taille) → tilt (inclinaison) → body (rotation sur lui-même) */
export type SatelliteRig = {
  holder: THREE.Group; tilt: THREE.Group; body: THREE.Group; beacon: THREE.Mesh;
  spin?: THREE.Object3D; waves?: THREE.Mesh[]; h: number;
};

const ORANGE = 0xff6a1f;

/* Reflets du métal : une pièce éclairée, précalculée (à libérer avec dispose) */
export const metalEnvironment = (renderer: THREE.WebGLRenderer) => {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const target = pmrem.fromScene(room, 0.04);
  room.dispose();
  pmrem.dispose();
  return target;
};

export const makeSatelliteKit = (envMap: THREE.Texture) => {
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(o: T) => { disposables.push(o); return o; };

  // Matériaux : métal sombre et chrome pour tous, l'orange seulement en touches (balise, ondes, cœur de Jarvis)
  const panelTexture = (() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 40;
    const g = c.getContext('2d')!;
    g.fillStyle = '#15171b';
    g.fillRect(0, 0, 64, 40);
    g.strokeStyle = '#3b3f47';
    for (let x = 8; x < 64; x += 8) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, 40); g.stroke(); }
    for (let y = 10; y < 40; y += 10) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(64, y + 0.5); g.stroke(); }
    g.strokeStyle = '#6b7079';
    g.strokeRect(0.5, 0.5, 63, 39);
    const t = keep(new THREE.CanvasTexture(c));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  })();
  // Le métal sombre reste lisible sur un fond noir grâce aux reflets (envMapIntensity)
  const metal = (params: THREE.MeshStandardMaterialParameters) =>
    keep(new THREE.MeshStandardMaterial({ envMap, envMapIntensity: 1.3, ...params }));
  const hull = metal({ color: 0x4a4e55, metalness: 1, roughness: 0.22 }); // corps en métal sombre
  const panel = metal({ map: panelTexture, metalness: 0.7, roughness: 0.35 });
  const white = metal({ color: 0xc9ced4, metalness: 1, roughness: 0.18, side: THREE.DoubleSide }); // paraboles : chrome clair
  const steel = metal({ color: 0x8d939b, metalness: 1, roughness: 0.3 });
  const chrome = metal({ color: 0xdfe3e8, metalness: 1, roughness: 0.1 });
  const core = metal({ color: 0x2a2c30, emissive: ORANGE, emissiveIntensity: 0.2, metalness: 0.8, roughness: 0.25 });
  const ringMat = metal({ color: 0xc9ced4, emissive: ORANGE, emissiveIntensity: 0.12, metalness: 1, roughness: 0.2 });
  const beaconMat = keep(new THREE.MeshBasicMaterial({ color: ORANGE, transparent: true }));
  const beaconGeometry = keep(new THREE.SphereGeometry(1.5, 12, 8));

  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(keep(geometry), material);
    o.position.set(x, y, z);
    return o;
  };
  const rodX = (len: number, r = 0.6) => { const o = mesh(new THREE.CylinderGeometry(r, r, len, 8), steel); o.rotation.z = Math.PI / 2; return o; };

  type Built = { body: THREE.Group; beacon: THREE.Vector3; spin?: THREE.Object3D; waves?: THREE.Mesh[] };

  const classic = (): Built => {
    const body = new THREE.Group();
    body.add(mesh(new THREE.BoxGeometry(10, 10, 10), hull));
    for (const s of [-1, 1]) {
      body.add(mesh(new THREE.BoxGeometry(14, 8.5, 0.8), panel, s * 15.5, 0, 0));
      const r = rodX(4);
      r.position.x = s * 6.8;
      body.add(r);
    }
    body.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 5, 8), steel, 0, 7.5, 0));
    const dish = mesh(new THREE.ConeGeometry(3, 2, 16, 1, true), white, 0, 10.5, 0);
    dish.rotation.x = Math.PI;
    body.add(dish);
    return { body, beacon: new THREE.Vector3(0, 12.5, 0) };
  };

  const dishSat = (): Built => {
    const body = new THREE.Group();
    body.add(mesh(new THREE.BoxGeometry(8, 9, 8), hull, -3, 0, 0));
    body.add(mesh(new THREE.BoxGeometry(9, 6.5, 0.7), panel, -15, 0, 0));
    const r = rodX(3.5);
    r.position.x = -9;
    body.add(r);
    // Parabole : calotte de sphère tournée vers +x (creux vers l'extérieur), et sa source au foyer
    const dish = mesh(new THREE.SphereGeometry(9, 28, 10, 0, Math.PI * 2, 0, 0.62), white, 12, 0, 0);
    dish.rotation.z = Math.PI / 2;
    body.add(dish);
    const feed = rodX(5, 0.45);
    feed.position.x = 5.3;
    body.add(feed);
    body.add(mesh(new THREE.SphereGeometry(1.1, 12, 8), steel, 7.8, 0, 0));
    return { body, beacon: new THREE.Vector3(-3, 7, 0) };
  };

  const sputnik = (): Built => {
    const body = new THREE.Group();
    const inner = new THREE.Group();
    inner.position.x = -8; // les antennes partent vers la droite : on recentre l'ensemble
    inner.add(mesh(new THREE.SphereGeometry(6.5, 32, 20), chrome));
    for (const [dy, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const dir = new THREE.Vector3(1, dy * 0.32, dz * 0.32).normalize();
      const len = 20;
      const rod = mesh(new THREE.CylinderGeometry(0.35, 0.35, len, 6), steel);
      rod.position.copy(dir.clone().multiplyScalar(6.5 + len / 2 - 1));
      rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      inner.add(rod);
    }
    body.add(inner);
    return { body, beacon: new THREE.Vector3(-8, 8, 0) };
  };

  const comm = (): Built => {
    const body = new THREE.Group();
    body.add(mesh(new THREE.CylinderGeometry(5.5, 5.5, 11, 6), hull));
    for (const s of [-1, 1]) {
      body.add(mesh(new THREE.BoxGeometry(11, 6, 0.7), panel, s * 13.5, 0, 0));
      const r = rodX(3);
      r.position.x = s * 7;
      body.add(r);
    }
    const dish = mesh(new THREE.SphereGeometry(5, 20, 8, 0, Math.PI * 2, 0, 0.7), white, 0, 10.5, 0);
    dish.rotation.x = Math.PI; // creux vers le haut
    body.add(dish);
    // Ondes : anneaux qui s'agrandissent et s'effacent (face au visiteur, autour de la parabole)
    const waves = [0, 1, 2].map(() => {
      const m = keep(new THREE.MeshBasicMaterial({ color: ORANGE, transparent: true, opacity: 0, depthWrite: false }));
      return mesh(new THREE.TorusGeometry(6, 0.35, 6, 40), m, 0, 7, 0);
    });
    return { body, beacon: new THREE.Vector3(0, 9, 3), waves };
  };

  const orb = (): Built => {
    const body = new THREE.Group();
    body.add(mesh(new THREE.SphereGeometry(6.5, 32, 20), core));
    const ring = mesh(new THREE.TorusGeometry(12.5, 0.8, 8, 48), ringMat);
    ring.rotation.set(Math.PI / 2 - 0.35, 0.25, 0);
    body.add(ring);
    return { body, beacon: new THREE.Vector3(0, 9, 0), spin: ring };
  };

  const builders = [classic, dishSat, sputnik, comm, orb];

  /* Monte le satellite n° i (dans l'ordre du menu) */
  const rig = (i: number): SatelliteRig => {
    const built = builders[i % builders.length]();
    const holder = new THREE.Group();
    const tilt = new THREE.Group();
    tilt.add(built.body);
    holder.add(tilt);
    const beacon = new THREE.Mesh(beaconGeometry, beaconMat);
    beacon.position.copy(built.beacon);
    built.body.add(beacon);
    built.waves?.forEach((w) => holder.add(w));
    built.body.rotation.y = i * 1.3;
    return { holder, tilt, body: built.body, beacon, spin: built.spin, waves: built.waves, h: 0 };
  };

  /* Mouvements communs aux deux scènes : rotation, balise, anneau de Jarvis, ondes de Contact */
  const animate = (r: SatelliteRig, dt: number, t: number, active: boolean, hovered: boolean) => {
    r.h += ((hovered ? 1 : 0) - r.h) * Math.min(1, dt * 8);
    r.body.rotation.y += dt * (0.45 + r.h * 2.4);
    r.beacon.visible = active;
    if (r.spin) r.spin.rotation.z += dt * 0.8;
    r.waves?.forEach((w, k) => {
      const on = active || r.h > 0.5 ? 1 : 0;
      const p = (t * 0.6 + k / 3) % 1;
      w.scale.setScalar(0.5 + p * 1.7);
      (w.material as THREE.MeshBasicMaterial).opacity = on * 0.55 * (1 - p);
    });
  };

  return {
    rig,
    animate,
    blink: (t: number) => { beaconMat.opacity = Math.sin(t * 5) > 0 ? 1 : 0.25; },
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
};
