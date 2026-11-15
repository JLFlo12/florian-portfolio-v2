import * as THREE from 'three';
import { ShipModel } from '@/games/event-horizon/ship/ShipModel';
import type { ModuleId } from '@/components/station/layout';
import { Builder } from './builder';
import { PALETTE, SCREEN_COLS, SCREEN_ROWS, mat4, moduleProfile, type Profile } from './kit';
import type { ModuleAccents } from './materials';

/* ───────────────────────────────────────────────────────────────
   StationModules : les neuf modules de la station, un par famille d'outils.
   Chacun renvoie un ModuleRuntime : ses matériaux lumineux (qui s'intensifient
   quand la caméra arrive) et une fonction update() appelée à chaque image avec
   l'activation du module (0..1, pilotée par le défilement) et l'avancée dans sa halte.
   ─────────────────────────────────────────────────────────────── */

export interface ModuleRuntime {
  id: ModuleId;
  accents: ModuleAccents;
  /** active : présence de l'étape (0..1) ; dwell : avancée dans la halte (0..1) ; ambient : animations d'ambiance */
  update(time: number, dt: number, active: number, dwell: number, ambient: boolean): void;
  lights: THREE.PointLight[];
  dispose(): void;
}

const PI = Math.PI;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const alongZ = (z: number, x = 0, y = 0) => mat4(x, y, z, PI / 2);      // axe local Y → +Z
const alongNegZ = (z: number, x = 0, y = 0) => mat4(x, y, -z, -PI / 2); // axe local Y → -Z, centre à -z
const alongX = (x: number, y = 0, z = 0) => mat4(x, y, z, 0, 0, -PI / 2); // axe local Y → +X
const smooth = (a: number, b: number, v: number) => { const x = Math.min(1, Math.max(0, (v - a) / (b - a))); return x * x * (3 - 2 * x); };
const damp = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

/** Écran : plan dont les UV pointent sur une case de l'atlas d'écrans. */
function screenPlane(w: number, h: number, k: number) {
  const g = new THREE.PlaneGeometry(w, h);
  const col = k % SCREEN_COLS;
  const row = Math.floor(k / SCREEN_COLS) % SCREEN_ROWS;
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    const u = (col + 0.02 + uv.getX(i) * 0.96) / SCREEN_COLS;
    const v = 1 - (row + 0.02 + (1 - uv.getY(i)) * 0.96) / SCREEN_ROWS;
    uv.setXY(i, u, v);
  }
  return g;
}

/** Façade de baie : la texture (1 × 4) garde ses proportions. */
function rackPlane(w: number, h: number, offset = 0) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setY(i, offset + (uv.getY(i) * h) / (w * 4));
  return g;
}

/* ——— Émetteur holographique : disque lumineux et cône de projection (origine 3D des panneaux) ——— */
const HOLO_VERTEX = /* glsl */ `
varying vec2 vUv;
varying float vFace;
void main() {
  vUv = uv;
  vec3 n = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFace = abs(dot(n, normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}`;
const HOLO_FRAGMENT = /* glsl */ `
uniform float uActive;
uniform float uTime;
varying vec2 vUv;
varying float vFace;
void main() {
  float fade = pow(1.0 - vUv.y, 1.6) * smoothstep(0.0, 0.08, vUv.y);
  float scan = 0.65 + 0.35 * step(0.5, fract(vUv.y * 18.0 - uTime * 1.6));
  float edge = pow(1.0 - vFace, 2.0);
  float a = fade * scan * (0.25 + edge * 1.4) * uActive;
  gl_FragColor = vec4(vec3(1.0, 0.46, 0.1) * a * 1.6, 0.0);
}`;

function emitter(b: Builder, parent: THREE.Object3D, pos: THREE.Vector3, A: ModuleAccents, height = 3.2, up = V(0, 1, 0)) {
  const m = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), up), V(1, 1, 1));
  b.cyl(1.2, 1.45, 0.35, b.M.frame, m.clone().multiply(mat4(0, 0.17, 0)), 24);
  b.lathe([[0.7, 0.36], [1.05, 0.36], [1.05, 0.42], [0.7, 0.42]], A.strip, m, 32);
  const material = new THREE.ShaderMaterial({
    vertexShader: HOLO_VERTEX,
    fragmentShader: HOLO_FRAGMENT,
    uniforms: { uActive: A.active, uTime: b.uniforms.uTime },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 0.6, height, 32, 1, true).translate(0, height / 2 + 0.42, 0), material);
  cone.applyMatrix4(m);
  cone.renderOrder = 6;
  parent.add(cone);
  return { geometry: cone.geometry, material };
}

/* ——— Parabole : surface en paraboloïde, nervures, quadripode et cornet d'alimentation. Axe de visée : +Y local ——— */
function dish(base: Builder, parent: THREE.Object3D, R: number, depth: number, A?: ModuleAccents) {
  const b = base.fork();
  const group = new THREE.Group();
  const prof: Profile = [];
  const n = 14;
  for (let i = 0; i <= n; i++) { const r = (R * i) / n; prof.push([Math.max(0.01, r), depth * (r / R) ** 2]); }
  b.lathe(prof, b.M.dish, undefined, 64, 0, PI * 2, R * 0.9);
  // Dos de la parabole (légèrement en retrait) et bord
  b.lathe(prof.map(([r, y]) => [r, y - 0.12] as [number, number]), b.M.frame, undefined, 48);
  b.lathe([[R, depth - 0.2], [R + 0.25, depth - 0.1], [R + 0.25, depth + 0.1], [R, depth + 0.12]], b.M.chrome, undefined, 64);
  // Nervures au dos
  const ribs = Math.round(12 * (base.q === 'high' ? 1 : 0.67));
  for (let k = 0; k < ribs; k++) {
    const phi = (k / ribs) * PI * 2;
    const s = Math.sin(phi);
    const c = Math.cos(phi);
    for (let i = 1; i < 6; i++) {
      const r0 = (R * (i - 1)) / 5;
      const r1 = (R * i) / 5;
      b.beams.beam(V(s * r0, depth * (r0 / R) ** 2 - 0.35, c * r0), V(s * r1, depth * (r1 / R) ** 2 - 0.35, c * r1), 0.16 + 0.1 * (5 - i) / 5);
    }
  }
  // Moyeu, quadripode, cornet au foyer
  const f = (R * R) / (4 * depth);
  b.cyl(R * 0.16, R * 0.12, R * 0.22, b.M.hull, mat4(0, -R * 0.1, 0), 20);
  for (let k = 0; k < 4; k++) {
    const phi = (k / 4) * PI * 2 + PI / 4;
    b.beams.beam(V(Math.sin(phi) * R * 0.96, depth, Math.cos(phi) * R * 0.96), V(0, f - 0.3, 0), Math.max(0.12, R * 0.018));
  }
  b.cyl(R * 0.03, R * 0.08, R * 0.12, b.M.hull, mat4(0, f - 0.2, 0), 16);
  b.cyl(R * 0.085, R * 0.085, R * 0.05, b.M.dark, mat4(0, f + R * 0.06, 0), 16);
  if (A) b.lathe([[R * 0.09, f + R * 0.085], [R * 0.095, f + R * 0.085], [R * 0.095, f + R * 0.1], [R * 0.09, f + R * 0.1]], A.strip, undefined, 16);
  b.lights.add(0, f + R * 0.12, 0, PALETTE.orangeHot, Math.max(0.5, R * 0.08), 2, Math.random() * 6, 2.4);
  b.flush(group);
  parent.add(group);
  return group;
}

