import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { MODULE_PLANS, type ModuleId } from '@/components/station/layout';
import { dwellAt, presenceAt, type Timeline } from '@/components/station/scrollTimeline';
import { CameraController } from './CameraController';
import { createSpaceEnvironment, type SpaceEnvironment } from './SpaceEnvironment';
import { buildStation, type Station } from './StationModel';
import { loadIndustrial, type IndustrialKit } from './IndustrialModules';
import type { Quality } from './kit';

/* ───────────────────────────────────────────────────────────────
   OrbitalScene : rendu de la station (chargé à part, seulement à l'approche de la section).
   - la progression du défilement (setProgress) est lissée puis donnée à la caméra ;
   - l'activation de chaque module (lumières, portes, paraboles…) suit sa présence dans la timeline ;
   - à chaque image, les ancrages des modules sont projetés à l'écran (onFrame) : l'interface
     HTML s'y accroche (étiquettes, lignes des panneaux holographiques) ;
   - rendu en pause hors écran, résolution adaptée à la fluidité, bloom unique et léger.
   ─────────────────────────────────────────────────────────────── */

export interface AnchorFrame { id: ModuleId; x: number; y: number; front: boolean; dist: number }
/** speed : vitesse de la caméra (m/s, lissée) ; motion : à quel point le module visité est en train de s'animer (0..1). */
export interface SceneFrame { t: number; anchors: AnchorFrame[]; speed: number; motion: number }

export interface OrbitalScene {
  ready: Promise<void>;
  setProgress(t: number, immediate?: boolean): void;
  setPointer(x: number, y: number): void;
  setAmbient(on: boolean): void;
  setVisible(on: boolean): void;
  dispose(): void;
}

const GRADE = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      // Légère aberration chromatique sur les bords
      vec2 off = c * r2 * 0.012;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      col *= 1.0 - smoothstep(0.12, 0.62, r2) * 0.55;
      // Noir chaud du site (#0b0907, le fond des pages) : la scène se raccorde au reste de la page sans démarcation
      col = max(col, vec3(0.0)) + vec3(0.0413, 0.0349, 0.0286) * (1.0 - col);
      col += (hash(vUv * uRes + fract(uTime * 7.0) * 91.0) - 0.5) * 0.018;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

