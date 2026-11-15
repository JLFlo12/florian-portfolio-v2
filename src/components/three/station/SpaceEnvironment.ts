import * as THREE from 'three';
import { makeRng, type Quality } from './kit';

/* ───────────────────────────────────────────────────────────────
   SpaceEnvironment : le décor autour de la station.
   - étoiles (taille et éclat variés, scintillement léger) et Voie lactée discrète ;
   - planète en contrebas, surtout côté nuit : continents sombres, villes orange,
     liseré d'atmosphère doré au terminateur ;
   - soleil (halo) ; poussières qui défilent près de la caméra (sensation de vitesse) ;
   - carte d'environnement (reflets des métaux) générée depuis ce même ciel.
   ─────────────────────────────────────────────────────────────── */

export interface SpaceEnvironment {
  group: THREE.Group;
  envMap: THREE.Texture;
  update(camera: THREE.PerspectiveCamera, time: number): void;
  dispose(): void;
}

const NOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbm(vec3 p) {
  float f = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { f += a * snoise(p); p *= 2.03; a *= 0.5; }
  return f;
}`;

/* ——— Étoiles ——— */
const STAR_VERTEX = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aPhase;
uniform float uTime;
uniform float uPixel;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.85 + 0.15 * sin(uTime * (0.6 + aPhase) + aPhase * 40.0);
  vColor = aColor * tw;
  gl_PointSize = aSize * uPixel;
}`;
const STAR_FRAGMENT = /* glsl */ `
varying vec3 vColor;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;
  gl_FragColor = vec4(vColor * (exp(-r2 * 5.0) + 0.5 * exp(-r2 * 30.0)), 1.0);
}`;

/* ——— Ciel lointain : Voie lactée très discrète ——— */
const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FRAGMENT = /* glsl */ `
${NOISE}
uniform vec3 uSun;
uniform float uEnv;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 bandN = normalize(vec3(0.32, 0.86, -0.4));
  float band = exp(-pow(dot(d, bandN) * 3.4, 2.0));
  float cloud = smoothstep(-0.2, 0.9, fbm(d * 3.2)) * 0.7 + 0.3 * smoothstep(0.0, 1.0, fbm(d * 9.0 + 4.0));
  float dustLane = smoothstep(0.1, 0.5, fbm(d * 5.0 + 11.0)) * band;
  vec3 col = vec3(0.012, 0.010, 0.009) * band * cloud * (1.0 - 0.7 * dustLane);
  col += vec3(0.0016, 0.0013, 0.0011);
  // Pour la carte d'environnement : soleil et lueur de la planète en dessous
  float sun = max(dot(d, uSun), 0.0);
  col += uEnv * (vec3(1.0, 0.92, 0.82) * (pow(sun, 600.0) * 7.0 + pow(sun, 24.0) * 0.45) + vec3(0.07, 0.036, 0.016) * smoothstep(0.1, -0.6, d.y) + vec3(0.025, 0.022, 0.02) * smoothstep(-0.2, 0.6, -dot(d, uSun)));
  gl_FragColor = vec4(col, 1.0);
}`;

