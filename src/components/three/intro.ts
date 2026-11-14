import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { gsap } from '@/lib/motion';
import { metalEnvironment } from './satellites';
import { introAudio } from '@/lib/introAudio';
import { createAngel, createFallWall, type Angel } from './introAngel';

/* ═══════════════════════════════════════════════════════════════
   INTRO DU SITE : LA CRÉATION → L'ŒIL (three.js)
   Les mains sont en 2.5D : une photo nette de deux mains dans la pose de « La Création d'Adam », sur fond noir,
   coupée en deux et recolorée dans la palette du site (public/intro/hand-l.webp, hand-r.webp : la photo en rouge, sa silhouette pleine en vert ;
   photo de référence, mains détourées de leur fond de plâtre).
   L'œil est en 3D : celui d'un buste de marbre scanné (public/intro/eye.glb, « Helen Ruthven Waterston »,
   Smithsonian Open Access, CC0), en pierre noire ; derrière ses paupières, un globe vivant (une sphère lisse) ; son iris vient
   d'une photo du domaine public déroulée et teintée ambre (public/intro/iris.webp). Décodeur : public/draco.

   Derrière les mains, un fond sombre et lisse (une lueur chaude au centre, un grain fin), où les mains projettent une ombre douce. Les mains flottent chacune à leur rythme ;
   elles ne réagissent pas à la souris (seul l'œil, à la fin, suit le curseur).
   Au clic : les deux mains se cherchent tendrement (approche lente, hésitation, elles se rejoignent ; une lueur naît
   entre les deux index et s'ouvre en anneau au contact ; elles s'attardent), puis sont séparées brusquement ; la caméra s'enfonce
   dans le vide : en travelling, elle tombe avec un astronaute ailé qui chute sur le dos comme Lucifer (introAngel.ts),
   la paroi de l'abîme défile vers le haut. La paroi était la créature : un œil de pierre y est fixé, il remonte dans le cadre
   pendant que l'astronaute tombe devant lui et le suit du regard ; il disparaît, l'œil cherche, puis nous trouve et nous fixe (Big Brother), il suit le
   curseur. La caméra plonge dans sa pupille, et le site s'ouvre.
   ═══════════════════════════════════════════════════════════════ */

const FOV = 15;            // longue focale : peu de perspective
const EYE_Z = -18;         // l'œil attend loin derrière, dans le noir
const FLY = 15;            // distance parcourue par chaque main quand elles sont arrachées
const STONE = 0x17120e;
const FALL_T = 4.0;        // durée du travelling sur la chute
const FALL_SPEED = 6.5;    // vitesse de chute de la caméra (unités du monde par seconde)
const FALL_UP = 2.4;       // la caméra se met à tomber (sine.inOut)…
const FALL_BRAKE = 2.2;    // … et freine, à la fin du travelling
// descente totale = vitesse × (moitié de l'accélération + plein régime + moitié du freinage) ; les deux courbes sont symétriques
const DESCENT_TOTAL = FALL_SPEED * (FALL_UP / 2 + (FALL_T - FALL_UP) + FALL_BRAKE / 2);
// position de la caméra = intégrale de sa vitesse (vitesse en cosinus pour démarrer et freiner) : une fonction du temps,
// identique quel que soit le nombre d'images par seconde
const easeFallStart = (t: number) => t - Math.sin(Math.PI * t) / Math.PI;
const easeFallBrake = (t: number) => t + Math.sin(Math.PI * t) / Math.PI;
const ANGEL_SCALE = 0.45;
const smooth01 = (x: number) => { const t = Math.min(Math.max(x, 0), 1); return t * t * (3 - 2 * t); };

/* Photo des mains : 1 unité = 145 px ; l'origine est le milieu entre les deux index.
   HAND_SCALE : sur un écran large, la photo occupe toute la largeur quand les index se touchent, les avant-bras sortent
   du cadre (pas de coupe visible) ; sur un écran étroit, les mains sont réduites pour rester entières (voir resize). */
const PX = 145;
const HAND_SCALE = 0.9;
// chaque moitié de photo, avec son point de contact : 25 px devant le bout de son index (l'index gauche est un peu plus bas)
const GAP_PX = 25;
const LEFT = { x: 0, y: 0, w: 877, h: 887, c: { x: 851 + GAP_PX, y: 516 } };
const RIGHT = { x: 877, y: 0, w: 897, h: 887, c: { x: 901 - GAP_PX, y: 491 } };

/* Œil, dans le repère du modèle (tout est mesuré sur le scan, voir les scripts de mesure) : iris. */
const EYE = { ix: -0.07, iy: 0.0, ir: 0.37 };
/* Le globe : une vraie sphère, lisse, ajustée au globe de marbre du scan (écart moyen 0,011) et à peine plus grosse
   que lui. Les paupières du scan passent devant elle. */
const BALL = { x: -0.2284, y: -0.0052, z: -0.9513, r: 0.9804, inflate: 0.03 };
/* Le bord des paupières : là où le scan passe devant la sphère. Deux courbes lisses le suivent (haut et bas), qui se
   rejoignent aux coins de l'œil : y = droite entre les coins + (1 - u²) · polynôme(u), u de -1 (coin gauche) à 1.
   Le globe s'arrête sur ces courbes, un rien en retrait du relief : son contour est net et régulier. */
