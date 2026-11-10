import * as THREE from 'three';
import { hashSeed, makeRng } from '../utils/rng';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** Rocher irrégulier : une sphère à facettes bosselée par quelques ondes. */
const makeRock = (seed: number, detail: number) => {
  const rng = makeRng(seed);
  const geometry = new THREE.IcosahedronGeometry(1, detail);
  const k = Array.from({ length: 9 }, () => rng() * 6.28);
  const position = geometry.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    const bump = 1
      + 0.22 * Math.sin(v.x * 2.3 + k[0]) * Math.sin(v.y * 2.9 + k[1])
      + 0.16 * Math.sin(v.z * 3.7 + k[2]) * Math.sin(v.x * 4.1 + k[3])
      + 0.07 * Math.sin(v.y * 8.3 + k[4]) * Math.sin(v.z * 7.7 + k[5]);
    v.multiplyScalar(bump);
    position.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
};

/**
 * Ceinture de débris autour de Morne, au-delà des anneaux.
 * Tous les rochers sont dessinés en un seul appel (InstancedMesh).
 */
export class AsteroidBelt {
  readonly group = new THREE.Group();
  private spin = new THREE.Group();
  private geometry: THREE.BufferGeometry;
  private bigGeometry: THREE.BufferGeometry;
  private material: THREE.MeshStandardMaterial;
  private angle = 0;
  private namedLocal = new THREE.Vector3();

  /** @param namedRadius rayon du plus gros astéroïde, ou 0 s'il n'y en a pas */
  constructor(count: number, private tilt: number, inner: number, outer: number, namedRadius: number) {
    const INNER = inner, OUTER = outer;
    const thickness = (outer - inner) * 0.11;
    this.namedLocal.set((inner + outer) / 2, thickness * 0.15, 0);
    const rng = makeRng(hashSeed('morne-belt'));
    this.geometry = makeRock(7, 2);
    this.bigGeometry = makeRock(217, 4);
    this.material = new THREE.MeshStandardMaterial({ color: 0x6f665d, roughness: 0.95, metalness: 0.05, flatShading: true });

    const rocks = new THREE.InstancedMesh(this.geometry, this.material, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      // Plus dense au milieu de la ceinture
      const r = INNER + (OUTER - INNER) * (rng() + rng()) / 2;
      p.set(Math.cos(a) * r, (rng() + rng() - 1) * thickness, Math.sin(a) * r);
      const size = 7 + Math.pow(rng(), 3.2) * 62;
      s.set(size * (0.7 + rng() * 0.6), size * (0.6 + rng() * 0.5), size * (0.7 + rng() * 0.6));
      e.set(rng() * 6.28, rng() * 6.28, rng() * 6.28);
      rocks.setMatrixAt(i, m.compose(p, q.setFromEuler(e), s));
      const tone = 0.55 + rng() * 0.5;
      rocks.setColorAt(i, color.setRGB(tone, tone * (0.9 + rng() * 0.1), tone * (0.82 + rng() * 0.12)));
    }
    rocks.frustumCulled = false;
    this.spin.add(rocks);

    if (namedRadius > 0) {
      const named = new THREE.Mesh(this.bigGeometry, this.material);
      named.position.copy(this.namedLocal);
      named.scale.set(namedRadius, namedRadius * 0.8, namedRadius * 0.9);
      this.spin.add(named);
    }

    this.group.rotation.z = tilt;
    this.group.add(this.spin);
  }

  update(scenePosition: THREE.Vector3, time: number) {
    this.angle = time * 0.0015;
    this.spin.rotation.y = this.angle;
    this.group.position.copy(scenePosition);
  }

  /** Position dans l'univers du plus gros astéroïde, qui tourne avec la ceinture. */
  namedWorld(out: THREE.Vector3, center: THREE.Vector3) {
    return out.copy(this.namedLocal).applyAxisAngle(Y_AXIS, this.angle).applyAxisAngle(Z_AXIS, this.tilt).add(center);
  }

  dispose() {
    this.geometry.dispose();
    this.bigGeometry.dispose();
    this.material.dispose();
  }
}
