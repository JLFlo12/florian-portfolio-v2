import * as THREE from 'three';
import { NOISE } from '../shaders/noise';
import type { SpaceObject } from './Derelicts';

const fragment = /* glsl */ `
uniform samplerCube uEnv;
uniform float uTime;
varying vec3 vNormalW;
varying vec3 vWorld;
${NOISE}
void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorld);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  // Le ciel vu à travers la bulle : rayons fortement déviés, puis tordus par un remous lent
  vec3 d = refract(-V, N, 0.6);
  float swirl = vnoise(N * 3.0 + uTime * 0.12) * 2.0 - 1.0;
  d = normalize(d + cross(N, V) * swirl * 0.7);
  vec3 col = textureLod(uEnv, d, 0.0).rgb * 2.4;
  float rim = pow(1.0 - ndv, 2.5);
  col += vec3(0.28, 0.49, 0.73) * rim * (1.1 + 0.5 * sin(uTime * 0.7));
  // Cœur sombre : au centre, plus rien ne ressort
  col *= 1.0 - smoothstep(0.55, 0.97, ndv) * 0.92;
  gl_FragColor = vec4(col, 1.0);
}`;

/** Anomalie gravitationnelle : une bulle où le ciel se replie sur lui-même autour d'un cœur noir. */
export const makeAnomaly = (radius: number, env: THREE.CubeTexture): SpaceObject => {
  const geometry = new THREE.SphereGeometry(radius, 48, 32);
  const material = new THREE.ShaderMaterial({
    uniforms: { uEnv: { value: env }, uTime: { value: 0 } },
    defines: { OCTAVES: 3 },
    vertexShader: /* glsl */ `
      varying vec3 vNormalW;
      varying vec3 vWorld;
      void main() {
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: fragment,
  });
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);
  return {
    group,
    drawDistance: 30000,
    update(_dt, time) {
      material.uniforms.uTime.value = time;
      mesh.scale.setScalar(1 + 0.06 * Math.sin(time * 0.45));
    },
    dispose() { geometry.dispose(); material.dispose(); },
  };
};