/* ——— Planète ——— */
const PLANET_VERTEX = /* glsl */ `
varying vec3 vN;
varying vec3 vW;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const PLANET_FRAGMENT = /* glsl */ `
${NOISE}
uniform vec3 uSun;
uniform float uTime;
varying vec3 vN;
varying vec3 vW;
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  float ndl = dot(n, uSun);
  float day = smoothstep(-0.08, 0.32, ndl);
  float c = fbm(n * 2.3 + vec3(1.7, 0.2, 3.1));
  float land = smoothstep(0.02, 0.1, c);
  float relief = fbm(n * 11.0) * 0.5 + 0.5;
  vec3 ocean = vec3(0.006, 0.006, 0.007);
  vec3 ground = mix(vec3(0.035, 0.026, 0.019), vec3(0.075, 0.058, 0.042), relief);
  vec3 surf = mix(ocean, ground, land);
  float clouds = smoothstep(0.15, 0.75, fbm(n * 4.6 + vec3(uTime * 0.002, 0.0, 0.0))) * 0.75;
  surf = mix(surf, vec3(0.2, 0.19, 0.18), clouds);
  float spec = pow(max(dot(reflect(-uSun, n), v), 0.0), 40.0) * (1.0 - land) * (1.0 - clouds) * 0.6;
  vec3 col = surf * day * 1.2 + vec3(1.0, 0.85, 0.65) * spec * day * 0.5;
  // Villes la nuit : grappes orange sur les continents
  float cityMask = land * smoothstep(0.25, 0.6, fbm(n * 18.0 + 5.0)) * (1.0 - smoothstep(-0.25, 0.05, ndl));
  float lights = pow(max(snoise(n * 160.0) * 0.5 + 0.5, 0.0), 6.0) + 0.4 * pow(max(snoise(n * 420.0) * 0.5 + 0.5, 0.0), 8.0);
  col += vec3(1.0, 0.46, 0.12) * cityMask * lights * 1.1 * (1.0 - clouds * 0.7);
  // Lueur au terminateur et bord éclairé
  float rim = pow(1.0 - max(dot(n, v), 0.0), 9.0);
  float twilight = exp(-pow(ndl * 4.0, 2.0));
  col += rim * (vec3(1.0, 0.46, 0.14) * twilight * 0.7 + vec3(0.7, 0.55, 0.4) * day * 0.3);
  gl_FragColor = vec4(col, 1.0);
}`;
const ATMO_FRAGMENT = /* glsl */ `
uniform vec3 uSun;
varying vec3 vN;
varying vec3 vW;
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  float limb = pow(max(0.0, 1.0 + dot(n, v)), 1.0);
  float edge = pow(1.0 - abs(dot(n, v)), 3.0);
  float ndl = dot(-n, uSun);
  float lit = smoothstep(-0.35, 0.3, ndl);
  float twilight = exp(-pow(ndl * 3.0, 2.0));
  vec3 col = (vec3(1.0, 0.45, 0.12) * twilight * 1.2 + vec3(0.9, 0.7, 0.5) * lit * 0.5) * edge * limb;
  gl_FragColor = vec4(col * 1.4, 0.0);
}`;

/* ——— Soleil ——— */
const SUN_FRAGMENT = /* glsl */ `
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float core = exp(-r * r * 220.0) * 40.0;
  float halo = exp(-r * 6.0) * 0.6 + exp(-r * 2.2) * 0.12;
  float streak = exp(-abs(p.y) * 90.0) * exp(-abs(p.x) * 2.5) * 0.5;
  gl_FragColor = vec4(vec3(1.0, 0.88, 0.72) * (core + halo + streak) * smoothstep(1.0, 0.7, r), 0.0);
}`;

/* ——— Poussières près de la caméra ——— */
const DUST_VERTEX = /* glsl */ `
uniform vec3 uCam;
uniform float uBox;
uniform float uPixel;
varying float vA;
void main() {
  vec3 p = mod(position - uCam + uBox * 0.5, uBox) - uBox * 0.5 + uCam;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float d = -mv.z;
  vA = smoothstep(2.0, 12.0, d) * (1.0 - smoothstep(uBox * 0.3, uBox * 0.5, d));
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(0.18 * uPixel / max(d, 0.1), 1.0, 6.0);
}`;
const DUST_FRAGMENT = /* glsl */ `
varying float vA;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  if (dot(p, p) > 1.0) discard;
  gl_FragColor = vec4(vec3(0.9, 0.8, 0.7) * vA * 0.35, 0.0);
}`;

const additive = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor } as const;

export const PLANET = { center: new THREE.Vector3(600, -6900, -3200), radius: 5600 };

export function createSpaceEnvironment(renderer: THREE.WebGLRenderer, q: Quality, sun: THREE.Vector3): SpaceEnvironment {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x; };
  const time = { value: 0 };
  const pixel = { value: 1 };

  // Ciel attaché à la caméra
  const sky = new THREE.Group();
  group.add(sky);
  const skyMat = keep(new THREE.ShaderMaterial({ vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT, uniforms: { uSun: { value: sun }, uEnv: { value: 0 } }, side: THREE.BackSide, depthWrite: false }));
  const skyMesh = new THREE.Mesh(keep(new THREE.SphereGeometry(9000, 48, 24)), skyMat);
  skyMesh.renderOrder = -10;
  skyMesh.frustumCulled = false;
  sky.add(skyMesh);

  const rng = makeRng(77);
  const N = q === 'high' ? 7000 : 3200;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const size = new Float32Array(N);
  const phase = new Float32Array(N);
  const bandN = new THREE.Vector3(0.32, 0.86, -0.4).normalize();
  const v = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    // Un tiers des étoiles se resserrent autour de la Voie lactée
    do { v.set(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1); } while (v.lengthSq() > 1 || v.lengthSq() < 0.01);
    v.normalize();
    if (i % 3 === 0) { v.addScaledVector(bandN, -v.dot(bandN) * (0.75 + rng() * 0.25)).normalize(); }
    v.multiplyScalar(8000);
    pos.set([v.x, v.y, v.z], i * 3);
    const mag = Math.pow(rng(), 6);
    const warm = rng();
    const c = warm < 0.6 ? [1, 0.94, 0.86] : warm < 0.85 ? [1, 0.8, 0.6] : [0.86, 0.9, 1];
    const b = 0.25 + mag * 3.2;
    col.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
    size[i] = 1.2 + mag * 3.4;
    phase[i] = rng();
  }
  const starGeo = keep(new THREE.BufferGeometry());
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const stars = new THREE.Points(starGeo, keep(new THREE.ShaderMaterial({ vertexShader: STAR_VERTEX, fragmentShader: STAR_FRAGMENT, uniforms: { uTime: time, uPixel: pixel }, ...additive })));
  stars.frustumCulled = false;
  stars.renderOrder = -9;
  sky.add(stars);

  // Soleil (halo), dans la direction de la lumière
  const sunMat = keep(new THREE.ShaderMaterial({ vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }', fragmentShader: SUN_FRAGMENT, ...additive }));
  const sunMesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1)), sunMat);
  sunMesh.scale.setScalar(2600);
  sunMesh.position.copy(sun).multiplyScalar(7000);
  sunMesh.renderOrder = -8;
  sky.add(sunMesh);

  // Planète et atmosphère (dans le monde : elle reste immobile quand la caméra bouge)
  // Éclairage propre à la planète : la face tournée vers la station est au terminateur (jour à droite, nuit et villes à gauche)
  const planetUniforms = { uSun: { value: new THREE.Vector3(0.9, 0.12, -0.42).normalize() }, uTime: time };
  const seg = q === 'high' ? 192 : 112;
  const planet = new THREE.Mesh(keep(new THREE.SphereGeometry(PLANET.radius, seg, seg / 2)), keep(new THREE.ShaderMaterial({ vertexShader: PLANET_VERTEX, fragmentShader: PLANET_FRAGMENT, uniforms: planetUniforms })));
  planet.position.copy(PLANET.center);
  planet.rotation.set(0.3, 1.1, 0.2);
  planet.renderOrder = -5;
  group.add(planet);
  const atmo = new THREE.Mesh(keep(new THREE.SphereGeometry(PLANET.radius * 1.022, seg, seg / 2)), keep(new THREE.ShaderMaterial({ vertexShader: PLANET_VERTEX, fragmentShader: ATMO_FRAGMENT, uniforms: planetUniforms, side: THREE.BackSide, ...additive })));
  atmo.position.copy(PLANET.center);
  atmo.renderOrder = -4;
  group.add(atmo);

  // Poussières
  const DN = q === 'high' ? 1400 : 600;
  const box = 140;
  const dust = new Float32Array(DN * 3).map(() => (rng() - 0.5) * box);
  const dustGeo = keep(new THREE.BufferGeometry());
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3));
  const dustUniforms = { uCam: { value: new THREE.Vector3() }, uBox: { value: box }, uPixel: { value: 1 } };
  const dustPts = new THREE.Points(dustGeo, keep(new THREE.ShaderMaterial({ vertexShader: DUST_VERTEX, fragmentShader: DUST_FRAGMENT, uniforms: dustUniforms, ...additive })));
  dustPts.frustumCulled = false;
  dustPts.renderOrder = 8;
  group.add(dustPts);

  // Carte d'environnement : le même ciel, avec le soleil et la lueur de la planète
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envMat = new THREE.ShaderMaterial({ vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT, uniforms: { uSun: { value: sun }, uEnv: { value: 1 } }, side: THREE.BackSide, depthWrite: false });
  const envGeo = new THREE.SphereGeometry(50, 64, 32);
  envScene.add(new THREE.Mesh(envGeo, envMat));
  const envRT = pmrem.fromScene(envScene, 0, 0.1, 200);
  envMat.dispose(); envGeo.dispose(); pmrem.dispose();
  disposables.push(envRT);

  const drawSize = new THREE.Vector2();
  return {
    group,
    envMap: envRT.texture,
    update(camera, t) {
      time.value = t;
      sky.position.copy(camera.position);
      sunMesh.quaternion.copy(camera.quaternion);
      dustUniforms.uCam.value.copy(camera.position);
      const h = renderer.getDrawingBufferSize(drawSize).y;
      pixel.value = h / 900;
      dustUniforms.uPixel.value = h / (2 * Math.tan((camera.fov * Math.PI) / 360));
    },
    dispose() { disposables.forEach((d) => d.dispose()); },
  };
}
