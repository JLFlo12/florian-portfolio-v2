import * as THREE from 'three';
import { Bucket, Instances, boxUV, lathe, roundedBox, truss, type Profile, type Quality, type StationUniforms } from './kit';
import type { Materials } from './materials';

/* ───────────────────────────────────────────────────────────────
   Atelier de construction : chaque groupe de la station (partie fixe, anneau
   qui tourne, paraboles, portes…) a son Builder. Les pièces sont posées avec
   une matrice, regroupées par matériau puis fusionnées au moment de flush().
   ─────────────────────────────────────────────────────────────── */

const UP = new THREE.Vector3(0, 1, 0);

/** Géométries unitaires partagées par toutes les instances */
export interface SharedGeometry { box: THREE.BufferGeometry; rod: THREE.BufferGeometry }
export const createSharedGeometry = (): SharedGeometry => ({
  box: new THREE.BoxGeometry(1, 1, 1),
  rod: new THREE.CylinderGeometry(0.5, 0.5, 1, 7, 1).rotateX(Math.PI / 2),
});

/* ——— Feux de navigation et voyants : points lumineux, fixes, à éclats ou qui respirent ——— */
const LIGHT_VERTEX = /* glsl */ `
attribute float aSize;
attribute float aMode;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
uniform float uScale;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float t = uTime + aPhase;
  float k = 1.0;
  if (aMode > 0.5 && aMode < 1.5) {
    float f = fract(t * 0.42);
    k = (f < 0.05 || (f > 0.12 && f < 0.16)) ? 1.0 : 0.06;   // double éclat
  } else if (aMode > 1.5) {
    k = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(t * 1.7), 2.0);   // respiration
  }
  vColor = aColor * k;
  gl_PointSize = clamp(aSize * uScale / max(1.0, -mv.z), 2.0, 64.0);
}`;
const LIGHT_FRAGMENT = /* glsl */ `
varying vec3 vColor;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;
  float a = exp(-r2 * 6.0) + 0.6 * exp(-r2 * 40.0);
  gl_FragColor = vec4(vColor * a, 0.0);
}`;

export class NavLights {
  private pos: number[] = [];
  private col: number[] = [];
  private size: number[] = [];
  private mode: number[] = [];
  private phase: number[] = [];
  /** mode 0 : fixe, 1 : double éclat, 2 : respiration ; intensité HDR (bloom) */
  add(x: number, y: number, z: number, color: number, size = 0.8, mode = 0, phase = Math.random() * 10, intensity = 3) {
    const c = new THREE.Color(color).multiplyScalar(intensity);
    this.pos.push(x, y, z);
    this.col.push(c.r, c.g, c.b);
    this.size.push(size);
    this.mode.push(mode);
    this.phase.push(phase);
  }
  addAt(v: THREE.Vector3, color: number, size?: number, mode?: number, phase?: number, intensity?: number) {
    this.add(v.x, v.y, v.z, color, size, mode, phase, intensity);
  }
  get count() { return this.size.length; }
  build(target: THREE.Object3D, uniforms: StationUniforms & { uScale: { value: number } }) {
    if (!this.count) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(this.size, 1));
    g.setAttribute('aMode', new THREE.Float32BufferAttribute(this.mode, 1));
    g.setAttribute('aPhase', new THREE.Float32BufferAttribute(this.phase, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: LIGHT_VERTEX,
      fragmentShader: LIGHT_FRAGMENT,
      uniforms: { uTime: uniforms.uTime, uScale: uniforms.uScale },
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
    });
    const points = new THREE.Points(g, m);
    points.frustumCulled = false;
    points.renderOrder = 5;
    target.add(points);
    return points;
  }
}

export class Builder {
  bucket = new Bucket();
  beams: Instances;
  rails: Instances;
  bolts: Instances;
  plates: Instances;
  lights = new NavLights();
  constructor(
    readonly q: Quality,
    readonly M: Materials,
    readonly shadows: boolean,
    readonly uniforms: StationUniforms & { uScale: { value: number } },
    readonly rng: () => number,
    readonly geo: SharedGeometry,
  ) {
    this.beams = new Instances(geo.box, M.frame);
    this.rails = new Instances(geo.rod, M.chrome);
    this.bolts = new Instances(geo.box, M.dark);
    this.plates = new Instances(geo.box, M.hull);
  }

  /** Builder d'un sous-groupe (pièces animées) : mêmes matériaux, ses propres lots. */
  fork() { return new Builder(this.q, this.M, this.shadows, this.uniforms, this.rng, this.geo); }