const LIDS = {
  xm: -0.16, hw: 0.74, yl: -0.1417, yr: -0.0145, inset: 0.018,
  top: [0.4253, 0.0676, -0.0304, 0.0683, 0.4881], bot: [-0.2440, -0.0875, 0.0558, 0.1053, -0.5453],
};
const horner = (c: number[]) => c.map((v) => v.toFixed(4)).reduceRight((acc, v) => `(${v} + u * ${acc})`);

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
  uniform vec2 uRes;
  varying vec2 vUv;
  void main() {
    vec2 la = vec2(0.);
    for (int i = 0; i < 28; i++) la += texture2D(uTex, vUv + uBlur * (float(i) / 27. - .5)).rg;   // flou de mouvement (R : la photo, G : sa silhouette)
    la /= 28.;
    float l = la.x;
    // la main est opaque (silhouette complète, canal vert) : on ne voit rien à travers ; son ombre va vers le noir
    // la main reste opaque (sinon le fond se voit à travers, comme des trous) ; seul le tout bout de l'avant-bras s'efface
    float edge = abs(vUv.x - uOuter);
    float a = la.y * smoothstep(.0, .08, edge);   // seul le tout bout de l'avant-bras s'efface (il est hors du cadre)
    if (a < .003) discard;
    float t = pow(l, .85);
    vec3 col = mix(vec3(.06, .032, .02), vec3(.5, .26, .15), smoothstep(0., .4, t));   // l'ombre a la couleur du fond : elle s'y fond (plus noire, on dirait des trous)
    col = mix(col, vec3(1., .56, .26), smoothstep(.32, .78, t));
    col = mix(col, vec3(1., .9, .76), smoothstep(.74, 1., t));
    col *= 1. + uGlow * .35;
    col = mix(vec3(.04, .03, .022), col, .1 + .9 * smoothstep(.02, .44, edge));   // la lumière vient du centre : l'avant-bras s'assombrit vers le bord du cadre

    // Chute aux enfers : incandescence rouge sang, cendre et braise consumée (main gauche)
    vec3 hell = mix(vec3(.32, .02, .005), vec3(1., .24, .02), smoothstep(0., .45, t));
    hell = mix(hell, vec3(1., .75, .2), smoothstep(.45, 1., t));
    col = mix(col, hell, uInferno * .92);

    // Ascension au paradis : or blanc radieux, translucidité et aura divine céleste (main droite)
    vec3 celestial = mix(vec3(1., .78, .4), vec3(1., .98, .92), smoothstep(.1, .75, t)) * 1.45;
    col = mix(col, celestial, uHeaven * .92);

    float sx = gl_FragCoord.x / uRes.x;
    col = mix(vec3(.0392, .0314, .0235), col, smoothstep(0., .17, min(sx, 1. - sx)));   // vignette : l'avant-bras se perd dans le noir au bord du cadre
    float alpha = a * (1. - uFade) * mix(1., smoothstep(.035, .32, l), uInferno * .45);
    gl_FragColor = vec4(col, alpha);
  }
`;

/* Mur : la texture de plâtre en niveaux de gris, passée dans la palette du site, éclairée au centre par la lueur des mains */
const WALL_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uTex;
  uniform float uK, uSpark;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - .5) * vec2(1.6, 1.);
    float lit = exp(-dot(p, p) * 10.) * .75 + .08;               // la lumière vient du milieu, les bords restent dans le noir
    lit += exp(-dot(p, p) * 70.) * uSpark * 1.4;                 // la lueur du contact éclaire le mur
    vec3 col = vec3(.075, .045, .03) * lit;                       // fond lisse, éclairé au centre
    col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - .5) * .012;   // grain fin, net
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
    for (int i = 0; i < 24; i++) {
      float ang = float(i) * 2.39996, r = sqrt((float(i) + .5) / 24.) * .06;
      vec4 tx = texture2D(uTex, vUv + vec2(cos(ang), sin(ang) * 1.6) * r);
      a += tx.g;
    }
    a = a / 24. * smoothstep(0., .45, abs(vUv.x - uOuter));
    gl_FragColor = vec4(0., 0., 0., a * uK);
  }
`;

const EYE_PARS = /* glsl */ `
  uniform sampler2D uIris;
  uniform vec2 uIrisC;
  uniform float uPupil, uReveal, uGlow, uOpen, uGlint;
  varying vec3 vObj;
  float eyeMask; vec3 irisCol; float irisMask; float lidOpen;
  float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(hash21(i), hash21(i + vec2(1., 0.)), f.x), mix(hash21(i + vec2(0., 1.)), hash21(i + vec2(1., 1.)), f.x), f.y);
  }
`;

