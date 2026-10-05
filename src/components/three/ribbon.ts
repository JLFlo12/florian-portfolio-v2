import * as THREE from 'three';
import { gsap } from '@/lib/motion';
import { createFluid } from './fluid';

/* ───────────────────────────────────────────────────────────────
   Bande de projets en 3D (inspirée de jesperlandberg.com) : les cartes se
   suivent sur un ruban qui ondule en profondeur. Elle avance avec le
   défilement de la page, se glisse à la souris ou au doigt, et un clic
   ouvre le projet. Les cartes sont unies, noires en mode sombre et blanches en
   mode clair (seul le texte reste visible) : sur la carte survolée, la souris
   laisse un liquide qui fait apparaître l'image, comme à travers une goutte
   d'eau (idée reprise de bleibtgleich.dev).
   En mouvement, elles se déforment comme du caoutchouc, avec un ressort.
   three.js seul (sans React), chargé à part quand la bande approche.
   ─────────────────────────────────────────────────────────────── */

export interface RibbonCard {
  title: string;
  tags: string[];
  image: string | null;
}

interface RibbonEvents {
  onSelect: (index: number) => void; // clic sur une carte (index dans la liste reçue)
  onFocus: (index: number) => void;  // carte au centre de l'écran
}

// Unités 3D : une carte fait 1 de haut, au format 16:10
const H = 1;
const W = 1.6;
const PITCH = W + 0.06;                   // largeur d'une carte + espace
const AMP = 0.3;                          // profondeur de l'ondulation
const K = (Math.PI * 2) / (PITCH * 2.4);  // une vague toutes les 2,4 cartes
const FOV = 30;
const TEX_W = 1024;
const TEX_H = 640;
const FONT_TITLE = '"Hubot Sans", "Arial Black", system-ui, sans-serif';
const FONT_MONO = '"Geist Mono", ui-monospace, monospace';
const FONTS = ['900 120px "Hubot Sans"', '700 50px "Hubot Sans"', '500 20px "Geist Mono"', '900 34px Doto'];

/* ——— Couleurs des cartes selon le thème du site (les teintes rvb servent aussi en transparence) ——— */
const DARK = {
  cover: '#0c0a08',        // version unie, que le liquide efface
  plain: '#120e0b',        // fond des projets sans image
  ink: '245, 240, 232',    // texte, liseré, quadrillage, mot-clé
  shade: '8, 6, 4',        // dégradé sous le texte
  accent: '255, 106, 31',  // numéro et lueur
  glow: 0.42,
  sheen: 0.08,             // lumière en haut à gauche de la version unie
};
type Look = typeof DARK;
const LIGHT: Look = {
  cover: '#fcfaf8',
  plain: '#f4eee6',
  ink: '25, 20, 16',
  shade: '244, 238, 230',
  accent: '234, 88, 12',
  glow: 0.3,
  sheen: 0,
};

/* ——— Visuel d'une carte, dessiné dans un canvas 2D puis envoyé en texture ——— */
const coverImage = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) => {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const iw = img.naturalWidth * s;
  const ih = img.naturalHeight * s;
  ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
};

const wrapLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) => {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(test).width <= maxWidth) line = test;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return kept;
};

