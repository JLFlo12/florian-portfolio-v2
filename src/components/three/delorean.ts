import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { gsap } from '@/lib/motion';
import { metalEnvironment } from './satellites';

/* ═══════════════════════════════════════════════════════════════
   LA DELOREAN DU SITE (clin d'œil à « Retour vers le futur »)
   Elle fait partie du décor, comme les satellites : toute petite, roues repliées, elle vole lentement en rond
   dans le fond de l'écran, derrière le contenu des pages (canvas transparent, components/fx/TimeTravel.tsx).

   Quand on entre sur la page de Jarvis ou qu'on en sort, c'est elle qui change la page (saut dans le temps) :
   1. ses phares s'allument, elle se cabre, puis elle part d'où elle est, sans coupure ;
   2. en entrée, elle fonce droit sur nous à plus de 400 km/h ; en sortie, elle plonge vers nous, vire au ras
      de l'objectif, puis s'enfuit vers le fond en accélérant ;
   3. à l'instant où elle nous atteint (ou disparaît au loin), un éclat de lumière couvre l'écran :
      la page change dessous ;
   4. l'éclat se referme sur la nouvelle page ; il reste deux traînées de feu, qui s'éteignent ;
   5. trois éclairs dans le fond : elle réapparaît en freinant, et reprend sa ronde.

   La vitesse se lit à : l'accélération réelle (elle grossit de plus en plus vite), le filé (flou de zoom vers
   la voiture), les traits de vitesse, le tremblement de la caméra, l'angle qui s'ouvre.

   Rendu : la scène est dessinée dans une cible flottante (avec sa transparence), un halo lumineux est calculé
   à part, puis tout est recomposé en couleurs prémultipliées : la lumière (phares, feu) s'ajoute à la page sans
   l'assombrir, la carrosserie la cache. Au repos, seul le petit rectangle autour de la voiture est redessiné.

   Le modèle : public/transition/delorean.glb, « DeLorean DMC-12 » de JandroS (Sketchfab, CC BY 4.0), préparé
   dans Blender : 4,2 m de long, avant vers +Z, quatre roues séparées (wheel_F_p, wheel_F_n, wheel_R_p,
   wheel_R_n ; origine au moyeu) pour qu'elles se replient.
   ═══════════════════════════════════════════════════════════════ */

const MODEL = '/transition/delorean.glb';
const LENGTH = 4.2;          // longueur de la voiture (m)
const CG = 0.6;              // l'origine de la voiture est au milieu de la caisse (elle s'incline autour de ce point)
const LAMP_Z = 1.96;         // les phares, devant le milieu de la voiture
const LAMP_Y = 0.626 - CG;
const TRACK = 0.876;         // demi-voie
const REAR_AXLE = 1.16;

/* Caméra : immobile, à l'origine, téléobjectif (la voiture au loin garde ses proportions). */
const FOV = 30;
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV) / 2);

/* Ronde de repos : une orbite inclinée, au fond de l'écran */
const ORBIT_D = 115;         // distance moyenne (m) : la voiture mesure 60 à 100 px de long
const ORBIT_T = 76;          // durée d'un tour (s)
const W = (Math.PI * 2) / ORBIT_T;

/* Saut */
const V_IN = 120;            // entrée : vitesse de pointe (m/s), soit 430 km/h
const A_IN = 400;            // m/s²
const V_TURN = 38;           // sortie : vitesse dans le virage au ras de l'objectif
const DIM = 0.55;            // la page s'assombrit pendant la course (les lumières ressortent)

export type TimeMachine = {
  /** La voiture fait sa ronde, prête à partir. */
  ready: () => boolean;
  /** Elle part, appelle `swap` (le changement de page) à l'instant où l'éclat couvre l'écran, et la promesse se
      termine quand la nouvelle page est découverte. Ensuite elle réapparaît toute seule dans le fond. */
  travel: (kind: 'in' | 'out', swap: () => Promise<void>) => Promise<void>;
  /** Cache ou montre la voiture (pages où elle gênerait). */
  setVisible: (on: boolean) => void;
  dispose: () => void;
};

const NOISE = /* glsl */ `
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
  }
  float fbm(vec2 p) { float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 7.1; a *= .5; } return s; }
`;
const FLAME = /* glsl */ `
  // t : température (0 → 1) ; au-dessus de 1, le halo s'en empare
  vec3 flame(float t) {
    vec3 c = mix(vec3(.55, .05, .0), vec3(1., .3, .03), smoothstep(0., .35, t));
    c = mix(c, vec3(1., .62, .14), smoothstep(.3, .65, t));
    c = mix(c, vec3(1., .9, .6), smoothstep(.62, 1., t));
    return c * (.6 + 1.1 * t * t);
  }`;
const QUAD_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

