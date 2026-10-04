import * as THREE from 'three';

/* ───────────────────────────────────────────────────────────────
   Simulation de fluide sur GPU (méthode « stable fluids ») pour une carte de
   la bande de projets. La souris remue le liquide et y dépose de l'« encre »
   (texture `output`, canal rouge, en coordonnées de la carte) ; le shader de
   la carte s'en sert pour faire apparaître l'image. Réglée pour un liquide
   épais (peu de tourbillons, mouvement vite freiné) plutôt qu'une fumée.
   Basse résolution : une vingtaine de passes très légères par image.
   ─────────────────────────────────────────────────────────────── */

const SIM: [number, number] = [96, 60];     // vitesse (format 16:10 de la carte)
const DYE: [number, number] = [320, 200];   // encre
const ASPECT = 1.6;
const PRESSURE_STEPS = 12;
const CURL = 3;              // presque pas de tourbillons : liquide, pas fumée
const VELOCITY_FADE = 2.2;   // liquide épais : le mouvement s'arrête vite
const DYE_FADE = 0.9;        // l'encre s'évapore en ~2 s
const SPLAT_RADIUS = 0.0022; // petite zone révélée autour de la souris
const SPLAT_FORCE = 2600;

const vertex = /* glsl */ `
  uniform vec2 uTexel;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  void main() {
    vUv = uv;
    vL = uv - vec2(uTexel.x, 0.0);
    vR = uv + vec2(uTexel.x, 0.0);
    vT = uv + vec2(0.0, uTexel.y);
    vB = uv - vec2(0.0, uTexel.y);
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const passes = {
  splat: /* glsl */ `
    uniform sampler2D uTarget;
    uniform float uAspect;
    uniform vec3 uColor;
    uniform vec2 uPoint;
    uniform float uRadius;
    varying vec2 vUv;
    void main() {
      vec2 p = vUv - uPoint;
      p.x *= uAspect;
      gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + exp(-dot(p, p) / uRadius) * uColor, 1.0);
    }
  `,
  advect: /* glsl */ `
    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 uVelocityTexel;
    uniform float uDt;
    uniform float uFade;
    varying vec2 vUv;
    void main() {
      vec2 from = vUv - uDt * texture2D(uVelocity, vUv).xy * uVelocityTexel;
      gl_FragColor = texture2D(uSource, from) / (1.0 + uFade * uDt);
    }
  `,
  curl: /* glsl */ `
    uniform sampler2D uVelocity;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    void main() {
      float l = texture2D(uVelocity, vL).y;
      float r = texture2D(uVelocity, vR).y;
      float t = texture2D(uVelocity, vT).x;
      float b = texture2D(uVelocity, vB).x;
      gl_FragColor = vec4(0.5 * (r - l - t + b), 0.0, 0.0, 1.0);
    }
  `,
  vorticity: /* glsl */ `
    uniform sampler2D uVelocity;
    uniform sampler2D uCurl;
    uniform float uCurlStrength;
    uniform float uDt;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    void main() {
      float l = texture2D(uCurl, vL).x;
      float r = texture2D(uCurl, vR).x;
      float t = texture2D(uCurl, vT).x;
      float b = texture2D(uCurl, vB).x;
      float c = texture2D(uCurl, vUv).x;
      vec2 force = 0.5 * vec2(abs(t) - abs(b), abs(r) - abs(l));
      force /= length(force) + 0.0001;
      force *= uCurlStrength * c;
      force.y *= -1.0;
      vec2 velocity = texture2D(uVelocity, vUv).xy + force * uDt;
      gl_FragColor = vec4(clamp(velocity, -1000.0, 1000.0), 0.0, 1.0);
    }
  `,
  divergence: /* glsl */ `
    uniform sampler2D uVelocity;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    void main() {
      vec2 c = texture2D(uVelocity, vUv).xy;
      float l = vL.x < 0.0 ? -c.x : texture2D(uVelocity, vL).x;
      float r = vR.x > 1.0 ? -c.x : texture2D(uVelocity, vR).x;
      float t = vT.y > 1.0 ? -c.y : texture2D(uVelocity, vT).y;
      float b = vB.y < 0.0 ? -c.y : texture2D(uVelocity, vB).y;
      gl_FragColor = vec4(0.5 * (r - l + t - b), 0.0, 0.0, 1.0);
    }
  `,
  fade: /* glsl */ `
    uniform sampler2D uTexture;
    uniform float uValue;
    varying vec2 vUv;
    void main() {
      gl_FragColor = uValue * texture2D(uTexture, vUv);
    }
  `,
  pressure: /* glsl */ `
    uniform sampler2D uPressure;
    uniform sampler2D uDivergence;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    void main() {
      float l = texture2D(uPressure, vL).x;
      float r = texture2D(uPressure, vR).x;
      float t = texture2D(uPressure, vT).x;
      float b = texture2D(uPressure, vB).x;
      gl_FragColor = vec4((l + r + b + t - texture2D(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0);
    }
  `,
  gradient: /* glsl */ `
    uniform sampler2D uPressure;
    uniform sampler2D uVelocity;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    void main() {
      float l = texture2D(uPressure, vL).x;
      float r = texture2D(uPressure, vR).x;
      float t = texture2D(uPressure, vT).x;
      float b = texture2D(uPressure, vB).x;
      gl_FragColor = vec4(texture2D(uVelocity, vUv).xy - vec2(r - l, t - b), 0.0, 1.0);
    }
  `,
};

type Pass = keyof typeof passes;

const target = ([w, h]: [number, number]) => new THREE.WebGLRenderTarget(w, h, {
  type: THREE.HalfFloatType,
  format: THREE.RGBAFormat,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  depthBuffer: false,
  stencilBuffer: false,
});

// Deux cibles qu'on échange : on lit l'une pendant qu'on écrit dans l'autre
const pingPong = (size: [number, number]) => {
  const pair = { read: target(size), write: target(size), swap() { [pair.read, pair.write] = [pair.write, pair.read]; } };
  return pair;
};

/** Texel de l'encre, pour lire ses voisins dans le shader de la carte. */
export const INK_TEXEL = new THREE.Vector2(1 / DYE[0], 1 / DYE[1]);

export function createFluid(renderer: THREE.WebGLRenderer) {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const scene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  scene.add(quad);

  const materials = Object.fromEntries(Object.entries(passes).map(([name, fragmentShader]) => [name, new THREE.ShaderMaterial({
    uniforms: {
      uTexel: { value: new THREE.Vector2() }, uVelocityTexel: { value: new THREE.Vector2(1 / SIM[0], 1 / SIM[1]) },
      uTarget: { value: null }, uVelocity: { value: null }, uSource: { value: null }, uCurl: { value: null },
      uPressure: { value: null }, uDivergence: { value: null }, uTexture: { value: null },
      uAspect: { value: ASPECT }, uColor: { value: new THREE.Vector3() }, uPoint: { value: new THREE.Vector2() }, uRadius: { value: SPLAT_RADIUS },
      uDt: { value: 0 }, uFade: { value: 0 }, uCurlStrength: { value: CURL }, uValue: { value: 0 },
    },
    vertexShader: vertex,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
  })])) as Record<Pass, THREE.ShaderMaterial>;

  const velocity = pingPong(SIM);
  const pressure = pingPong(SIM);
  const dye = pingPong(DYE);
  const divergence = target(SIM);
  const curl = target(SIM);
  const splats: { x: number; y: number; dx: number; dy: number }[] = [];

  // Lance une passe : uniforms à jour, rendu du quad plein écran dans la cible
  const run = (pass: Pass, out: THREE.WebGLRenderTarget, uniforms: Record<string, unknown>, size = SIM) => {
    const material = materials[pass];
    material.uniforms.uTexel.value.set(1 / size[0], 1 / size[1]);
    for (const [key, value] of Object.entries(uniforms)) material.uniforms[key].value = value;
    quad.material = material;
    renderer.setRenderTarget(out);
    renderer.render(scene, camera);
  };

  // Les passes modifient l'état du rendu : on le rétablit ensuite
  const isolated = (draw: () => void) => {
    const previous = renderer.getRenderTarget();
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    draw();
    renderer.setRenderTarget(previous);
    renderer.autoClear = autoClear;
  };

  return {
    /** Encre actuelle (canal rouge), en coordonnées de la carte. */
    get output() { return dye.read.texture; },

    /** Mouvement du pointeur sur la carte, en coordonnées 0–1 (origine en bas à gauche). */
    splat(x: number, y: number, dx: number, dy: number) {
      splats.push({ x, y, dx, dy });
    },

    /** Vide le liquide (la simulation passe à une autre carte). */
    clear() {
      splats.length = 0;
      isolated(() => {
        for (const pair of [velocity, pressure, dye]) {
          run('fade', pair.write, { uTexture: pair.read.texture, uValue: 0 }, pair === dye ? DYE : SIM);
          pair.swap();
        }
      });
    },

    step(dt: number) {
      isolated(() => {
        for (const s of splats.splice(0)) {
          const point = new THREE.Vector2(s.x, s.y);
          run('splat', velocity.write, { uTarget: velocity.read.texture, uPoint: point, uColor: new THREE.Vector3(s.dx * SPLAT_FORCE, s.dy * SPLAT_FORCE, 0), uRadius: SPLAT_RADIUS * 1.6 });
          velocity.swap();
          // Plus d'encre quand la souris va vite, jamais trop peu pour qu'une goutte apparaisse
          const ink = 0.55 + Math.min(Math.hypot(s.dx * ASPECT, s.dy) * 30, 0.6);
          run('splat', dye.write, { uTarget: dye.read.texture, uPoint: point, uColor: new THREE.Vector3(ink, 0, 0), uRadius: SPLAT_RADIUS }, DYE);
          dye.swap();
        }
        run('curl', curl, { uVelocity: velocity.read.texture });
        run('vorticity', velocity.write, { uVelocity: velocity.read.texture, uCurl: curl.texture, uCurlStrength: CURL, uDt: dt });
        velocity.swap();
        run('divergence', divergence, { uVelocity: velocity.read.texture });
        run('fade', pressure.write, { uTexture: pressure.read.texture, uValue: 0.8 });
        pressure.swap();
        for (let i = 0; i < PRESSURE_STEPS; i++) {
          run('pressure', pressure.write, { uPressure: pressure.read.texture, uDivergence: divergence.texture });
          pressure.swap();
        }
        run('gradient', velocity.write, { uPressure: pressure.read.texture, uVelocity: velocity.read.texture });
        velocity.swap();
        run('advect', velocity.write, { uVelocity: velocity.read.texture, uSource: velocity.read.texture, uDt: dt, uFade: VELOCITY_FADE });
        velocity.swap();
        run('advect', dye.write, { uVelocity: velocity.read.texture, uSource: dye.read.texture, uDt: dt, uFade: DYE_FADE }, DYE);
        dye.swap();
      });
    },

    dispose() {
      [velocity.read, velocity.write, pressure.read, pressure.write, dye.read, dye.write, divergence, curl].forEach((t) => t.dispose());
      Object.values(materials).forEach((m) => m.dispose());
      quad.geometry.dispose();
    },
  };
}

export type Fluid = ReturnType<typeof createFluid>;
