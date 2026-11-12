import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { gsap } from '@/lib/motion';
import { metalEnvironment } from './satellites';
import { introAudio } from '@/lib/introAudio';

/* ═══════════════════════════════════════════════════════════════
   INTRO DU SITE : LA CRÉATION → L'ŒIL (three.js)
   Les mains sont en 2.5D : une photo nette de deux mains dans la pose de « La Création d'Adam », sur fond noir,
   coupée en deux et recolorée dans la palette du site (public/intro/hand-l.webp, hand-r.webp ;
   photo Pexels n° 12428480, licence Pexels, libre d'utilisation).
   L'œil est en 3D : celui d'un buste de marbre scanné (public/intro/eye.glb, « Helen Ruthven Waterston »,
   Smithsonian Open Access, CC0), en pierre sombre, avec un globe vivant peint dans le shader ; son iris vient
   d'une photo du domaine public déroulée et teintée ambre (public/intro/iris.webp). Décodeur : public/draco.

   Derrière les mains, un mur de vieux plâtre (public/intro/wall.webp, texture « grey_plaster_02 », Poly Haven, CC0),
   assombri et teinté, où les mains projettent leur ombre. Les mains (premier plan) suivent la souris et flottent
   chacune à leur rythme ; le mur (arrière-plan) part dans l'autre sens : les deux plans bougent indépendamment.
   Au clic : les deux mains se cherchent tendrement (approche lente, hésitation, elles se rejoignent ; une lueur naît
   entre les deux index et s'ouvre en anneau au contact ; elles s'attardent), puis sont séparées brusquement ; la caméra traverse le noir jusqu'à l'œil qui regarde dans
   le vide, plonge dans sa pupille, et le site s'ouvre.
   ═══════════════════════════════════════════════════════════════ */

const FOV = 15;            // longue focale : peu de perspective
const EYE_Z = -18;         // l'œil attend loin derrière, dans le noir
const FLY = 15;            // distance parcourue par chaque main quand elles sont arrachées
const STONE = 0x17120e;

/* Photo des mains : 1 unité = 315 px ; l'origine est le milieu entre les deux index.
   HAND_SCALE réduit l'ensemble : on voit les mains entières et un bout d'avant-bras, qui se fond dans le noir. */
const PX = 315;
const HAND_SCALE = 0.66;
const CONTACT = { x: 2168, y: 1362 };
const LEFT = { x: 0, y: 866, w: 2168, h: 1305 };
const RIGHT = { x: 2168, y: 866, w: 1928, h: 1305 };
const HALF_GAP = (54 / PX) * HAND_SCALE;  // sur la photo, chaque index est à 54 px du milieu

/* Ouverture de l'œil dans le repère du modèle (mesurée sur le scan) : coins, hauteur des paupières, iris */
const EYE = { ax: -0.94, ay: -0.08, bx: 0.76, by: -0.16, up: 0.5, low: 0.19, ix: -0.07, iy: 0.0, ir: 0.37 };

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
`;

/* Main : la photo est en noir et blanc sur fond noir. La luminosité sert de transparence (la main sort du noir)
   et choisit la couleur dans la palette du site : brun sombre, cuivre, orange, crème dans les lumières.
   uOuter : côté du plan où l'avant-bras sort de la photo (0 = gauche, 1 = droite) ; il s'y fond dans le noir.
   uInferno : chute dans les enfers (incandescence rouge braise et feu).
   uHeaven : ascension au paradis (lumière céleste, or blanc radieux et aura divine).
   uFade : disparition progressive dans le néant. */
const HAND_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uTex;
  uniform vec2 uBlur;
  uniform float uGlow, uOuter, uInferno, uHeaven, uFade;
  varying vec2 vUv;
  void main() {
    float l = 0.;
    for (int i = 0; i < 28; i++) l += texture2D(uTex, vUv + uBlur * (float(i) / 27. - .5)).r;   // flou de mouvement
    l /= 28.;
    float a = smoothstep(.018, .1, l) * smoothstep(0., .34, abs(vUv.x - uOuter));
    if (a < .003) discard;
    float t = pow(l, .85);
    vec3 col = mix(vec3(.06, .032, .02), vec3(.5, .26, .15), smoothstep(0., .4, t));
    col = mix(col, vec3(1., .56, .26), smoothstep(.32, .78, t));
    col = mix(col, vec3(1., .9, .76), smoothstep(.74, 1., t));
    col *= 1. + uGlow * .35;

    // Chute aux enfers : incandescence rouge sang, cendre et braise consumée (main gauche)
    vec3 hell = mix(vec3(.32, .02, .005), vec3(1., .24, .02), smoothstep(0., .45, t));
    hell = mix(hell, vec3(1., .75, .2), smoothstep(.45, 1., t));
    col = mix(col, hell, uInferno * .92);

    // Ascension au paradis : or blanc radieux, translucidité et aura divine céleste (main droite)
    vec3 celestial = mix(vec3(1., .78, .4), vec3(1., .98, .92), smoothstep(.1, .75, t)) * 1.45;
    col = mix(col, celestial, uHeaven * .92);

    float alpha = a * (1. - uFade) * mix(1., smoothstep(.035, .32, l), uInferno * .45);
    gl_FragColor = vec4(col, alpha);
  }
`;