/* Lueur ronde et douce (phares, braises, éclairs) */
const glowTexture = () => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,.55)');
  grad.addColorStop(0.45, 'rgba(255,255,255,.14)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

const smooth = (x: number, a: number, b: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const heading = (v: THREE.Vector3) => Math.atan2(v.x, v.z);
/* Lumière ajoutée : elle s'additionne à ce qui est derrière, sans toucher à la transparence (la page reste visible dessous). */
const LIGHT = {
  transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
  blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
} as const;

/* Trajectoire : des courbes de Bézier bout à bout (les tangentes sont imposées : aucun à-coup de cap),
   échantillonnées une fois, puis parcourues en mètres. */
type Path = { pts: Float32Array; cum: Float32Array; len: number; marks: number[] };
const makePath = (segs: THREE.Vector3[][]): Path => {
  const N = 420, n = segs.length * N + 1;
  const pts = new Float32Array(n * 3), cum = new Float32Array(n), marks: number[] = [];
  const p = new THREE.Vector3(), q = new THREE.Vector3();
  let i = 0;
  segs.forEach(([a, b, c, d], s) => {
    for (let j = s === 0 ? 0 : 1; j <= N; j++) {
      const t = j / N, u = 1 - t;
      p.set(0, 0, 0).addScaledVector(a, u * u * u).addScaledVector(b, 3 * u * u * t).addScaledVector(c, 3 * u * t * t).addScaledVector(d, t * t * t);
      cum[i] = i === 0 ? 0 : cum[i - 1] + p.distanceTo(q);
      pts[i * 3] = p.x; pts[i * 3 + 1] = p.y; pts[i * 3 + 2] = p.z;
      q.copy(p);
      i++;
    }
    marks.push(cum[i - 1]);
  });
  return { pts, cum, len: cum[n - 1], marks };
};
const pathAt = (path: Path, d: number, out: THREE.Vector3) => {
  const { pts, cum } = path;
  let lo = 0, hi = cum.length - 1;
  d = Math.min(path.len, Math.max(0, d));
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= d) lo = mid; else hi = mid; }
  const f = (d - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]);
  return out.set(
    pts[lo * 3] + (pts[hi * 3] - pts[lo * 3]) * f,
    pts[lo * 3 + 1] + (pts[hi * 3 + 1] - pts[lo * 3 + 1]) * f,
    pts[lo * 3 + 2] + (pts[hi * 3 + 2] - pts[lo * 3 + 2]) * f,
  );
};