/* ——— Bras robotique (deux segments, poignet) ——— */
function robotArm(b: Builder, base: THREE.Vector3, elbow: THREE.Vector3, wrist: THREE.Vector3, tip: THREE.Vector3, r = 0.55) {
  const joint = (p: THREE.Vector3, s: number) => b.cyl(r * 1.45 * s, r * 1.45 * s, r * 2.4 * s, b.M.mid, mat4(p.x, p.y, p.z, PI / 2, 0, 0), 20);
  joint(base, 1.2);
  b.cyl(r * 1.8, r * 2.2, r * 1.6, b.M.hull, mat4(base.x, base.y - r * 0.8, base.z), 20);
  for (const [a, c] of [[base, elbow], [elbow, wrist]] as const) {
    const dir = c.clone().sub(a);
    const m = new THREE.Matrix4().compose(a.clone().add(c).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().normalize()), V(1, 1, 1));
    b.cyl(r, r, dir.length() - r * 2, b.M.white, m, 18);
    b.cyl(r * 1.08, r * 1.08, 0.5, b.M.paint, m.clone().multiply(mat4(0, dir.length() * 0.3, 0)), 18);
  }
  joint(elbow, 1);
  joint(wrist, 0.8);
  b.beams.beam(wrist, tip, r * 1.1);
  b.cyl(r * 0.9, r * 1.2, r * 0.8, b.M.dark, mat4(tip.x, tip.y, tip.z), 12);
}

const runtime = (id: ModuleId, accents: ModuleAccents, update: ModuleRuntime['update'], lights: THREE.PointLight[] = [], disposables: { dispose(): void }[] = []): ModuleRuntime => ({
  id, accents, update, lights, dispose: () => disposables.forEach((d) => d.dispose()),
});

/* ═════════════ SECURITY LAB — avant du noyau (+Z) ═════════════ */
export function buildSecurity(b: Builder, parent: THREE.Object3D): ModuleRuntime {
  const A = b.M.accents();
  const M = b.M;
  // Sas, corps nervuré, tambour de contrôle vitré, coupole d'extrémité
  b.lathe(moduleProfile(3.6, 6.4, { ribEvery: 1.8, collar: 2.8, endR: 3.1 }), M.hull, alongZ(16.6), 32);
  b.lathe(moduleProfile(6.5, 20, { ribEvery: 3.4 }), M.hull, alongZ(31), 56);
  const body = alongZ(31);
  for (const [phi0, len] of [[PI * 0.62, 0.9], [PI * 1.55, 0.7], [-0.25, 0.5]]) b.lathe([[6.68, -8.6], [6.68, 7.8]], M.foil, body, 28, phi0, len);
  for (const y of [-9.2, 8.6]) b.lathe([[6.72, y - 0.35], [6.72, y + 0.35]], M.paint, body, 48);
  // Filets lumineux le long du corps
  for (const phi of [PI * 0.75, PI * 1.25]) {
    for (let y = -8; y <= 7; y += 3) b.box(0.18, 1.8, 0.12, A.strip, body.clone().multiply(mat4(Math.sin(phi) * 6.72, y, Math.cos(phi) * 6.72, 0, phi, 0)), 0.04);
  }
  b.greebles(body, 6.5, -9, 9, 110);
  b.handrails(body, 6.5, -8.8, 8.8, [PI * 0.5 + 0.45, PI * 1.5 - 0.45, PI - 0.3]);

  // Tambour de contrôle : bandeau vitré tout autour, salle de surveillance à l'intérieur
  const drum = alongZ(48.8);
  b.lathe([[6.4, -6.6], [10.2, -4.7], [10.6, -4.3], [10.6, -1.9], [9.9, -1.9]], M.hull, drum, 72);
  b.lathe([[9.9, 1.9], [10.6, 1.9], [10.6, 4.3], [10.3, 4.7], [7.6, 6.4], [4.3, 6.7], [4.3, 7.5], [3.2, 7.5], [3.2, 8.4], [0.01, 8.4]], M.hull, drum, 72);
  b.lathe([[10.64, -3.3], [10.64, -3.05]], A.strip, drum, 72);
  b.lathe([[9.92, -1.9], [9.92, 1.9]], M.glass, drum, 72);
  const mull = Math.round(40 * (b.q === 'high' ? 1 : 0.6));
  for (let k = 0; k < mull; k++) {
    const phi = (k / mull) * PI * 2;
    b.beams.push(drum.clone().multiply(mat4(Math.sin(phi) * 10.05, 0, Math.cos(phi) * 10.05, 0, phi, 0, 0.28, 3.9, 0.3)));
  }
  // Intérieur : cloisons, pilier d'écrans tourné vers les vitres, pupitres
  for (const y of [-1.95, 1.95]) b.cyl(9.9, 9.9, 0.1, M.interior, drum.clone().multiply(mat4(0, y, 0)), 48);
  b.cyl(5.2, 5.2, 3.9, M.interior, drum, 36);
  const screens = 18;
  for (let k = 0; k < screens; k++) {
    const phi = (k / screens) * PI * 2;
    b.add(screenPlane(1.5, 1.2, k), A.screen, drum.clone().multiply(mat4(Math.sin(phi) * 5.25, k % 2 ? 0.75 : -0.6, Math.cos(phi) * 5.25, 0, phi, 0)));
    b.box(1.8, 0.5, 0.9, M.dark, drum.clone().multiply(mat4(Math.sin(phi) * 7.6, -1.6, Math.cos(phi) * 7.6, 0, phi, 0)), 0.12);
    b.add(screenPlane(0.9, 0.55, k + 3), A.screen, drum.clone().multiply(mat4(Math.sin(phi) * 8.1, -1.15, Math.cos(phi) * 8.1, -0.5, phi, 0)));
  }
  b.greebles(drum, 10.6, 2.2, 4.2, 60);
  b.greebles(drum, 10.6, -4.2, -2.2, 60);
  // Capteurs de surveillance sur les flancs (ils balaient l'espace)
  const sensors: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const mount = new THREE.Group();
    mount.position.set(side * 11.1, -1.5, 48.8);
    parent.add(mount);
    b.cyl(0.5, 0.7, 1.6, M.frame, mat4(side * 10.9, -1.5, 48.8, 0, 0, PI / 2), 12);
    const d = dish(b, mount, 1.9, 0.6, A);
    d.position.set(side * 0.9, 0, 0);
    d.rotation.set(0, 0, -side * PI / 2);
    sensors.push(mount);
  }
  const holo = emitter(b, parent, V(0, 10.6, 48.8), A);
  b.lights.add(0, 0, 57.4, PALETTE.orangeHot, 0.9, 1, 0.3, 4);
  b.lights.add(10.7, 3.8, 48.8, PALETTE.text, 0.6, 2, 1.1, 2.5);
  b.lights.add(-10.7, 3.8, 48.8, PALETTE.text, 0.6, 2, 2.2, 2.5);
  let sweep = 0;
  return runtime('security', A, (time, dt, active, _dwell, ambient) => {
    sweep += dt * (ambient ? 0.35 + active * 0.9 : 0);
    sensors.forEach((s, i) => { s.rotation.y = Math.sin(sweep + i * 1.7) * 0.9; s.rotation.x = Math.sin(sweep * 0.6 + i) * 0.25; });
  }, [], [holo.geometry, holo.material]);
}

