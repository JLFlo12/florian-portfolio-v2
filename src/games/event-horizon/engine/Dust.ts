import * as THREE from 'three';
import { hashSeed, makeRng } from '../utils/rng';

const BOX = 800;
/** Au-delà, les traits ne s'allongent plus : en croisière le vaisseau dépasse le million d'unités par seconde. */
const MAX_SHOWN_SPEED = 5200;

/**
 * Poussières interstellaires autour du vaisseau : elles donnent la sensation de vitesse.
 * Un seul appel de dessin ; chaque grain est un trait étiré par la vitesse, et le nuage
 * se replie sur lui-même pour entourer le vaisseau où qu'il aille.
 */
export class Dust {
  readonly lines: THREE.LineSegments;
  private material: THREE.ShaderMaterial;
  private geometry: THREE.BufferGeometry;
  private travelled = new THREE.Vector3();

  constructor(count = 900) {
    const rng = makeRng(hashSeed('dust'));
    const positions = new Float32Array(count * 6);
    const ends = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const x = rng() * BOX, y = rng() * BOX, z = rng() * BOX;
      positions.set([x, y, z, x, y, z], i * 6);
      ends[i * 2 + 1] = 1;
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uOffset: { value: new THREE.Vector3() },
        uVelocity: { value: new THREE.Vector3() },
        uAlpha: { value: 0 },
      },
      vertexShader: /* glsl */ `
        attribute float aEnd;
        uniform vec3 uOffset;
        uniform vec3 uVelocity;
        varying float vAlpha;
        void main() {
          vec3 p = mod(position - uOffset, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)};
          float fade = 1.0 - smoothstep(${(BOX * 0.3).toFixed(1)}, ${(BOX * 0.5).toFixed(1)}, length(p));
          p -= uVelocity * 0.03 * aEnd;
          vAlpha = fade * (1.0 - aEnd);
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uAlpha;
        varying float vAlpha;
        void main() { gl_FragColor = vec4(vec3(0.72, 0.8, 0.9) * vAlpha * uAlpha, 1.0); }`,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    this.lines = new THREE.LineSegments(this.geometry, this.material);
    this.lines.frustumCulled = false;
  }

  update(dt: number, velocity: THREE.Vector3) {
    const wrap = (v: number) => ((v % BOX) + BOX) % BOX;
    const shown = this.material.uniforms.uVelocity.value as THREE.Vector3;
    shown.copy(velocity).clampLength(0, MAX_SHOWN_SPEED);
    this.travelled.addScaledVector(shown, dt);
    this.travelled.set(wrap(this.travelled.x), wrap(this.travelled.y), wrap(this.travelled.z));
    this.material.uniforms.uOffset.value.copy(this.travelled);
    this.material.uniforms.uAlpha.value = THREE.MathUtils.smoothstep(velocity.length(), 4, 160) * 0.55;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