export const createTimeMachine = async (
  canvas: HTMLCanvasElement,
  layers: { root: HTMLElement; dim: HTMLElement },
): Promise<TimeMachine> => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NoToneMapping;   // l'étalonnage est fait à la recomposition

  const scene = new THREE.Scene();
  const env = metalEnvironment(renderer);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.38;

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 900);
  scene.add(camera);
  const time = { value: 0 };

  /* ── Voiture ── */
  const draco = new DRACOLoader().setDecoderPath('/draco/');
  const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(MODEL);
  draco.dispose();
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const k = LENGTH / (box.max.z - box.min.z);
  model.scale.setScalar(k);
  model.position.set(-(box.min.x + box.max.x) / 2 * k, -box.min.y * k - CG, -(box.min.z + box.max.z) / 2 * k);
  const car = new THREE.Group();   // origine : au milieu de la caisse
  car.add(model);
  scene.add(car);
  const lampMats: { m: THREE.MeshStandardMaterial; on: number }[] = [];   // optiques et feux : allumés avec le contact
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) mesh.frustumCulled = false;
    for (const m of ([] as THREE.Material[]).concat(mesh.material ?? [])) {
      const std = m as THREE.MeshStandardMaterial;
      if (m.name === 'Material.004') { std.color.set(0x050506); std.metalness = 0; std.roughness = 0.3; }   // glace du rétroviseur
      if (std.emissive && std.emissive.getHex() !== 0) {
        std.color.set(0x070707);
        if (m.name === 'headlight') { std.emissive.setRGB(1, 0.93, 0.8); lampMats.push({ m: std, on: 6.5 }); }
        else lampMats.push({ m: std, on: std.emissive.g > 0.5 ? 1.1 : 4.5 });   // plaque blanche : douce ; feux rouges et orange : vifs
      }
    }
  });
  // l'intérieur n'est pas modélisé : un volume sombre empêche de voir à travers les passages de roue
  const inside = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.62, 3.7), new THREE.MeshBasicMaterial({ color: 0x030303 }));
  inside.position.y = 0.5 - CG;
  car.add(inside);
  // elle vole : les quatre roues sont repliées à plat
  const wheels = ['wheel_F_p', 'wheel_F_n', 'wheel_R_p', 'wheel_R_n'].flatMap((name) => {
    const node = model.getObjectByName(name);
    if (!node) return [];
    const side = Math.sign(node.position.x) || 1;
    const base = node.position.clone();
    node.rotation.order = 'ZXY';
    node.rotation.set(0, 0, -side * (Math.PI / 2));
    node.position.set(base.x + (side * 0.2) / k, base.y - 0.07 / k, base.z);
    return [{ base, side }];
  });

  // éclairage : une lumière froide par-dessus, un contre-jour orange (la couleur du site)
  const key = new THREE.DirectionalLight(0xdfe8ff, 0.65);
  key.position.set(-4, 9, 6);
  const rim = new THREE.DirectionalLight(0xff6a1f, 0.9);
  rim.position.set(6, 3, -10);
  scene.add(key, rim);

  const glowMap = glowTexture();
  const sprite = (color: number | THREE.Color, order = 6, depthTest = false) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, color, ...LIGHT, depthTest }));
    sp.renderOrder = order;
    return sp;
  };
  // phares : un trait horizontal par bloc optique (reflet d'objectif) et un petit éclat ; le halo rond vient du bloom
  const streaks = [-0.59, 0.59].map((x) => { const sp = sprite(0xffb070); sp.position.set(x, LAMP_Y, LAMP_Z); sp.scale.set(3.4, 0.11, 1); car.add(sp); return sp; });
  const glares = [-0.59, 0.59].map((x) => { const sp = sprite(0xfff1dc); sp.position.set(x, LAMP_Y, LAMP_Z); sp.scale.setScalar(0.5); car.add(sp); return sp; });
  // une lueur sous chaque roue repliée (la sustentation)
  const hovers = wheels.map((w) => {
    const sp = sprite(0xffb46a, 4, true);
    sp.position.set(w.base.x * k + w.side * 0.2, 0.16 - CG, w.base.z * k + model.position.z);
    sp.scale.set(1.25, 0.5, 1);
    car.add(sp);
    return sp;
  });
  // les deux tuyères, à l'arrière : elles s'embrasent quand elle accélère
  const burners = [-0.46, 0.46].map((x) => {
    const sp = sprite(new THREE.Color(1.8, 0.8, 0.28), 4, true);
    sp.position.set(x, 0.72 - CG, -LENGTH / 2 - 0.05);
    car.add(sp);
    return sp;
  });
  // les trois éclairs qui annoncent son retour
  const pop = sprite(new THREE.Color(5, 3.6, 2.2), 7);
  pop.visible = false;
  scene.add(pop);

  /* ── Traînées de feu : derrière chaque roue, une bande à plat (le cœur) et un rideau (les flammes), le long de la trajectoire ── */
  const fire = { uHead: { value: 0 }, uFrom: { value: 0 }, uDie: { value: 0 }, uTime: time, uK: { value: 0 } };
  const fireMat = new THREE.ShaderMaterial({
    ...LIGHT, side: THREE.DoubleSide, uniforms: fire,
    vertexShader: /* glsl */ `attribute float aD; attribute float aSheet; varying vec2 vUv; varying float vD; varying float vSheet;
      void main() { vUv = uv; vD = aD; vSheet = aSheet; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; varying float vD; varying float vSheet;
      uniform float uHead, uFrom, uDie, uTime, uK;
      ${NOISE}
      ${FLAME}
      void main() {
        float along = (1. - smoothstep(uHead - .4, uHead, vD)) * smoothstep(uFrom, uFrom + 2.5, vD);
        float fresh = exp(-(uHead - vD) * .05);
        // extinction : par plaques, les plus anciennes d'abord
        float alive = 1. - smoothstep(-.3, 0., uDie * 1.6 - noise(vec2(vD * .5, 3.7)) * .9 - .25 - .35 * clamp((vD - uFrom) / 30., 0., 1.));
        float a, t;
        if (vSheet > .5) {
          float h = vUv.y;
          vec2 q = vec2(vD * 1.7, h * 1.9 - uTime * 2.9);
          float warp = fbm(q * 1.2 + vec2(0., uTime * .8));
          float f = fbm(q + vec2(warp * 1.5, -warp));
          float body = f * 1.5 - h * (1.55 - .7 * fresh) - (1. - alive) * 1.2;
          a = smoothstep(.02, .3, body) * (1. - smoothstep(.85, 1., h)) * .6;
          t = clamp(body * 1.25, 0., 1.) * (1. - h * .6);
        } else {
          float x = abs(vUv.y - .5) * 2.;
          float f = fbm(vec2(vD * 2.6 - uTime * 1.2, x * 2. + uTime * .9));
          a = smoothstep(1., .1, x + (1. - f) * .8) * alive * .85;
          t = a * (.5 + .4 * fresh);
        }
        gl_FragColor = vec4(flame(t) * a * along * uK, 1.);
      }`,
  });
  const trails = new THREE.Mesh(new THREE.BufferGeometry(), fireMat);
  trails.frustumCulled = false;
  trails.renderOrder = 3;
  trails.visible = false;
  scene.add(trails);

  /* ── Braises : elles montent des traînées tant qu'elles brûlent ── */
  const SPARKS = 320;
  const sPos = new Float32Array(SPARKS * 3), sCol = new Float32Array(SPARKS * 3);
  const sVel = new Float32Array(SPARKS * 3), sAge = new Float32Array(SPARKS).fill(9), sLife = new Float32Array(SPARKS).fill(1);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sparkGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ map: glowMap, size: 0.085, sizeAttenuation: true, vertexColors: true, ...LIGHT }));
  sparks.frustumCulled = false;
  sparks.renderOrder = 5;
  scene.add(sparks);
  let sparkNext = 0;
  const spark = (x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number) => {
    const i = sparkNext;
    sparkNext = (sparkNext + 1) % SPARKS;
    sPos[i * 3] = x; sPos[i * 3 + 1] = y; sPos[i * 3 + 2] = z;
    sVel[i * 3] = vx; sVel[i * 3 + 1] = vy; sVel[i * 3 + 2] = vz;
    sAge[i] = 0; sLife[i] = life;
  };
  const stepSparks = (dt: number) => {
    let live = 0;
    const drag = Math.exp(-2.4 * dt);
    for (let i = 0; i < SPARKS; i++) {
      const a = (sAge[i] += dt) / sLife[i];
      const j = i * 3;
      if (a >= 1) { sCol[j] = sCol[j + 1] = sCol[j + 2] = 0; continue; }
      live++;
      sVel[j] *= drag; sVel[j + 2] *= drag;
      sVel[j + 1] = sVel[j + 1] * drag + 0.6 * dt;
      sPos[j] += sVel[j] * dt; sPos[j + 1] += sVel[j + 1] * dt; sPos[j + 2] += sVel[j + 2] * dt;
      const heat = (1 - a) * (1 - a);
      sCol[j] = 5 * heat + 0.6 * (1 - a); sCol[j + 1] = 2.6 * heat * heat + 0.12 * (1 - a); sCol[j + 2] = 0.9 * heat * heat * heat;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparkGeo.attributes.color.needsUpdate = true;
    return live;
  };

  /* ── Rendu : scène (avec transparence) → halo → recomposition prémultipliée ── */
  const target = (w: number, h: number, samples = 0) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples, depthBuffer: samples > 0 });
  const rtScene = target(4, 4, 4);
  const rtBright = target(2, 2);
  const rtBlur = [0, 1, 2].map(() => [target(2, 2), target(2, 2)]);
  const quad = new FullScreenQuad();
  const pass = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>) =>
    new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false, blending: THREE.NoBlending });
  const brightMat = pass(/* glsl */ `
    varying vec2 vUv; uniform sampler2D tMap; uniform vec2 uTexel;
    void main() {
      vec3 c = (texture2D(tMap, vUv + uTexel * vec2(-.5, -.5)).rgb + texture2D(tMap, vUv + uTexel * vec2(.5, -.5)).rgb
              + texture2D(tMap, vUv + uTexel * vec2(-.5, .5)).rgb + texture2D(tMap, vUv + uTexel * vec2(.5, .5)).rgb) * .25;
      float l = max(c.r, max(c.g, c.b));
      gl_FragColor = vec4(c * max(l - .95, 0.) / max(l, 1e-4), 1.);
    }`, { tMap: { value: null }, uTexel: { value: new THREE.Vector2() } });
  const blurMat = pass(/* glsl */ `
    varying vec2 vUv; uniform sampler2D tMap; uniform vec2 uDir;
    void main() {
      vec3 c = texture2D(tMap, vUv).rgb * .227;
      c += (texture2D(tMap, vUv + uDir * 1.385).rgb + texture2D(tMap, vUv - uDir * 1.385).rgb) * .316;
      c += (texture2D(tMap, vUv + uDir * 3.231).rgb + texture2D(tMap, vUv - uDir * 3.231).rgb) * .07;
      gl_FragColor = vec4(c, 1.);
    }`, { tMap: { value: null }, uDir: { value: new THREE.Vector2() } });
  /* Recomposition. Tout part du point où se trouve la voiture à l'écran (uFocus) :
     - filé : la scène est étirée vers ce point (flou de zoom), avec une frange de couleur ;
     - traits de vitesse : des comètes fines qui filent le long des rayons ;
     - éclat du saut (uCover) : une lumière qui s'ouvre depuis ce point, couvre tout, puis s'y referme. */
  const finalMat = pass(/* glsl */ `
    varying vec2 vUv;
    uniform sampler2D tScene, tB0, tB1, tB2;
    uniform vec2 uFocus;
    uniform float uAspect, uZoom, uAberr, uBloom, uLines, uFlow, uIn, uCover;
    float h1(float n) { return fract(sin(n * 127.1 + 3.3) * 43758.5453); }
    vec3 aces(vec3 x) { return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
    void main() {
      vec2 d = vUv - uFocus;
      vec3 acc = vec3(0.), wsum = vec3(0.);
      float a = 0.;
      for (int i = 0; i < 10; i++) {
        float f = float(i) / 9.;
        vec4 t = texture2D(tScene, vUv - d * uZoom * f);
        vec3 w = mix(vec3(1.), vec3(1.5 - f, 1., .5 + f), uAberr);
        acc += t.rgb * w; wsum += w; a += t.a * .1;
      }
      vec3 col = acc / wsum;
      col += (texture2D(tB0, vUv).rgb * .9 + texture2D(tB1, vUv).rgb * .75 + texture2D(tB2, vUv).rgb * .6) * .5 * uBloom;

      vec2 p = vec2(d.x * uAspect, d.y);
      float r = length(p), ang = atan(p.y, p.x) / 6.2831853 + .5;
      if (uLines > .002) {
        float lines = 0.;
        for (int j = 0; j < 2; j++) {
          float fj = float(j);
          float n = ang * (84. + 62. * fj);
          float id = floor(n), fr = abs(fract(n) - .5);
          float ha = h1(id + fj * 71.), hb = h1(id * 1.7 + 13. + fj * 31.);
          float thin = smoothstep(.5, 0., fr * (5. + 14. * hb));
          float ph = fract(log(r + .03) * (1.2 + .9 * ha) - uFlow * (.8 + 1.4 * hb) + ha * 9.);
          ph = mix(ph, 1. - ph, uIn);
          lines += thin * smoothstep(.35, .93, ph) * smoothstep(1., .94, ph) * step(.62, ha);
        }
        col += mix(vec3(1., .44, .1), vec3(1., .88, .7), smoothstep(.25, .9, r)) * lines * smoothstep(.14, .62, r) * uLines * .6;
      }
      if (uCover > .001) {
        float c = smoothstep(0., 1., uCover * 2.5 - r * 1.25);
        float n = ang * 48., i0 = floor(n), f0 = fract(n);
        f0 = f0 * f0 * (3. - 2. * f0);
        float rays = mix(h1(i0 + 200.), h1(mod(i0 + 1., 48.) + 200.), f0);
        vec3 burst = mix(vec3(1., .4, .07), vec3(1., .94, .84), smoothstep(.3, .95, c)) * (1. + 1.5 * c) * (.75 + .5 * rays);
        col = mix(col, burst, c);
        a = max(a, smoothstep(0., .55, c));
      }
      col = pow(aces(col * 1.05), vec3(1. / 2.2));
      // couleurs prémultipliées : là où la scène est transparente, la lumière s'ajoute à la page
      gl_FragColor = vec4(col, clamp(a, 0., 1.));
    }`, {
    tScene: { value: rtScene.texture }, tB0: { value: rtBlur[0][1].texture }, tB1: { value: rtBlur[1][1].texture }, tB2: { value: rtBlur[2][1].texture },
    uFocus: { value: new THREE.Vector2(0.5, 0.5) }, uAspect: { value: 1 }, uZoom: { value: 0 }, uAberr: { value: 0 }, uBloom: { value: 1 },
    uLines: { value: 0 }, uFlow: { value: 0 }, uIn: { value: 0 }, uCover: { value: 0 },
  });
  const FU = finalMat.uniforms;
  const blit = (material: THREE.ShaderMaterial, to: THREE.WebGLRenderTarget | null) => {
    quad.material = material;
    renderer.setRenderTarget(to);
    quad.render(renderer);
  };
  let pw = 4, ph = 4, ratio = 1;
  const dirty = new THREE.Vector4(0, 0, 1e5, 1e5);   // ce qui est dessiné dans rtScene (à effacer au prochain rendu partiel)
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();
  /* Saut en cours : tout l'écran, avec le halo. */
  const renderFull = () => {
    rtScene.scissorTest = false;
    renderer.setRenderTarget(rtScene);
    renderer.clear();
    renderer.render(scene, camera);
    brightMat.uniforms.tMap.value = rtScene.texture;
    brightMat.uniforms.uTexel.value.set(1 / rtScene.width, 1 / rtScene.height);
    blit(brightMat, rtBright);
    let src = rtBright;
    for (const [tmp, out] of rtBlur) {
      blurMat.uniforms.tMap.value = src.texture;
      blurMat.uniforms.uDir.value.set(1 / tmp.width, 0);
      blit(blurMat, tmp);
      blurMat.uniforms.tMap.value = tmp.texture;
      blurMat.uniforms.uDir.value.set(0, 1 / out.height);
      blit(blurMat, out);
      src = out;
    }
    FU.uBloom.value = 1;
    renderer.setScissorTest(false);
    blit(finalMat, null);
    dirty.set(0, 0, pw, ph);
  };
  /* Au repos : la voiture est minuscule. On ne redessine que le rectangle qui la contient, sans halo. */
  const renderSmall = () => {
    tmpA.copy(car.position).project(camera);
    const r = (3.6 / Math.max(1, -car.position.z)) / TAN * (ph / 2) + 6;
    const cx = (tmpA.x * 0.5 + 0.5) * pw, cy = (tmpA.y * 0.5 + 0.5) * ph;
    const x0 = Math.max(0, Math.floor(cx - r)), y0 = Math.max(0, Math.floor(cy - r));
    const x1 = Math.min(pw, Math.ceil(cx + r)), y1 = Math.min(ph, Math.ceil(cy + r));
    const w = Math.max(0, x1 - x0), h = Math.max(0, y1 - y0);
    // dans la cible : on efface aussi l'ancien rectangle
    const ux = Math.min(x0, dirty.x), uy = Math.min(y0, dirty.y);
    rtScene.scissorTest = true;
    rtScene.scissor.set(ux, uy, Math.min(pw, Math.max(x1, dirty.x + dirty.z)) - ux, Math.min(ph, Math.max(y1, dirty.y + dirty.w)) - uy);
    renderer.setRenderTarget(rtScene);
    renderer.clear();
    renderer.render(scene, camera);
    dirty.set(x0, y0, w, h);
    FU.uBloom.value = 0;
    renderer.setRenderTarget(null);
    renderer.setScissorTest(false);
    renderer.clear();
    if (w === 0 || h === 0) return;
    renderer.setScissor(x0 / ratio, y0 / ratio, w / ratio, h / ratio);
    renderer.setScissorTest(true);
    blit(finalMat, null);
    renderer.setScissorTest(false);
  };

  /* ── Ronde de repos : une orbite inclinée. Elle passe de droite à gauche en bas de l'écran (plus près, plus grande),
        et revient de gauche à droite en haut (plus loin, plus petite). ── */
  let aspect = 1;
  const orbitAt = (a: number, out: THREE.Vector3) => {
    const rx = 0.8 * TAN * aspect * ORBIT_D, rz = Math.min(36, rx * 0.75), ry = TAN * ORBIT_D;
    return out.set(rx * Math.cos(a), ry * (0.05 - 0.45 * Math.sin(a) + 0.08 * Math.sin(2 * a + 0.6)), -ORBIT_D + rz * Math.sin(a));
  };
  const orbitDir = (a: number, out: THREE.Vector3) => { orbitAt(a + 0.004, tmpA); orbitAt(a - 0.004, tmpB); return out.subVectors(tmpA, tmpB).normalize(); };
  const orbitSpeed = (a: number) => { orbitAt(a + 0.004, tmpA); orbitAt(a - 0.004, tmpB); return (tmpA.distanceTo(tmpB) / 0.008) * W; };

  /* ── État ── */
  type Phase = 'idle' | 'run' | 'jump' | 'after' | 'arrive';
  let phase: Phase = 'idle';
  let kind: 'in' | 'out' = 'in';
  let path: Path | null = null;
  // en mètres le long de la trajectoire : l'éclat, le freinage et la relance (sortie), les traînées
  let plan = { v0: 5, cover: 0, coverIn: 0.07, brake: 0, boost: 0, trail0: 0, trail1: 1 };
  const pathDir = (d: number, out: THREE.Vector3) => {
    const c = Math.min(Math.max(d, 1), path!.len - 1);
    pathAt(path!, c + 1, tmpA);
    pathAt(path!, c - 1, tmpB);
    return out.subVectors(tmpA, tmpB).normalize();
  };
  /* Vitesse voulue selon l'endroit. Entrée : elle accélère jusqu'à sa pointe. Sortie : elle fonce, freine pour virer
     au ras de l'objectif, puis repart de plus en plus vite. */
  const planSpeed = (d: number) => {
    if (kind === 'in') return Math.min(V_IN, Math.sqrt(plan.v0 * plan.v0 + 2 * A_IN * d));
    const go = Math.sqrt(plan.v0 * plan.v0 + 2 * 260 * d);
    const brake = Math.sqrt(V_TURN * V_TURN + 2 * 300 * Math.max(0, plan.brake - d));
    const boost = Math.sqrt(V_TURN * V_TURN + 2 * 1000 * Math.max(0, d - plan.boost));
    return Math.max(Math.min(go, brake), boost);
  };

  const P = new THREE.Vector3(), F = new THREE.Vector3(0, 0, 1);
  const aim = new THREE.Object3D();
  const fx = { lamp: 0, burn: 0, lines: 0, zoom: 0, dim: 0, shake: 0, calm: 1, die: 0, into: 0 };
  let orbitA = 0.9, tPhase = 0, clock = 0, last = 0, dist = 0, speed = 0, bank = 0, flow = 0, fov = FOV, cover = 0, dimShown = 0;
  let swapped = false, pending = false, uncovered = true, shown = true, running = false, snap = true;
  let swap: () => Promise<void> = () => Promise.resolve();
  let done: () => void = () => {};
  const rate = () => (import.meta.env.DEV && (window as unknown as { __warpRate?: number }).__warpRate) || 1;   // ralenti de réglage

  /* La trajectoire du saut part de là où elle est, dans la direction où elle va. */
  const buildPlan = () => {
    orbitAt(orbitA, P);
    orbitDir(orbitA, F);
    const v0 = orbitSpeed(orbitA);
    const s = P.x >= 0 ? 1 : -1;
    const wide = Math.min(1, aspect / 1.5);   // écran étroit : les passages de côté se font plus loin
    const p0 = P.clone(), c1 = P.clone().addScaledVector(F, 30);
    if (kind === 'in') {
      // elle arrive de son côté, un peu au-dessus, et finit droit sur l'objectif (les phares à hauteur d'œil)
      path = makePath([[p0, c1, new THREE.Vector3(s * 7 * wide, 2, -62), new THREE.Vector3(0, -0.03, 6)]]);
      plan = { v0, cover: path.len - 15, coverIn: 0.07, brake: 0, boost: 0, trail0: path.len - 90, trail1: path.len };
    } else {
      // elle plonge vers nous, traverse l'écran en virant (au plus près : N), puis s'enfuit vers le fond en montant
      const N = new THREE.Vector3(0, -1.6, -11 - 14 * (1 - wide));
      const Tn = new THREE.Vector3(-s, 0.04, 0.1).normalize();
      path = makePath([
        [p0, c1, N.clone().addScaledVector(Tn, -(5 + 10 * wide)), N],
        [N, N.clone().addScaledVector(Tn, 4 + 12 * wide), new THREE.Vector3(-s * 7 * wide, 6, -150), new THREE.Vector3(-s * 2 * wide, 13, -340)],
      ]);
      const dN = path.marks[0];
      plan = { v0, cover: dN + 80, coverIn: 0.16, brake: dN - 7, boost: dN + 5, trail0: dN + 12, trail1: dN + 92 };
    }
    // traînées de feu : le long de la trajectoire (plus larges au loin, pour rester visibles)
    const M = 120, grow = kind === 'in' ? 0 : 0.012;
    const p: number[] = [], uv: number[] = [], ad: number[] = [], sheet: number[] = [], idx: number[] = [];
    const side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Vector3(), t = new THREE.Vector3();
    let base = 0;
    for (const track of [-TRACK, TRACK]) {
      for (const isSheet of [0, 1]) {
        for (let i = 0; i <= M; i++) {
          const d = plan.trail0 + (plan.trail1 - plan.trail0) * (i / M);
          pathAt(path, d, c);
          pathDir(d, t);
          side.crossVectors(t, up).normalize();
          const w = 1 + grow * c.length();
          const x = c.x + side.x * track * w, y = c.y - CG + 0.12, z = c.z + side.z * track * w;
          if (isSheet) p.push(x, y, z, x, y + 0.85 * w, z);
          else p.push(x - side.x * 0.24 * w, y, z - side.z * 0.24 * w, x + side.x * 0.24 * w, y, z + side.z * 0.24 * w);
          uv.push(i / M, 0, i / M, 1);
          ad.push(d, d);
          sheet.push(isSheet, isSheet);
          if (i < M) { const b = base + i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
        }
        base += (M + 1) * 2;
      }
    }
    trails.geometry.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aD', new THREE.Float32BufferAttribute(ad, 1));
    g.setAttribute('aSheet', new THREE.Float32BufferAttribute(sheet, 1));
    g.setIndex(idx);
    trails.geometry = g;
    fire.uFrom.value = plan.trail0;
  };

  const draw = () => {
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, Math.max(0, now - last)) * rate();
    last = now;
    clock += dt;
    tPhase += dt;
    orbitA += dt * W;
    time.value = clock;
    const ease = (r: number) => 1 - Math.exp(-dt * r);
    let omega = 0, pitch = 0, v = 0, popK = 0;
    let lampT = 0, burnT = 0, linesT = 0, zoomT = 0, dimT = 0, shakeT = 0, fovT = FOV, calmT = 0, intoT = fx.into;

    if (phase === 'idle' || phase === 'arrive' || !path) {
      /* ── la ronde ── */
      orbitAt(orbitA, P);
      orbitDir(orbitA, F);
      v = orbitSpeed(orbitA);
      orbitDir(orbitA + 0.03, tmpC);
      const h = heading(tmpC);
      orbitDir(orbitA - 0.03, tmpC);
      omega = (wrap(h - heading(tmpC)) / 0.06) * W;
      calmT = 1;
      if (phase === 'arrive') {
        // retour : trois éclairs, puis elle surgit de 70 m en arrière et freine jusqu'à sa vitesse de ronde
        const u = Math.min(1, Math.max(0, tPhase - 0.3) / 1.1);
        P.addScaledVector(F, -70 * Math.pow(1 - u, 3));
        car.visible = tPhase > 0.3;
        for (const at of [0.05, 0.16, 0.27]) popK = Math.max(popK, Math.exp(-Math.pow((tPhase - at) / 0.035, 2)));
        lampT = 1 - smooth(tPhase, 1, 2.2);
        burnT = 1 - smooth(tPhase, 0.4, 1.4);
        calmT = smooth(tPhase, 0.8, 2.2);
        if (tPhase > 2.4) phase = 'idle';
      }
    } else {
      /* ── le saut ── */
      if (phase === 'run') {
        // contact : elle se cabre un instant à sa vitesse de ronde, puis part
        const go = smooth(tPhase, 0.12, 0.34);
        speed += (plan.v0 + (planSpeed(dist) - plan.v0) * go - speed) * ease(14);
        pitch = -0.14 * Math.sin(Math.PI * Math.min(1, tPhase / 0.4));
        burnT = go;
        if (dist >= plan.cover) { phase = 'jump'; tPhase = 0; }
      }
      if (phase === 'run' || phase === 'jump') dist = Math.min(path.len, dist + speed * dt);
      pathAt(path, dist, P);
      pathDir(dist, F);
      v = speed;
      pathDir(dist + 2, tmpC);
      const h = heading(tmpC);
      pathDir(dist - 2, tmpC);
      omega = (wrap(h - heading(tmpC)) / 4) * speed;
      const far = Math.max(1, P.length());
      const toward = -F.dot(P) / far;   // 1 : elle vient droit sur nous ; -1 : elle s'enfuit
      const rush = smooth(speed, 45, 110);
      lampT = 1;
      if (phase === 'run') {
        linesT = rush;
        shakeT = rush * 0.7;
        dimT = DIM * smooth(speed, 15, 90);
        zoomT = toward > 0 ? Math.min(0.26, (0.02 * speed * toward) / far) : 0.03 * smooth(speed, 100, 300);
        fovT = FOV + 8 * rush;
        intoT = smooth(-toward, -0.2, 0.2);
      } else if (phase === 'jump') {
        cover = Math.min(1, tPhase / plan.coverIn);
        burnT = 1; linesT = 1; shakeT = 1; dimT = DIM; zoomT = fx.zoom; fovT = fov;
        if (cover >= 1 && !swapped) {
          // l'éclat couvre tout : la page change dessous
          swapped = true;
          pending = true;
          car.visible = false;
          swap().catch(() => {}).then(() => { pending = false; });
        }
        if (swapped && !pending && tPhase > plan.coverIn + 0.14) { phase = 'after'; tPhase = 0; fov = FOV; }
      } else {
        // l'éclat se referme sur la nouvelle page ; les traînées brûlent, puis s'éteignent
        cover = Math.pow(1 - Math.min(1, tPhase / 0.7), 2);
        linesT = 1 - smooth(tPhase, 0.05, 0.8);
        shakeT = 1 - smooth(tPhase, 0, 0.45);
        dimT = DIM * (1 - smooth(tPhase, 0.2, 1.5));
        zoomT = 0.1 * (1 - smooth(tPhase, 0, 0.6));
        fx.die = smooth(tPhase, 0.5, 2);
        if (!uncovered && tPhase > 0.3) {
          uncovered = true;
          layers.root.classList.remove('is-on');   // la nouvelle page est découverte : on peut s'en servir
          done();
        }
      }
      if (P.z > -0.8) car.visible = false;
    }

    // les réglages suivent leur cible en douceur (aucune valeur ne saute)
    fx.lamp += (lampT - fx.lamp) * ease(9);
    fx.burn += (burnT - fx.burn) * ease(9);
    fx.lines += (linesT - fx.lines) * ease(10);
    fx.zoom += (zoomT - fx.zoom) * ease(16);
    fx.shake += (shakeT - fx.shake) * ease(10);
    fx.dim += (dimT - fx.dim) * ease(7);
    fx.calm += (calmT - fx.calm) * ease(3);
    fx.into += (intoT - fx.into) * ease(8);
    fov += (fovT - fov) * ease(7);

    // attitude : le nez suit la trajectoire, la caisse s'incline dans les virages ; au repos, elle flotte
    const bankT = THREE.MathUtils.clamp(-omega * (0.17 + 1.4 * Math.exp(-v / 12)), -0.8, 0.8);
    bank += (bankT - bank) * ease(6);
    aim.position.copy(P);
    aim.lookAt(tmpA.copy(P).add(F));
    aim.rotateZ(bank + Math.sin(clock * 0.8) * 0.035 * fx.calm);
    aim.rotateX(pitch + Math.sin(clock * 0.63 + 1) * 0.02 * fx.calm);
    if (snap) { car.quaternion.copy(aim.quaternion); snap = false; } else car.quaternion.slerp(aim.quaternion, ease(14));
    car.position.copy(P);
    car.position.y += Math.sin(clock * 1.15) * 0.3 * fx.calm;

    // caméra : elle tremble avec la vitesse, et son angle s'ouvre
    const sh = fx.shake * 0.0038;
    camera.rotation.set(sh * 0.5 * (Math.sin(clock * 61) + Math.sin(clock * 37.3 + 1.7)), sh * 0.5 * (Math.sin(clock * 53) + Math.sin(clock * 29.1 + 0.4)), 0);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();

    // phares, feux, tuyères, sustentation
    for (const l of lampMats) l.m.emissiveIntensity = l.on * fx.lamp;
    car.getWorldDirection(tmpA);
    const lit = fx.lamp * smooth(-tmpA.dot(P) / Math.max(1, P.length()), 0.15, 0.7);   // de face seulement
    glares.forEach((g) => { g.material.opacity = 0.3 * lit; g.visible = lit > 0.01; });
    streaks.forEach((g) => { g.material.opacity = 0.34 * lit; g.visible = lit > 0.01; });
    hovers.forEach((g) => { g.material.opacity = 0.5 + 0.08 * Math.sin(clock * 2) + 0.4 * fx.burn; });
    burners.forEach((g) => { g.scale.setScalar(0.7 + 0.9 * fx.burn); g.material.opacity = 0.8 * fx.burn; g.visible = fx.burn > 0.01; });
    pop.visible = popK > 0.01;
    if (pop.visible) { pop.position.copy(P); pop.scale.setScalar(4 + 9 * popK); pop.material.opacity = popK; }

    // feu
    const burning = phase === 'run' || phase === 'jump' || phase === 'after';
    fire.uHead.value = phase === 'after' ? 1e6 : dist - REAR_AXLE;
    fire.uK.value = burning ? 1 : 0;
    fire.uDie.value = fx.die;
    trails.visible = burning && fx.die < 0.999;
    if (phase === 'after' && path && Math.random() < (1 - fx.die) * 0.9) {
      // braises, surtout du côté de la caméra
      const q = Math.random() * Math.random();
      const d = kind === 'in' ? plan.trail1 - 8 - 50 * q : plan.trail0 + 70 * q;
      pathAt(path, d, tmpA);
      spark(tmpA.x + (Math.random() - 0.5) * 2.4, tmpA.y - CG + 0.2 + Math.random() * 0.5, tmpA.z + (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 0.5, 0.5 + Math.random() * 1.2, (Math.random() - 0.5) * 0.4, 0.8 + Math.random() * 0.9);
    }
    const live = stepSparks(dt);
    if (phase === 'after' && tPhase > 2.1 && (live === 0 || tPhase > 3)) {
      // tout est éteint : le canvas repasse derrière la page, et elle revient
      phase = 'arrive';
      tPhase = 0;
      path = null;
      cover = 0;
      snap = true;
      fx.lamp = 1;
      fx.burn = 1;
      layers.root.classList.remove('is-front');
    }

    // recomposition
    if (phase === 'run' || phase === 'jump') {
      if (P.z < -1.5) { tmpA.copy(P).project(camera); FU.uFocus.value.set(THREE.MathUtils.clamp(tmpA.x * 0.5 + 0.5, -0.2, 1.2), THREE.MathUtils.clamp(tmpA.y * 0.5 + 0.5, -0.2, 1.2)); }
      flow += dt * (1 - 2 * fx.into) * (0.9 + speed / 90);
    } else flow += dt * (1 - 2 * fx.into) * 1.6;
    FU.uFlow.value = flow;
    FU.uIn.value = fx.into;
    FU.uLines.value = fx.lines;
    FU.uZoom.value = fx.zoom;
    FU.uAberr.value = Math.min(1, 0.15 + fx.zoom * 5 + cover);
    FU.uCover.value = cover;
    if (Math.abs(fx.dim - dimShown) > 0.003) { dimShown = fx.dim < 0.004 ? 0 : fx.dim; layers.dim.style.opacity = dimShown.toFixed(3); }

    if (phase === 'idle') renderSmall(); else renderFull();
    if (phase === 'idle' && !shown) run(false);
  };

  const run = (on: boolean) => {
    if (on === running) return;
    running = on;
    if (on) { last = performance.now() / 1000; gsap.ticker.add(draw); } else gsap.ticker.remove(draw);
  };

  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    ratio = Math.min(window.devicePixelRatio, w < 768 ? 1.25 : 1.5);
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    pw = Math.max(2, Math.floor(w * ratio));
    ph = Math.max(2, Math.floor(h * ratio));
    rtScene.setSize(pw, ph);
    rtBright.setSize(pw >> 1, ph >> 1);
    rtBlur.forEach((pair, i) => pair.forEach((rt) => rt.setSize(Math.max(2, pw >> (i + 2)), Math.max(2, ph >> (i + 2)))));
    dirty.set(0, 0, pw, ph);
    aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    FU.uAspect.value = aspect;
    if (!running) { last = performance.now() / 1000; draw(); }
  };
  window.addEventListener('resize', resize);
  // un premier rendu complet, feu allumé (les shaders sont compilés avant le premier clic), puis la ronde commence
  resize();
  buildPlan();
  phase = 'after';
  FU.uLines.value = 1;
  FU.uCover.value = 0.5;
  fire.uK.value = 1;
  fire.uHead.value = 1e6;
  trails.visible = pop.visible = true;
  renderFull();
  phase = 'idle';
  path = null;
  trails.visible = pop.visible = false;
  run(true);

  const travel = (mode: 'in' | 'out', change: () => Promise<void>) => new Promise<void>((resolve) => {
    kind = mode;
    swap = change;
    done = resolve;
    buildPlan();
    swapped = false; pending = false; uncovered = false;
    dist = 0; speed = plan.v0; tPhase = 0; cover = 0;
    fx.die = 0;
    fx.into = 0;
    car.visible = true;
    phase = 'run';
    layers.root.classList.add('is-front', 'is-on');   // devant tout, et les clics sont bloqués jusqu'à la nouvelle page
    run(true);
  });

  const dispose = () => {
    run(false);
    window.removeEventListener('resize', resize);
    layers.root.classList.remove('is-front', 'is-on');
    layers.dim.style.opacity = '0';
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      for (const mat of ([] as THREE.Material[]).concat(m.material ?? [])) {
        for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
        mat.dispose();
      }
    });
    [rtScene, rtBright, ...rtBlur.flat()].forEach((rt) => rt.dispose());
    [brightMat, blurMat, finalMat].forEach((m) => m.dispose());
    quad.dispose();
    glowMap.dispose();
    env.dispose();
    renderer.dispose();
  };

  return {
    ready: () => phase === 'idle' && shown,
    travel,
    setVisible: (on) => {
      shown = on;
      canvas.style.opacity = on ? '1' : '0';
      if (on) run(true);
    },
    dispose,
  };
};
