import * as THREE from 'three';
import { NOISE } from '../shaders/noise';
import type { QualityPreset } from '../engine/quality';

/** Rayon (en rayons de Schwarzschild) de la sphère dans laquelle la lumière est intégrée. */
const PROXY = 13;

const fragment = /* glsl */ `
uniform vec3 uCenter;
uniform float uRs;
uniform mat3 uRot;
uniform mat3 uInv;
uniform samplerCube uEnv;
uniform float uTime;
varying vec3 vWorld;

#define PROXY ${PROXY.toFixed(1)}
#define RIN 2.6
#define ROUT 9.5
#define PERIOD 36.0
${NOISE}

float diskNoise(float a, float rr) {
  vec2 cs = vec2(cos(a), sin(a));
  return fbm(vec3(cs * 2.2, rr * 1.4)) * 0.75 + fbm(vec3(cs * 5.0 + 7.0, rr * 5.5)) * 0.6;
}

// Émission du disque d'accrétion au point hp (plan y = 0), vu par un rayon de direction v.
vec4 disk(vec3 hp, float rr, vec3 v) {
  float u = (rr - RIN) / (ROUT - RIN);
  float ang = atan(hp.z, hp.x);
  // Rotation képlérienne : l'intérieur tourne plus vite. Deux phases fondues en boucle
  // évitent que le cisaillement n'étire le motif à l'infini.
  float omega = 2.2 * pow(rr, -1.5);
  float T = uTime / PERIOD;
  float t1 = fract(T), t2 = fract(T + 0.5);
  float nA = diskNoise(ang - omega * (t1 - 0.5) * PERIOD, rr);
  float nB = diskNoise(ang + 1.7 - omega * (t2 - 0.5) * PERIOD, rr);
  float n = mix(nA, nB, abs(2.0 * t1 - 1.0));

  float ring = smoothstep(0.0, 0.05, u) * (1.0 - smoothstep(0.5, 1.0, u));
  float dens = ring * (0.22 + 1.25 * n * n);
  dens *= 0.78 + 0.22 * sin(rr * 9.0 + n * 6.0);

  float heat = pow(clamp(1.0 - u, 0.0, 1.0), 2.4);
  vec3 c = mix(vec3(0.55, 0.16, 0.04), vec3(0.90, 0.54, 0.20), smoothstep(0.0, 0.45, heat));
  c = mix(c, vec3(1.0, 0.86, 0.66), smoothstep(0.4, 1.0, heat));
  float lum = 0.4 + 3.4 * heat;

  // Effet Doppler relativiste : le côté qui vient vers l'observateur est plus lumineux.
  vec3 velDir = normalize(vec3(-hp.z, 0.0, hp.x));
  float beta = 0.62 / sqrt(rr);
  float dop = 1.0 / (1.0 - beta * dot(velDir, -normalize(v)));
  lum *= dop * dop * dop;
  // Décalage gravitationnel vers le rouge près de l'horizon
  lum *= sqrt(max(1.0 - 1.0 / rr, 0.0));

  return vec4(c * lum * dens, clamp(dens * 1.3, 0.0, 1.0));
}

void main() {
  vec3 ro = uInv * ((cameraPosition - uCenter) / uRs);
  vec3 rd = normalize(uInv * (vWorld - cameraPosition));

  // Si la caméra est hors de la sphère, on avance jusqu'à son entrée.
  float b = dot(ro, rd);
  float c = dot(ro, ro) - PROXY * PROXY;
  if (c > 0.0) ro += rd * max(-b - sqrt(max(b * b - c, 0.0)), 0.0);

  vec3 p = ro, v = rd;
  vec3 L = cross(p, v);
  float h2 = dot(L, L);
  vec3 col = vec3(0.0);
  float trans = 1.0;
  bool captured = false;
  float k = 8.4 / float(STEPS);

  // Géodésique lumineuse dans la métrique de Schwarzschild : a = -1.5 h² p / r⁵
  // Rayon qui passe au large : il ne touche ni le disque ni les jets, et la déviation est
  // fondue dans le ciel normal (w = 1 plus bas). Le résultat est le même, sans intégration.
  if (h2 > PROXY * PROXY * 0.9409) {
    gl_FragColor = vec4(textureLod(uEnv, uRot * rd, 0.0).rgb, 1.0);
    return;
  }
  for (int i = 0; i < STEPS; i++) {
    // Disque devenu opaque : plus rien derrière ne peut apparaître
    if (trans < 0.004) break;
    float r2 = dot(p, p);
    float r = sqrt(r2);
    if (r < 1.0) { captured = true; break; }
    if (r > PROXY * 1.001 && dot(p, v) > 0.0) break;
    float dt = clamp(k * r, 0.035, 1.3);
    v += -1.5 * h2 * p / (r2 * r2 * r) * dt;
    vec3 pn = p + v * dt;
    if (p.y * pn.y < 0.0) {
      vec3 hp = mix(p, pn, p.y / (p.y - pn.y));
      float rr = length(hp.xz);
      if (rr > RIN && rr < ROUT && trans > 0.01) {
        vec4 d = disk(hp, rr, v);
        col += trans * d.rgb;
        trans *= 1.0 - d.a;
      }
    }
    // Jets relativistes : deux colonnes de plasma le long de l'axe de rotation, courbées
    // par la lentille comme le reste puisqu'elles sont intégrées le long du même rayon.
    float hy = abs(p.y);
    float jw = 0.2 + 0.07 * hy;
    float rho2 = dot(p.xz, p.xz);
    if (hy > 1.3 && rho2 < jw * jw * 7.0) {
      float core = exp(-rho2 / (jw * jw));
      float fade = smoothstep(1.3, 2.8, hy) * (1.0 - smoothstep(5.0, 12.0, hy));
      float knots = 0.5 + 0.95 * vnoise(vec3(p.xz * 2.5, hy * 1.3 - uTime * 1.5));
      col += trans * vec3(0.3, 0.5, 0.95) * core * fade * knots * dt * 0.55;
    }
    p = pn;
  }

  if (!captured) {
    // Loin du centre la déviation devient négligeable : raccord sans couture avec le vrai ciel.
    float w = smoothstep(PROXY * 0.7, PROXY * 0.97, sqrt(h2));
    vec3 dir = uRot * normalize(mix(normalize(v), rd, w));
    col += trans * textureLod(uEnv, dir, 0.0).rgb;
  }
  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}`;