/* ═════════════ NETWORK HUB — sur la poutre, côté droit (x = 44) ═════════════ */
export function buildNetwork(b: Builder, parent: THREE.Object3D, links: (from: THREE.Vector3, to: THREE.Vector3, A: ModuleAccents) => void): ModuleRuntime {
  const A = b.M.accents();
  const M = b.M;
  const X = 44;
  // Nœud sphérique nervuré
  const sphere: Profile = [];
  const R = 7.4;
  for (let i = 0; i <= 18; i++) {
    const lat = -PI / 2 + (i / 18) * PI;
    const r = Math.max(0.01, Math.cos(lat) * R);
    sphere.push([r, Math.sin(lat) * R]);
    if (i === 6 || i === 12) sphere.push([r + 0.25, Math.sin(lat) * R + 0.05], [r + 0.25, Math.sin(lat) * R + 0.45], [r, Math.sin(lat) * R + 0.5]);
  }
  b.lathe(sphere, M.hull, mat4(X, 0, 0), 56);
  b.lathe([[7.48, -1.4], [7.48, 1.4]], M.foil, mat4(X, 0, 0), 40, PI * 0.15, PI * 0.7);
  // Ports et routeurs (avant et arrière)
  for (const side of [-1, 1]) {
    const port = mat4(X, 0, side * 8.6, side * PI / 2);
    b.lathe(moduleProfile(3.1, 3, { ribEvery: 1.5, collar: 2.6, endR: 2.9 }), M.hull, port, 28);
    const box = mat4(X, 0, side * 14.2);
    b.box(6.2, 5, 7, M.mid, box, 0.5);
    for (const dx of [-1.6, 1.6]) b.add(rackPlane(2.8, 4.2, dx > 0 ? 0.3 : 0), M.rack, mat4(X + dx, 0, side * 17.72, 0, side > 0 ? 0 : PI, 0));
    b.box(6.5, 0.25, 0.25, A.strip, mat4(X, 2.7, side * 17.6), 0.05);
    for (let k = 0; k < 7; k++) b.bolts.box(X - 2.8 + k * 0.9, -2.7, side * 14.2, 0.5, 0.6, 6.8);
    b.greebles(mat4(X, 0, side * 14.2, 0, 0, PI / 2), 3.1, -3, 3, 26, -0.6, 0.6);
  }
  // Mât d'antennes vers le haut : petites paraboles, fouets, balise
  b.cyl(2.4, 2.8, 2.4, M.hull, mat4(X, 7.6, 0), 24);
  // (sous les rayons de l'anneau, qui passent à y = 25..29 en tournant)
  b.truss(V(X, 8.6, 0), V(X, 22, 0), 1.7, 1.9, 0.16);
  for (const [y, rot] of [[11.6, 0.3], [15.4, 2.4], [19.2, -1.2]] as const) {
    const arm = new THREE.Group();
    arm.position.set(X, y, 0);
    arm.rotation.y = rot;
    parent.add(arm);
    b.beams.beam(V(X, y, 0), V(X + Math.sin(rot) * 3.6, y, Math.cos(rot) * 3.6), 0.22);
    const d = dish(b, arm, 1.6, 0.5, A);
    d.position.set(0, 0, 3.8);
    d.rotation.x = PI / 2 - 0.3;
  }
  for (const [dx, dz, h] of [[0.8, 0.8, 2.4], [-0.8, 0.8, 1.6], [0.8, -0.8, 2], [-0.8, -0.8, 1.2]]) b.rails.beam(V(X + dx, 22, dz), V(X + dx, 22 + h, dz), 0.1);
  b.lights.add(X, 22.4, 0, PALETTE.orangeHot, 1.1, 1, 0.1, 5);
  b.lights.add(X + 0.8, 24.4, 0.8, PALETTE.text, 0.5, 2, 1.4, 2);
  // Mât inférieur : antenne log-périodique
  b.cyl(2.4, 2.8, 2.4, M.hull, mat4(X, -7.6, 0, PI), 24);
  b.truss(V(X, -8.6, 0), V(X, -25, 0), 1.4, 2, 0.14);
  for (let i = 0; i < 9; i++) {
    const y = -12 - i * 1.5;
    const w = 7 - i * 0.6;
    b.rails.beam(V(X - w / 2, y, 0.9), V(X + w / 2, y, 0.9), 0.1);
    b.rails.beam(V(X, y - 0.4, 0.9 - w / 2), V(X, y - 0.4, 0.9 + w / 2), 0.1);
  }
  b.lights.add(X, -25.4, 0, PALETTE.orangeHot, 0.9, 1, 0.9, 4);
  // Câbles vers le noyau, posés le long de la poutre
  for (const [z, y, sag] of [[2.6, -2.6, 1.6], [-2.6, -2.9, 2.1], [2.9, 2.4, 1.2]]) {
    b.tube([V(X - 7, y, z), V(X - 16, y - sag, z), V(X - 25, y - sag * 0.4, z), V(14.5, y, z)], 0.18, M.dark, 24);
  }
  b.tube([V(X - 3, -2, 10.7), V(X - 4, -4.5, 9), V(X - 6, -3.4, 3), V(X - 7.5, -2.2, 2.4)], 0.22, M.dark, 16);
  b.tube([V(X + 3, 2, -10.7), V(X + 4, 4.5, -9), V(X + 6, 3.4, -3), V(X + 7.5, 2.2, -2.4)], 0.22, M.dark, 16);
  // Faisceaux qui relient les antennes de la station
  // (tracés hors du moyeu et sous les rayons de l'anneau)
  links(V(X, 22.4, 0), V(116, 33.4, 6), A);
  links(V(X, 22.4, 0), V(0, 10.9, 48.8), A);
  links(V(X, -25.4, 0), V(16.6, -33, 1.5), A);
  links(V(116, 33.4, 6), V(0, 99.4, 0), A);
  links(V(X, 22.4, 0), V(0, 11.4, -40), A);
  links(V(0, 11.4, -40), V(-44, 10.4, 0), A);
  links(V(-44, -10.4, 0), V(-104, -3.4, -15.5), A);
  const holo = emitter(b, parent, V(X, 2.55, 14.2), A, 2.6);
  return runtime('network', A, () => {}, [], [holo.geometry, holo.material]);
}

/* ═════════════ TELECOMMUNICATIONS ARRAY — bout de poutre droit (x = 104) ═════════════ */
export function buildTelecom(b: Builder, parent: THREE.Object3D): ModuleRuntime {
  const A = b.M.accents();
  const M = b.M;
  const X = 104;
  b.box(24, 2.2, 19, M.mid, mat4(X, 4.6, 0), 0.4);
  b.box(24.4, 0.3, 0.3, A.strip, mat4(X, 5.7, 9.4), 0.05);
  b.box(24.4, 0.3, 0.3, A.strip, mat4(X, 5.7, -9.4), 0.05);
  for (let x = -11; x <= 11; x += 2.75) { b.rails.beam(V(X + x, 5.7, 9.5), V(X + x, 6.9, 9.5), 0.08); b.rails.beam(V(X + x, 5.7, -9.5), V(X + x, 6.9, -9.5), 0.08); }
  b.rails.beam(V(X - 12, 6.9, 9.5), V(X + 12, 6.9, 9.5), 0.08);
  b.rails.beam(V(X - 12, 6.9, -9.5), V(X + 12, 6.9, -9.5), 0.08);
  b.greebles(mat4(X, 4.6, 0, 0, 0, PI / 2), 1.1, -11, 11, 40, -PI / 2 - 0.4, -PI / 2 + 0.4);
  // Grande parabole sur fourche, qui suit lentement sa cible
  const az = new THREE.Group();
  az.position.set(X - 3, 5.8, 2.5);
  parent.add(az);
  const bigBase = b.fork();
  bigBase.cyl(1.6, 2.2, 3.4, M.hull, mat4(0, 1.7, 0), 24);
  bigBase.box(5.4, 1, 2.2, M.frame, mat4(0, 3.6, 0), 0.2);
  for (const s of [-1, 1]) bigBase.box(0.7, 4.4, 1.8, M.frame, mat4(s * 2.5, 5.6, 0), 0.2);
  bigBase.flush(az);
  const el = new THREE.Group();
  el.position.set(0, 8.4, 0);
  az.add(el);
  const big = dish(b, el, 10, 3.1, A);
  big.position.set(0, -1.2, 0);
  el.rotation.x = 0.95;
  // Paraboles moyennes
  const mids: THREE.Group[] = [];
  for (const [x, z, rx, ry] of [[X + 7.5, -7, 0.8, 2.6], [X - 9, -7, 0.6, -2.2]] as const) {
    b.cyl(0.9, 1.3, 3, M.hull, mat4(x, 7.2, z), 18);
    const g = new THREE.Group();
    g.position.set(x, 9.2, z);
    g.rotation.set(rx, ry, 0, 'YXZ');
    parent.add(g);
    dish(b, g, 4.4, 1.3, A);
    mids.push(g);
  }
  // Tour de transmission avec cornets et panneaux plats
  const TX = X + 12;
  const TZ = 6;
  b.truss(V(TX, 5.7, TZ), V(TX, 33, TZ), 2.2, 2.3, 0.18);
  for (const [y, rot] of [[30.5, 0], [30.5, PI / 2], [30.5, PI], [30.5, -PI / 2], [26, PI / 4], [26, -PI * 0.75]] as const) {
    b.cyl(0.25, 0.9, 2.2, M.chrome, new THREE.Matrix4().makeRotationY(rot).premultiply(new THREE.Matrix4().makeTranslation(TX, y, TZ)).multiply(mat4(0, 0, 2, PI / 2)), 12);
  }
  for (const [y, rot] of [[19, 0.4], [14, 2.4], [19, -2.2]] as const) {
    b.box(3.2, 4.2, 0.35, M.dark, new THREE.Matrix4().makeRotationY(rot).premultiply(new THREE.Matrix4().makeTranslation(TX, y, TZ)).multiply(mat4(0, 0, 1.6)), 0.1);
    b.add(screenPlane(2.6, 3.4, 2), A.screen, new THREE.Matrix4().makeRotationY(rot).premultiply(new THREE.Matrix4().makeTranslation(TX, y, TZ)).multiply(mat4(0, 0, 1.8)));
  }
  b.lights.add(TX, 33.4, TZ, PALETTE.orangeHot, 1.2, 1, 0.6, 5);
  b.lights.add(TX, 24, TZ + 1.2, PALETTE.text, 0.5, 2, 1, 2);
  const holo = emitter(b, parent, V(X + 2, 5.9, -6.5), A, 3.4);
  let t0 = 0;
  return runtime('telecom', A, (time, dt, active, dwell, ambient) => {
    if (ambient) t0 += dt;
    az.rotation.y = damp(az.rotation.y, 0.55 + Math.sin(t0 * 0.07) * 0.25 + active * (dwell - 0.5) * 0.4, 1.5, dt);
    el.rotation.x = damp(el.rotation.x, 0.95 + Math.sin(t0 * 0.05) * 0.12 - active * 0.15, 1.5, dt);
    mids.forEach((g, i) => { g.rotation.y += (ambient ? dt * 0.04 : 0) * (i ? -1 : 1); });
  }, [], [holo.geometry, holo.material]);
}

