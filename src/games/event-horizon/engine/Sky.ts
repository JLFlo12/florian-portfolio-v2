import * as THREE from 'three';
import { NOISE } from '../shaders/noise';
import { hashSeed, makeRng } from '../utils/rng';
import { SUN_DIR, UNIVERSE_SEED } from '../universe/bodies';
import type { QualityPreset } from './quality';

const SKY_RADIUS = 60000;
const STAR_RADIUS = 50000;
const SUN_RADIUS = 55000;

/** Plan de la galaxie : les étoiles et les poussières s'y concentrent. */
const GALACTIC_NORMAL = new THREE.Vector3(0.25, 0.9, 0.35).normalize();

const skyFragment = /* glsl */ `
varying vec3 vDir;
uniform vec3 uGalaxy;
${NOISE}
void main() {
  vec3 d = normalize(vDir);
  float lat = dot(d, uGalaxy);
  float band = exp(-lat * lat * 9.0);
  float n = fbm(d * 3.0 + 4.0);
  float n2 = fbm(d * 7.0 + vec3(n * 1.5));

  vec3 col = vec3(0.0025, 0.0035, 0.007);
  // Lueur diffuse de la galaxie, bleu froid vers poussières chaudes
  col += band * (0.012 + 0.05 * n) * mix(vec3(0.28, 0.49, 0.73), vec3(0.85, 0.68, 0.52), n2);
  // Bandes de poussière sombres
  col *= 1.0 - 0.75 * band * smoothstep(0.42, 0.68, fbm(d * 5.0 + 9.0));
  // Une nébuleuse en émission, discrète
  float nd = max(dot(d, normalize(vec3(-0.62, 0.22, -0.45))), 0.0);
  float neb = pow(nd, 10.0) * smoothstep(0.3, 0.75, fbm(d * 6.0 + 2.0));
  col += neb * mix(vec3(0.30, 0.09, 0.06), vec3(0.10, 0.16, 0.30), fbm(d * 11.0)) * 0.55;

  // Poussière d'étoiles lointaines, plus dense dans le plan galactique
  vec3 p = d * 240.0;
  vec3 id = floor(p);
  float h = hash13(id);
  vec3 jitter = vec3(hash13(id + 11.0), hash13(id + 23.0), hash13(id + 37.0)) - 0.5;
  float dist = length(fract(p) - 0.5 - jitter * 0.6);
  float star = (1.0 - smoothstep(0.0, 0.11, dist)) * step(0.985 - band * 0.03, h);
  col += star * (0.25 + 0.9 * hash13(id + 5.0)) * mix(vec3(0.75, 0.84, 1.0), vec3(1.0, 0.86, 0.7), hash13(id + 3.0));

  gl_FragColor = vec4(col, 1.0);
}`;

const dirVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const STAR_TINTS = [
  [0.86, 0.9, 0.94], // blanc froid
  [0.62, 0.75, 1.0], // bleue
  [1.0, 0.95, 0.82], // jaune
  [1.0, 0.78, 0.55], // orangée
  [1.0, 0.62, 0.45], // rouge
];

/** Fond spatial : voûte procédurale, étoiles instanciées en un seul appel de dessin, étoile du système. */
export class Sky {
  readonly group = new THREE.Group();
  private skyMaterial: THREE.ShaderMaterial;
  private starMaterial: THREE.ShaderMaterial;
  private sunMaterial: THREE.ShaderMaterial;
  private disposables: { dispose: () => void }[] = [];
  cube: THREE.WebGLCubeRenderTarget | null = null;