/* Mur : la texture de plâtre en niveaux de gris, passée dans la palette du site, éclairée au centre par la lueur des mains */
const WALL_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uTex;
  uniform vec2 uShift, uLight;
  uniform float uK, uSpark;
  varying vec2 vUv;
  void main() {
    float l = texture2D(uTex, vUv * vec2(2.6, 1.7) + uShift).r;
    vec3 col = mix(vec3(.025, .016, .011), vec3(.2, .11, .065), smoothstep(.15, .85, l));
    vec2 p = (vUv - .5 - uLight) * vec2(1.6, 1.);
    float lit = exp(-dot(p, p) * 9.) * .9 + .22;                 // la lumière vient du milieu, les bords restent dans le noir
    lit += exp(-dot(p, p) * 70.) * uSpark * 1.4;                 // la lueur du contact éclaire le mur
    col *= lit;
    col = mix(vec3(.0392, .0314, .0235), col, smoothstep(.62, .25, length((vUv - .5) * vec2(1., 1.3))));
    float alpha = uK * smoothstep(.62, .25, length((vUv - .5) * vec2(1., 1.3)));
    gl_FragColor = vec4(col, alpha);
  }
`;

/* Ombre d'une main sur le mur : la silhouette de la photo, floutée, en noir transparent */
const SHADOW_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uTex;
  uniform float uK, uOuter;
  varying vec2 vUv;
  void main() {
    float a = 0.;
    for (int i = 0; i < 12; i++) {
      float ang = float(i) * 2.39996, r = sqrt((float(i) + .5) / 12.) * .02;
      a += smoothstep(.02, .12, texture2D(uTex, vUv + vec2(cos(ang), sin(ang) * 1.6) * r).r);
    }
    a = a / 12. * smoothstep(0., .45, abs(vUv.x - uOuter));
    gl_FragColor = vec4(0., 0., 0., a * uK);
  }
`;

const EYE_PARS = /* glsl */ `
  uniform sampler2D uIris;
  uniform vec2 uIrisC;
  uniform float uPupil, uReveal, uGlow;
  varying vec3 vObj;
  float eyeMask; vec3 irisCol; float irisMask;
  float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(hash21(i), hash21(i + vec2(1., 0.)), f.x), mix(hash21(i + vec2(0., 1.)), hash21(i + vec2(1., 1.)), f.x), f.y);
  }
`;

/* Le globe : là où le scan montre l'œil nu entre les paupières, la pierre devient un œil vivant */
const EYE_MAP = /* glsl */ `
  {
    float t = (vObj.x - (${EYE.ax.toFixed(3)})) / ${(EYE.bx - EYE.ax).toFixed(3)};
    float base = mix(${EYE.ay.toFixed(3)}, ${EYE.by.toFixed(3)}, t);
    float arch = pow(max(4. * t * (1. - t), 0.), .72);
    float top = base + ${EYE.up.toFixed(3)} * arch - vObj.y;       // distance au bord de la paupière du haut
    float bot = vObj.y - (base - ${EYE.low.toFixed(3)} * arch);    // … et à celle du bas
    eyeMask = smoothstep(0., .01, min(top, bot)) * step(0., t) * step(t, 1.);

    vec2 q = vObj.xy - uIrisC;
    float r = length(q) / ${EYE.ir.toFixed(3)};
    float rt = mix(.265, 1., clamp((r - uPupil) / (1. - uPupil), 0., 1.));   // la pupille s'ouvre : l'iris se resserre
    irisCol = texture2D(uIris, vec2(atan(q.y, q.x) / 6.2832 + .5, 1. - rt / 1.1)).rgb;
    irisCol *= 1. - .85 * smoothstep(.76, 1., r);                            // anneau sombre du bord
    irisCol *= .75 + .5 * smoothstep(-.9, .9, -q.y / ${EYE.ir.toFixed(3)});   // la lumière traverse la cornée, le bas s'éclaire
    irisMask = (1. - smoothstep(.96, 1.04, r)) * smoothstep(uPupil, uPupil + .05, r);

    vec3 sclera = (vec3(.4, .36, .32) - vec3(.02, .07, .07) * smoothstep(1., 2.6, r)) * (1. - .45 * smoothstep(.9, 2.5, r));
    float vein = smoothstep(.02, 0., abs(vnoise(vObj.xy * 9.) * .6 + vnoise(vObj.xy * 21.) * .4 - .5)) * smoothstep(1.25, 2.3, r);
    sclera -= vein * vec3(.02, .16, .15);
    sclera = mix(sclera, vec3(.42, .2, .17), smoothstep(.62, .98, abs(t - .5) * 2.) * .8);   // coins rosés
    vec3 eyeCol = mix(irisCol, sclera, smoothstep(.96, 1.04, r));
    eyeCol = mix(vec3(.002), eyeCol, smoothstep(uPupil, uPupil + .05, r));  // pupille
    eyeCol *= .22 + .78 * smoothstep(0., .34, top);                          // ombre de la paupière du haut
    eyeCol *= .55 + .45 * smoothstep(0., .12, bot);
    diffuseColor.rgb = mix(diffuseColor.rgb, eyeCol, eyeMask);
    // trait sombre et net au ras des paupières (comme la ligne des cils) : il dessine le contour de l'œil
    float inEye = step(-.04, t) * step(t, 1.04);
    diffuseColor.rgb *= 1. - .9 * inEye * smoothstep(.045, .0, abs(top + .012));
    diffuseColor.rgb *= 1. - .7 * inEye * smoothstep(.03, .0, abs(bot + .008));
  }
`;