/* ═════════════ DATA CENTER — sous le noyau, salle hexagonale traversante ═════════════ */
export function buildDataCenter(b: Builder, parent: THREE.Object3D): ModuleRuntime {
  const A = b.M.accents();
  const M = b.M;
  const Y = -36;
  const Rh = 16;
  const ap = Rh * Math.cos(PI / 6); // apothème
  const H = 24;
  // Couvercles hexagonaux
  for (const [y, t] of [[Y + H / 2 + 0.6, 1.2], [Y - H / 2 - 0.6, 1.2]] as const) {
    const g = new THREE.CylinderGeometry(Rh + 0.6, Rh + 0.6, t, 6, 1, false, PI / 6);
    b.add(g, M.hull, mat4(0, y, 0));
  }
  b.cyl(5.2, 5.8, 1.6, M.hull, mat4(0, Y + H / 2 + 1.9, 0), 28);
  // Parois : les faces avant et arrière sont percées d'une grande ouverture
  const OW = 10.4;
  const OH = 9.6;
  const OY = Y - 0.6;
  for (let k = 0; k < 6; k++) {
    const th = (k / 6) * PI * 2;
    const wall = mat4(Math.sin(th) * ap, Y, Math.cos(th) * ap, 0, th, 0);
    if (k === 0 || k === 3) {
      const side = (Rh - OW) / 2;
      b.box(side, H, 1, M.mid, wall.clone().multiply(mat4(-(OW + side) / 2, 0, 0)), 0.15);
      b.box(side, H, 1, M.mid, wall.clone().multiply(mat4((OW + side) / 2, 0, 0)), 0.15);
      const top = H / 2 - (OY - Y) - OH / 2;
      const bottom = H / 2 + (OY - Y) - OH / 2;
      b.box(OW, top, 1, M.mid, wall.clone().multiply(mat4(0, H / 2 - top / 2, 0)), 0.15);
      b.box(OW, bottom, 1, M.mid, wall.clone().multiply(mat4(0, -H / 2 + bottom / 2, 0)), 0.15);
      // Cadre lumineux et bandes de danger
      b.box(OW + 0.6, 0.3, 0.3, A.strip, wall.clone().multiply(mat4(0, OY - Y + OH / 2 + 0.3, 0.62)), 0.05);
      b.box(OW + 0.6, 0.3, 0.3, A.strip, wall.clone().multiply(mat4(0, OY - Y - OH / 2 - 0.3, 0.62)), 0.05);
      for (const s of [-1, 1]) b.box(0.3, OH, 0.3, A.strip, wall.clone().multiply(mat4(s * (OW / 2 + 0.3), OY - Y, 0.62)), 0.05);
      b.box(OW + 2.4, 1.2, 0.5, M.paint, wall.clone().multiply(mat4(0, OY - Y + OH / 2 + 1.3, 0.55)), 0.1);
      // Tunnel d'entrée (épaisseur de la paroi)
      for (const s of [-1, 1]) b.box(0.4, OH + 0.4, 2.4, M.frame, wall.clone().multiply(mat4(s * (OW / 2 + 0.2), OY - Y, -0.2)), 0.08);
    } else {
      b.box(Rh, H, 1, M.mid, wall, 0.15);
      // Ailettes de refroidissement
      const fins = Math.round(14 * b.detail) + 4;
      for (let i = 0; i < fins; i++) b.plates.push(wall.clone().multiply(mat4(-Rh / 2 + 1.2 + (i * (Rh - 2.4)) / (fins - 1), 0, 1.4, 0, 0, 0, 0.18, H - 4, 1.8)));
      b.box(Rh - 1, 0.5, 0.5, A.strip, wall.clone().multiply(mat4(0, H / 2 - 1.2, 0.6)), 0.05);
    }
    b.greebles(new THREE.Matrix4().makeRotationY(th).premultiply(new THREE.Matrix4().makeTranslation(0, Y, 0)), ap + 0.5, -H / 2 + 1, -H / 2 + 3, 10, -0.4, 0.4);
  }
  // Intérieur : sol, plafond, deux rangées de baies face à l'allée centrale
  const FLOOR = Y - H / 2 + 1.6;
  b.box(26, 0.6, 26, M.floor, mat4(0, FLOOR - 0.3, 0), 0.05);
  b.box(26, 0.5, 26, M.interior, mat4(0, Y + H / 2 - 1.2, 0), 0.05);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const z = -9.1 + i * 2.6;
      b.box(2.6, 11.4, 2.4, M.dark, mat4(s * 5.4, FLOOR + 5.7, z), 0.08);
      b.add(rackPlane(2.2, 11, i * 0.37), M.rack, mat4(s * 4.09, FLOOR + 5.7, z, 0, -s * PI / 2, 0));
    }
    b.box(1.2, 0.6, 22, M.frame, mat4(s * 5.4, FLOOR + 12, 0), 0.1);
    for (let i = 0; i < 6; i++) b.tube([V(s * 5.4, FLOOR + 12.3, -8 + i * 3.2), V(s * 5.8, FLOOR + 15, -8 + i * 3.2 + 0.4), V(s * 6, Y + H / 2 - 1.5, -8 + i * 3.2)], 0.15, M.dark, 8);
    // Conduites de refroidissement le long des parois
    for (let i = 0; i < 3; i++) b.cyl(0.35, 0.35, H - 3, M.chrome, mat4(s * (9.5 + i * 0.9), Y, -6 + i * 4), 10);
    b.box(0.25, 0.08, 22, A.strip, mat4(s * 3.6, FLOOR + 0.05, 0), 0.02);
  }
  for (const x of [-2.2, 2.2]) b.box(0.8, 0.2, 22, M.lamp, mat4(x, Y + H / 2 - 1.55, 0), 0.05);
  b.add(screenPlane(8, 3.2, 1), A.screen, mat4(0, Y + 7, -ap + 1.5));
  // Portes coulissantes avant et arrière (elles s'ouvrent quand la caméra arrive)
  const doors: { mesh: THREE.Group; side: number }[] = [];
  for (const k of [0, 3]) {
    const th = (k / 6) * PI * 2;
    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      const leaf = b.fork();
      leaf.box(OW / 2 + 0.2, OH + 0.4, 0.45, M.hull, mat4(0, 0, 0), 0.08);
      leaf.box(0.2, OH, 0.1, A.strip, mat4(-side * (OW / 4 - 0.1), 0, 0.26), 0.03);
      leaf.box(OW / 2, 0.8, 0.12, M.paint, mat4(0, OH / 2 - 0.8, 0.26), 0.05);
      leaf.flush(g);
      g.position.set(Math.sin(th) * (ap + 0.85), OY, Math.cos(th) * (ap + 0.85));
      g.rotation.y = th;
      g.userData.th = th;
      parent.add(g);
      doors.push({ mesh: g, side });
    }
  }
  const light = new THREE.PointLight(0xffb070, 0, 46, 1.6);
  light.position.set(0, Y + 4, 0);
  parent.add(light);
  for (const [x, z] of [[Rh + 0.6, 0], [-Rh - 0.6, 0]]) b.lights.add(x, Y + H / 2 + 1, z, PALETTE.orangeHot, 1, 1, x * 0.1, 4);
  const holo = emitter(b, parent, V(0, Y + H / 2 + 1.2, ap - 1.6), A, 3.2);
  let open = 0.15;
  return runtime('datacenter', A, (time, dt, active) => {
    open = damp(open, 0.12 + 0.88 * smooth(0.05, 0.55, active), 2.2, dt);
    for (const { mesh, side } of doors) {
      const th = mesh.userData.th as number;
      const off = side * (OW / 4 + 0.1 + open * (OW / 2 + 0.4));
      mesh.position.set(Math.sin(th) * (ap + 0.85) + Math.cos(th) * off, OY, Math.cos(th) * (ap + 0.85) - Math.sin(th) * off);
    }
    light.intensity = 115 * (0.35 + 0.65 * active);
  }, [light], [holo.geometry, holo.material]);
}

