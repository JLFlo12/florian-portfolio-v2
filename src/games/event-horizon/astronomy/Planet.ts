import * as THREE from 'three';
import { NOISE } from '../shaders/noise';
import { SUN_DIR } from '../universe/bodies';
import type { QualityPreset } from '../engine/quality';

export type PlanetKind = 'ocean' | 'moon' | 'gas';

const KIND_ID: Record<PlanetKind, number> = { ocean: 0, moon: 1, gas: 2 };

const vertex = /* glsl */ `
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vWorld;
void main() {
  vObj = position;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const fragment = /* glsl */ `
uniform vec3 uSun;
uniform float uTime;
uniform float uSeed;
uniform mat4 modelMatrix;
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vWorld;
${NOISE}

mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }

#if KIND == 0
float height(vec3 p) {
  float w = fbm(p * 1.6 + uSeed);
  return fbm(p * 2.4 + uSeed + w) * 0.8 + fbm(p * 10.0 + uSeed) * 0.2;
}
#elif KIND == 1
float height(vec3 p) {
  float h = fbm(p * 3.0 + uSeed) * 0.7 + fbm(p * 13.0 + uSeed) * 0.3;
  // Cratères : creux circulaires répartis sur une grille bruitée
  vec3 q = p * 7.0 + uSeed;
  vec3 id = floor(q);
  vec3 c = vec3(hash13(id), hash13(id + 7.0), hash13(id + 13.0));
  float d = length(fract(q) - 0.25 - c * 0.5);
  float size = 0.12 + 0.2 * hash13(id + 3.0);
  float crater = (1.0 - smoothstep(size * 0.75, size, d)) * 0.12 - (1.0 - smoothstep(size, size * 1.15, d)) * smoothstep(size * 0.8, size, d) * 0.07;
  return h - crater * step(0.45, hash13(id + 21.0));
}
#endif

// Normale perturbée par le relief (différences finies sur la sphère)
#if KIND != 2
vec3 bumped(vec3 p, vec3 n, float h0, float strength) {
  vec3 t1 = normalize(cross(n, vec3(0.0, 1.0, 0.001)));
  vec3 t2 = cross(n, t1);
  float e = 0.004;
  float h1 = height(normalize(p + t1 * e));
  float h2 = height(normalize(p + t2 * e));
  return normalize(n - strength * ((h1 - h0) * t1 + (h2 - h0) * t2) / e);
}
#endif

void main() {
  vec3 p = normalize(vObj);
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorld);
  mat3 toWorld = mat3(modelMatrix);
  vec3 col;
  float fres = pow(clamp(1.0 - dot(N, V), 0.0, 1.0), 3.0);

#if KIND == 0
  float h = height(p);
  float sea = 0.5;
  float land = smoothstep(sea, sea + 0.008, h);
  float alt = clamp((h - sea) / 0.3, 0.0, 1.0);
  float lat = abs(p.y);

  vec3 ocean = mix(vec3(0.006, 0.03, 0.085), vec3(0.02, 0.13, 0.2), smoothstep(sea - 0.16, sea, h));
  vec3 lowland = mix(vec3(0.17, 0.16, 0.08), vec3(0.07, 0.12, 0.05), fbm(p * 6.0 + 3.0));
  vec3 dry = vec3(0.36, 0.27, 0.16);
  vec3 rock = vec3(0.22, 0.2, 0.18);
  float arid = smoothstep(0.42, 0.6, fbm(p * 2.2 + 31.0)) * (1.0 - smoothstep(0.35, 0.7, lat));
  vec3 ground = mix(lowland, dry, arid);
  ground = mix(ground, rock, smoothstep(0.35, 0.75, alt));
  ground = mix(ground, vec3(0.8, 0.83, 0.87), smoothstep(0.78, 0.95, alt));
  vec3 surface = mix(ocean, ground, land);
  float ice = smoothstep(0.80, 0.88, lat + (h - 0.5) * 0.35);
  surface = mix(surface, vec3(0.82, 0.87, 0.92), ice);

  vec3 Ns = N;
  if (land > 0.01) Ns = normalize(mix(N, toWorld * bumped(p, p, h, 0.05), land * (1.0 - ice * 0.6)));

  // Nuages portés par la circulation atmosphérique
  vec3 q = rotY(uTime * 0.004) * p;
  float cl = fbm(q * 3.2 + vec3(0.0, uTime * 0.002, 0.0) + fbm(q * 6.5 + 11.0) * 0.75);
  float cover = smoothstep(0.5, 0.72, cl) * (0.55 + 0.45 * smoothstep(0.1, 0.5, lat + 0.25));

  float ndl = dot(Ns, uSun);
  float ndlG = dot(N, uSun);
  float day = smoothstep(-0.1, 0.22, ndlG);
  col = surface * max(ndl, 0.0);
  vec3 H = normalize(uSun + V);
  col += vec3(1.0, 0.94, 0.85) * pow(max(dot(N, H), 0.0), 90.0) * (1.0 - land) * (1.0 - ice) * 0.9 * day;
  col = mix(col, vec3(0.92, 0.94, 0.96) * max(ndlG * 0.9 + 0.1, 0.0), cover);
  // Diffusion atmosphérique au limbe, rougie près du terminateur
  vec3 scatter = mix(vec3(0.85, 0.38, 0.16), vec3(0.28, 0.5, 0.9), smoothstep(0.0, 0.3, ndlG));
  col += scatter * fres * day * 0.7;
  col = mix(col, col * vec3(1.0, 0.72, 0.5), (1.0 - smoothstep(0.0, 0.25, ndlG)) * 0.6);
  col += surface * 0.004;