// cover = version unie de la carte (texte seul), que le fluide efface pour montrer l'image
function drawCard(canvas: HTMLCanvasElement, card: RibbonCard, number: number, look: Look, img?: HTMLImageElement, cover = false) {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.textBaseline = 'alphabetic';
  // Sur une image, le texte reste clair sur un dégradé sombre, quel que soit le thème
  const on = img ? DARK : look;

  if (cover) {
    ctx.fillStyle = look.cover;
    ctx.fillRect(0, 0, w, h);
    if (look.sheen) {
      const light = ctx.createRadialGradient(w * 0.15, 0, 0, w * 0.15, 0, w * 0.95);
      light.addColorStop(0, `rgba(${look.ink}, ${look.sheen})`);
      light.addColorStop(1, `rgba(${look.ink}, 0)`);
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, w, h);
    }
    // Liseré discret, aligné sur les coins arrondis du shader (rayon 0,055 × 640 px)
    ctx.strokeStyle = `rgba(${look.ink}, .12)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(1.5, 1.5, w - 3, h - 3, 34);
    ctx.stroke();
  } else if (img) coverImage(ctx, img, w, h);
  else {
    // Projet sans image : fond uni, lueur orange, quadrillage et grand mot-clé
    ctx.fillStyle = look.plain;
    ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w * 0.82, h * 0.06, 0, w * 0.82, h * 0.06, w * 0.85);
    glow.addColorStop(0, `rgba(${look.accent}, ${look.glow})`);
    glow.addColorStop(1, `rgba(${look.accent}, 0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = `rgba(${look.ink}, .06)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 32; x < w; x += 32) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
    for (let y = 32; y < h; y += 32) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
    ctx.stroke();
    const word = (card.tags[0] ?? card.title.split(' ')[0]).toUpperCase();
    let size = 150;
    ctx.font = `900 ${size}px ${FONT_TITLE}`;
    while (size > 56 && ctx.measureText(word).width > w - 112) { size -= 6; ctx.font = `900 ${size}px ${FONT_TITLE}`; }
    ctx.fillStyle = `rgba(${look.ink}, .92)`;
    ctx.fillText(word, 52, h * 0.5);
  }

  // Dégradé en bas pour lire le texte sur l'image
  if (!cover) {
    const shade = ctx.createLinearGradient(0, h * 0.4, 0, h);
    shade.addColorStop(0, `rgba(${on.shade}, 0)`);
    shade.addColorStop(1, `rgba(${on.shade}, .84)`);
    ctx.fillStyle = shade;
    ctx.fillRect(0, h * 0.4, w, h * 0.6);
  }

  // Numéro en chiffres LED
  ctx.font = `900 34px Doto, ${FONT_MONO}`;
  ctx.fillStyle = `rgb(${look.accent})`;
  ctx.fillText(String(number).padStart(2, '0'), 52, 80);

  // Titre (deux lignes au plus) et mots-clés au-dessus
  const pad = 52;
  const button = 64;
  ctx.font = `700 50px ${FONT_TITLE}`;
  const lines = wrapLines(ctx, card.title, w - pad * 2 - button - 28, 2);
  ctx.fillStyle = `rgb(${on.ink})`;
  let y = h - pad;
  for (let i = lines.length - 1; i >= 0; i--) { ctx.fillText(lines[i], pad, y); y -= 56; }
  ctx.font = `500 20px ${FONT_MONO}`;
  ctx.fillStyle = `rgba(${on.ink}, .66)`;
  ctx.fillText(card.tags.slice(0, 3).join('  ·  ').toUpperCase(), pad, y - 6);

  // Bouton flèche en bas à droite
  const cx = w - pad - button / 2;
  const cy = h - pad - button / 2 + 12;
  ctx.beginPath();
  ctx.arc(cx, cy, button / 2, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${on.ink}, .14)`;
  ctx.fill();
  ctx.strokeStyle = `rgba(${on.ink}, .4)`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = `rgb(${on.ink})`;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 9, cy + 9); ctx.lineTo(cx + 9, cy - 9);
  ctx.moveTo(cx - 5, cy - 9); ctx.lineTo(cx + 9, cy - 9); ctx.lineTo(cx + 9, cy + 5);
  ctx.stroke();
}

/* ——— Shaders ——— */
const cardVertex = /* glsl */ `
  uniform float uAmp;
  uniform float uK;
  uniform float uPhase;
  uniform float uLift;
  uniform float uBend;
  varying vec2 vUv;
  varying float vLight;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    // Caoutchouc : en mouvement, le milieu de la carte traîne derrière ses bords et se creuse
    float middle = 1.0 - pow(abs(uv.y * 2.0 - 1.0), 2.0);
    world.x += uBend * 0.22 * middle;
    world.z -= abs(uBend) * 0.16 * sin(3.14159 * uv.x) * middle;
    float a = uK * world.x + uPhase;
    world.z += uAmp * sin(a) + uLift;
    // Lumière venant de face, un peu à gauche : les pans tournés vers la droite s'assombrissent
    vec3 normal = normalize(vec3(-uAmp * uK * cos(a), 0.0, 1.0));
    vLight = clamp(dot(normal, normalize(vec3(-0.5, 0.15, 1.0))), 0.0, 1.0);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const cardFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uCover;
  uniform sampler2D uInk;
  uniform float uInkOn;
  uniform float uReveal;
  uniform vec2 uSize;
  uniform float uRadius;
  uniform float uHover;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vLight;
  float roundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  void main() {
    float d = roundedBox((vUv - 0.5) * uSize, uSize * 0.5, uRadius);
    float edge = fwidth(d);
    float mask = 1.0 - smoothstep(-edge, edge, d);
    vec3 color = texture2D(uMap, vUv).rgb;
    if (uReveal > 0.5) {
      vec3 cover = texture2D(uCover, vUv).rgb;
      if (uInkOn > 0.5) {
        // Liquide laissé par la souris : bord net, image montrée telle quelle (sans déformation
        // ni reflet blanc), avec juste un bord un peu plus sombre
        float ink = texture2D(uInk, vUv).r;
        float aa = fwidth(ink) + 0.002;
        float inside = smoothstep(0.32 - aa, 0.32 + aa, ink);
        float rim = 1.0 - smoothstep(0.32, 0.5, ink);
        color = mix(cover, color * (1.0 - rim * 0.18), inside);
      } else {
        color = cover;
      }
    }
    color *= mix(0.6, 1.0, vLight);
    // Survol : léger éclaircissement (très léger sur les cartes noires, qui sinon virent au gris)
    color = mix(color, vec3(1.0), uHover * (uReveal > 0.5 ? 0.02 : 0.07));
    gl_FragColor = vec4(color, mask * uOpacity);
    #include <colorspace_fragment>
  }
`;