  /** Fusionne tout ce qui a été posé et l'ajoute au groupe. */
  flush(target: THREE.Object3D) {
    const meshes: THREE.Object3D[] = this.bucket.build(target, this.shadows);
    for (const inst of [this.beams, this.rails, this.bolts, this.plates]) {
      // Rambardes et petits boîtiers : trop fins pour une ombre visible, on ne les dessine pas dans la carte d'ombre
      const mesh = inst.build(target, this.shadows);
      if (mesh && (inst === this.rails || inst === this.bolts)) mesh.castShadow = false;
      if (mesh) meshes.push(mesh);
    }
    const pts = this.lights.build(target, this.uniforms);
    if (pts) meshes.push(pts);
    return meshes;
  }

  get detail() { return this.q === 'high' ? 1 : 0.45; }

  add(geometry: THREE.BufferGeometry, material: THREE.Material, matrix?: THREE.Matrix4) {
    this.bucket.add(geometry, material, matrix);
    geometry.dispose();
  }

  lathe(profile: Profile, material: THREE.Material, matrix?: THREE.Matrix4, radial = 48, phi0 = 0, phiLen = Math.PI * 2, uv = 5, uScale = uv) {
    this.add(lathe(profile, Math.max(12, Math.round(radial * (this.q === 'high' ? 1 : 0.6))), phi0, phiLen, uv, uScale), material, matrix);
  }

  /** Caisson à bords arrondis, UV en mètres. */
  box(w: number, h: number, d: number, material: THREE.Material, matrix: THREE.Matrix4, r = 0.25) {
    this.add(boxUV(roundedBox(w, h, d, r, r > 0.05 ? 2 : 1), 5), material, matrix);
  }

  /** Cylindre le long de Y. */
  cyl(r0: number, r1: number, len: number, material: THREE.Material, matrix: THREE.Matrix4, seg = 24, open = false) {
    const g = new THREE.CylinderGeometry(r0, r1, len, Math.max(6, Math.round(seg * (this.q === 'high' ? 1 : 0.6))), 1, open);
    this.add(g, material, matrix);
  }

  /** Câble ou tuyau le long d'une courbe. */
  tube(points: THREE.Vector3[], radius: number, material: THREE.Material, seg = 32) {
    const curve = new THREE.CatmullRomCurve3(points);
    this.add(new THREE.TubeGeometry(curve, seg, radius, 6, false), material);
  }

  truss(a: THREE.Vector3, b: THREE.Vector3, width: number, bay: number, t = 0.32, up = UP) {
    truss(this.beams, a, b, width, bay, t, up);
  }

  /**
   * Petits équipements posés sur une coque cylindrique (repère local du module : axe Y),
   * entre y0 et y1, dans un secteur [phi0, phi1] : boîtiers, plaques, boulons.
   */
  greebles(matrix: THREE.Matrix4, radius: number, y0: number, y1: number, count: number, phi0 = 0, phi1 = Math.PI * 2) {
    const n = Math.round(count * this.detail);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (let i = 0; i < n; i++) {
      const phi = phi0 + this.rng() * (phi1 - phi0);
      const y = y0 + this.rng() * (y1 - y0);
      const big = this.rng() < 0.3;
      const w = big ? 0.8 + this.rng() * 1.6 : 0.2 + this.rng() * 0.6;
      const h = big ? 0.8 + this.rng() * 2.2 : 0.2 + this.rng() * 0.7;
      const d = big ? 0.25 + this.rng() * 0.5 : 0.1 + this.rng() * 0.3;
      const r = radius + d / 2;
      e.set(0, phi, 0);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(Math.sin(phi) * r, y, Math.cos(phi) * r), q, new THREE.Vector3(w, h, d));
      (big ? this.plates : this.bolts).push(matrix.clone().multiply(m));
    }
  }

  /** Rambardes le long d'une coque (repère local du module : axe Y), aux angles donnés. */
  handrails(matrix: THREE.Matrix4, radius: number, y0: number, y1: number, phis: number[]) {
    const r = radius + 0.45;
    for (const phi of phis) {
      const s = Math.sin(phi);
      const c = Math.cos(phi);
      const a = new THREE.Vector3(s * r, y0, c * r).applyMatrix4(matrix);
      const b = new THREE.Vector3(s * r, y1, c * r).applyMatrix4(matrix);
      this.rails.beam(a, b, 0.09);
      for (let y = y0; y <= y1 + 1e-3; y += 1.6) {
        const p = new THREE.Vector3(s * r, y, c * r).applyMatrix4(matrix);
        const base = new THREE.Vector3(s * radius, y, c * radius).applyMatrix4(matrix);
        this.rails.beam(base, p, 0.07);
      }
    }
  }
}