#elif KIND == 1
  float h = height(p);
  vec3 Ns = toWorld * bumped(p, p, h, 0.09);
  vec3 base = mix(vec3(0.12, 0.115, 0.11), vec3(0.38, 0.36, 0.34), smoothstep(0.25, 0.75, h));
  base = mix(base, vec3(0.2, 0.17, 0.15), smoothstep(0.5, 0.7, fbm(p * 1.7 + uSeed + 5.0)) * 0.6);
  col = base * max(dot(Ns, uSun), 0.0) * 1.15 + base * 0.003;
#else
  // Géante gazeuse : bandes en latitude, cisaillées par des vents de vitesses différentes
  float y = p.y;
  float T = uTime / 240.0;
  float t1 = fract(T), t2 = fract(T + 0.5);
  float wind = sin(y * 11.0 + uSeed) * 0.9 + sin(y * 23.0) * 0.35;
  vec3 pa = rotY(wind * (t1 - 0.5) * 2.4) * p;
  vec3 pb = rotY(wind * (t2 - 0.5) * 2.4 + 1.3) * p;
  float wgt = abs(2.0 * t1 - 1.0);
  float turb = mix(fbm(vec3(pa.x * 3.0, y * 9.0, pa.z * 3.0) + uSeed), fbm(vec3(pb.x * 3.0, y * 9.0, pb.z * 3.0) + uSeed), wgt);
  float fine = mix(fbm(vec3(pa.x * 9.0, y * 30.0, pa.z * 9.0)), fbm(vec3(pb.x * 9.0, y * 30.0, pb.z * 9.0)), wgt);
  float bands = sin(y * 17.0 + (turb - 0.5) * 3.2 + sin(y * 5.0) * 1.5);
  vec3 c1 = vec3(0.34, 0.24, 0.15);
  vec3 c2 = vec3(0.56, 0.47, 0.35);
  vec3 c3 = vec3(0.25, 0.22, 0.24);
  col = mix(c1, c2, smoothstep(-0.55, 0.55, bands));
  col = mix(col, c3, smoothstep(0.55, 0.8, fbm(vec3(0.0, y * 7.0 + uSeed, 3.0)) + (fine - 0.5) * 0.25) * 0.7);
  col *= 0.82 + 0.36 * fine;
  // Régions polaires plus froides et plus bleues
  col = mix(col, vec3(0.3, 0.36, 0.44), smoothstep(0.62, 0.95, abs(y)) * 0.7);
  float ndl = dot(N, uSun);
  // Assombrissement au limbe : l'atmosphère épaisse absorbe la lumière rasante
  col *= smoothstep(-0.05, 0.35, ndl) * max(ndl, 0.0) * (0.55 + 0.45 * max(dot(N, V), 0.0));
  col += vec3(0.5, 0.56, 0.7) * fres * smoothstep(-0.05, 0.3, ndl) * 0.12;
  col *= 0.72;
