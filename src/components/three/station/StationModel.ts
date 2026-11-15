import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ModuleId } from '@/components/station/layout';
import { moduleById } from '@/components/station/scrollTimeline';
import { Builder, createSharedGeometry } from './builder';
import { PALETTE, makeRng, mat4, moduleProfile, type Profile, type Quality, type StationUniforms } from './kit';
import { createMaterials, type ModuleAccents } from './materials';
import { placeIndustrial, type IndustrialKit } from './IndustrialModules';
import {
  buildArchive, buildDataCenter, buildDevelopment, buildEngineering, buildGameDev, buildNetwork,
  buildSecurity, buildTelecom, buildVirtualization, type ModuleRuntime,
} from './StationModules';

/* ───────────────────────────────────────────────────────────────
   StationModel : la structure qui relie tout.
   - noyau central (moyeu nervuré, hublots, isolant) ;
   - anneau habité de 128 m de diamètre, relié au moyeu par quatre rayons (il tourne lentement) ;
   - poutre principale en treillis de 410 m le long de X : modules, radiateurs, ailes solaires ;
   - axe vertical : ingénierie au sommet, data center et archives en dessous ;
   - faisceaux lumineux entre les antennes (réseau de la station).
   Les modules sont construits un par un (await step()) pour ne pas figer la page.
   ─────────────────────────────────────────────────────────────── */

export interface Station {
  group: THREE.Group;
  modules: ModuleRuntime[];
  lights: THREE.PointLight[];
  update(time: number, dt: number, active: Partial<Record<ModuleId, number>>, dwell: Partial<Record<ModuleId, number>>, ambient: boolean): void;
  /** Ajoute les structures industrielles (modèle chargé à part) sur la poutre principale. */
  attachIndustrial(kit: IndustrialKit): THREE.Object3D[];
  dispose(): void;
}

const PI = Math.PI;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/* ——— Faisceaux : tubes lumineux parcourus d'impulsions ——— */
const LINK_VERTEX = /* glsl */ `
attribute float aLen;
varying float vS;
varying float vLen;
void main() {
  vLen = aLen;
  vS = (1.0 - uv.y) * aLen;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const LINK_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uActive;
varying float vS;
varying float vLen;
void main() {
  float speed = 9.0 + uActive * 16.0;
  float pulse = pow(fract((vS - uTime * speed) / 22.0), 18.0) + 0.6 * pow(fract((vS - uTime * speed * 0.7 + 9.0) / 31.0), 30.0);
  float ends = smoothstep(0.0, 3.0, vS) * smoothstep(0.0, 3.0, vLen - vS);
  float a = (0.16 + 2.4 * pulse) * ends * (0.4 + 0.9 * uActive);
  gl_FragColor = vec4(vec3(1.0, 0.47, 0.11) * a, 0.0);
}`;