/* Le globe (sphère) : iris, pupille, blanc de l'œil, ombre des paupières */
const BALL_MAP = /* glsl */ `
  {
    float uu = (vObj.x - (${LIDS.xm.toFixed(4)})) / ${LIDS.hw.toFixed(4)};
    float u = clamp(uu, -1., 1.);
    float base = mix(${LIDS.yl.toFixed(4)}, ${LIDS.yr.toFixed(4)}, u * .5 + .5);
    float top = base + (1. - u * u) * ${horner(LIDS.top)} - vObj.y;   // distance au bord de la paupière du haut
    float bot = vObj.y - (base + (1. - u * u) * ${horner(LIDS.bot)});   // … et à celle du bas
    float t = u * .5 + .5;
    lidOpen = min(top, bot) - ${LIDS.inset.toFixed(4)} - max(abs(uu) - 1., 0.) * 4.;   // > 0 : entre les paupières
    eyeMask = 1.;

    vec2 q = vObj.xy - uIrisC;
    float r = length(q) / ${EYE.ir.toFixed(3)};
    float rt = mix(.265, 1., clamp((r - uPupil) / (1. - uPupil), 0., 1.));   // la pupille s'ouvre : l'iris se resserre
    irisCol = texture2D(uIris, vec2(atan(q.y, q.x) / 6.2832 + .5, 1. - rt / 1.1)).rgb;
    irisCol *= 1. - .85 * smoothstep(.76, 1., r);                            // anneau sombre du bord
    irisCol *= .75 + .5 * smoothstep(-.9, .9, -q.y / ${EYE.ir.toFixed(3)});   // la lumière traverse la cornée, le bas s'éclaire
    float aa = fwidth(r) * 1.2;                                              // bords nets à toute distance
    irisMask = (1. - smoothstep(1. - aa - .03, 1. + aa + .03, r)) * smoothstep(uPupil - aa, uPupil + aa + .03, r);

    vec3 sclera = (vec3(.29, .25, .21) - vec3(.02, .07, .07) * smoothstep(1., 2.6, r)) * (1. - .45 * smoothstep(.9, 2.5, r));
    float vein = smoothstep(.02, 0., abs(vnoise(vObj.xy * 9.) * .6 + vnoise(vObj.xy * 21.) * .4 - .5)) * smoothstep(1.25, 2.3, r);
    sclera -= vein * vec3(.01, .05, .05);
    sclera = mix(sclera, vec3(.42, .2, .17), smoothstep(.62, .98, abs(t - .5) * 2.) * .8);   // coins rosés
    vec3 eyeCol = mix(irisCol, sclera, smoothstep(1. - aa - .03, 1. + aa + .03, r));
    eyeCol = mix(vec3(.002), eyeCol, smoothstep(uPupil - aa, uPupil + aa + .03, r));   // pupille
    // les paupières font de l'ombre sur le globe : large et douce sous celle du haut, serrée au ras de celle du bas
    eyeCol *= .2 + .8 * smoothstep(-.02, .3, top);
    eyeCol *= .5 + .5 * smoothstep(-.02, .12, bot);
    eyeCol *= .35 + .65 * smoothstep(-.01, .05, min(top, bot));              // contact : le globe s'enfonce sous la paupière
    diffuseColor.rgb = eyeCol;
  }
`;