/* ═════════════ TECHNICAL ARCHIVE — bas de l'axe, carrousel de casiers ═════════════ */
export function buildArchive(b: Builder, parent: THREE.Object3D, count: number): ModuleRuntime {
  const A = b.M.accents();
  const M = b.M;
  const Y = -71;
  // Axe central et paliers fixes
  b.lathe(moduleProfile(3, 30, { ribEvery: 2.4, collar: 2.2, endR: 2.6 }), M.hull, mat4(0, Y + 1, 0), 32);
  for (const y of [Y + 13.4, Y - 13.4]) b.cyl(5.4, 5.4, 1.4, M.frame, mat4(0, y, 0), 32);
  b.truss(V(0, -50, 0), V(0, -56.5, 0), 7, 3.2, 0.3);
  b.truss(V(0, Y - 14.4, 0), V(0, -98, 0), 1.8, 2.2, 0.16);
  b.lights.add(0, -98.4, 0, PALETTE.orangeHot, 1.2, 1, 1.7, 5);
  // Carrousel qui tourne : anneaux, montants, casiers
  const carousel = new THREE.Group();
  carousel.position.y = Y;
  parent.add(carousel);
  const c = b.fork();
  for (const y of [12.6, -12.6]) {
    c.lathe([[12.4, y - 0.7], [14.2, y - 0.7], [14.2, y + 0.7], [12.4, y + 0.7], [12.4, y - 0.7]], M.mid, undefined, 72);
    for (let k = 0; k < 6; k++) { const phi = (k / 6) * PI * 2 + PI / 12; c.beams.beam(V(Math.sin(phi) * 5.4, y, Math.cos(phi) * 5.4), V(Math.sin(phi) * 12.4, y, Math.cos(phi) * 12.4), 0.55); }
  }
  const COLS = 12;
  const featured: THREE.Group[] = [];
  for (let k = 0; k < COLS; k++) {
    const phi = (k / COLS) * PI * 2;
    const s = Math.sin(phi);
    const co = Math.cos(phi);
    c.beams.beam(V(s * 13.3, -12, co * 13.3), V(s * 13.3, 12, co * 13.3), 0.45);
    for (let l = 0; l < 4; l++) {
      const y = -7.5 + l * 5;
      if (l === 1 && k < count) {
        // Casier d'un outil : il sort du carrousel quand l'outil est mis en avant
        const g = new THREE.Group();
        const pod = b.fork();
        pod.box(2.4, 4.2, 3.4, M.mid, mat4(0, 0, 0), 0.25);
        pod.box(2.5, 0.35, 0.2, A.strip, mat4(0, 1.6, 1.72), 0.04);
        pod.box(1.6, 0.6, 0.1, M.paint, mat4(0, -1.4, 1.72), 0.04);
        pod.lights.add(0.9, 1.6, 1.8, PALETTE.orangeHot, 0.35, 2, k, 3);
        pod.flush(g);
        g.position.set(s * 11, y, co * 11);
        g.rotation.y = phi;
        g.userData.phi = phi;
        carousel.add(g);
        featured.push(g);
        continue;
      }
      const m = mat4(s * 11, y, co * 11, 0, phi, 0);
      c.box(2.4, 4.2, 3.4, M.mid, m, 0.25);
      c.box(1.6, 0.6, 0.1, (k + l) % 3 ? M.paint : M.dark, m.clone().multiply(mat4(0, -1.4, 1.72)), 0.04);
      if ((k * 7 + l) % 3 === 0) c.lights.add(s * 12.8, y + 1.6, co * 12.8, PALETTE.orangeHot, 0.3, 2, k + l, 2);
    }
  }
  c.flush(carousel);
  b.lathe([[14.25, -0.1], [14.25, 0.1]], A.strip, mat4(0, Y + 12.6, 0), 72);
  b.lathe([[14.25, -0.1], [14.25, 0.1]], A.strip, mat4(0, Y - 12.6, 0), 72);
  // Bras de manutention fixé à l'axe
  robotArm(b, V(-4.2, Y + 15.4, -2), V(-9, Y + 19, -8), V(-13.6, Y + 16.4, -12), V(-14.6, Y + 14.2, -12.6), 0.6);
  const holo = emitter(b, parent, V(0, Y + 14.1, -4), A, 3);
  // Le casier de l'outil en avant vient face à la caméra (côté arrière gauche de la station)
  const facing = Math.atan2(-30, -56);
  let rot = 0;
  let spin = 0;
  return runtime('archive', A, (time, dt, active, dwell, ambient) => {
    const focus = Math.min(count - 1, Math.floor(dwell * count * 0.999));
    if (ambient) spin += dt * 0.025;
    const target = active > 0.02 ? facing - (focus / COLS) * PI * 2 : spin;
    let delta = target - rot;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    rot += delta * (1 - Math.exp(-dt * 2.4 * Math.max(0.15, active)));
    carousel.rotation.y = rot;
    featured.forEach((g, i) => {
      const out = i === focus ? active : 0;
      g.userData.out = damp(g.userData.out ?? 0, out, 3, dt);
      const r = 11 + g.userData.out * 3.4;
      const phi = g.userData.phi as number;
      g.position.x = Math.sin(phi) * r;
      g.position.z = Math.cos(phi) * r;
    });
  }, [], [holo.geometry, holo.material]);
}