export function createRibbon(canvas: HTMLCanvasElement, cards: RibbonCard[], events: RibbonEvents, light = false) {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.3 : 1.75));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  // Cartes noires + liquide seulement avec une souris : sur écran tactile, les images restent visibles
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const canFloat = renderer.extensions.has('EXT_color_buffer_half_float') || renderer.extensions.has('EXT_color_buffer_float');
  const liquid = fine && canFloat;

  /* ——— Textures : une par projet (redessinée quand l'image, les polices ou le thème changent) ——— */
  let look = light ? LIGHT : DARK;
  const visuals = cards.map((card, i) => {
    const surface = document.createElement('canvas');
    surface.width = TEX_W;
    surface.height = TEX_H;
    const visual = { card, surface, img: undefined as HTMLImageElement | undefined, texture: new THREE.CanvasTexture(surface), cover: null as THREE.CanvasTexture | null };
    visual.texture.colorSpace = THREE.SRGBColorSpace;
    visual.texture.anisotropy = anisotropy;
    if (liquid) {
      const plain = document.createElement('canvas');
      plain.width = TEX_W;
      plain.height = TEX_H;
      visual.cover = new THREE.CanvasTexture(plain);
      visual.cover.colorSpace = THREE.SRGBColorSpace;
      visual.cover.anisotropy = anisotropy;
    }
    if (card.image) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = () => { visual.img = img; drawCard(surface, card, i + 1, look, img); visual.texture.needsUpdate = true; };
      img.src = card.image;
    }
    return visual;
  });
  // Dessine les deux textures d'une carte (image et version unie) avec le thème actuel
  const paint = (v: (typeof visuals)[number], i: number) => {
    drawCard(v.surface, v.card, i + 1, look, v.img);
    v.texture.needsUpdate = true;
    if (v.cover) { drawCard(v.cover.image as HTMLCanvasElement, v.card, i + 1, look, undefined, true); v.cover.needsUpdate = true; }
  };
  visuals.forEach(paint);
  let alive = true;
  Promise.all(FONTS.map((font) => document.fonts.load(font))).then(() => {
    if (alive) visuals.forEach(paint);
  }).catch(() => { /* polices de secours */ });

  /* ——— Cartes : répétées pour couvrir toute la largeur, puis replacées en boucle ——— */
  const count = Math.max(cards.length, Math.ceil(12 / cards.length) * cards.length);
  const length = count * PITCH;
  const wrap = (x: number) => x - length * Math.floor((x + length / 2) / length);
  const shared = {
    uAmp: { value: AMP },
    uK: { value: K },
    uPhase: { value: 0 },
    uSize: { value: new THREE.Vector2(W, H) },
    uRadius: { value: 0.055 },
    uBend: { value: 0 },
    uReveal: { value: liquid ? 1 : 0 },
  };
  const geometry = new THREE.PlaneGeometry(W, H, 40, 12);
  const materials = Array.from({ length: count }, (_, i) => new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uMap: { value: visuals[i % cards.length].texture },
      uCover: { value: visuals[i % cards.length].cover },
      uInk: { value: null as THREE.Texture | null }, uInkOn: { value: 0 },
      uLift: { value: 0 }, uHover: { value: 0 }, uOpacity: { value: 0 },
    },
    vertexShader: cardVertex,
    fragmentShader: cardFragment,
    transparent: true,
  }));
  const meshes = materials.map((material) => {
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    return mesh;
  });

  /* ——— Liquide : trois simulations, prêtées tour à tour aux cartes survolées ——— */
  const sims = liquid ? Array.from({ length: 3 }, () => ({ fluid: createFluid(renderer), mesh: -1, last: -Infinity })) : [];
  const simFor = (mesh: number) => {
    let slot = sims.find((s) => s.mesh === mesh);
    if (!slot) {
      slot = sims.reduce((a, b) => (a.last <= b.last ? a : b)); // la moins récemment utilisée
      if (slot.mesh >= 0) materials[slot.mesh].uniforms.uInkOn.value = 0;
      slot.fluid.clear();
      slot.mesh = mesh;
      materials[mesh].uniforms.uInkOn.value = 1;
    }
    slot.last = performance.now();
    return slot;
  };

  /* ——— État ——— */
  const state = {
    offset: 0, drag: 0, drift: 0, fling: 0,
    amp: AMP, phase: 0, intro: 1, bend: 0, bendSpeed: 0,
    hover: -1, focus: -1,
    dist: 5, unitsPerPx: 0.01, running: false, introStarted: false,
  };

  // Défilement de la page : la bande avance d'environ trois cartes pendant qu'elle traverse l'écran
  const scrollShift = () => {
    const r = canvas.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = Math.min(Math.max((vh - r.top) / (vh + r.height), 0), 1);
    return (p - 0.5) * PITCH * 3;
  };

  const render = () => renderer.render(scene, camera);

  const tick = (_time: number, deltaMs: number) => {
    const dt = Math.min(deltaMs / 1000, 0.05);
    if (!dragging) {
      state.drag += state.fling * dt;
      state.fling *= Math.exp(-dt * 2.6);
      state.drift += dt * 0.09;
    }
    const target = scrollShift() + state.drag + state.drift - state.intro * PITCH * 2.4;
    const before = state.offset;
    state.offset += (target - state.offset) * (1 - Math.exp(-dt * 7));
    const velocity = (state.offset - before) / Math.max(dt, 1e-3);
    // Caoutchouc : la déformation suit la vitesse avec un ressort (elle déborde puis revient en oscillant)
    const bendTarget = Math.max(-1.3, Math.min(1.3, velocity * 0.32));
    state.bendSpeed += (bendTarget - state.bend) * 150 * dt;
    state.bendSpeed *= Math.exp(-dt * 9);
    state.bend += state.bendSpeed * dt;
    state.amp += (AMP * (1 + Math.min(Math.abs(state.bend), 0.9)) - state.amp) * (1 - Math.exp(-dt * 6));
    state.phase += dt * 0.22;
    shared.uAmp.value = state.amp;
    shared.uPhase.value = state.phase;
    shared.uBend.value = state.bend;

    let focus = 0;
    let nearest = Infinity;
    const ease = 1 - Math.exp(-dt * 10);
    meshes.forEach((mesh, i) => {
      const x = wrap(i * PITCH - state.offset);
      mesh.position.x = x;
      const u = materials[i].uniforms;
      u.uHover.value += ((i === state.hover ? 1 : 0) - u.uHover.value) * ease;
      u.uLift.value = u.uHover.value * 0.08;
      // Apparition : les cartes arrivent de la droite en s'allumant, celles de gauche d'abord
      u.uOpacity.value = Math.min(Math.max((1 - state.intro) * 2.6 - (x + 3) * 0.08, 0), 1);
      if (Math.abs(x) < nearest) { nearest = Math.abs(x); focus = i % cards.length; }
    });
    if (focus !== state.focus) { state.focus = focus; events.onFocus(focus); }
    const now = performance.now();
    for (const slot of sims) {
      if (slot.mesh < 0) continue;
      if (now - slot.last > 4000) { // liquide évaporé : la simulation se libère
        materials[slot.mesh].uniforms.uInkOn.value = 0;
        slot.mesh = -1;
        continue;
      }
      slot.fluid.step(dt);
      materials[slot.mesh].uniforms.uInk.value = slot.fluid.output;
    }
    render();
  };

  const start = () => {
    if (state.running) return;
    state.running = true;
    gsap.ticker.add(tick);
  };
  const stop = () => {
    if (!state.running) return;
    state.running = false;
    gsap.ticker.remove(tick);
  };
  // Rendu seulement à l'écran ; l'entrée se lance quand un tiers de la bande est visible
  const viewObserver = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) start(); else stop();
    if (!state.introStarted && entry.intersectionRatio >= 0.3) {
      state.introStarted = true;
      gsap.to(state, { intro: 0, duration: 2.2, ease: 'expo.out' });
    }
  }, { threshold: [0, 0.3] });
  viewObserver.observe(canvas);

  /* ——— Cadrage : une carte fait 56 % de la hauteur, et au plus les 3/4 de la largeur (85 % sur mobile) ——— */
  const fit = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const share = camera.aspect < 1 ? 0.85 : 0.76;
    state.dist = Math.max(H / (0.56 * 2 * tan), W / (share * 2 * tan * camera.aspect));
    camera.position.set(0, state.dist * 0.06, state.dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    state.unitsPerPx = (2 * state.dist * tan * camera.aspect) / w;
    if (!state.running) render();
  };
  fit();
  const sizeObserver = new ResizeObserver(fit);
  sizeObserver.observe(canvas);

  /* ——— Souris et doigt : survol, glisser avec élan, clic ——— */
  const ndc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  // Carte sous le pointeur : intersection du rayon avec la surface ondulée (méthode de Newton)
  const pick = (clientX: number, clientY: number) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const { origin: o, direction: d } = raycaster.ray;
    let t = -o.z / d.z;
    for (let n = 0; n < 6; n++) {
      const a = K * (o.x + t * d.x) + state.phase;
      t -= (o.z + t * d.z - state.amp * Math.sin(a)) / (d.z - state.amp * K * Math.cos(a) * d.x);
    }
    const x = o.x + t * d.x;
    const y = o.y + t * d.y;
    const index = Math.abs(y) > H / 2 ? -1 : meshes.findIndex((m) => Math.abs(x - m.position.x) <= W / 2);
    // Position sur la carte, en coordonnées 0–1 (origine en bas à gauche)
    return { index, u: index >= 0 ? (x - meshes[index].position.x) / W + 0.5 : 0, v: y / H + 0.5 };
  };

  let dragging = false;
  let pointer = -1;
  let lastX = 0;
  let lastT = 0;
  let travel = 0;
  let lastInk: { mesh: number; u: number; v: number } | null = null;
  // La souris remue le liquide de la carte qu'elle survole, et seulement celle-là
  const stir = (hit: ReturnType<typeof pick>) => {
    if (!sims.length || hit.index < 0) { lastInk = null; return; }
    const prev = lastInk && lastInk.mesh === hit.index ? lastInk : null;
    simFor(hit.index).fluid.splat(hit.u, hit.v, prev ? hit.u - prev.u : 0, prev ? hit.v - prev.v : 0);
    lastInk = { mesh: hit.index, u: hit.u, v: hit.v };
  };
  const cursor = () => { canvas.style.cursor = dragging ? 'grabbing' : state.hover >= 0 ? 'pointer' : 'grab'; };
  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    dragging = true;
    pointer = e.pointerId;
    lastX = e.clientX;
    lastT = e.timeStamp;
    travel = 0;
    state.fling = 0;
    canvas.setPointerCapture(e.pointerId);
    cursor();
  };
  const move = (e: PointerEvent) => {
    const hit = e.pointerType === 'mouse' ? pick(e.clientX, e.clientY) : null;
    if (hit) stir(hit);
    if (dragging && e.pointerId === pointer) {
      const dx = e.clientX - lastX;
      const seconds = Math.max(e.timeStamp - lastT, 8) / 1000;
      lastX = e.clientX;
      lastT = e.timeStamp;
      travel += Math.abs(dx);
      state.drag -= dx * state.unitsPerPx;
      const speed = Math.max(-14, Math.min(14, (-dx * state.unitsPerPx) / seconds));
      state.fling += (speed - state.fling) * 0.5;
      return;
    }
    if (hit) {
      state.hover = hit.index;
      cursor();
    }
  };
  const up = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== pointer) return;
    dragging = false;
    if (e.timeStamp - lastT > 90) state.fling = 0; // relâché sans élan
    if (travel < 6) {
      state.fling = 0;
      const i = pick(e.clientX, e.clientY).index;
      if (i >= 0) events.onSelect(i % cards.length);
    }
    cursor();
  };
  const cancel = () => { dragging = false; cursor(); };
  const leave = () => { state.hover = -1; lastInk = null; };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('pointerleave', leave);
  cursor();

  return {
    /** Thème du site : cartes blanches en mode clair, noires en mode sombre. */
    setLight(next: boolean) {
      if ((look === LIGHT) === next) return;
      look = next ? LIGHT : DARK;
      visuals.forEach(paint);
    },

    destroy() {
      alive = false;
      stop();
      gsap.killTweensOf(state);
      viewObserver.disconnect();
      sizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('pointerleave', leave);
      visuals.forEach((v) => { v.texture.dispose(); v.cover?.dispose(); });
      materials.forEach((m) => m.dispose());
      geometry.dispose();
      sims.forEach((s) => s.fluid.dispose());
      renderer.dispose();
    },
  };
}

export type Ribbon = ReturnType<typeof createRibbon>;