/**
 * NEMESIS-01. Horizon, disque d'accrétion, anneau de photons et lentille gravitationnelle
 * sortent tous du même calcul : chaque pixel suit un rayon de lumière courbé par la gravité.
 */
export class BlackHole {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private geometry: THREE.SphereGeometry;

  constructor(readonly rs: number, env: THREE.CubeTexture, quality: QualityPreset) {
    // Inclinaison du disque par rapport au plan de départ du joueur
    const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.16, 0.4, -0.2));
    const rot = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(tilt));
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uCenter: { value: new THREE.Vector3() },
        uRs: { value: rs },
        uRot: { value: rot },
        uInv: { value: rot.clone().transpose() },
        uEnv: { value: env },
        uTime: { value: 0 },
      },
      defines: { STEPS: quality.blackHoleSteps, OCTAVES: Math.min(quality.octaves, 5) },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: fragment,
      side: THREE.BackSide,
    });
    this.geometry = new THREE.SphereGeometry(1, 48, 32);
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.scale.setScalar(rs * PROXY);
  }

  update(scenePosition: THREE.Vector3, time: number) {
    this.mesh.position.copy(scenePosition);
    this.material.uniforms.uCenter.value.copy(scenePosition);
    this.material.uniforms.uTime.value = time;
  }

  /** Accélération gravitationnelle simplifiée, en unités/s², à la distance r du centre. */
  gravityAt(r: number) {
    const x = this.rs / r;
    const fade = THREE.MathUtils.smoothstep(r, this.rs * 14, this.rs * 26);
    return 1100 * x * x * (1 - fade);
  }

  /** Dilatation temporelle (Schwarzschild, observateur statique) : 1 loin, 0 à l'horizon. */
  timeFactor(r: number) {
    return Math.sqrt(Math.max(0, 1 - this.rs / r));
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