/* ═════════════ VIRTUALIZATION MODULE — cage de capsules identiques (x = -44) ═════════════ */
export function buildVirtualization(b: Builder, parent: THREE.Object3D): ModuleRuntime {
  const A = b.M.accents();
  const M = b.M;
  const X = -44;
  const W = 21;
  const Hc = 17;
  const D = 21;
  // Cage : arêtes, montants intermédiaires, nœuds
  const corners = [-1, 1];
  for (const sy of corners) for (const sz of corners) b.beams.beam(V(X - W / 2, sy * Hc / 2, sz * D / 2), V(X + W / 2, sy * Hc / 2, sz * D / 2), 0.7);
  for (const sx of corners) for (const sz of corners) b.beams.beam(V(X + sx * W / 2, -Hc / 2, sz * D / 2), V(X + sx * W / 2, Hc / 2, sz * D / 2), 0.7);
  for (const sx of corners) for (const sy of corners) b.beams.beam(V(X + sx * W / 2, sy * Hc / 2, -D / 2), V(X + sx * W / 2, sy * Hc / 2, D / 2), 0.7);
  for (const sx of corners) for (const sy of corners) for (const sz of corners) b.box(1.5, 1.5, 1.5, M.hull, mat4(X + sx * W / 2, sy * Hc / 2, sz * D / 2), 0.2);
  for (const sz of corners) for (const x of [-3.2, 3.2]) b.beams.beam(V(X + x, -Hc / 2, sz * D / 2), V(X + x, Hc / 2, sz * D / 2), 0.35);
  // Cœur de l'hyperviseur, traversé par la poutre
  b.box(7, 6, 6, M.hull, mat4(X, 0, 0), 0.5);
  for (const y of [-1.5, 0, 1.5]) b.box(7.1, 0.16, 6.1, A.strip, mat4(X, y, 0), 0.04);
  // Capsules : machines virtuelles (fenêtre = console, voyant d'état)
  const pods: { mat: THREE.MeshStandardMaterial; phase: number }[] = [];
  const podMats: THREE.Material[] = [];
  let i = 0;
  for (const y of [-4.6, 4.6]) {
    for (const x of [-6.6, 0, 6.6]) {
      for (const sz of [-1, 1]) {
        const z = sz * 6.4;
        const m = mat4(X + x, y, z);
        b.box(5.2, 3.9, 5.4, M.mid, m, 0.45);
        const mat = A.screen.clone();
        mat.onBeforeCompile = A.screen.onBeforeCompile;
        mat.customProgramCacheKey = A.screen.customProgramCacheKey;
        mat.emissiveIntensity = 0.2;
        podMats.push(mat);
        b.add(screenPlane(3.6, 2.2, (i * 3) % 8), mat, m.clone().multiply(mat4(0, 0.2, sz * 2.74, 0, sz > 0 ? 0 : PI, 0)));
        b.box(3.9, 0.18, 0.1, A.strip, m.clone().multiply(mat4(0, -1.4, sz * 2.73)), 0.03);
        b.lights.add(X + x + 2.2, y + 1.6, z + sz * 2.8, PALETTE.orangeHot, 0.3, 2, i, 2.5);
        pods.push({ mat, phase: i });
        i++;
      }
    }
  }
  // Liaisons lumineuses entre capsules voisines
  for (const y of [-4.6, 4.6]) for (const sz of [-1, 1]) b.cyl(0.12, 0.12, 13.2, A.strip, mat4(X, y - 1.1, sz * 6.4 + sz * 2.8, 0, 0, PI / 2), 6);
  for (const x of [-6.6, 0, 6.6]) for (const sz of [-1, 1]) b.cyl(0.12, 0.12, 9.2, A.strip, mat4(X + x + 2, 0, sz * 6.4 + sz * 2.8), 6);
  // Mât supérieur (point d'arrivée d'un faisceau)
  b.truss(V(X, Hc / 2, 0), V(X, 10.2, 0), 1, 0.9, 0.12);
  b.lights.add(X, 10.4, 0, PALETTE.orangeHot, 0.9, 1, 2.6, 4);
  b.truss(V(X, -Hc / 2, 0), V(X, -10.2, 0), 1, 0.9, 0.12);
  b.lights.add(X, -10.4, 0, PALETTE.orangeHot, 0.8, 1, 1.3, 4);
  const holo = emitter(b, parent, V(X, Hc / 2 + 0.35, -D / 2), A, 2.8);
  return runtime('virtualization', A, (time, dt, active) => {
    // Les machines démarrent l'une après l'autre quand la caméra arrive ; au repos, quelques-unes tournent
    pods.forEach(({ mat, phase }) => {
      const boot = smooth(phase / pods.length, phase / pods.length + 0.25, active * 1.25);
      const idle = 0.25 + 0.25 * Math.max(0, Math.sin(time * 0.3 + phase * 2.1));
      mat.emissiveIntensity = damp(mat.emissiveIntensity, Math.max(idle, boot * 1.7), 4, dt);
    });
  }, [], [holo.geometry, holo.material, ...podMats]);
}

/* ═════════════ DEVELOPMENT LAB — arrière du noyau (-Z), baie vitrée sur les postes ═════════════ */
export function buildDevelopment(b: Builder, parent: THREE.Object3D): ModuleRuntime {
  const A = b.M.accents();
  const M = b.M;
  b.lathe(moduleProfile(3.6, 6.4, { ribEvery: 1.8, collar: 2.8, endR: 3.1 }), M.hull, alongNegZ(16.6), 32);
  // Corps : fermé côté noyau, ouvert à l'autre bout sur une baie vitrée
  const R = 7.2;
  const L = 30;
  const body = alongNegZ(36);
  const p: Profile = [[0.01, -L / 2 - 1.2], [3, -L / 2 - 1.2], [3, -L / 2 - 0.4], [3.6, -L / 2 - 0.4], [3.6, -L / 2], [5.4, -L / 2], [R, -L / 2 + 2]];
  for (let y = -L / 2 + 2.6; y < L / 2 - 2; y += 3.4) p.push([R, y - 0.28], [R + 0.14, y - 0.18], [R + 0.14, y + 0.18], [R, y + 0.28]);
  p.push([R, L / 2 - 1.4], [R + 0.6, L / 2 - 1], [R + 0.6, L / 2 + 0.6], [R - 0.9, L / 2 + 0.6], [R - 0.9, L / 2]);
  b.lathe(p, M.hull, body, 60);
  // Intérieur visible par la baie : doublure, cloison du fond, postes de travail
  b.lathe([[R - 0.95, L / 2], [R - 0.95, L / 2 - 13]], M.interior, body, 48);
  b.cyl(R - 0.9, R - 0.9, 0.2, M.interior, body.clone().multiply(mat4(0, L / 2 - 13, 0)), 40);
  b.box(12, 0.3, 12, M.floor, mat4(0, -3.6, -(36 + L / 2 - 6.5)), 0.05);
  for (const [x, zOff, k] of [[-3.4, 9.6, 0], [0, 9.6, 1], [3.4, 9.6, 3], [-2, 5.6, 2], [2, 5.6, 0]] as const) {
    const z = -(36 + L / 2 - 13) - (13 - zOff);
    b.box(2.8, 0.18, 1.4, M.dark, mat4(x, -2.4, z), 0.05);
    b.box(0.2, 1.1, 0.2, M.frame, mat4(x, -3, z), 0.03);
    b.add(screenPlane(1.5, 0.95, k), A.screen, mat4(x - 0.6, -1.5, z + 0.5, 0, PI, 0));
    b.add(screenPlane(1.5, 0.95, (k + 2) % 8), A.screen, mat4(x + 0.6, -1.5, z + 0.5, 0, PI, 0));
  }
  b.add(screenPlane(9, 4.2, 4), A.screen, mat4(0, 1.6, -(36 + L / 2 - 13) - 0.12, 0, PI, 0));
  b.box(5, 0.18, 0.4, M.lamp, mat4(0, 5.1, -(36 + L / 2 - 4)), 0.04);
  b.add(new THREE.CircleGeometry(R - 0.85, 48), M.glass, mat4(0, 0, -(36 + L / 2 + 0.3), 0, PI, 0));
  for (let k = 0; k < 6; k++) b.beams.push(mat4(0, 0, -(36 + L / 2 + 0.35), 0, 0, (k / 6) * PI, 0.22, 2 * (R - 0.9), 0.22));
  // Hublots éclairés sur les flancs, isolant, rambardes
  for (const phi of [PI / 2, -PI / 2]) b.lathe([[R + 0.16, -11], [R + 0.16, 9.6]], A.window, body, 12, phi - 0.18, 0.36, 1.6, 21);
  for (const [phi0, len] of [[PI * 0.85, 0.5], [-PI * 0.25, 0.5]]) b.lathe([[R + 0.17, -12], [R + 0.17, 10]], M.foil, body, 20, phi0, len);
  b.greebles(body, R, -12, 11, 120);
  b.handrails(body, R, -12, 11, [0.4, -0.4, PI - 0.5]);
  robotArm(b, V(1.5, R + 0.4, -24), V(7, R + 7, -31), V(9.5, R + 3.4, -41), V(9.6, R + 1.2, -42.6), 0.55);
  // Navette amarrée sous le module
  b.lathe(moduleProfile(1.6, 7, { ribEvery: 1.6, collar: 1.1, endR: 1.2 }), M.mid, mat4(0, -R - 2.4, -40, 0, 0, PI / 2), 24);
  b.box(2, 0.3, 4, M.hull, mat4(0, -R - 2.4, -40), 0.1);
  b.lights.add(0, -R - 2.4, -44.6, PALETTE.orangeHot, 0.5, 1, 2, 3);
  const light = new THREE.PointLight(0xffa860, 0, 24, 1.6);
  light.position.set(0, 1.5, -(36 + L / 2 - 5));
  parent.add(light);
  const holo = emitter(b, parent, V(0, R + 0.4, -40), A, 2.8);
  return runtime('development', A, (time, dt, active) => {
    light.intensity = 40 * (0.4 + 0.6 * active);
  }, [light], [holo.geometry, holo.material]);
}