const CLAMP = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (any(isnan(c.rgb))) c.rgb = vec3(0.0);
      gl_FragColor = vec4(clamp(c.rgb, 0.0, 48.0), 1.0);
    }`,
};

export function createOrbitalScene(
  canvas: HTMLCanvasElement,
  opts: { timeline: Timeline; quality: Quality; onFrame: (f: SceneFrame) => void; onReady?: () => void; onLost?: () => void },
): OrbitalScene {
  const q = opts.quality;
  const high = q === 'high';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false });
  renderer.setClearColor(0x0b0907, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = high;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const maxDpr = Math.min(window.devicePixelRatio || 1, high ? 1.6 : 1.25);
  let dpr = maxDpr;
  let width = 1;
  let height = 1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 30000);
  const sunDir = new THREE.Vector3(0.78, 0.36, 0.5).normalize();

  // Lumières : nombre fixe dès le départ (ajouter une lumière plus tard recompile tous les matériaux)
  const sun = new THREE.DirectionalLight(0xfff0de, 3.1);
  sun.position.copy(sunDir).multiplyScalar(420);
  sun.target.position.set(0, 0, 0);
  scene.add(sun, sun.target);
  if (high) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = sun.shadow.camera as THREE.OrthographicCamera;
    s.left = -235; s.right = 235; s.top = 235; s.bottom = -235; s.near = 40; s.far = 900;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.5;
  }
  const bounce = new THREE.DirectionalLight(0xff9a50, 0.42);
  bounce.position.set(-0.2, -1, -0.35).multiplyScalar(300);
  scene.add(bounce);
  // Contre-jour doux : la face arrière de la station (archives, hangar, labo) reste lisible
  const rim = new THREE.DirectionalLight(0xffe2c6, 1.05);
  rim.position.set(-0.55, 0.3, -0.78).multiplyScalar(300);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0x15130f, 0x2a160a, 0.55));

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: high ? 4 : 0 }));
  composer.addPass(new RenderPass(scene, camera));
  // Garde-fou : une valeur infinie ou NaN (reflet trop intense) noircirait toute l'image en passant par le bloom
  composer.addPass(new ShaderPass(CLAMP));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), high ? 0.5 : 0.42, 0.5, 1.05);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GRADE);
  composer.addPass(grade);

  const controller = new CameraController(opts.timeline.keys);
  const stopOf = new Map(opts.timeline.stops.map((s) => [s.id, s]));
  const overview = stopOf.get('overview')!;
  const final = stopOf.get('final')!;
  const anchors = MODULE_PLANS.map((m) => ({ id: m.id, v: new THREE.Vector3(...m.anchor) }));
  const frame: SceneFrame = { t: 0, anchors: anchors.map(({ id }) => ({ id, x: 0, y: 0, front: false, dist: 0 })), speed: 0, motion: 0 };
  const lastPos = new THREE.Vector3();
  let lastActive = 0;
  const active: Partial<Record<ModuleId, number>> = {};
  const dwell: Partial<Record<ModuleId, number>> = {};
  const uniforms = { uTime: { value: 0 }, uScale: { value: 1 } };

  let env: SpaceEnvironment | null = null;
  let station: Station | null = null;
  let target = 0;
  let current = 0;
  let ambient = true;
  let visible = true;
  let disposed = false;
  let raf = 0;
  let last = performance.now();
  let time = 0;
  let frames = 0;
  let slow = 0;
  let fast = 0;
  const pointer = new THREE.Vector2();
  const tmp = new THREE.Vector3();
  let freeLook: number[] | null = null; // développement : caméra posée à la main (captures)

  const resize = () => {
    const rect = canvas.parentElement?.getBoundingClientRect() ?? canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(dpr);
    composer.setSize(width, height);
    bloom.resolution.set(width * dpr * (high ? 0.5 : 0.35), height * dpr * (high ? 0.5 : 0.35));
    grade.uniforms.uRes.value.set(width * dpr, height * dpr);
  };
  const ro = new ResizeObserver(resize);
  if (canvas.parentElement) ro.observe(canvas.parentElement);
  resize();

  const render = () => {
    raf = requestAnimationFrame(render);
    if (!visible || !station || !env) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (ambient) time += dt;
    uniforms.uTime.value = time;
    grade.uniforms.uTime.value = time;

    current += (target - current) * (1 - Math.exp(-dt * 3.2));
    if (Math.abs(target - current) < 1e-6) current = target;
    controller.apply(camera, current, dt, pointer, time, ambient, width, height);
    if (freeLook) {
      camera.clearViewOffset();
      camera.position.set(freeLook[0], freeLook[1], freeLook[2]);
      camera.up.set(0, 1, 0);
      camera.lookAt(freeLook[3], freeLook[4], freeLook[5]);
      camera.fov = freeLook[6];
      camera.near = 0.5;
      camera.updateProjectionMatrix();
    }
    uniforms.uScale.value = (height * dpr) / (2 * Math.tan((camera.fov * Math.PI) / 360));

    // Activation des modules : leur étape, plus une lueur douce pendant la vue d'ensemble et la vue finale
    const glow = 0.22 * Math.max(presenceAt(overview, current), presenceAt(final, current));
    for (const m of MODULE_PLANS) {
      const st = stopOf.get(m.id)!;
      active[m.id] = Math.max(glow, presenceAt(st, current));
      dwell[m.id] = dwellAt(st, current);
    }
    station.update(time, dt, active, dwell, ambient);
    env.update(camera, time);

    // Ombres recalculées 10 fois par seconde environ : l'anneau et les portes bougent lentement
    if (renderer.shadowMap.enabled && (frames % 6 === 0 || frames < 3)) renderer.shadowMap.needsUpdate = true;
    composer.render(dt);
    frames++;

    // Ancrages des modules projetés à l'écran
    frame.t = current;
    // Vitesse de la caméra et animation du module visité (pour les bruitages)
    if (dt > 0) {
      const v = camera.position.distanceTo(lastPos) / dt;
      frame.speed += (Math.min(v, 400) - frame.speed) * (1 - Math.exp(-dt * 6));
      let a = 0;
      for (const m of MODULE_PLANS) a = Math.max(a, active[m.id] ?? 0);
      const da = Math.abs(a - lastActive) / dt;
      frame.motion += (Math.min(1, da * 1.5) - frame.motion) * (1 - Math.exp(-dt * 5));
      lastActive = a;
    }
    lastPos.copy(camera.position);
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      const f = frame.anchors[i];
      tmp.copy(a.v).applyMatrix4(camera.matrixWorldInverse);
      f.front = tmp.z < 0;
      f.dist = -tmp.z;
      tmp.copy(a.v).project(camera);
      f.x = (tmp.x * 0.5 + 0.5) * width;
      f.y = (0.5 - tmp.y * 0.5) * height;
    }
    opts.onFrame(frame);

    // Fluidité : on baisse la résolution si les images sont trop lentes, on la remonte sinon
    const ms = dt * 1000;
    if (ms > 26) { slow++; fast = 0; } else if (ms < 15) { fast++; slow = Math.max(0, slow - 1); } else { slow = Math.max(0, slow - 1); fast = 0; }
    if (slow > 40 && dpr > 0.6) { dpr = Math.max(0.6, dpr * 0.85); slow = 0; resize(); }
    else if (fast > 240 && dpr < maxDpr) { dpr = Math.min(maxDpr, dpr * 1.1); fast = 0; resize(); }
  };

  const onLost = (e: Event) => { e.preventDefault(); cancelAnimationFrame(raf); opts.onLost?.(); };
  canvas.addEventListener('webglcontextlost', onLost);

  const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  const ready = (async () => {
    // Le modèle des structures industrielles se télécharge pendant que la station se construit
    const industrialLoad = loadIndustrial().catch(() => null);
    env = createSpaceEnvironment(renderer, q, sunDir);
    scene.environment = env.envMap;
    scene.add(env.group);
    await nextFrame();
    const built = await buildStation(q, uniforms, high, nextFrame);
    if (disposed) { built.dispose(); return; }
    station = built;
    scene.add(station.group);
    // Structures industrielles : posées avant la compilation si le modèle est arrivé, sinon dès qu'il arrive
    const kit = await Promise.race([industrialLoad, new Promise<null>((r) => setTimeout(() => r(null), 6000))]);
    if (disposed) { (kit as IndustrialKit | null)?.dispose(); return; }
    if (kit) station.attachIndustrial(kit);
    else industrialLoad.then(async (late) => {
      if (!late) return;
      if (disposed || !station) { late.dispose(); return; }
      const added = station.attachIndustrial(late);
      try {
        renderer.setRenderTarget(composer.readBuffer);
        for (const o of added) await renderer.compileAsync(o, camera, scene);
      } catch { /* compilation au premier rendu */ } finally { renderer.setRenderTarget(null); }
    });
    controller.apply(camera, current, 0, pointer, 0, false, width, height);
    // Compilation en arrière-plan, pour la cible du composer (sortie linéaire, sans tone mapping) :
    // ce sont ces variantes des programmes qui servent à chaque image, pas celles de l'écran.
    try {
      renderer.setRenderTarget(composer.readBuffer);
      await renderer.compileAsync(scene, camera, scene);
    } catch { /* compilation au premier rendu */ } finally { renderer.setRenderTarget(null); }
    if (disposed) return;
    // Envoi des textures au GPU, quelques-unes par image (sinon le premier rendu fige la page)
    const textures = new Set<THREE.Texture>();
    scene.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!mat || Array.isArray(mat)) return;
      for (const key of ['map', 'normalMap', 'roughnessMap', 'emissiveMap'] as const) if (mat[key]) textures.add(mat[key]!);
    });
    let n = 0;
    for (const tex of textures) {
      if (disposed) return;
      renderer.initTexture(tex);
      if (++n % 3 === 0) await nextFrame();
    }
    if (disposed) return;
    if (disposed) return;
    // Préchauffage : un rendu de toute la station (sans élimination hors champ) envoie toutes les géométries
    // au GPU et compile les programmes de la carte d'ombre maintenant, pas au milieu de la visite
    const culled: THREE.Object3D[] = [];
    scene.traverse((o) => { if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; } });
    renderer.shadowMap.needsUpdate = true;
    composer.render(0.016);
    culled.forEach((o) => { o.frustumCulled = true; });
    await nextFrame();
    if (disposed) return;
    last = performance.now();
    lastPos.copy(camera.position);
    raf = requestAnimationFrame(render);
    opts.onReady?.();
  })();

  if (import.meta.env.DEV) (window as unknown as { __station?: unknown }).__station = { camera, scene, renderer, composer, bloom, grade, setT: (t: number) => { target = current = t; }, look: (...v: number[]) => { freeLook = v.length ? v : null; } };

  return {
    ready,
    setProgress(t, immediate = false) {
      target = Math.min(1, Math.max(0, t));
      if (immediate) current = target;
    },
    setPointer(x, y) { pointer.set(x, y); },
    setAmbient(on) { ambient = on; },
    setVisible(on) {
      if (on && !visible) last = performance.now();
      visible = on;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('webglcontextlost', onLost);
      station?.dispose();
      env?.dispose();
      composer.passes.forEach((p) => p.dispose());
      composer.dispose();
      renderer.dispose();
      // Libère le contexte tout de suite (le site en ouvre déjà plusieurs : planète, ruban, DeLorean)
      renderer.forceContextLoss();
    },
  };
}