  constructor(quality: QualityPreset) {
    // Voûte
    this.skyMaterial = new THREE.ShaderMaterial({
      vertexShader: dirVertex,
      fragmentShader: skyFragment,
      uniforms: { uGalaxy: { value: GALACTIC_NORMAL } },
      defines: { OCTAVES: quality.octaves },
      side: THREE.BackSide,
      depthWrite: false,
    });
    const skyGeometry = new THREE.SphereGeometry(SKY_RADIUS, 48, 24);
    const sky = new THREE.Mesh(skyGeometry, this.skyMaterial);
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    this.group.add(sky);

    // Étoiles brillantes
    const rng = makeRng(hashSeed(UNIVERSE_SEED + ':stars'));
    const count = quality.stars;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      // Direction uniforme, puis resserrée vers le plan galactique pour 55 % des étoiles
      v.set(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1);
      if (v.lengthSq() < 1e-4) v.set(1, 0, 0);
      v.normalize();
      if (rng() < 0.55) v.addScaledVector(GALACTIC_NORMAL, -v.dot(GALACTIC_NORMAL) * (0.6 + rng() * 0.38)).normalize();
      positions.set([v.x * STAR_RADIUS, v.y * STAR_RADIUS, v.z * STAR_RADIUS], i * 3);
      const tint = STAR_TINTS[Math.min(STAR_TINTS.length - 1, Math.floor(Math.pow(rng(), 1.6) * STAR_TINTS.length))];
      const magnitude = Math.pow(rng(), 7); // beaucoup d'étoiles faibles, peu de brillantes
      const brightness = 0.35 + magnitude * 2.6;
      colors.set([tint[0] * brightness, tint[1] * brightness, tint[2] * brightness], i * 3);
      sizes[i] = 1.1 + magnitude * 3.4;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    starGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    this.starMaterial = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float aSize;
        uniform float uScale;
        varying vec3 vColor;
        void main() {
          vColor = color;
          gl_PointSize = aSize * uScale;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = 1.0 - smoothstep(0.0, 1.0, d);
          gl_FragColor = vec4(vColor * a * a, 1.0);
        }`,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const stars = new THREE.Points(starGeometry, this.starMaterial);
    stars.frustumCulled = false;
    this.group.add(stars);

    // Étoile du système
    this.sunMaterial = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          float r = length(vUv - 0.5) * 2.0;
          float core = (1.0 - smoothstep(0.034, 0.05, r)) * 55.0;
          float glow = 0.012 / (r * r + 0.0016) * pow(max(1.0 - r, 0.0), 2.0);
          gl_FragColor = vec4(vec3(1.0, 0.93, 0.82) * (core + glow), 1.0);
        }`,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const sunGeometry = new THREE.PlaneGeometry(SUN_RADIUS * 0.5, SUN_RADIUS * 0.5);
    const sun = new THREE.Mesh(sunGeometry, this.sunMaterial);
    sun.position.copy(SUN_DIR).multiplyScalar(SUN_RADIUS);
    sun.lookAt(0, 0, 0);
    sun.frustumCulled = false;
    this.group.add(sun);

    this.disposables.push(skyGeometry, starGeometry, sunGeometry, this.skyMaterial, this.starMaterial, this.sunMaterial);
  }

  /**
   * Photographie le ciel dans une carte cubique HDR. Elle sert de fond aux rayons courbés
   * par le trou noir (lentille gravitationnelle) et de source de reflets pour les matériaux PBR.
   */
  capture(renderer: THREE.WebGLRenderer, size: number) {
    const target = new THREE.WebGLCubeRenderTarget(size, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    const scene = new THREE.Scene();
    const parent = this.group.parent;
    this.group.position.set(0, 0, 0);
    scene.add(this.group);
    this.starMaterial.uniforms.uScale.value = Math.max(1, size / 1024) * 1.25;
    const camera = new THREE.CubeCamera(10, SKY_RADIUS * 1.2, target);
    camera.update(renderer, scene);
    scene.remove(this.group);
    parent?.add(this.group);
    this.cube = target;
    return target;
  }

  setPixelRatio(ratio: number) {
    this.starMaterial.uniforms.uScale.value = Math.max(0.9, ratio);
  }

  /** Le fond est à l'infini : il suit la caméra. */
  follow(camera: THREE.Camera) {
    this.group.position.copy(camera.position);
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.cube?.dispose();
  }
}