/* ═════════════ GAME DEV HANGAR — bout de poutre gauche (x = -104) ═════════════ */
export function buildGameDev(b: Builder, parent: THREE.Object3D): ModuleRuntime {
  const A = b.M.accents();
  const M = b.M;
  const X = -104;
  const Y = -15;
  const W = 30;
  const H = 18;
  const Z0 = -19; // façade (porte), côté -Z
  const Z1 = 13;
  const D = Z1 - Z0;
  const ZC = (Z0 + Z1) / 2;
  b.box(W, 1, D, M.mid, mat4(X, Y + H / 2 - 0.5, ZC), 0.3);
  b.box(W, 1, D, M.mid, mat4(X, Y - H / 2 + 0.5, ZC), 0.3);
  for (const s of [-1, 1]) b.box(1, H, D, M.mid, mat4(X + s * (W / 2 - 0.5), Y, ZC), 0.3);
  b.box(W, H, 1, M.mid, mat4(X, Y, Z1 - 0.5), 0.3);
  // Façade : grande ouverture
  const OW = 22;
  const OH = 12;
  b.box(W, H / 2 - OH / 2, 1.4, M.hull, mat4(X, Y + OH / 2 + (H / 2 - OH / 2) / 2, Z0 + 0.7), 0.2);
  b.box(W, H / 2 - OH / 2, 1.4, M.hull, mat4(X, Y - OH / 2 - (H / 2 - OH / 2) / 2, Z0 + 0.7), 0.2);
  for (const s of [-1, 1]) b.box((W - OW) / 2, OH, 1.4, M.hull, mat4(X + s * (OW / 2 + (W - OW) / 4), Y, Z0 + 0.7), 0.2);
  b.box(OW + 1.2, 0.2, 0.2, A.strip, mat4(X, Y + OH / 2 + 0.3, Z0 - 0.1), 0.04);
  b.box(OW + 1.2, 0.2, 0.2, A.strip, mat4(X, Y - OH / 2 - 0.3, Z0 - 0.1), 0.04);
  b.box(OW + 4, 1.1, 0.5, M.paint, mat4(X, Y + OH / 2 + 1.5, Z0 - 0.1), 0.1);
  // Nervures extérieures et liaison avec la poutre
  for (let z = Z0 + 3; z < Z1; z += 4) for (const s of [-1, 1]) b.beams.beam(V(X + s * (W / 2 + 0.3), Y - H / 2, z), V(X + s * (W / 2 + 0.3), Y + H / 2, z), 0.5);
  for (let x = -12; x <= 12; x += 6) b.beams.beam(V(X + x, Y + H / 2, -3), V(X + x * 0.4, -3.6, 0), 0.5);
  for (let x = -12; x <= 12; x += 6) b.beams.beam(V(X + x, Y + H / 2, 6), V(X + x * 0.4, -3.6, 0), 0.4);
  b.greebles(mat4(X, Y, ZC, PI / 2), W / 2, -D / 2 + 1, D / 2 - 1, 50, PI / 2 - 0.5, PI / 2 + 0.5);
  b.greebles(mat4(X, Y, ZC, PI / 2), W / 2, -D / 2 + 1, D / 2 - 1, 50, -PI / 2 - 0.5, -PI / 2 + 0.5);
  // Intérieur : pont, marquages, postes de création, portique
  const FLOOR = Y - H / 2 + 1;
  b.box(W - 2.2, 0.3, D - 2, M.floor, mat4(X, FLOOR + 0.15, ZC + 0.5), 0.05);
  b.lathe([[5.6, 0], [6, 0]], A.strip, mat4(X, FLOOR + 0.32, -1, PI), 64);
  b.lathe([[6.2, 0], [7.4, 0]], M.paint, mat4(X, FLOOR + 0.31, -1, PI), 64);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const z = Z0 + 6 + i * 5.2;
      const x = X + s * (W / 2 - 3);
      b.box(1.6, 1, 3.6, M.dark, mat4(x, FLOOR + 1.1, z), 0.1);
      b.add(screenPlane(2.6, 1.6, (i + (s > 0 ? 2 : 0)) % 8), A.screen, mat4(x + s * 0.4, FLOOR + 2.6, z, 0, -s * PI / 2, 0));
    }
    b.beams.beam(V(X + s * 8, Y + H / 2 - 1.6, Z0 + 2), V(X + s * 8, Y + H / 2 - 1.6, Z1 - 2), 0.6);
  }
  b.box(17, 0.9, 1.3, M.paint, mat4(X, Y + H / 2 - 2.4, 1), 0.1);
  b.tube([V(X - 2, Y + H / 2 - 2.9, 1), V(X - 1.8, Y + 1, 1.4), V(X - 1.5, Y - 1, 1)], 0.08, M.chrome, 8);
  for (const x of [-9, 0, 9]) b.box(0.6, 0.2, D - 6, M.lamp, mat4(X + x, Y + H / 2 - 1.1, ZC), 0.04);
  // Table holographique
  b.cyl(1.4, 1.8, 1.1, M.dark, mat4(X + 8, FLOOR + 0.85, 7), 24);
  const table = emitter(b, parent, V(X + 8, FLOOR + 1.1, 7), A, 3);
  // Vaisseau prototype (AETHER-01, le vaisseau de mon jeu EVENT HORIZON)
  const ship = new ShipModel(false);
  const shipLights: THREE.Object3D[] = [];
  ship.group.traverse((o) => { if ((o as THREE.PointLight).isPointLight) shipLights.push(o); });
  shipLights.forEach((o) => o.parent?.remove(o));
  ship.update(0.016, 0, 0, 0, 0, 0);
  ship.group.scale.setScalar(0.19);
  ship.group.position.set(X, FLOOR + 3.4, -1);
  ship.group.rotation.y = -0.7;
  ship.group.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh) { mesh.castShadow = b.shadows; mesh.receiveShadow = b.shadows; } });
  parent.add(ship.group);
  for (const [dx, dz] of [[-2.6, -4], [2.6, -4], [0, 5.5]]) b.cyl(0.35, 0.6, 2.6, M.frame, mat4(X + dx, FLOOR + 1.6, -1 + dz), 10);
  // Portes coulissantes de la façade
  const doors: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    const leaf = b.fork();
    leaf.box(OW / 2 + 0.3, OH + 0.6, 0.6, M.hull, mat4(0, 0, 0), 0.1);
    for (let y = -OH / 2 + 1; y < OH / 2; y += 2.2) leaf.box(OW / 2 - 0.6, 0.12, 0.2, M.dark, mat4(0, y, -0.36), 0.02);
    leaf.box(0.25, OH - 1, 0.12, A.strip, mat4(s * -(OW / 4 - 0.2), 0, -0.36), 0.03);
    leaf.flush(g);
    g.position.set(X + s * (OW / 4 + 0.15), Y, Z0 - 0.8);
    parent.add(g);
    doors.push(g);
  }
  b.beams.beam(V(X - W / 2 - 12, Y + OH / 2 + 0.5, Z0 - 0.8), V(X + W / 2 + 12, Y + OH / 2 + 0.5, Z0 - 0.8), 0.45);
  const light = new THREE.PointLight(0xffa860, 0, 40, 1.5);
  light.position.set(X, Y + 3, -1);
  parent.add(light);
  for (const s of [-1, 1]) b.lights.add(X + s * (W / 2 + 0.2), Y + H / 2 + 0.2, Z0 - 0.2, PALETTE.orangeHot, 1, 1, s, 4);
  const holo = emitter(b, parent, V(X, Y + H / 2 + 0.05, Z0 + 3.5), A, 3);
  let open = 0.32;
  return runtime('gamedev', A, (time, dt, active, _dwell, ambient) => {
    open = damp(open, 0.32 + 0.68 * smooth(0.05, 0.6, active), 1.8, dt);
    doors.forEach((g, i) => { const s = i ? 1 : -1; g.position.x = X + s * (OW / 4 + 0.15 + open * (OW / 2 + 0.6)); });
    light.intensity = 55 * (0.45 + 0.55 * active);
    if (ambient) ship.update(dt, time, 0, 0, 0, 0);
  }, [light], [table.geometry, table.material, holo.geometry, holo.material, ship]);
}