/* Grain de pierre sur le visage (le scan du marbre poli est très lisse) */
const EYE_BUMP = /* glsl */ `
  {
    float h = vnoise(vObj.xy * 26.) * .65 + vnoise(vObj.xy * 61.) * .35;
    vec3 dpx = dFdx(vViewPosition), dpy = dFdy(vViewPosition);
    vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
    float det = dot(dpx, r1);
    normal = normalize(abs(det) * normal - .006 * (1. - eyeMask) * sign(det) * (dFdx(h) * r1 + dFdy(h) * r2));
  }
`;

export type Intro = {
  loaded: Promise<void>;
  play: () => void;
  dispose: () => void;
};

/** Monte la scène d'intro dans le canvas. `onEnd` : la plongée est finie (écran noir), le site peut s'ouvrir. */
export function createIntro(
  canvas: HTMLCanvasElement,
  onEnd: () => void,
  onEvent?: (name: string, val?: number) => void
): Intro {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x0a0806, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;   // ne concerne que la pierre de l'œil ; les photos gardent leurs couleurs
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  const env = metalEnvironment(renderer);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.16;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.02, 80);

  /* ——— Lumières de l'œil : liserés orange venus de l'arrière, un jour doux de face, une lumière orange rasante ——— */
  const rimA = new THREE.DirectionalLight(0xff6a1f, 7);
  rimA.position.set(-2.5, 3.2, -5);
  const rimB = new THREE.DirectionalLight(0xff9448, 3.2);
  rimB.position.set(4, -1.2, -4.5);
  const key = new THREE.DirectionalLight(0xdfe6ff, 0.42);
  key.position.set(1.5, 3, 5);
  const eyeKey = new THREE.DirectionalLight(0xfff1e2, 0);
  eyeKey.position.set(-2.2, 2.6, 6);
  const eyeRim = new THREE.DirectionalLight(0xff6a1f, 0);
  eyeRim.position.set(-6, 1.4, 1.6);
  scene.add(rimA, rimB, key, eyeKey, eyeRim);

  // Halo orange derrière les mains (comme derrière la planète de l'accueil)
  const glowMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uK: { value: 1 } },
    vertexShader: VERT,
    fragmentShader: 'uniform float uK; varying vec2 vUv; void main() { float d = length(vUv - .5) * 2.; float a = pow(max(1. - d, 0.), 2.2); gl_FragColor = vec4(vec3(1., .42, .12) * a * .2 * uK, 1.); }',
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(14, 9.5), glowMat);
  glow.position.z = -1.5;
  glow.renderOrder = 1;
  scene.add(glow);

  // Mur du fond, loin derrière les mains
  const WALL_Z = -6;
  const wallMat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: WALL_FRAG, depthWrite: false, transparent: true,
    uniforms: { uTex: { value: null as THREE.Texture | null }, uShift: { value: new THREE.Vector2() }, uLight: { value: new THREE.Vector2() }, uK: { value: 1 }, uSpark: { value: 0 } },
  });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(26, 15), wallMat);
  wall.position.z = WALL_Z;
  scene.add(wall);

  // Braises en suspension : quelques-unes près des mains, un couloir entier que la caméra traverse jusqu'à l'œil
  const EMBERS = 460;
  const emberPos = new Float32Array(EMBERS * 3);
  const emberSeed = new Float32Array(EMBERS);
  for (let i = 0; i < EMBERS; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.9 + Math.random() * 4.6;
    emberPos.set([Math.cos(a) * r * 1.3, Math.sin(a) * r * 0.75, 2 + (EYE_Z - 1) * Math.random()], i * 3);
    emberSeed[i] = Math.random();
  }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  emberGeo.setAttribute('aSeed', new THREE.BufferAttribute(emberSeed, 1));
  const emberMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uK: { value: 0.3 }, uScale: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uT, uScale;
      varying float vA;
      void main() {
        vec3 p = position;
        p.x += sin(uT * (.2 + aSeed * .3) + aSeed * 40.) * .18;
        p.y += mod(uT * (.03 + aSeed * .05), 1.) * .6 - .3;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        vA = smoothstep(.5, 3., -mv.z) * smoothstep(60., 25., -mv.z) * (.35 + .65 * aSeed);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.6 + aSeed * 3.6) * uScale / -mv.z;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uK;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - .5);
        gl_FragColor = vec4(vec3(1., .5, .16) * smoothstep(.5, .05, d) * vA * uK, 1.);
      }`,
  });
  const embers = new THREE.Points(emberGeo, emberMat);
  embers.frustumCulled = false;
  scene.add(embers);

  /* ——— Mains : deux plans, chacun avec sa moitié de la photo ——— */
  const makeHand = (r: typeof LEFT, outer: number) => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: HAND_FRAG, transparent: true, depthWrite: false,
      uniforms: {
        uTex: { value: null as THREE.Texture | null },
        uBlur: { value: new THREE.Vector2() },
        uGlow: { value: 0 },
        uOuter: { value: outer },
        uInferno: { value: 0 },
        uHeaven: { value: 0 },
        uFade: { value: 0 },
      },
    });
    const w = r.w / PX;
    const h = r.h / PX;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    // le plan est placé dans un groupe dont l'origine est le milieu entre les index : le groupe tourne autour de ce point
    mesh.position.set((r.x - CONTACT.x) / PX + w / 2, (CONTACT.y - r.y) / PX - h / 2, 0);
    const group = new THREE.Group();
    group.scale.setScalar(HAND_SCALE);
    group.add(mesh);
    scene.add(group);
    return { group, mesh, mat, w: w * HAND_SCALE, h: h * HAND_SCALE, last: new THREE.Vector2(), first: true };
  };
  const handL = makeHand(LEFT, 0);
  const handR = makeHand(RIGHT, 1);
  handL.group.renderOrder = handR.group.renderOrder = 3;
  handL.mesh.renderOrder = handR.mesh.renderOrder = 3;

  // Ombre de chaque main, posée sur le mur ; elle suit sa main, mais avec le mur (décalée, plus floue, plus lente)
  const makeShadow = (h: typeof handL, outer: number) => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: SHADOW_FRAG, transparent: true, depthWrite: false,
      uniforms: { uTex: h.mat.uniforms.uTex, uK: { value: 0.75 }, uOuter: { value: outer } },
    });
    const mesh = new THREE.Mesh(h.mesh.geometry, mat);
    mesh.position.copy(h.mesh.position);
    mesh.renderOrder = 2;
    const group = new THREE.Group();
    group.add(mesh);
    scene.add(group);
    return { group, mat };
  };
  const shadowL = makeShadow(handL, 0);
  const shadowR = makeShadow(handR, 1);

  /* ——— Lueur entre les deux index : un cœur chaud et un halo, plus un anneau fin qui s'ouvre au contact ——— */
  const sparkMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: { uK: { value: 0 }, uRing: { value: 0 }, uRingK: { value: 0 } },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform float uK, uRing, uRingK;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - .5) * 2.;
        float core = exp(-d * d * 220.);                 // point chaud organique
        float inner = exp(-d * d * 28.);                 // lueur orange douce
        float halo = exp(-d * d * 6.) * .32;             // halo large et doux
        vec3 col = vec3(1., .94, .82) * core * 1.5 + vec3(1., .55, .2) * inner + vec3(1., .42, .12) * halo;
        float ring = exp(-pow((d - uRing) * 70., 2.)) * uRingK;
        col += vec3(1., .62, .3) * ring;
        gl_FragColor = vec4(col * uK, 1.);
      }`,
  });
  const spark = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), sparkMat);
  spark.position.z = 0.05;
  spark.renderOrder = 5;
  scene.add(spark);

  /* ——— Œil : la pierre du visage, et le globe peint par-dessus dans le shader ——— */
  const eyeUniforms = {
    uIris: { value: null as THREE.Texture | null }, uIrisC: { value: new THREE.Vector2(EYE.ix, EYE.iy) },
    uPupil: { value: 0.26 }, uReveal: { value: 0 }, uGlow: { value: 1 },
  };
  const eyeMat = new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.55, metalness: 0.02, transparent: true });
  eyeMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, eyeUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${EYE_PARS}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${EYE_MAP}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, .05, eyeMask);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${EYE_BUMP}`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += irisCol * irisMask * eyeMask * .22 * uGlow;')
      // le visage se fond dans le noir en s'éloignant de l'œil ; uReveal le fait sortir de l'ombre en transparence
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\nfloat eyeAlpha = uReveal * smoothstep(2.35, 1.25, length((vObj.xy - vec2(-.15, .1)) * vec2(vObj.x > 0. ? 1.3 : .95, 1.2)));\ngl_FragColor.rgb = mix(vec3(.0392, .0314, .0235), gl_FragColor.rgb, eyeAlpha);\ngl_FragColor.a = smoothstep(0.005, 0.35, eyeAlpha);');
  };
  const eye = new THREE.Group();
  eye.position.z = EYE_Z;
  eye.visible = false;
  scene.add(eye);

  let disposed = false;
  let ready = false;
  const textures: THREE.Texture[] = [];
  let eyeGeo: THREE.BufferGeometry | null = null;
  const draco = new DRACOLoader().setDecoderPath('/draco/');
  const gltf = new GLTFLoader().setDRACOLoader(draco);
  const loader = new THREE.TextureLoader();
  const load = (file: string) => new Promise<THREE.Texture>((resolve, reject) => loader.load(`/intro/${file}`, (t) => {
    textures.push(t);
    resolve(t);
  }, undefined, reject));

  const loaded = Promise.all([load('hand-l.webp'), load('hand-r.webp'), load('iris.webp'), gltf.loadAsync('/intro/eye.glb'), load('wall.webp')]).then(([l, r, iris, eyeFile, wallTex]) => {
    draco.dispose();
    if (disposed) return;
    l.anisotropy = r.anisotropy = 8;
    handL.mat.uniforms.uTex.value = l;
    handR.mat.uniforms.uTex.value = r;
    iris.colorSpace = THREE.SRGBColorSpace;
    iris.wrapS = THREE.RepeatWrapping;
    iris.generateMipmaps = false; // pas de couture à la jonction de l'angle
    iris.minFilter = THREE.LinearFilter;
    eyeUniforms.uIris.value = iris;
    wallTex.wrapS = wallTex.wrapT = THREE.MirroredRepeatWrapping;
    wallTex.anisotropy = 4;
    wallMat.uniforms.uTex.value = wallTex;
    eyeFile.scene.traverse((o) => { if (!eyeGeo && (o as THREE.Mesh).isMesh) eyeGeo = (o as THREE.Mesh).geometry; });
    eye.add(new THREE.Mesh(eyeGeo!, eyeMat));
    ready = true;
    resize();
    renderer.compile(scene, camera);
    gsap.ticker.add(render);
  });

  /* ——— Cadrage ——— */
  let aspect = 1;
  let wide = 11;       // largeur visible au niveau des mains
  let wideEye = 4.6;   // … et au niveau de l'œil
  const dist = (w: number) => w / (2 * Math.tan((FOV * Math.PI) / 360) * aspect);
  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    wide = Math.max(4.6, Math.min(11, 7 * aspect));
    wideEye = 1.75 / Math.max(0.3, Math.min(0.72, 0.5 / aspect));
    emberMat.uniforms.uScale.value = renderer.getPixelRatio() * h * 0.022;
  }
  const sizes = new ResizeObserver(resize);
  sizes.observe(canvas);

  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const move = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', move, { passive: true });

  /* ——— État animé par la séquence ———
     god, adam : 0 = mains écartées (avant le clic), 1 = les index se touchent ; caress : elles s'attardent l'une contre l'autre */
  const s = {
    god: 0, adam: 0, caress: 0, fly: 0, glow: 0.15, ring: 0, cam: 0, push: 0, eye: 0, pupil: 0.3, dive: 0,
    shake: 0, flash: 0, chroma: 0,
    // Chute tragique de la main gauche dans les enfers :
    fallY: 0,
    fallX: 0,
    fallRotZ: 0,
    fallRotX: 0,
    inferno: 0,
    fadeL: 0,
    // Ascension majestueuse de la main droite au paradis :
    riseY: 0,
    riseX: 0,
    riseRotZ: 0,
    riseRotX: 0,
    heaven: 0,
    fadeR: 0,
  };
  const par = new THREE.Vector2(); // décalage de parallaxe commun aux deux mains et à leur lueur
  let timeline: gsap.core.Timeline | null = null;
  // Chaque main recule le long de son avant-bras : la gauche vers le bas à gauche, la droite vers le haut à droite
  const dirL = new THREE.Vector2(-1, -0.3).normalize();
  const dirR = new THREE.Vector2(1, 0.12).normalize();
  // regard : il dérive lentement vers des points au hasard, jamais vers nous
  const gaze = { x: -0.07, y: 0.06, tx: -0.07, ty: 0.06, next: 0, burst: 0 };
  let last = performance.now() / 1000;

  function render() {
    if (disposed || !ready) return;
    const now = performance.now() / 1000;
    const dt = Math.min(now - last, 0.1);
    last = now;
    // souris lissée : la parallaxe suit en douceur, sans à-coups
    pointer.sx += (pointer.x - pointer.sx) * Math.min(dt * 2.2, 1);
    pointer.sy += (pointer.y - pointer.sy) * Math.min(dt * 2.2, 1);

    // ——— mains ———
    const calm = (1 - s.fadeR) * (1 - s.fadeL);
    const touch = Math.min(s.god, s.adam);
    // parallaxe : les mains (premier plan) suivent la souris plus que le halo et les braises (arrière-plan)
    par.set(pointer.sx * 0.42, -pointer.sy * 0.26).multiplyScalar(calm);

    // ——— MAIN GAUCHE (Adam / mortelle) ———
    // Approche jusqu'au contact, puis chute poignante dans les flammes des enfers
    const dL = 0.95 * (1 - s.adam) - (HALF_GAP - 0.004) * s.adam;
    const baseLx = dirL.x * dL;
    const baseLy = dirL.y * dL;
    const freeL = calm * (1 - touch * 0.85);
    const floatLx = (Math.sin(now * 0.23) * 0.05 + Math.sin(now * 0.11) * 0.03) * freeL;
    const floatLy = (Math.sin(now * 0.31) * 0.06 + Math.sin(now * 0.17) * 0.03) * freeL;

    const posX_L = baseLx - s.fallX + par.x + pointer.sx * 0.06 * (1 - touch) + floatLx;
    const posY_L = baseLy - s.fallY + par.y - pointer.sy * 0.036 * (1 - touch) + floatLy;
    const posZ_L = -s.fallY * 0.22;

    handL.group.position.set(posX_L, posY_L, posZ_L);
    handL.group.rotation.z = (-0.09 * (1 - s.adam) + Math.sin(now * 0.27) * 0.02 * (1 - touch)) * calm + s.fallRotZ;
    handL.group.rotation.y = pointer.sx * 0.1 * calm - s.fallRotZ * 0.35;
    handL.group.rotation.x = pointer.sy * 0.06 * calm + s.fallRotX;

    const blurL = handL.mat.uniforms.uBlur.value as THREE.Vector2;
    if (handL.first) { handL.last.set(posX_L, posY_L); handL.first = false; }
    blurL.set((posX_L - handL.last.x) / handL.w, (posY_L - handL.last.y) / handL.h).multiplyScalar(0.9).clampLength(0, 0.4);
    handL.last.set(posX_L, posY_L);

    handL.mat.uniforms.uInferno.value = s.inferno;
    handL.mat.uniforms.uFade.value = s.fadeL;
    handL.mat.uniforms.uGlow.value = s.glow;
    handL.group.visible = s.fadeL < 0.99;

    // ——— MAIN DROITE (Dieu / céleste — Ascension au paradis) ———
    // Approche jusqu'au contact, puis élévation majestueuse vers les cieux
    const dR = 1.6 * (1 - s.god) - (HALF_GAP - 0.004) * s.god;
    const freeR = calm * (1 - touch * 0.85);
    const floatRx = (Math.sin(now * 0.23 + 2.2) * 0.05 + Math.sin(now * 0.11 + 6.6) * 0.03) * freeR;
    const floatRy = (Math.sin(now * 0.31 + 3.74) * 0.06 + Math.sin(now * 0.17 + 2.2) * 0.03) * freeR;

    const posX_R = dirR.x * dR + s.riseX + par.x + pointer.sx * 0.1 * (1 - touch) + floatRx;
    const posY_R = dirR.y * dR + s.riseY + par.y - pointer.sy * 0.06 * (1 - touch) + floatRy;
    const posZ_R = Math.min(s.riseY * 0.05, 0.35);

    handR.group.position.set(posX_R, posY_R, posZ_R);
    handR.group.rotation.z = (0.06 * (1 - s.god) + Math.sin(now * 0.27 + 2.2) * 0.02 * (1 - touch)) * calm + s.riseRotZ;
    handR.group.rotation.y = pointer.sx * 0.1 * calm - s.riseRotZ * 0.25;
    handR.group.rotation.x = pointer.sy * 0.06 * calm - s.riseRotX;

    const blurR = handR.mat.uniforms.uBlur.value as THREE.Vector2;
    if (handR.first) { handR.last.set(posX_R, posY_R); handR.first = false; }
    blurR.set((posX_R - handR.last.x) / handR.w, (posY_R - handR.last.y) / handR.h).multiplyScalar(0.9).clampLength(0, 0.35);
    handR.last.set(posX_R, posY_R);

    handR.mat.uniforms.uGlow.value = s.glow + s.heaven * 2.4;
    handR.mat.uniforms.uHeaven.value = s.heaven;
    handR.mat.uniforms.uFade.value = s.fadeR;
    handR.group.visible = s.fadeR < 0.99;

    // ——— mur : il part à contre-sens de la souris ; disparaît dès que la caméra plonge ———
    const back = new THREE.Vector2(-pointer.sx * 0.5, pointer.sy * 0.3).multiplyScalar(calm);
    wall.position.set(back.x, back.y, WALL_Z);
    wallMat.uniforms.uShift.value.set(-pointer.sx * 0.01, pointer.sy * 0.006);
    wallMat.uniforms.uLight.value.set(par.x * 0.012, par.y * 0.012);
    wallMat.uniforms.uSpark.value = Math.min(1, Math.max(0, (touch - 0.6) / 0.4)) * (1 - s.fallY * 0.1) + Math.max(s.glow - 1, 0) * 0.5;
    wallMat.uniforms.uK.value = Math.max(0, 1 - s.cam * 2.5);
    wall.visible = s.cam < 0.35 && camera.position.z > (WALL_Z + 1.2);

    const hideL = 1 - Math.min(s.fallY / 6, 1);
    const hideR = 1 - Math.min(s.riseY / 4.5, 1);
    shadowL.group.position.set(handL.group.position.x - par.x * 0.55 + back.x * 0.5 + 0.3, handL.group.position.y - par.y * 0.55 + back.y * 0.5 - 0.42, -2.2);
    shadowL.group.rotation.copy(handL.group.rotation);
    shadowL.mat.uniforms.uK.value = 0.85 * hideL * (1 - s.cam);
    shadowL.group.visible = hideL > 0.01 && s.cam < 0.25;

    shadowR.group.position.set(handR.group.position.x - par.x * 0.55 + back.x * 0.5 + 0.3, handR.group.position.y - par.y * 0.55 + back.y * 0.5 - 0.42, -2.2);
    shadowR.group.rotation.copy(handR.group.rotation);
    shadowR.mat.uniforms.uK.value = 0.85 * hideR * (1 - s.cam);
    shadowR.group.visible = hideR > 0.01 && s.cam < 0.25;

    // ——— lueur au point de contact : elle naît quand les doigts s'approchent, respire quand ils se touchent ———
    const near = Math.min(Math.max((touch - 0.45) / 0.55, 0), 1);
    const breath = 0.85 + 0.15 * Math.sin(now * 1.6);
    spark.position.set(par.x, par.y, 0.05);
    sparkMat.uniforms.uK.value = (0.12 + near * near * 0.9 * (s.caress > 0 ? breath : 1) + Math.max(s.glow - 1, 0) * 1.2) * (1 - s.cam);
    spark.scale.setScalar(0.55 + near * 0.6 + Math.max(s.glow - 1, 0) * 0.5);
    sparkMat.uniforms.uRing.value = s.ring;
    sparkMat.uniforms.uRingK.value = Math.sin(Math.PI * s.ring) * 0.6;
    spark.visible = s.cam < 0.15;

    // Ajuste dynamiquement la tension sonore lors de l'approche
    if (s.god > 0.01 && s.god <= 1 && s.riseY === 0) {
      introAudio.setTension(Math.min(s.god, s.adam));
    }

    // ——— lumière, braises ———
    glowMat.uniforms.uK.value = (1 + s.glow * 1.4) * (1 - s.cam);
    glow.position.set(back.x * 0.4 + par.x * 0.3, back.y * 0.4 + par.y * 0.3, -1.5);
    glow.visible = s.cam < 0.3;
    emberMat.uniforms.uT.value = now;
    emberMat.uniforms.uK.value = (0.35 + 1.9 * Math.sin(Math.PI * s.cam)) * (1 - s.eye * 0.8);
    eyeKey.intensity = s.eye * 1.15;
    eyeRim.intensity = s.eye * 2.6;
    key.intensity = 0.42 * (1 - s.eye * 0.6);

    // ——— œil : n'apparaît que lorsqu'il est effectivement révélé (zéro masse noire avant !) ———
    eye.visible = s.eye > 0.005;
    if (now > gaze.next) {
      const side = Math.random() < 0.5 ? -1 : 1;
      gaze.tx = side * (0.12 + Math.random() * 0.2) - 0.03;
      gaze.ty = 0.04 + (Math.random() - 0.4) * 0.18;
      if (gaze.burst > 0) { gaze.burst -= 1; gaze.next = now + 0.35 + Math.random() * 0.45; }
      else { gaze.burst = Math.floor(Math.random() * 4); gaze.next = now + 1.4 + Math.random() * 1.8; }
    }
    gaze.x += (gaze.tx - gaze.x) * Math.min(dt * 7, 1);
    gaze.y += (gaze.ty - gaze.y) * Math.min(dt * 7, 1);
    const look = 1 - s.dive;
    eyeUniforms.uIrisC.value.set(
      EYE.ix + (gaze.x + Math.sin(now * 0.31) * 0.015) * look,
      EYE.iy + (gaze.y + Math.sin(now * 0.23 + 1) * 0.01) * look,
    );
    // la pupille ne se fixe jamais : elle s'ouvre et se resserre lentement
    eyeUniforms.uPupil.value = s.pupil + Math.sin(now * 0.55) * 0.035 + Math.sin(now * 1.3) * 0.01;
    // la tête dérive lentement
    eye.rotation.set(Math.sin(now * 0.19) * 0.05 * look, Math.sin(now * 0.14 + 1) * 0.07 * look, Math.sin(now * 0.11) * 0.035 * look);
    eyeUniforms.uReveal.value = s.eye * (1 - Math.max(0, s.dive - 0.72) / 0.28);

    // ——— caméra : cadrage cinématique, respiration steadycam, secousse cinétique et dolly zoom ———
    const zHands = dist(wide) * (1 - 0.1 * s.god - 0.03 * s.caress);   // elle s'approche avec elles
    const zEye = EYE_Z + dist(wideEye) * (1 - 0.16 * s.push);
    let z = zHands + (zEye - zHands) * s.cam;
    z += (EYE_Z + 0.2 - z) * s.dive;
    const sway = (1 - s.cam * 0.75) * (1 - s.dive);
    const tx = eyeUniforms.uIrisC.value.x * s.dive;
    const ty = eyeUniforms.uIrisC.value.y * s.dive;

    // Respiration de caméra steadycam (cadreur organique cinématographique)
    const breatheX = (Math.sin(now * 0.42) * 0.022 + Math.sin(now * 0.88) * 0.011) * calm;
    const breatheY = (Math.cos(now * 0.35) * 0.018 + Math.cos(now * 0.76) * 0.009) * calm;
    const breatheRoll = Math.sin(now * 0.25) * 0.004 * calm;

    // Secousse cinétique (impact tactile au toucher et déchirure violente)
    const shakeAmp = s.shake * (1 - s.dive * 0.4);
    const shakeX = (Math.sin(now * 85) * 0.13 + Math.sin(now * 142) * 0.07) * shakeAmp;
    const shakeY = (Math.cos(now * 97) * 0.11 + Math.cos(now * 163) * 0.05) * shakeAmp;
    const shakeZ = Math.sin(now * 71) * 0.08 * shakeAmp;
    const shakeRoll = Math.sin(now * 110) * 0.024 * shakeAmp;

    // FOV dynamique (Dolly Zoom cinématographique / effet vertigo dans l'accélération)
    const targetFov = FOV + s.dive * 16 + Math.sin(Math.PI * s.cam) * 4.2;
    if (Math.abs(camera.fov - targetFov) > 0.02) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }

    camera.position.set(
      tx + (pointer.sx * 0.06 + Math.sin(now * 0.17) * 0.015) * sway + breatheX + shakeX,
      ty + (-pointer.sy * 0.04 + Math.cos(now * 0.13) * 0.01) * sway + breatheY + shakeY,
      z + shakeZ,
    );
    camera.lookAt(tx, ty, z - 10);
    camera.rotation.z = Math.sin(now * 0.09) * 0.02 * s.eye * (1 - s.dive) + breatheRoll + shakeRoll;
    renderer.render(scene, camera);
  }

  return {
    loaded,
    play() {
      if (timeline || !ready) return;
      introAudio.ignite();
      onEvent?.('ignite');

      timeline = gsap.timeline({
        onComplete: () => {
          introAudio.portalReveal();
          onEvent?.('portal');
          onEnd();
        },
      })
        // elles se cherchent : la main de droite vient lentement, celle de gauche se relève vers elle
        .to(s, { god: 0.6, duration: 2.3, ease: 'sine.inOut' }, 0)
        .to(s, { adam: 0.5, duration: 2.0, ease: 'sine.inOut' }, 0.5)
        .to(s, { glow: 0.5, duration: 2.4, ease: 'sine.inOut' }, 0.3)
        // une hésitation : elles reculent à peine
        .to(s, { god: 0.52, duration: 0.9, ease: 'sine.inOut' }, 2.4)
        .to(s, { adam: 0.44, duration: 0.9, ease: 'sine.inOut' }, 2.5)
        // puis elles se rejoignent, très doucement, jusqu'à se toucher
        .to(s, { god: 1, duration: 2.1, ease: 'power2.inOut' }, 3.3)
        .to(s, { adam: 1, duration: 1.9, ease: 'power2.inOut' }, 3.5)
        .to(s, { glow: 1, duration: 2.0, ease: 'power1.in' }, 3.4)
        // elles se touchent : étincelle cristalline, faisceau anamorphique et onde d'impact
        .call(() => {
          introAudio.touch();
          onEvent?.('touch');
        }, [], 5.2)
        .to(s, { caress: 1, duration: 0.7, ease: 'sine.out' }, 5.2)
        .fromTo(s, { ring: 0 }, { ring: 1, duration: 1.6, ease: 'power2.out' }, 5.25)
        .to(s, { shake: 0.18, duration: 0.04, ease: 'none' }, 5.2)
        .to(s, { shake: 0, duration: 0.35, ease: 'power2.out' }, 5.24)
        // séparation brusque : rupture poignante, la main gauche sombre dans les enfers
        .addLabel('split', 7.2)
        .call(() => {
          introAudio.split();
          onEvent?.('split');
          onEvent?.('flash', 1);
        }, [], 'split')
        .to(s, { glow: 2.2, duration: 0.05, ease: 'none' }, 'split')
        .to(s, { glow: 0, duration: 0.45, ease: 'power2.out' }, 'split+=0.05')
        .to(s, { shake: 0.75, duration: 0.05, ease: 'none' }, 'split')
        .to(s, { shake: 0, duration: 1.1, ease: 'power3.out' }, 'split+=0.05')
        .to(s, { flash: 1, duration: 0.05, ease: 'none' }, 'split')
        .to(s, { flash: 0, duration: 0.45, ease: 'power2.out' }, 'split+=0.05')
        .to(s, { chroma: 1, duration: 0.08, ease: 'none' }, 'split')
        .to(s, { chroma: 0, duration: 0.65, ease: 'power2.out' }, 'split+=0.08')

        // 1. LA MAIN GAUCHE TOMBE DANS LES ENFERS :
        // Micro-hésitation désespérée (le doigt tendu tente d'agripper)
        .to(s, { fallX: 0.7, fallRotZ: 0.25, duration: 0.3, ease: 'power1.out' }, 'split')
        // Puis décrochage vertigineux et chute libre dans le gouffre
        .to(s, { fallY: 18.0, duration: 2.2, ease: 'power3.in' }, 'split+=0.15')
        .to(s, { fallX: 4.8, duration: 2.2, ease: 'power2.in' }, 'split+=0.15')
        .to(s, { fallRotZ: -0.9, fallRotX: 0.8, duration: 2.2, ease: 'power2.in' }, 'split+=0.15')
        // Incandescence et combustion aux enfers
        .to(s, { inferno: 1.0, duration: 1.5, ease: 'power1.in' }, 'split+=0.25')
        .to(s, { fadeL: 1.0, duration: 0.9, ease: 'power2.in' }, 'split+=1.4')

        // 2. LA MAIN DROITE S'ÉLÈVE AU PARADIS (Élévation céleste sereine et douce) :
        // Ascension lente, fluide, flottant gracieusement vers les cieux
        .to(s, { riseY: 5.5, duration: 3.4, ease: 'sine.inOut' }, 'split+=0.15')
        .to(s, { riseX: 3.6, duration: 3.4, ease: 'sine.inOut' }, 'split+=0.15')
        .to(s, { riseRotZ: 0.18, riseRotX: -0.14, duration: 3.4, ease: 'sine.inOut' }, 'split+=0.15')
        .to(s, { heaven: 1.0, duration: 2.0, ease: 'sine.out' }, 'split+=0.15')
        .to(s, { fadeR: 1.0, duration: 1.8, ease: 'power1.inOut' }, 'split+=1.6')

        // Traversée cosmique vers l'œil (qui démarre pendant la chute)
        .to(s, { cam: 1, duration: 2.2, ease: 'power3.inOut' }, 'split+=0.35')
        .call(() => {
          introAudio.eyeReveal();
          onEvent?.('eye');
        }, [], 'split+=1.35')
        .to(s, { eye: 1, duration: 1.5, ease: 'power2.out' }, 'split+=1.35')
        // l'œil regarde dans le vide : la caméra avance à peine, la pupille s'ouvre
        .to(s, { push: 1, duration: 3.0, ease: 'none' }, 'split+=2.4')
        .to(s, { pupil: 0.42, duration: 2.2, ease: 'sine.inOut' }, 'split+=2.6')
        // plongée dans la pupille : vortex d'aspiration spatiale
        .call(() => {
          introAudio.dive();
          onEvent?.('dive');
        }, [], 'split+=4.7')
        .to(s, { dive: 1, duration: 1.05, ease: 'power3.in' }, 'split+=4.7')
        .to(s, { pupil: 0.78, duration: 1.05, ease: 'power2.in' }, 'split+=4.7')
        .to(s, { chroma: 1, duration: 0.95, ease: 'power3.in' }, 'split+=4.7')
        .to(s, { shake: 0.28, duration: 0.95, ease: 'power2.in' }, 'split+=4.7');
    },
    dispose() {
      disposed = true;
      timeline?.kill();
      gsap.ticker.remove(render);
      sizes.disconnect();
      window.removeEventListener('pointermove', move);
      textures.forEach((t) => t.dispose());
      [glow, spark, wall, handL.mesh, handR.mesh].forEach((m) => m.geometry.dispose());
      sparkMat.dispose(); wallMat.dispose(); shadowL.mat.dispose(); shadowR.mat.dispose();
      eyeGeo?.dispose();
      glowMat.dispose(); emberGeo.dispose(); emberMat.dispose(); handL.mat.dispose(); handR.mat.dispose(); eyeMat.dispose();
      env.dispose();
      draco.dispose();
      renderer.dispose();
      introAudio.dispose();
    },
  };
}