/* La pierre du visage : au ras du globe, le bord des paupières tombe dans l'ombre (comme une ligne de cils) */
const STONE_MAP = /* glsl */ `
  {
    eyeMask = 0.; irisCol = vec3(0.); irisMask = 0.; lidOpen = 0.;
    float h = length(vObj - vec3(${BALL.x.toFixed(4)}, ${BALL.y.toFixed(4)}, ${BALL.z.toFixed(4)})) - ${(BALL.r + BALL.inflate).toFixed(4)};   // hauteur au-dessus du globe
    diffuseColor.rgb *= .25 + .75 * smoothstep(0., .09, h);
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
  eyeKey.position.set(-1.5, 5.5, 4);   // d'en haut, comme la lumière de la paroi
  const eyeRim = new THREE.DirectionalLight(0xff6a1f, 0);
  eyeRim.position.set(-6, 1.4, 1.6);
  // Lumières de l'astronaute : la lumière d'en haut (celle d'où il tombe), un jour chaud de face, une lueur orange d'en bas
  const astroTop = new THREE.DirectionalLight(0xffe2c0, 0);
  astroTop.position.set(-1.5, 8, 3);   // d'en haut : la lumière qu'il quitte
  const astroKey = new THREE.DirectionalLight(0xfff0e0, 0);
  astroKey.position.set(-3, 4, 6);
  const astroRim = new THREE.DirectionalLight(0xff6a1f, 0);
  astroRim.position.set(0.8, -6, 1.5);   // lueur orange qui monte du fond
  scene.add(rimA, rimB, key, eyeKey, eyeRim, astroTop, astroKey, astroRim);

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
    uniforms: { uTex: { value: null as THREE.Texture | null }, uK: { value: 1 }, uSpark: { value: 0 } },
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
    uniforms: { uT: { value: 0 }, uK: { value: 0.3 }, uScale: { value: 1 }, uCamY: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uT, uScale, uCamY;
      varying float vA;
      void main() {
        vec3 p = position;
        p.x += sin(uT * (.2 + aSeed * .3) + aSeed * 40.) * .18;
        p.y += mod(uT * (.03 + aSeed * .05), 1.) * .6 - .3;
        p.y = uCamY + mod(p.y - uCamY + 4.5, 9.) - 4.5;   // la caméra tombe : les braises défilent vers le haut, autour d'elle
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
  const handRes = { value: new THREE.Vector2(1, 1) };   // taille du rendu, en pixels
  const makeHand = (r: typeof LEFT, outer: number) => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: HAND_FRAG, transparent: true, depthWrite: false,
      uniforms: {
        uTex: { value: null as THREE.Texture | null },
        uBlur: { value: new THREE.Vector2() },
        uGlow: { value: 0 },
        uOuter: { value: outer },
        uRes: handRes,
        uInferno: { value: 0 },
        uHeaven: { value: 0 },
        uFade: { value: 0 },
      },
    });
    const w = r.w / PX;
    const h = r.h / PX;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    // le plan est placé dans un groupe dont l'origine est le milieu entre les index : le groupe tourne autour de ce point
    mesh.position.set((r.x - r.c.x) / PX + w / 2, (r.c.y - r.y) / PX - h / 2, 0);
    const group = new THREE.Group();
    group.add(mesh);
    scene.add(group);
    return { group, mesh, mat, pw: w, ph: h, w, h, last: new THREE.Vector2(), first: true };
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
    uPupil: { value: 0.26 }, uReveal: { value: 0 }, uGlow: { value: 1 }, uOpen: { value: 1 }, uGlint: { value: 0 },
  };
  const eyeMat = new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.55, metalness: 0.02, transparent: true });
  const ballMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.12, metalness: 0, transparent: true });
  const eyeShader = (ball: boolean) => (shader: THREE.WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, eyeUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      // la sphère est centrée sur le globe : on la ramène dans le repère du visage
      .replace('#include <begin_vertex>', ball
        ? `#include <begin_vertex>\nvObj = position + vec3(${BALL.x.toFixed(4)}, ${BALL.y.toFixed(4)}, ${BALL.z.toFixed(4)});`
        : '#include <begin_vertex>\nvObj = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${EYE_PARS}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${ball ? BALL_MAP : STONE_MAP}`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += irisCol * irisMask * eyeMask * .22 * uGlow;')
      // le visage se fond dans le fond en s'éloignant de l'œil : sa couleur glisse vers celle du fond avant de devenir
      // transparent (pas d'anneau noir) ; uReveal le fait sortir de l'ombre. Le globe, lui, reste plein.
      .replace('#include <dithering_fragment>', ball
        ? '#include <dithering_fragment>\ngl_FragColor.a = uReveal * smoothstep(0., max(fwidth(lidOpen) * 1.5, .0005), lidOpen);'
        : '#include <dithering_fragment>\nfloat er0 = length((vObj.xy - vec2(-.15, .1)) * vec2(vObj.x > 0. ? 1.3 : .95, 1.2));\nfloat fall = smoothstep(2.3, .7, er0);\nfall *= fall;\ngl_FragColor.rgb = mix(vec3(.0392, .0314, .0235), gl_FragColor.rgb, fall);\ngl_FragColor.a = uReveal * smoothstep(0., .25, fall);');
  };
  eyeMat.onBeforeCompile = eyeShader(false);
  ballMat.onBeforeCompile = eyeShader(true);
  // deux programmes distincts (sans clé, three les confond : les deux fonctions ont le même texte)
  eyeMat.customProgramCacheKey = () => 'intro-eye-stone';
  ballMat.customProgramCacheKey = () => 'intro-eye-ball';
  // le globe est dessiné après le visage : il n'apparaît que là où il passe devant le scan, entre les paupières
  const ballGeo = new THREE.SphereGeometry(BALL.r + BALL.inflate, 128, 96);
  const ball = new THREE.Mesh(ballGeo, ballMat);
  ball.position.set(BALL.x, BALL.y, BALL.z);
  ball.renderOrder = 1;
  const eye = new THREE.Group();
  eye.position.z = EYE_Z;
  eye.visible = false;
  scene.add(eye);

  /* ——— Astronaute ailé (introAngel.ts) et le ciel de sa chute ——— */
  let angel: Angel | null = null;
  const sky = createFallWall(scene);

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

  const loaded = Promise.all([load('hand-l.webp'), load('hand-r.webp'), load('iris.webp'), gltf.loadAsync('/intro/eye.glb'), gltf.loadAsync('/intro/angel.glb'), load('rock.webp')]).then(([l, r, iris, eyeFile, astroFile, rockTex]) => {
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
    eyeFile.scene.traverse((o) => { if (!eyeGeo && (o as THREE.Mesh).isMesh) eyeGeo = (o as THREE.Mesh).geometry; });
    eye.add(new THREE.Mesh(eyeGeo!, eyeMat), ball);
    sky.setTexture(rockTex);
    angel = createAngel(astroFile, scene);
    angel.group.scale.setScalar(ANGEL_SCALE);
    angel.group.visible = false;
    ready = true;
    resize();
    renderer.compile(scene, camera);
    gsap.ticker.add(render);
  });

  /* ——— Cadrage ——— */
  let aspect = 1;
  let wide = 11;       // largeur visible au niveau des mains
  let wideEye = 4.6;   // … et au niveau de l'œil
  let handScale = HAND_SCALE;
  let spread = 1;      // écartement des mains avant le clic : réduit sur un écran étroit, pour qu'elles restent dans le cadre
  let halfGap = (GAP_PX / PX) * handScale;
  const dist = (w: number) => w / (2 * Math.tan((FOV * Math.PI) / 360) * aspect);
  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.getDrawingBufferSize(handRes.value);
    wide = Math.max(4.6, Math.min(11, 7 * aspect));
    wideEye = 1.75 / Math.max(0.3, Math.min(0.72, 0.5 / aspect));
    // écran étroit : les mains rétrécissent avec le cadre et se rapprochent, pour rester entières à l'écran
    handScale = HAND_SCALE * Math.max(0.6, wide / 11);
    spread = Math.min(1, wide / 11);
    halfGap = (GAP_PX / PX) * handScale;
    for (const h of [handL, handR]) { h.group.scale.setScalar(handScale); h.w = h.pw * handScale; h.h = h.ph * handScale; }
    shadowL.group.scale.setScalar(handScale * 1.12);   // l'ombre portée est un peu plus grande que la main
    shadowR.group.scale.setScalar(handScale * 1.12);
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
    astro: 0, astroL: 0, sky: 0,   // chute de l'astronaute (0 → 1), sa lumière, la lumière d'en haut
    lock: 0, irisPulse: 0, open: 1, glint: 0, rise: 0, fallV: 0, drop: 0, lift: 0, wingOpen: 0,   // l'œil remonte des profondeurs ; vitesse de la chute         // l'œil se fixe sur nous ; l'iris s'embrase quand il avale l'astronaute
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
  let timeline: gsap.core.Timeline | null = null;
  // Chaque main recule le long de son avant-bras : la gauche vers le bas à gauche, la droite vers le haut à droite
  const dirL = new THREE.Vector2(-1, -0.3).normalize();
  const dirR = new THREE.Vector2(1, 0.12).normalize();
  // regard : il dérive lentement vers des points au hasard, jamais vers nous
  // regard : il suit la chute de l'astronaute, puis se fixe sur nous (micro-saccades, il suit le curseur)
  // regard : la créature cherche (saccades vers les côtés, puis des pauses), puis nous trouve et ne nous lâche plus
  const gaze = { x: 0.15, y: 0.05, tx: 0.15, ty: 0.05, mx: 0, my: 0, next: 0, burst: 0 };
  const tmpV = new THREE.Vector3();
  const headDir = new THREE.Vector3(), front = new THREE.Vector3(), sideV = new THREE.Vector3();
  const basis = new THREE.Matrix4(), angelQ = new THREE.Quaternion();
  let angelFirst = true;
  let descent = 0;   // de combien la caméra est descendue (s.drop, piloté par la séquence)
  let last = performance.now() / 1000;

  function render() {
    if (disposed || !ready) return;
    const now = performance.now() / 1000;
    const dt = Math.min(now - last, 0.1);
    last = now;
    // souris lissée : la parallaxe suit en douceur, sans à-coups
    descent = s.drop;
    pointer.sx += (pointer.x - pointer.sx) * Math.min(dt * 2.2, 1);
    pointer.sy += (pointer.y - pointer.sy) * Math.min(dt * 2.2, 1);

    // ——— mains ———
    const calm = (1 - s.fadeR) * (1 - s.fadeL);
    const touch = Math.min(s.god, s.adam);
    // les mains ne réagissent pas à la souris : elles flottent seulement, chacune à son rythme

    // ——— MAIN GAUCHE (Adam / mortelle) ———
    // Approche jusqu'au contact, puis chute poignante dans les flammes des enfers
    const dL = 0.95 * spread * (1 - s.adam) - (halfGap - 0.004) * s.adam;
    const baseLx = dirL.x * dL;
    const baseLy = dirL.y * dL;
    const freeL = calm * (1 - touch * 0.85);
    const floatLx = (Math.sin(now * 0.23) * 0.05 + Math.sin(now * 0.11) * 0.03) * freeL;
    const floatLy = (Math.sin(now * 0.31) * 0.06 + Math.sin(now * 0.17) * 0.03) * freeL;

    const posX_L = baseLx - s.fallX + floatLx;
    const posY_L = baseLy - s.fallY + floatLy;
    const posZ_L = -s.fallY * 0.22;

    handL.group.position.set(posX_L, posY_L, posZ_L);
    handL.group.rotation.z = (-0.09 * (1 - s.adam) + Math.sin(now * 0.27) * 0.02 * (1 - touch)) * calm + s.fallRotZ;
    handL.group.rotation.y = -s.fallRotZ * 0.35;
    handL.group.rotation.x = s.fallRotX;

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
    const dR = 1.6 * spread * (1 - s.god) - (halfGap - 0.004) * s.god;
    const freeR = calm * (1 - touch * 0.85);
    const floatRx = (Math.sin(now * 0.23 + 2.2) * 0.05 + Math.sin(now * 0.11 + 6.6) * 0.03) * freeR;
    const floatRy = (Math.sin(now * 0.31 + 3.74) * 0.06 + Math.sin(now * 0.17 + 2.2) * 0.03) * freeR;

    const posX_R = dirR.x * dR + s.riseX + floatRx;
    const posY_R = dirR.y * dR + s.riseY + floatRy;
    const posZ_R = Math.min(s.riseY * 0.05, 0.35);

    handR.group.position.set(posX_R, posY_R, posZ_R);
    handR.group.rotation.z = (0.06 * (1 - s.god) + Math.sin(now * 0.27 + 2.2) * 0.02 * (1 - touch)) * calm + s.riseRotZ;
    handR.group.rotation.y = -s.riseRotZ * 0.25;
    handR.group.rotation.x = -s.riseRotX;

    const blurR = handR.mat.uniforms.uBlur.value as THREE.Vector2;
    if (handR.first) { handR.last.set(posX_R, posY_R); handR.first = false; }
    blurR.set((posX_R - handR.last.x) / handR.w, (posY_R - handR.last.y) / handR.h).multiplyScalar(0.9).clampLength(0, 0.35);
    handR.last.set(posX_R, posY_R);

    handR.mat.uniforms.uGlow.value = s.glow + s.heaven * 2.4;
    handR.mat.uniforms.uHeaven.value = s.heaven;
    handR.mat.uniforms.uFade.value = s.fadeR;
    handR.group.visible = s.fadeR < 0.99;

    // ——— mur : immobile lui aussi ; disparaît dès que la caméra plonge ———
    wallMat.uniforms.uSpark.value = Math.min(1, Math.max(0, (touch - 0.6) / 0.4)) * (1 - s.fallY * 0.1) + Math.max(s.glow - 1, 0) * 0.5;
    wallMat.uniforms.uK.value = Math.max(0, 1 - s.cam * 2.5);
    wall.visible = s.cam < 0.35 && camera.position.z > (WALL_Z + 1.2);

    const hideL = 1 - Math.min(s.fallY / 6, 1);
    const hideR = 1 - Math.min(s.riseY / 4.5, 1);
    shadowL.group.position.set(handL.group.position.x + 0.3, handL.group.position.y - 0.42, -2.2);
    shadowL.group.rotation.copy(handL.group.rotation);
    shadowL.mat.uniforms.uK.value = 0.45 * hideL * (1 - s.cam);
    shadowL.group.visible = hideL > 0.01 && s.cam < 0.25;

    shadowR.group.position.set(handR.group.position.x + 0.3, handR.group.position.y - 0.42, -2.2);
    shadowR.group.rotation.copy(handR.group.rotation);
    shadowR.mat.uniforms.uK.value = 0.45 * hideR * (1 - s.cam);
    shadowR.group.visible = hideR > 0.01 && s.cam < 0.25;

    // ——— lueur au point de contact : elle naît quand les doigts s'approchent, respire quand ils se touchent ———
    const near = Math.min(Math.max((touch - 0.45) / 0.55, 0), 1);
    const breath = 0.85 + 0.15 * Math.sin(now * 1.6);
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
    glow.visible = s.cam < 0.3;
    emberMat.uniforms.uT.value = now;
    emberMat.uniforms.uCamY.value = camera.position.y;
    emberMat.uniforms.uK.value = (0.35 + 1.9 * Math.sin(Math.PI * s.cam)) * (1 - s.eye * 0.8) * (1 - s.sky * 0.45);
    eyeRim.intensity = s.eye * 0.3;   // liseré discret : plus fort, il fait des taches rouges sur la joue
    key.intensity = 0.42 * (1 - s.eye * 0.6);

    // ——— œil : la paroi est la créature. L'œil y est fixé, plus bas ; il suit l'astronaute qui passe, puis nous trouve (Big Brother) ———
    eye.visible = s.eye > 0.005 || s.glint > 0.005;
    eye.position.y = -DESCENT_TOTAL;   // immobile dans le monde : il remonte dans le cadre avec la roche
    const watching = angel?.group.visible && s.lock < 0.5;
    if (watching && angel) {   // il le suit des yeux pendant qu'il tombe devant lui
      tmpV.copy(angel.group.position);
      eye.worldToLocal(tmpV);
      const dz = Math.max(tmpV.z, 0.5);
      gaze.tx = THREE.MathUtils.clamp(Math.atan2(tmpV.x - EYE.ix, dz) * 0.6, -0.24, 0.24);
      gaze.ty = THREE.MathUtils.clamp(Math.atan2(tmpV.y - EYE.iy, dz) * 0.6, -0.18, 0.18);
    } else if (now > gaze.next) {
      if (s.lock < 0.5) {   // il l'a perdu : rafales de saccades vers les côtés, puis des pauses
        const side = Math.random() < 0.5 ? -1 : 1;
        gaze.tx = side * (0.1 + Math.random() * 0.18);
        gaze.ty = (Math.random() - 0.4) * 0.16;
        if (gaze.burst > 0) { gaze.burst -= 1; gaze.next = now + 0.3 + Math.random() * 0.4; }
        else { gaze.burst = Math.floor(Math.random() * 4); gaze.next = now + 1.1 + Math.random() * 1.4; }
      } else {             // elle nous fixe : micro-saccades, elle est vivante
        gaze.mx = (Math.random() - 0.5) * 0.024;
        gaze.my = (Math.random() - 0.5) * 0.016;
        gaze.next = now + 0.5 + Math.random() * 0.9;
      }
    }
    const lx = pointer.sx * 0.14 + gaze.mx, ly = -pointer.sy * 0.09 + gaze.my;
    const gk = Math.min(dt * (s.lock > 0 && s.lock < 1 ? 14 : 7), 1);
    gaze.x += (gaze.tx + (lx - gaze.tx) * s.lock - gaze.x) * gk;
    gaze.y += (gaze.ty + (ly - gaze.ty) * s.lock - gaze.y) * gk;
    const look = 1 - s.dive;
    eyeUniforms.uIrisC.value.set(EYE.ix + gaze.x * look, EYE.iy + gaze.y * look);
    // la pupille respire ; quand elle nous trouve, elle se resserre d'un coup (mise au point) puis s'ouvre lentement
    eyeUniforms.uPupil.value = s.pupil + Math.sin(now * 0.55) * 0.03 * (1 - s.lock * 0.6) + Math.sin(now * 1.3) * 0.008;
    eyeUniforms.uGlow.value = 1 + s.irisPulse * 2.4;
    eyeUniforms.uOpen.value = s.open;
    eyeUniforms.uGlint.value = s.glint;
    // la tête dérive dans le noir, puis se tourne à peine vers le curseur
    const drift = (1 - s.lock) * look;
    eye.rotation.set(
      Math.sin(now * 0.19) * 0.05 * drift + pointer.sy * 0.035 * s.lock * look,
      Math.sin(now * 0.14 + 1) * 0.07 * drift + pointer.sx * 0.05 * s.lock * look,
      Math.sin(now * 0.11) * 0.035 * drift,
    );
    eyeUniforms.uReveal.value = s.eye * (1 - Math.max(0, s.dive - 0.72) / 0.28);
    eyeKey.intensity = s.eye * s.eye * 1.0;   // la créature sort d'abord par ses liserés orange, puis la lumière la prend

    // ——— caméra : cadrage cinématique, respiration steadycam, secousse cinétique et dolly zoom ———
    const zHands = dist(wide) * (1 - 0.1 * s.god - 0.03 * s.caress);   // elle s'approche avec elles
    // une fois arrêtée, la caméra se recale exactement sur l'œil (la descente intégrée image par image dérive un peu)
    const camDrop = descent + (DESCENT_TOTAL - descent) * s.cam;
    // l'œil attend juste devant la caméra arrêtée : il sort de la roche en avançant vers nous
    const eyeZ = zHands - dist(wideEye);
    eye.position.z = eyeZ;
    const zEye = eyeZ + dist(wideEye) * (1 - 0.16 * s.push);
    let z = zHands + (zEye - zHands) * s.cam;
    z += (eyeZ + 0.2 - z) * s.dive;
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
    const targetFov = FOV + s.dive * 16;
    if (Math.abs(camera.fov - targetFov) > 0.02) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }

    const mouse = 1 - calm;   // la souris ne déplace le cadre qu'une fois les mains parties
    camera.position.set(
      tx + (pointer.sx * 0.06 * mouse + Math.sin(now * 0.17) * 0.015) * sway + breatheX + shakeX,
      ty + (-pointer.sy * 0.04 * mouse + Math.cos(now * 0.13) * 0.01) * sway + breatheY + shakeY - camDrop,
      z + shakeZ,
    );

    // ——— astronaute ailé : travelling sur sa chute. Il entre par le haut, la caméra le rattrape et tombe avec lui
    //     (la roche file vers le haut derrière lui), puis elle freine et il disparaît en bas, dans le noir ———
    const a = s.astro;
    let lookY = 0;
    if (angel) {
      angel.group.visible = a > 0.001 && s.lift > -4.3;
      if (angel.group.visible) {
        const fit = Math.min(1, aspect / 1.5);   // écran en portrait : plus petit
        const enter = 1 - smooth01(a / 0.3);                         // il nous rattrape par le haut
        const ax = (0.18 - 0.3 * a + Math.sin(now * 0.6) * 0.04) * fit;
        // s.lift : la caméra freine, lui non : il file vers le bas et passe devant l'œil qui arrive
        const ay = 2.8 * enter + s.lift - 0.3 + Math.sin(now * 0.9) * 0.05;
        angel.group.position.set(camera.position.x + ax + pointer.sx * 0.08, camera.position.y + ay - pointer.sy * 0.05, camera.position.z - 8.5);
        angel.group.scale.setScalar(ANGEL_SCALE * (0.5 + 0.5 * fit));
        // de profil, sur le dos (poitrine vers le ciel), la tête plus lourde un peu plus bas ; il bascule lentement
        const phi = 2.9 + 1.2 * a - 0.14 * s.lift + Math.sin(now * 0.5) * 0.05;   // il bascule sans s'arrêter en tombant
        headDir.set(Math.cos(phi), Math.sin(phi), 0.1).normalize();
        front.set(0.05, 0.9, 0.42);   // un peu de trois-quarts : on voit son casque et sa poitrine sous les ailes
        front.addScaledVector(headDir, -front.dot(headDir)).normalize();
        front.applyAxisAngle(headDir, Math.sin(now * 0.8) * 0.28);
        sideV.crossVectors(headDir, front);
        angelQ.setFromRotationMatrix(basis.makeBasis(sideV, headDir, front));
        if (angelFirst) { angel.group.quaternion.copy(angelQ); angelFirst = false; }
        else angel.group.quaternion.slerp(angelQ, Math.min(dt * 3, 1));
        // la caméra le suit à peine du regard ; ce regard naît et retombe en douceur (il se recentre sur l'œil qui arrive),
        // sinon le cadre sautait d'un cran à l'instant où l'astronaute sortait de l'image
        lookY = Math.max(ay, -1.6) * 0.06 * smooth01(a / 0.15) * (1 - s.eye);
      }
    }
    astroTop.intensity = s.astroL * 2.1;
    astroKey.intensity = s.astroL * 0.3;
    astroRim.intensity = s.astroL * 1.2;

    camera.lookAt(tx, ty + lookY - camDrop, z - 10);
    camera.rotation.z = Math.sin(now * 0.09) * 0.02 * s.eye * (1 - s.dive) + breatheRoll + shakeRoll + Math.sin(now * 0.7) * 0.012 * s.fallV;
    camera.updateMatrixWorld();
    // on tombe : la paroi et les braises filent vers le haut, à la vitesse de la chute
    sky.update(camera, s.sky, descent, s.fallV * FALL_SPEED, dist(wideEye));   // la paroi est à la profondeur de l'œil
    angel?.update(dt, now, a, s.astroL, s.sky, camera, s.wingOpen);
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

        // 3. Dès la séparation, la caméra se met à tomber : les mains et le fond glissent vers le haut,
        //    la paroi de l'abîme apparaît dessous, et l'astronaute ailé nous rattrape par le haut (travelling)
        .to(s, { fallV: 1, duration: FALL_UP, ease: 'sine.inOut' }, 'split+=0.3')   // la caméra ne fait que tomber, en douceur
        .to(s, { drop: (FALL_SPEED * FALL_UP) / 2, duration: FALL_UP, ease: easeFallStart }, 'split+=0.3')
        .to(s, { drop: FALL_SPEED * (FALL_UP / 2 + FALL_T - FALL_UP), duration: FALL_T - FALL_UP, ease: 'none' }, `split+=${0.3 + FALL_UP}`)
        .to(s, { sky: 1, duration: 1.8, ease: 'sine.inOut' }, 'split+=0.6')
        .addLabel('fall', 'split+=1.4')
        .call(() => introAudio.astronautFall(FALL_T + 0.6), [], 'fall')
        .to(s, { astroL: 1, duration: 0.8, ease: 'sine.out' }, 'fall')
        .to(s, { astro: 1, duration: FALL_T, ease: 'none' }, 'fall')
        // 4. La paroi était la créature : en freinant, on découvre l'œil fixé dans la roche, qui remonte vers nous
        //    pendant que l'astronaute tombe devant lui ; il le suit du regard. La caméra s'arrête pile devant lui.
        .addLabel('brake', `fall+=${FALL_T - 1.1}`)
        .to(s, { fallV: 0, duration: FALL_BRAKE, ease: (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t) }, 'brake')
        .to(s, { drop: DESCENT_TOTAL, duration: FALL_BRAKE, ease: easeFallBrake }, 'brake')
        .call(() => {
          introAudio.eyeReveal();
          onEvent?.('eye');
        }, [], 'brake')
        .to(s, { eye: 1, duration: 1.4, ease: 'power1.inOut' }, 'brake')
        // la caméra freine, lui non : il file vers le bas et passe devant l'œil, qui le suit du regard
        .to(s, { lift: -4.4, duration: FALL_BRAKE + 0.3, ease: 'power2.in' }, 'brake+=0.2')
        .to(s, { astroL: 0, duration: 0.7, ease: 'sine.in' }, `brake+=${FALL_BRAKE - 0.4}`)
        .to(s, { cam: 1, duration: 3.2, ease: 'sine.inOut' }, `brake+=${FALL_BRAKE}`)
        .to(s, { push: 1, duration: 2.6, ease: 'none' }, `brake+=${FALL_BRAKE}`)
        // … il l'a perdu, il cherche ; puis il nous trouve : la pupille se resserre, il ne nous lâche plus (Big Brother)
        .addLabel('watch', `brake+=${FALL_BRAKE + 1}`)
        // la paroi s'éteint autour du visage : il sort seul de l'obscurité (pas de hublot éclairé autour)
        .to(s, { sky: 0, duration: 1.5, ease: 'sine.inOut' }, 'brake')
        .to(s, { lock: 1, duration: 0.45, ease: 'power3.out' }, 'watch')
        .to(s, { pupil: 0.2, duration: 0.3, ease: 'power3.out' }, 'watch')
        .to(s, { pupil: 0.4, duration: 1.4, ease: 'sine.inOut' }, 'watch+=0.4')
        .to(s, { push: 1.15, duration: 1.6, ease: 'none' }, 'watch')
        // plongée dans la pupille : vortex d'aspiration spatiale
        .call(() => {
          introAudio.dive();
          onEvent?.('dive');
        }, [], 'watch+=1.6')
        .to(s, { dive: 1, duration: 1.05, ease: 'power3.in' }, 'watch+=1.6')
        .to(s, { pupil: 0.78, duration: 1.05, ease: 'power2.in' }, 'watch+=1.6')
        .to(s, { chroma: 1, duration: 0.95, ease: 'power3.in' }, 'watch+=1.6')
        .to(s, { shake: 0.28, duration: 0.95, ease: 'power2.in' }, 'watch+=1.6');
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
      angel?.dispose();
      sky.dispose();
      glowMat.dispose(); emberGeo.dispose(); emberMat.dispose(); handL.mat.dispose(); handR.mat.dispose(); eyeMat.dispose(); ballMat.dispose(); ballGeo.dispose();
      env.dispose();
      draco.dispose();
      renderer.dispose();
      introAudio.dispose();
    },
  };
}