/* ═════════════ ENGINEERING MODULE — sommet de l'axe : réacteur, atelier matériel et systèmes ═════════════ */
export function buildEngineering(b: Builder, parent: THREE.Object3D): ModuleRuntime {
  const A = b.M.accents();
  const M = b.M;
  // Réacteur : cœur lumineux entre des ailettes de dissipation
  b.lathe([[0.01, 45.2], [6.2, 45.2], [11.4, 46], [11.4, 47], [5.2, 47]], M.hull, undefined, 64);
  b.lathe([[5.2, 57], [11.4, 57], [11.4, 58], [6.2, 58.8], [0.01, 58.8]], M.hull, undefined, 64);
  b.cyl(4.3, 4.3, 10, b.M.core, mat4(0, 52, 0), 40);
  const fins = Math.round(44 * (b.q === 'high' ? 1 : 0.6));
  for (let k = 0; k < fins; k++) {
    const phi = (k / fins) * PI * 2;
    b.plates.push(mat4(Math.sin(phi) * 7.9, 52, Math.cos(phi) * 7.9, 0, phi, 0, 0.22, 9.8, 6.6));
  }
  for (let k = 0; k < 8; k++) { const phi = (k / 8) * PI * 2 + 0.2; b.beams.beam(V(Math.sin(phi) * 11, 47, Math.cos(phi) * 11), V(Math.sin(phi) * 11, 57, Math.cos(phi) * 11), 0.45); }
  b.lathe([[11.45, -0.2], [11.45, 0.2]], A.strip, mat4(0, 46.5, 0), 64);
  b.lathe([[11.45, -0.2], [11.45, 0.2]], A.strip, mat4(0, 57.5, 0), 64);
  // Pont de l'atelier, poteaux, toit
  b.box(24, 1.6, 24, M.mid, mat4(0, 59.6, 0), 0.4);
  b.box(24.2, 0.25, 0.25, A.strip, mat4(0, 60.5, 12.05), 0.04);
  b.box(24.2, 0.25, 0.25, A.strip, mat4(0, 60.5, -12.05), 0.04);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.beams.beam(V(sx * 11, 60.4, sz * 11), V(sx * 11, 72, sz * 11), 0.8);
  b.box(24, 1.2, 24, M.hull, mat4(0, 72.6, 0), 0.4);
  for (let x = -10; x <= 10; x += 2.5) b.rails.beam(V(x, 60.4, -11.6), V(x, 61.6, -11.6), 0.08);
  b.rails.beam(V(-11, 61.6, -11.6), V(11, 61.6, -11.6), 0.08);
  b.lights.add(0, 72, 0, PALETTE.text, 0.4, 0);
  for (const x of [-6, 0, 6]) b.box(0.5, 0.15, 20, M.lamp, mat4(x, 71.9, 0), 0.03);
  // Carte mère géante (matériel) tournée vers l'arrière de la station
  b.box(13, 9.4, 0.6, M.frame, mat4(0, 66, -8.6), 0.1);
  b.add(new THREE.PlaneGeometry(12.4, 8.8), M.pcb, mat4(0, 66, -8.94, 0, PI, 0));
  // Terminaux des systèmes d'exploitation, côté gauche
  for (const [z, k] of [[-3.5, 0], [0, 3], [3.5, 1]] as const) {
    b.box(0.5, 2.6, 3.2, M.dark, mat4(-9.4, 63.6, z), 0.06);
    b.add(screenPlane(2.9, 2.2, k), A.screen, mat4(-9.7, 63.7, z, 0, -PI / 2, 0));
  }
  b.box(3, 1, 1.6, M.dark, mat4(-7.6, 61.1, 0), 0.08);
  // Établi avec une petite carte (Raspberry Pi) et la radio logicielle
  b.box(6, 1, 2.6, M.frame, mat4(5.5, 61, -4), 0.1);
  b.add(new THREE.PlaneGeometry(1.7, 1.1), M.pcb, mat4(4.6, 61.52, -4, -PI / 2, 0, 0));
  b.box(1.2, 0.4, 0.7, M.white, mat4(6.8, 61.7, -4.2), 0.08);
  robotArm(b, V(7, 61.2, 6), V(4, 66.5, 2.5), V(2.2, 64.5, -1.5), V(2.1, 62.6, -2), 0.5);
  // Radiateurs latéraux et mât d'antenne supérieur
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) b.box(7.4, 0.3, 10, M.white, mat4(s * (16.2 + i * 7.8), 72.6, 0), 0.1);
    b.beams.beam(V(s * 12, 72.6, 0), V(s * 39.6, 72.6, 0), 0.5);
  }
  b.cyl(2, 2.6, 2.2, M.hull, mat4(0, 74.3, 0), 24);
  b.truss(V(0, 75.3, 0), V(0, 99, 0), 1.2, 1.6, 0.12);
  b.lights.add(0, 99.4, 0, PALETTE.orangeHot, 1.3, 1, 0.4, 5);
  b.lights.add(39.6, 72.6, 0, PALETTE.orangeHot, 0.8, 1, 1.2, 4);
  b.lights.add(-39.6, 72.6, 0, PALETTE.orangeHot, 0.8, 1, 2.1, 4);
  const holo = emitter(b, parent, V(-5, 73.2, -6), A, 3.4);
  return runtime('engineering', A, () => {}, [], [holo.geometry, holo.material]);
}