class Links {
  private geos: THREE.BufferGeometry[] = [];
  private accent: ModuleAccents | null = null;
  add = (a: THREE.Vector3, b: THREE.Vector3, A: ModuleAccents) => {
    this.accent = A;
    const len = a.distanceTo(b);
    for (const r of [0.07, 0.22]) {
      const g = new THREE.CylinderGeometry(r, r, len, 6, 1, true);
      g.setAttribute('aLen', new THREE.Float32BufferAttribute(new Array(g.getAttribute('position').count).fill(len), 1));
      const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()), V(1, 1, 1));
      g.applyMatrix4(m);
      g.deleteAttribute('normal');
      this.geos.push(g);
    }
  };
  build(target: THREE.Object3D, uniforms: StationUniforms) {
    if (!this.geos.length || !this.accent) return null;
    const geometry = mergeGeometries(this.geos, false)!;
    this.geos.forEach((g) => g.dispose());
    const material = new THREE.ShaderMaterial({
      vertexShader: LINK_VERTEX,
      fragmentShader: LINK_FRAGMENT,
      uniforms: { uTime: uniforms.uTime, uActive: this.accent.active },
      transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 4;
    mesh.frustumCulled = false;
    target.add(mesh);
    return mesh;
  }
}

/** Profil du moyeu central : cônes, nervures, deux ceintures d'équipements. */
function hubProfile(): Profile {
  const p: Profile = [[0.01, -23], [5, -23], [5, -22.2], [8.6, -22.2], [12.6, -18.6], [14, -17.2]];
  for (let y = -16.4; y <= 16.5; y += 4.1) {
    if (Math.abs(Math.abs(y) - 8.2) < 0.1) {
      p.push([14, y - 1.2], [15.2, y - 0.8], [15.2, y + 0.8], [14, y + 1.2]);
    } else {
      p.push([14, y - 0.3], [14.16, y - 0.2], [14.16, y + 0.2], [14, y + 0.3]);
    }
  }
  p.push([14, 17.2], [12.6, 18.6], [8.6, 22.2], [5, 22.2], [5, 23], [0.01, 23]);
  return p;
}

export async function buildStation(q: Quality, uniforms: StationUniforms & { uScale: { value: number } }, shadows: boolean, step: () => Promise<void>): Promise<Station> {
  const M = await createMaterials(q, uniforms, step);
  const geo = createSharedGeometry();
  const rng = makeRng(20240901);
  const group = new THREE.Group();
  const b = new Builder(q, M, shadows, uniforms, rng, geo);
  const disposables: { dispose(): void }[] = [];
  const core = M.accents();
  core.active.value = 0.4;

  /* ——— Noyau central ——— */
  b.lathe(hubProfile(), M.hull, undefined, 80);
  for (const [y0, y1] of [[2.6, 5.2], [-6.4, -4]]) b.lathe([[14.06, y0], [14.06, y1]], core.window, undefined, 80, 0, PI * 2, y1 - y0, 16 * 1.9);
  for (const [phi0, len, y0, y1] of [[0.2, 1.1, -15.4, -10.6], [2.5, 1.4, -15.4, -10.6], [4.4, 1.2, 10.6, 15.4], [1.3, 0.9, 10.6, 15.4]]) b.lathe([[14.2, y0], [14.2, y1]], M.foil, undefined, 30, phi0, len);
  b.greebles(new THREE.Matrix4(), 14, -15.5, 15.5, 260);
  b.lathe([[15.25, 8.05], [15.25, 8.35]], core.strip, undefined, 80);
  b.lathe([[15.25, -8.35], [15.25, -8.05]], core.strip, undefined, 80);
  for (const s of [-1, 1]) b.lathe(moduleProfile(4.6, 3, { ribEvery: 1.5, collar: 3.6, endR: 4.2 }), M.hull, mat4(s * 14.6, 0, 0, 0, 0, -PI / 2), 32);
  b.lights.add(14.3, 15, 0, PALETTE.text, 0.7, 2, 0.2, 2);
  b.lights.add(-14.3, -15, 0, PALETTE.text, 0.7, 2, 1.2, 2);

  /* ——— Axe vertical (au-dessus de l'anneau) ——— */
  b.cyl(2.6, 2.6, 12.4, M.hull, mat4(0, 39.2, 0), 24);
  b.truss(V(0, 33.2, 0), V(0, 45.4, 0), 7, 3.05, 0.34);
  b.tube([V(2.2, 33.5, 2.2), V(2.4, 39, 2.6), V(2.2, 45, 2.2)], 0.3, M.chrome, 8);

  /* ——— Poutre principale ——— */
  for (const s of [-1, 1]) {
    b.truss(V(s * 13, 0, 0), V(s * 206, 0, 0), 7, 7, 0.34);
    for (const [z, y] of [[2.2, -2.6], [-2.2, -2.6], [2.6, 2.4]]) b.cyl(0.38, 0.38, 192, M.chrome, mat4(s * 109.5, y, z, 0, 0, PI / 2), 10);
    for (const x of [70, 132]) {
      b.box(9.4, 9.4, 9.4, M.hull, mat4(s * x, 0, 0), 0.6);
      b.box(9.6, 0.3, 9.6, core.strip, mat4(s * x, 3.6, 0), 0.05);
      b.greebles(mat4(s * x, 0, 0, 0, 0, PI / 2), 4.7, -4, 4, 18);
      b.lights.add(s * x, 4.9, 4.9, PALETTE.orangeHot, 0.6, 2, x * 0.03, 2.5);
    }
    b.box(5, 5, 5, M.hull, mat4(s * 207, 0, 0), 0.5);
    b.lights.add(s * 209.8, 0, 0, PALETTE.orangeHot, 1.4, 1, s > 0 ? 0 : 1.1, 5);
    b.rails.beam(V(s * 15, 4.1, 3.6), V(s * 200, 4.1, 3.6), 0.09);
    // Radiateurs (en accordéon, vers l'arrière)
    for (let i = 0; i < 5; i++) {
      const z = -6.5 - i * 6.3;
      b.box(13, 0.26, 6, M.white, mat4(s * 118, -0.6 + (i % 2 ? 0.5 : -0.5), z, i % 2 ? 0.16 : -0.16, 0, 0), 0.05);
      b.beams.beam(V(s * 111.4, 0, z + 3), V(s * 124.6, 0, z + 3), 0.22);
    }
    b.box(4, 4, 4, M.frame, mat4(s * 118, 0, -4.2), 0.3);
  }

  /* ——— Ailes solaires : quatre gimbals, chaque aile a deux couvertures de chaque côté de son mât ——— */
  const wings: THREE.Group[] = [];
  const beta = -Math.atan2(0.7, 0.55);
  for (const x of [-184, -150, 150, 184]) {
    b.cyl(3.4, 3.4, 7.6, M.hull, mat4(x, 0, 0, 0, 0, PI / 2), 28);
    b.lathe([[3.46, -0.3], [3.46, 0.3]], core.strip, mat4(x, 0, 0, 0, 0, PI / 2), 28);
    const alpha = new THREE.Group();
    alpha.position.set(x, 0, 0);
    group.add(alpha);
    const betaG = new THREE.Group();
    betaG.rotation.y = beta;
    alpha.add(betaG);
    const w = b.fork();
    for (const sy of [-1, 1]) {
      w.cyl(1.4, 1.8, 2.6, M.frame, mat4(0, sy * 4.6, 0), 16);
      w.truss(V(0, sy * 5.8, 0), V(0, sy * 66, 0), 1.3, 2.4, 0.14);
      w.box(1.2, 1.4, 24.6, M.hull, mat4(0, sy * 66.6, 0), 0.2);
      w.box(1.4, 1.6, 2.4, M.frame, mat4(0, sy * 6.4, 0), 0.2);
      for (const sz of [-1, 1]) {
        const zc = sz * (0.9 + 5.6);
        const yc = sy * 36;
        const front = new THREE.PlaneGeometry(11, 58);
        const uv = front.getAttribute('uv');
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.98, uv.getY(i) * 5.2);
        w.add(front.clone(), M.solarFront, mat4(0.05, yc, zc, 0, PI / 2, 0));
        w.add(front, M.solarBack, mat4(-0.05, yc, zc, 0, -PI / 2, 0));
        for (const e of [-1, 1]) w.beams.beam(V(0, sy * 7, zc + e * 5.5), V(0, sy * 65, zc + e * 5.5), 0.14);
        for (let k = 0; k <= 4; k++) w.beams.beam(V(0, sy * (7 + k * 14.5), zc - 5.5), V(0, sy * (7 + k * 14.5), zc + 5.5), 0.12);
      }
      w.lights.add(0, sy * 67.6, 12.2, PALETTE.orangeHot, 0.9, 1, x * 0.01 + sy, 4);
      w.lights.add(0, sy * 67.6, -12.2, PALETTE.text, 0.6, 2, x * 0.02, 2.4);
    }
    w.flush(betaG);
    wings.push(alpha);
  }
  await step();

  /* ——— Anneau habité et rayons (tournent ensemble) ——— */
  const ring = new THREE.Group();
  ring.position.y = 27;
  group.add(ring);
  const r = b.fork();
  const RS = 220;
  r.lathe([[61, -3.5], [67, -3.5], [68.5, -2], [68.5, 2], [67, 3.5], [61, 3.5], [59.5, 2], [59.5, -2], [61, -3.5]], M.hull, undefined, RS);
  r.lathe([[68.56, -1], [68.56, 1.3]], core.window, undefined, RS, 0, PI * 2, 2.3, 16 * 2);
  r.lathe([[59.44, 1.1], [59.44, -0.7]], core.window, undefined, RS, 0, PI * 2, 1.8, 16 * 1.6);
  r.lathe([[68.6, -2.2], [68.6, -2.0]], core.strip, undefined, RS);
  const ribs = 24;
  for (let k = 0; k < ribs; k++) {
    const phi = (k / ribs) * PI * 2 + PI / ribs;
    r.plates.push(mat4(Math.sin(phi) * 64, 0, Math.cos(phi) * 64, 0, phi, 0, 0.8, 7.7, 9.9));
    if (k % 3 === 0) r.lights.add(Math.sin(phi) * 69, 0, Math.cos(phi) * 69, PALETTE.orangeHot, 0.8, 1, k * 0.37, 4);
  }
  r.greebles(new THREE.Matrix4(), 68.5, -1.7, -1.2, 260);
  r.greebles(new THREE.Matrix4(), 68.5, 1.5, 1.9, 200);
  for (let k = 0; k < 90 * b.detail; k++) {
    const phi = rng() * PI * 2;
    r.plates.push(mat4(Math.sin(phi) * (62 + rng() * 4), 3.7, Math.cos(phi) * (62 + rng() * 4), 0, phi, 0, 1 + rng() * 2.5, 0.4 + rng() * 0.6, 1 + rng() * 2));
  }
  // Collier tournant autour de l'axe (porte les rayons)
  const collar: Profile = [[0.01, -4], [9.2, -4]];
  for (let y = -3.4; y < 6; y += 1.7) collar.push([9.2, y - 0.2], [9.4, y - 0.1], [9.4, y + 0.1], [9.2, y + 0.2]);
  collar.push([9.2, 6], [6, 6.2], [3.4, 6.2]);
  r.lathe(collar, M.hull, undefined, 48);
  r.lathe([[9.26, 0.2], [9.26, 1.4]], core.window, undefined, 48, 0, PI * 2, 1.2, 16 * 1.2);
  for (let k = 0; k < 4; k++) {
    const phi = PI / 4 + (k * PI) / 2;
    const m = mat4(Math.sin(phi) * 34.4, 0, Math.cos(phi) * 34.4, 0, phi, 0).multiply(mat4(0, 0, 0, PI / 2));
    r.lathe(moduleProfile(1.8, 47.6, { ribEvery: 3, collar: 1.5, endR: 1.7 }), M.hull, m, 28);
    r.handrails(m, 1.8, -22, 22, [PI / 2, -PI / 2]);
    for (const s of [-1, 1]) {
      const side = V(Math.cos(phi), 0, -Math.sin(phi)).multiplyScalar(s * 3.2);
      r.rails.beam(V(Math.sin(phi) * 9.4, 0, Math.cos(phi) * 9.4).add(side.clone().multiplyScalar(0.3)), V(Math.sin(phi) * 59.5, 0, Math.cos(phi) * 59.5).add(side), 0.12);
    }
  }
  r.flush(ring);
  await step();

  /* ——— Modules ——— */
  const links = new Links();
  const modules: ModuleRuntime[] = [];
  const builders: [() => ModuleRuntime][] = [
    [() => buildSecurity(b, group)],
    [() => buildNetwork(b, group, links.add)],
    [() => buildTelecom(b, group)],
    [() => buildDataCenter(b, group)],
    // Un casier par outil des archives (lu dans data/tools.tsx), 12 au plus
    [() => buildArchive(b, group, Math.min(12, Math.max(1, moduleById('archive').tools.length)))],
    [() => buildVirtualization(b, group)],
    [() => buildDevelopment(b, group)],
    [() => buildGameDev(b, group)],
    [() => buildEngineering(b, group)],
  ];
  for (const [make] of builders) {
    modules.push(make());
    await step();
  }
  b.flush(group);
  const linkMesh = links.build(group, uniforms);
  if (linkMesh) disposables.push(linkMesh.geometry, linkMesh.material as THREE.Material);
  await step();

  const lights = modules.flatMap((m) => m.lights);
  let alphaT = 0;
  let industrial: IndustrialKit | null = null;
  return {
    group,
    modules,
    lights,
    update(time, dt, active, dwell, ambient) {
      if (ambient) {
        ring.rotation.y += dt * 0.012;
        alphaT += dt;
        wings.forEach((w, i) => { w.rotation.x = Math.sin(alphaT * 0.03 + i * 0.4) * 0.12; });
      }
      for (const m of modules) {
        const a = active[m.id] ?? 0;
        m.accents.active.value = a;
        m.update(time, dt, a, dwell[m.id] ?? 0, ambient);
      }
    },
    attachIndustrial(kit) {
      industrial = kit;
      // À droite : suspendue sous la poutre (entre le Network Hub et le Telecom), sous le caisson de jonction
      // (la pièce « lights » du modèle, des points semés autour des blocs, ferait des débris flottants : la station a ses propres feux)
      const right = placeIndustrial(kit, group, { length: 40, center: V(74, -7, 0), skip: ['lights'], shadows });
      // À gauche : posée sur la poutre (entre la virtualisation et le hangar), sans les câbles pendants
      const left = placeIndustrial(kit, group, { length: 40, center: V(-76, 7, 0), flip: true, skip: ['cables', 'lights'], shadows });
      const s = b.fork();
      for (const x of [57, 61, 79, 86, 92]) for (const z of [-2.6, 2.6]) s.beams.beam(V(x, -3.4, z), V(x, -5.4, z), 0.32);
      for (const x of [-59, -63, -79, -86, -92]) for (const z of [-2.6, 2.6]) s.beams.beam(V(x, 3.4, z), V(x, 5.1, z), 0.32);
      return [right.group, left.group, ...s.flush(group)];
    },
    dispose() {
      industrial?.dispose();
      modules.forEach((m) => m.dispose());
      disposables.forEach((d) => d.dispose());
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh || (o as THREE.Points).isPoints) {
          mesh.geometry?.dispose();
          const mat = mesh.material as THREE.Material;
          if (mat && (mat as THREE.ShaderMaterial).isShaderMaterial) mat.dispose();
        }
      });
      geo.box.dispose();
      geo.rod.dispose();
      M.dispose();
    },
  };
}