#endif

  gl_FragColor = vec4(col * 1.7, 1.0);
}`;

const atmosphereFragment = /* glsl */ `
uniform vec3 uSun;
uniform vec3 uColor;
uniform float uEdge;
varying vec3 vNormalW;
varying vec3 vWorld;
void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorld);
  // Face arrière : x vaut 0 sur le bord extérieur du halo et uEdge au limbe de la planète
  float x = clamp(-dot(N, V) / uEdge, 0.0, 1.0);
  float halo = pow(x, 2.2);
  float lit = smoothstep(-0.25, 0.3, dot(N, uSun));
  gl_FragColor = vec4(uColor * halo * lit, 1.0);
}`;

const ringFragment = /* glsl */ `
uniform vec3 uSun;
uniform vec3 uCenter;
uniform float uPlanetRadius;
uniform float uInner;
uniform float uOuter;
varying vec3 vWorld;
varying vec3 vLocal;
${NOISE}
void main() {
  float r = length(vLocal.xy);
  float u = (r - uInner) / (uOuter - uInner);
  // Structure radiale : anneaux fins, lacunes, bords doux
  float n = fbm(vec3(u * 14.0, 3.0, 7.0)) * 0.65 + fbm(vec3(u * 70.0, 9.0, 1.0)) * 0.35;
  float alpha = smoothstep(0.0, 0.03, u) * (1.0 - smoothstep(0.94, 1.0, u)) * smoothstep(0.3, 0.62, n);
  alpha *= 1.0 - (1.0 - smoothstep(0.0, 0.02, abs(u - 0.58))) * 0.9; // division principale
  vec3 col = mix(vec3(0.42, 0.36, 0.3), vec3(0.78, 0.74, 0.68), n);
  // Ombre de la planète sur les anneaux
  vec3 q = vWorld - uCenter;
  float along = dot(q, uSun);
  float off = sqrt(max(dot(q, q) - along * along, 0.0));
  float shadow = along < 0.0 ? smoothstep(uPlanetRadius * 0.97, uPlanetRadius * 1.03, off) : 1.0;
  gl_FragColor = vec4(col * (0.04 + 0.7 * shadow), alpha * 0.85);
}`;

export interface PlanetOptions {
  kind: PlanetKind;
  radius: number;
  seed: number;
  /** Tours par seconde, très lent. */
  spin: number;
  tilt?: number;
  atmosphere?: THREE.Color;
  rings?: { inner: number; outer: number };
}

/** Corps céleste procédural : surface, nuages, atmosphère et anneaux calculés par shader. */
export class Planet {
  readonly group = new THREE.Group();
  private body: THREE.Mesh;
  private materials: THREE.ShaderMaterial[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private ringMaterial: THREE.ShaderMaterial | null = null;

  constructor(readonly options: PlanetOptions, quality: QualityPreset) {
    const { kind, radius } = options;
    const segments = kind === 'moon' ? Math.round(quality.planetSegments / 2) : quality.planetSegments;
    const geometry = new THREE.SphereGeometry(radius, segments, Math.round(segments / 2));
    const material = new THREE.ShaderMaterial({
      uniforms: { uSun: { value: SUN_DIR }, uTime: { value: 0 }, uSeed: { value: options.seed } },
      defines: { KIND: KIND_ID[kind], OCTAVES: quality.octaves },
      vertexShader: vertex,
      fragmentShader: fragment,
    });
    this.body = new THREE.Mesh(geometry, material);
    this.geometries.push(geometry);
    this.materials.push(material);

    const tilted = new THREE.Group();
    tilted.rotation.z = options.tilt ?? 0;
    tilted.add(this.body);
    this.group.add(tilted);

    if (options.atmosphere) {
      const scale = kind === 'gas' ? 1.035 : 1.06;
      const shell = new THREE.SphereGeometry(radius * scale, segments, Math.round(segments / 2));
      const atmosphere = new THREE.ShaderMaterial({
        uniforms: {
          uSun: { value: SUN_DIR },
          uColor: { value: options.atmosphere },
          uEdge: { value: Math.sqrt(1 - 1 / (scale * scale)) },
        },
        vertexShader: vertex,
        fragmentShader: atmosphereFragment,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      });
      this.group.add(new THREE.Mesh(shell, atmosphere));
      this.geometries.push(shell);
      this.materials.push(atmosphere);
    }

    if (options.rings) {
      const { inner, outer } = options.rings;
      const ringGeometry = new THREE.RingGeometry(inner, outer, 160, 1);
      this.ringMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uSun: { value: SUN_DIR },
          uCenter: { value: new THREE.Vector3() },
          uPlanetRadius: { value: radius },
          uInner: { value: inner },
          uOuter: { value: outer },
        },
        defines: { OCTAVES: 5 },
        vertexShader: /* glsl */ `
          varying vec3 vWorld;
          varying vec3 vLocal;
          void main() {
            vLocal = position;
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader: ringFragment,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeometry, this.ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      tilted.add(ring);
      this.geometries.push(ringGeometry);
      this.materials.push(this.ringMaterial);
    }
  }

  update(scenePosition: THREE.Vector3, time: number) {
    this.group.position.copy(scenePosition);
    this.body.rotation.y = time * this.options.spin * Math.PI * 2;
    (this.body.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
    this.ringMaterial?.uniforms.uCenter.value.copy(scenePosition);
  }

  dispose() {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
