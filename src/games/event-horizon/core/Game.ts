import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Input } from './input';
import { hud, type GameMode, type HudState, type MapEntry, type NavEntry } from './store';
import { QUALITY, type QualityLevel, type QualityPreset } from '../engine/quality';
import { Sky } from '../engine/Sky';
import { Dust } from '../engine/Dust';
import { BlackHole } from '../astronomy/BlackHole';
import { Planet, type PlanetKind } from '../astronomy/Planet';
import { AsteroidBelt } from '../astronomy/AsteroidBelt';
import { makeAnomaly } from '../astronomy/Anomaly';
import { makeBeacon, makeGhost, makeMegastructure, makePod, makeProbe, makeTwin, makeWreck, type SpaceObject } from '../astronomy/Derelicts';
import { ShipModel } from '../ship/ShipModel';
import { ShipController, type ShipSnapshot } from '../ship/ShipController';
import { ChaseCamera } from '../ship/ChaseCamera';
import { Scanner } from '../exploration/Scanner';
import { Progression, type UpgradeId } from '../progression/Progression';
import { AudioEngine } from '../audio/AudioEngine';
import { BLACK_HOLE_RS, KM_PER_UNIT, OBJECTIVES, SECTOR_NAME, STORY, SUN_DIR, createStartSystem, type Body } from '../universe/bodies';
import { HOME, distanceLy, generateSystem, keyOf, neighbours, parseKey, systemInfo, type Sector, type StarSystem, type SystemInfo } from '../universe/generator';

export interface GameSnapshot {
  sector: string;
  ship: ShipSnapshot;
  target: string;
  time: number;
  shipTime: number;
  farTime: number;
}

export interface Markers {
  target: HTMLElement;
  ghost: HTMLElement;
}

const ENDING_SECONDS = 9;
/** Distance au centre (en rayons de Schwarzschild) sous laquelle la chute devient irréversible. */
const END_TRIGGER = 1.36;
/** Altitude où le vaisseau se fige pendant la séquence de fin, juste au-dessus de l'horizon. */
const END_FLOOR = 1.035;

/** Croisière : vitesse maximale = 30 % de la distance à l'astre le plus proche, par seconde. */
const CRUISE_RATE = 0.3;
const CRUISE_FLOOR = 3200;
/** Plafond en espace profond : 80 millions de km/s. C'est de la fiction, sans quoi un trajet prendrait des heures. */
const CRUISE_TOP = 8_000_000;

const JUMP_SECONDS = 3.6;
/** Un saut ne s'ouvre qu'à bonne distance de toute masse (3 millions de km). */
const JUMP_CLEARANCE = 300_000;
const JUMP_COST = 50;
const SECTOR_KEY = 'event-horizon-sector';
const VISITED_KEY = 'event-horizon-visited';

const PLANET_KINDS = new Set(['ocean', 'moon', 'gas', 'lava', 'ice']);
const ZERO = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Ce que l'ordinateur de bord finit par dire quand il ne se passe rien. */
const SOLITUDE = [
  'Bande de détresse : silence. Aucune réponse de la Terre depuis 2 ans et 114 jours.',
  'Aucun autre vaisseau à moins de 4 années-lumière.',
  'Rappel : vous êtes le seul membre d’équipage éveillé.',
  'Dernier message reçu : il y a 847 jours. Contenu : « Bon courage. »',
  'Balayage longue portée terminé. Rien ne bouge.',
];

const loadSector = (): Sector => {
  try { return parseKey(localStorage.getItem(SECTOR_KEY) || '0.0.0'); } catch { return HOME; }
};
const loadVisited = () => {
  const set = new Set<string>([keyOf(HOME)]);
  try {
    const saved = JSON.parse(localStorage.getItem(VISITED_KEY) || '[]');
    if (Array.isArray(saved)) saved.forEach((k) => typeof k === 'string' && set.add(k));
  } catch { /* stockage indisponible */ }
  return set;
};

/** Boucle de jeu : relie le moteur de rendu, l'univers, le vaisseau, le son et l'interface. */
export class Game {
  private canvas = document.createElement('canvas');
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(52, 1, 2, 2e9);
  private preset: QualityPreset;
  private input: Input;
  private sky: Sky;
  private dust = new Dust();
  private environment: THREE.WebGLRenderTarget;
  private envCube: THREE.CubeTexture;
  private blackHole: BlackHole;
  private sunLight = new THREE.DirectionalLight(0xfff1dc, 3.4);
  private diskLight = new THREE.DirectionalLight(0xffa860, 0.5);

  // ── Système stellaire courant (reconstruit à chaque saut) ──
  private system!: StarSystem;
  private bodies: Body[] = [];
  private planets = new Map<Body, Planet>();
  private objects = new Map<Body, SpaceObject>();
  private belt: AsteroidBelt | null = null;
  private beltParent: Body | null = null;
  private asteroid: Body | null = null;
  private blackHoleBody: Body | null = null;
  private star!: Body;
  private ghost!: Body;
  private orbiters: { body: Body; parent: Body }[] = [];
  private solid: Body[] = [];
  private visited = loadVisited();

  private shipModel = new ShipModel();
  private ship = new ShipController();
  private chase: ChaseCamera;
  private scanner = new Scanner(createStartSystem());
  private progression = new Progression();
  private audio = new AudioEngine();
  private target!: Body;
  private mode: GameMode = 'menu';
  /** Temps du monde (figé en pause et en mode photo). */
  private time = 0;
  /** Temps réel de jeu, pour la durée d'affichage des messages. */
  private clock = 0;
  private shipTime = 0;
  private farTime = 0;
  private raf = 0;
  private last = 0;
  private hudTimer = 0;
  private frames = 0;
  private fpsTimer = 0;
  private fps = 0;
  private messageUntil = 0;
  private dirty = true;
  private photo = false;
  private capture = false;
  private endT = 0;
  private dread = 0;
  private radiation = 0;
  private nearest = Infinity;
  private falling = false;
  private inRadiation = false;
  private tideWarned = false;
  private cruiseExplained = false;
  private jump: { target: SystemInfo; t: number; done: boolean } | null = null;
  private scanTickAt = 0;
  private creakAt = 0;
  private solitudeAt = 50;
  private solitudeIndex = 0;
  private knockAt = -1;
  private knockSaid = 0;
  private ghostActive = false;
  private ghostUntil = 0;
  private ghostAt = 0;
  private ghostCount = 0;
  private resizeObserver: ResizeObserver;
  private scenePos = new THREE.Vector3();
  private toHole = new THREE.Vector3();
  private projected = new THREE.Vector3();
  private tmp = new THREE.Vector3();

  constructor(container: HTMLElement, private markers: Markers, quality: QualityLevel, restore?: GameSnapshot) {
    this.preset = QUALITY[quality];
    const preset = this.preset;
    const canvas = this.canvas;
    container.prepend(canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = preset.shadowMap > 0;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // Ciel, puis sa photographie HDR : fond de la lentille gravitationnelle et reflets des matériaux
    this.sky = new Sky(preset);
    const cube = this.sky.capture(this.renderer, preset.skyCube, preset.skyCube >= 1024 ? 1024 : 768);
    this.envCube = cube.texture;
    this.scene.add(this.sky.group);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromCubemap(cube.texture);
    pmrem.dispose();
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 1.6;

    // Lumière de l'étoile, avec ombres resserrées sur le vaisseau (toujours à l'origine)
    const sun = this.sunLight;
    sun.position.copy(SUN_DIR).multiplyScalar(300);
    if (preset.shadowMap) {
      sun.castShadow = true;
      sun.shadow.mapSize.setScalar(preset.shadowMap);
      const s = sun.shadow.camera;
      s.left = s.bottom = -62; s.right = s.top = 62; s.near = 100; s.far = 500;
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.35;
      sun.shadow.radius = 3;
    }
    this.scene.add(sun, sun.target, this.diskLight, this.diskLight.target);
    this.scene.add(new THREE.HemisphereLight(0x8fa6c4, 0x1a1410, 0.05));

    this.blackHole = new BlackHole(BLACK_HOLE_RS, cube.texture, preset);
    this.scene.add(this.blackHole.mesh);
    this.scene.add(this.shipModel.group, this.dust.lines);
    this.chase = new ChaseCamera(this.camera);
    this.chase.azimuth = 0.5;
    this.chase.setDistance(115, true);
    this.applyUpgrades();
    this.ship.energy = this.ship.mods.energyMax;

    this.buildSystem(restore ? parseKey(restore.sector) : loadSector(), true);
    if (restore) {
      this.ship.restore(restore.ship);
      this.target = this.bodies.find((b) => b.sheet.id === restore.target && this.scanner.isRevealed(b)) ?? this.target;
      this.time = restore.time;
      this.shipTime = restore.shipTime;
      this.farTime = restore.farTime;
      this.chase.azimuth = 0;
    }
    this.chase.snapTo(this.ship.quaternion);
    this.ghostAt = this.time + 140;
    this.solitudeAt = this.time + 50;

    // Post-traitement : rendu HDR, halo des sources très lumineuses, puis conversion écran
    const renderTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: preset.msaa });
    this.composer = new EffectComposer(this.renderer, renderTarget);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.7, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.input = new Input(canvas);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.warmUp();

    hud.set({ quality, muted: this.audio.muted, ...this.progressState() });
    this.raf = requestAnimationFrame(this.tick);
  }

  /**
   * Une image d'échauffement dessine tout, même hors champ, pour que le pilote graphique finisse
   * de préparer chaque programme avant la première vraie image (sinon l'image se fige une seconde
   * la première fois qu'une planète entre dans le champ).
   */
  private warmUp() {
    const culled: THREE.Object3D[] = [];
    const hidden: THREE.Object3D[] = [];
    this.scene.traverse((o) => {
      if (o.frustumCulled) { o.frustumCulled = false; culled.push(o); }
      if (!o.visible && !(o instanceof THREE.Light)) { o.visible = true; hidden.push(o); }
    });
    this.composer.render(0);
    culled.forEach((o) => { o.frustumCulled = true; });
    hidden.forEach((o) => { o.visible = false; });
  }

  // ── Système stellaire ──

  /** Libère le système courant et construit celui de la case demandée. */
  private buildSystem(sector: Sector, place: boolean) {
    this.planets.forEach((p) => { this.scene.remove(p.group); p.dispose(); });
    this.objects.forEach((o) => { this.scene.remove(o.group); o.dispose(); });
    this.planets.clear();
    this.objects.clear();
    if (this.belt) { this.scene.remove(this.belt.group); this.belt.dispose(); this.belt = null; }

    const system = generateSystem(sector);
    this.system = system;
    this.bodies = system.bodies;
    const byId = (id?: string) => this.bodies.find((b) => b.sheet.id === id) ?? null;
    const byKind = (kind: Body['kind']) => this.bodies.find((b) => b.kind === kind) ?? null;
    this.star = byKind('star')!;
    this.ghost = byKind('ghost')!;
    this.blackHoleBody = byKind('blackhole');
    this.orbiters = this.bodies.filter((b) => b.orbit && byId(b.orbit.parent)).map((body) => ({ body, parent: byId(body.orbit!.parent)! }));
    this.solid = this.bodies.filter((b) => PLANET_KINDS.has(b.kind) || b.kind === 'star');

    for (const body of this.bodies) {
      const spec = body.planet;
      if (spec && PLANET_KINDS.has(body.kind)) {
        const planet = new Planet({
          kind: body.kind as PlanetKind, radius: body.radius, seed: spec.seed, spin: spec.spin, tilt: spec.tilt, rings: spec.rings,
          atmosphere: spec.atmosphere && new THREE.Color(...spec.atmosphere),
          tint: spec.tint && new THREE.Vector3(...spec.tint),
        }, this.preset);
        this.planets.set(body, planet);
        this.scene.add(planet.group);
      }
      let object: SpaceObject | null = null;
      if (body.kind === 'beacon') object = makeBeacon();
      else if (body.kind === 'wreck') object = makeWreck(body.sheet.id);
      else if (body.kind === 'pod') object = makePod();
      else if (body.kind === 'probe') object = makeProbe();
      else if (body.kind === 'twin') object = makeTwin();
      else if (body.kind === 'anomaly') object = makeAnomaly(body.radius, this.envCube);
      else if (body.kind === 'megastructure' && this.blackHoleBody) object = makeMegastructure(body.radius, this.tmp.copy(this.blackHoleBody.world).sub(body.world));
      else if (body.kind === 'ghost') object = makeGhost();
      if (object) { this.objects.set(body, object); this.scene.add(object.group); }
    }

    this.beltParent = byId(system.belt?.parentId);
    this.asteroid = byId(system.belt?.namedId);
    if (system.belt && this.beltParent) {
      this.belt = new AsteroidBelt(this.preset.asteroids, system.belt.tilt, system.belt.inner, system.belt.outer, this.asteroid?.radius ?? 0);
      this.scene.add(this.belt.group);
    }

    const color = this.star.star?.color ?? [1, 0.93, 0.82];
    this.sky.setSystem(system.skyRotation, color);
    this.sunLight.color.setRGB(0.55 + color[0] * 0.45, 0.55 + color[1] * 0.45, 0.55 + color[2] * 0.45);
    this.blackHole.mesh.visible = !!this.blackHoleBody;

    this.scanner.cancel();
    this.ghostActive = false;
    this.inRadiation = this.tideWarned = this.falling = false;
    this.radiation = this.dread = 0;
    this.target = this.nextStoryBody() ?? this.bodies.find((b) => PLANET_KINDS.has(b.kind) && !b.orbit) ?? this.star;

    if (place) {
      this.ship.position.copy(system.arrival);
      this.ship.velocity.set(0, 0, 0);
      this.ship.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(system.arrival, system.lookAt, UP));
      this.ship.yawRate = this.ship.pitchRate = 0;
      this.ship.cruise = false;
      this.chase?.snapTo(this.ship.quaternion);
    }
    this.updateOrbits();
    hud.set({ sector: system.info.home ? `Hélice · ${SECTOR_NAME}` : `${system.info.name} · case ${system.info.key}`, ...this.progressState() });
  }

  /** Carte galactique : les systèmes des cases voisines, vus depuis le système actuel. */
  private mapEntries(): MapEntry[] {
    const here = this.system.info;
    const list = neighbours(here.sector, 2);
    if (!here.home && !list.some((s) => s.home)) list.push(systemInfo(HOME));
    return list.map((s) => ({
      key: s.key, name: s.name, starType: s.starType, color: s.starColor,
      dx: s.position[0] - here.position[0], dy: s.position[1] - here.position[1], dz: s.position[2] - here.position[2],
      distance: distanceLy(here, s),
      visited: this.visited.has(s.key), discoveries: this.scanner.countInSystem(s.name), home: s.home,
    }));
  }

  /** Demande de saut depuis la carte. */
  requestJump(key: string) {
    if (this.mode !== 'play' || this.jump || this.photo) return;
    const target = systemInfo(parseKey(key));
    if (target.key === this.system.info.key) return;
    if (this.nearest < JUMP_CLEARANCE) {
      this.audio.deny();
      hud.set({ panel: null });
      this.say(`Trop près d’une masse pour ouvrir un saut. Éloignez-vous à plus de ${this.km(JUMP_CLEARANCE)} de tout astre (mode croisière, touche C).`, 8);
      return;
    }
    if (this.ship.energy < JUMP_COST) {
      this.audio.deny();
      hud.set({ panel: null });
      this.say(`Énergie insuffisante pour un saut : il faut ${JUMP_COST} %.`, 6);
      return;
    }
    this.jump = { target, t: 0, done: false };
    this.scanner.cancel();
    this.audio.jump(JUMP_SECONDS);
    hud.set({ panel: null, sheet: null, message: '', jump: { name: target.name, arrived: false } });
  }

  private updateJump(dt: number) {
    const jump = this.jump!;
    jump.t += dt;
    this.input.consume();
    this.ship.update(dt, null, ZERO);
    if (!jump.done && jump.t >= JUMP_SECONDS) {
      jump.done = true;
      const first = !this.visited.has(jump.target.key);
      this.visited.add(jump.target.key);
      try {
        localStorage.setItem(SECTOR_KEY, jump.target.key);
        localStorage.setItem(VISITED_KEY, JSON.stringify([...this.visited]));
      } catch { /* stockage indisponible */ }
      this.buildSystem(jump.target.sector, true);
      this.ship.energy = Math.max(0, this.ship.energy - JUMP_COST);
      const worlds = this.bodies.filter((b) => PLANET_KINDS.has(b.kind) && !b.orbit).length;
      hud.set({ jump: { name: jump.target.name, arrived: true } });
      this.say(
        jump.target.home ? 'Retour dans le système Hélice.'
          : first ? `Système ${jump.target.name} : ${jump.target.starType.toLowerCase()}, ${worlds || 'aucune'} planète${worlds > 1 ? 's' : ''}. Personne n’est jamais venu ici.`
            : `Retour dans le système ${jump.target.name}.`, 9);
    }
    if (jump.t >= JUMP_SECONDS + 1.5) {
      this.jump = null;
      hud.set({ jump: null });
    }
  }

  // ── Commandes venant de l'interface ──

  setMode(mode: GameMode) {
    const from = this.mode;
    if (mode === 'play') {
      this.audio.start();
      this.audio.setPaused(false);
      if (from === 'menu') {
        this.chase.azimuth = 0;
        this.chase.elevation = 0.2;
        this.chase.setDistance(150);
        if (this.system.info.home && !this.scanner.knows(STORY[0])) {
          this.say(OBJECTIVES[STORY[0]], 8);
          this.audio.signal();
        }
      }
    }
    if (mode === 'pause') this.audio.setPaused(true);
    if (mode === 'menu') { this.audio.setPaused(false); this.chase.setDistance(115); this.setPhoto(false); }
    this.mode = mode;
    this.frameView();
    this.dirty = true;
    this.input.consume();
    hud.set({ mode });
  }

  /** Après la fin : retour au point de départ, découvertes conservées. */
  restart(mode: 'play' | 'menu') {
    if (!this.system.info.home) this.buildSystem(HOME, true);
    this.ship.reset();
    this.chase.snapTo(this.ship.quaternion);
    this.chase.setDistance(150, true);
    this.audio.restore();
    this.ghostActive = false;
    this.tideWarned = false;
    this.mode = 'menu';
    hud.set({ end: null });
    this.setMode(mode);
  }

  selectTarget(id: string) {
    const body = this.bodies.find((b) => b.sheet.id === id);
    if (!body) return;
    this.target = body;
    this.scanner.cancel();
    hud.set({ panel: null });
  }

  buy(id: UpgradeId) {
    if (this.progression.buy(id, this.scanner.research())) {
      this.applyUpgrades();
      this.audio.scanDone();
      hud.set(this.progressState());
    } else {
      this.audio.deny();
    }
  }

  setMuted(muted: boolean) {
    this.audio.setMuted(muted);
    hud.set({ muted });
  }

  setPhoto(on: boolean) {
    if (this.photo === on || this.jump) return;
    this.photo = on;
    if (on) this.chase.setLimits(30, 5000);
    else { this.chase.setLimits(); this.chase.setDistance(150); }
    hud.set({ photo: on, sheet: null, panel: null });
  }

  savePhoto() { this.capture = true; }

  snapshot(): GameSnapshot {
    return { sector: this.system.info.key, ship: this.ship.snapshot(), target: this.target.sheet.id, time: this.time, shipTime: this.shipTime, farTime: this.farTime };
  }

  // ── Progression ──

  private applyUpgrades() {
    const p = this.progression;
    this.ship.mods = { thrust: p.thrust, topSpeed: p.topSpeed, energyMax: p.energyMax, regen: p.energyRegen };
    this.scanner.duration = p.scanDuration;
  }

  private nextStoryBody() {
    const id = STORY.find((step) => !this.scanner.knows(step));
    return id ? this.bodies.find((b) => b.sheet.id === id && this.scanner.isRevealed(b)) : undefined;
  }

  private progressState(): Partial<HudState> {
    const next = STORY.find((step) => !this.scanner.knows(step));
    return {
      journal: this.scanner.discovered(),
      research: this.scanner.research() - this.progression.spent(),
      upgrades: this.progression.list(),
      objective: this.system.info.home ? OBJECTIVES[next ?? 'done'] : next ? 'Le signal de détresse vient du système Hélice.' : '',
      energyMax: this.ship.mods.energyMax,
    };
  }

  private nameOf(body: Body) { return this.scanner.isKnown(body) ? body.sheet.name : body.alias ?? body.sheet.name; }
  private typeOf(body: Body) { return this.scanner.isKnown(body) || !body.alias ? body.sheet.type : 'Non identifié'; }
  private scanRange(body: Body) { return body.scanRange * this.progression.scanRange; }
  private revealed() { return this.bodies.filter((b) => this.scanner.isRevealed(b) || (b === this.ghost && this.ghostActive)); }

  private distanceTo(body: Body) {
    return Math.max(0, body.world.distanceTo(this.ship.position) - body.radius);
  }

  private km(units: number) {
    const km = units * KM_PER_UNIT;
    if (km >= 1.5e7) return `${(km / 1.496e8).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} UA`;
    if (km >= 1e6) return `${(km / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} millions de km`;
    return `${(Math.round(km / 100) * 100).toLocaleString('fr-FR')} km`;
  }

  // ── Affichage ──

  private resize() {
    const width = this.canvas.clientWidth || 1;
    const height = this.canvas.clientHeight || 1;
    const ratio = Math.min(window.devicePixelRatio || 1, this.preset.maxPixelRatio);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(width, height);
    this.sky.setPixelRatio(ratio);
    this.camera.aspect = width / height;
    this.frameView();
    this.dirty = true;
  }

  /** Au menu, la scène est décalée vers la droite pour laisser la place au titre. */
  private frameView() {
    const width = this.canvas.clientWidth || 1;
    const height = this.canvas.clientHeight || 1;
    if (this.mode === 'menu' && width > 900) this.camera.setViewOffset(width, height, -width * 0.13, height * 0.05, width, height);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  private say(message: string, seconds = 5) {
    this.messageUntil = this.clock + seconds;
    hud.set({ message });
  }

  // ── Entrées ──

  private handleKeys() {
    const state = hud.get();
    for (const key of this.input.consume()) {
      if (this.photo) {
        if (key === 'p' || key === 'Escape') this.setPhoto(false);
        else if (key === 'Enter') this.capture = true;
        continue;
      }
      const toggle = (panel: HudState['panel']) => hud.set({ panel: state.panel === panel ? null : panel, sheet: null });
      if (key === 'Escape') {
        if (state.sheet || state.panel) hud.set({ sheet: null, panel: null });
        else this.setMode('pause');
      } else if (key === 'f') {
        if (state.sheet) hud.set({ sheet: null });
        else this.startScan();
      } else if (key === 'c') {
        this.ship.toggleCruise();
        const first = this.ship.cruise && !this.cruiseExplained;
        this.cruiseExplained ||= this.ship.cruise;
        this.say(this.ship.cruise ? (first ? 'Mode croisière : plus le vaisseau est loin de toute masse, plus il peut aller vite. Il ralentit seul à l’approche d’un astre.' : 'Mode croisière engagé') : 'Mode impulsion', first ? 8 : 2.2);
      } else if (key === 't') {
        const list = this.revealed();
        this.target = list[(list.indexOf(this.target) + 1) % list.length];
        this.scanner.cancel();
      } else if (key === 'j') toggle('journal');
      else if (key === 'n') toggle('nav');
      else if (key === 'u') toggle('upgrades');
      else if (key === 'm') hud.set({ panel: state.panel === 'map' ? null : 'map', sheet: null, map: this.mapEntries() });
      else if (key === 'p') this.setPhoto(true);
      else if (key === 'h') hud.set({ helpOpen: !state.helpOpen });
    }
  }

  private startScan() {
    const body = this.target;
    if (body === this.ghost) { this.audio.deny(); this.say('Analyse impossible : aucun écho en retour.'); return; }
    if (this.scanner.isKnown(body)) { hud.set({ sheet: body.sheet, panel: null }); return; }
    if (this.ship.energy < 5) { this.audio.deny(); this.say('Scanner hors service : énergie de bord insuffisante.'); return; }
    if (this.distanceTo(body) > this.scanRange(body)) {
      this.audio.deny();
      this.say(`${this.nameOf(body)} : hors de portée du scanner. Approchez à moins de ${this.km(this.scanRange(body))}.`);
      return;
    }
    this.scanner.start(body);
    this.scanTickAt = 0;
  }

  // ── Simulation ──

  private simulate(dt: number) {
    const ship = this.ship;
    if (this.jump) { this.updateJump(dt); return; }
    this.handleKeys();
    if (this.mode !== 'play' || this.photo) return;

    // Croisière : la vitesse permise grandit avec la distance à la masse la plus proche
    let nearest = Infinity;
    for (const body of this.bodies) if (body !== this.ghost) nearest = Math.min(nearest, this.distanceTo(body));
    this.nearest = nearest;
    ship.cruiseLimit = THREE.MathUtils.clamp(nearest * CRUISE_RATE, CRUISE_FLOOR, CRUISE_TOP);

    // NEMESIS-01 : radiations autour du disque, dérive sous la dernière orbite stable
    let range = Infinity, timeFactor = 1, pull = 0, r = Infinity;
    const hole = this.blackHoleBody;
    if (hole) {
      this.toHole.copy(hole.world).sub(ship.position);
      r = this.toHole.length();
      range = r / BLACK_HOLE_RS;
      timeFactor = this.blackHole.timeFactor(r);
      pull = this.blackHole.pullSpeed(r);
    }
    const zone = this.progression.radiationZone;
    this.radiation = 1 - THREE.MathUtils.smoothstep(range, zone * 0.55, zone);
    ship.update(dt, this.input, ZERO, this.radiation * 16);
    if (pull > 0) ship.position.addScaledVector(this.toHole, (pull * dt) / r);
    if (pull > 0 && !this.falling) this.say('Sous la dernière orbite stable : le vaisseau dérive vers l’horizon. Poussée maximale pour remonter.', 8);
    this.falling = pull > 0;
    this.shipTime += dt;
    this.farTime += dt / Math.max(timeFactor, 0.05);

    if (r < BLACK_HOLE_RS * END_TRIGGER) { this.beginEnding(); return; }

    // Étoile et planètes sont solides : le vaisseau glisse le long de leur surface
    for (const body of this.solid) {
      const limit = body.radius * 1.05 + 45;
      this.tmp.copy(ship.position).sub(body.world);
      const d = this.tmp.length();
      if (d < limit) {
        this.tmp.divideScalar(d || 1);
        ship.position.copy(body.world).addScaledVector(this.tmp, limit);
        const inward = ship.velocity.dot(this.tmp);
        if (inward < 0) ship.velocity.addScaledVector(this.tmp, -inward);
      }
    }

    this.updateScan(dt);
    this.updateDetection();
    this.updateAtmosphere(dt, range);
  }

  private updateScan(dt: number) {
    const body = this.target;
    if (this.scanner.active) {
      if (this.ship.energy < 2) { this.scanner.cancel(); this.say('Analyse interrompue : plus d’énergie.'); return; }
      this.scanTickAt -= dt;
      if (this.scanTickAt <= 0) { this.audio.scanTick(this.scanner.progress); this.scanTickAt = 0.28; }
    }
    const result = this.scanner.update(dt, body, this.distanceTo(body), this.scanRange(body));
    if (result === 'lost') { this.audio.deny(); this.say('Analyse interrompue : cible sortie de la portée du scanner.'); }
    if (result !== 'done') return;
    this.audio.scanDone();
    hud.set({ sheet: body.sheet, panel: null, ...this.progressState() });
    if (body.after) this.say(body.after, 9);
    // L'histoire avance : la piste suivante devient la cible
    if (STORY.includes(body.sheet.id)) {
      const next = this.nextStoryBody();
      if (next) this.target = next;
      if (body.sheet.id === STORY[1]) this.knockAt = this.time + 70 + Math.random() * 60;
    }
  }

  /** Les objets hors catalogue se révèlent quand on passe assez près. */
  private updateDetection() {
    for (const body of this.bodies) {
      if (!body.detectRange || this.scanner.isRevealed(body)) continue;
      const d = this.distanceTo(body);
      if (d < body.detectRange * this.progression.detectRange && this.scanner.detect(body)) {
        this.audio.signal();
        this.say(`Objet non catalogué à ${this.km(d)} : ${(body.alias ?? 'écho').toLowerCase()}. Touche N pour le cibler.`, 8);
      }
    }
  }

  /** Tout ce qui installe l'inquiétude : radiations, coque qui travaille, silence, présence. */
  private updateAtmosphere(dt: number, range: number) {
    const audio = this.audio;
    this.dread = 1 - THREE.MathUtils.smoothstep(range, 2.5, 18);

    if (this.radiation > 0.05 && !this.inRadiation) {
      this.inRadiation = true;
      this.say('Radiations : l’énergie de bord se vide. Le scanner s’arrêtera avec elle.', 7);
    } else if (this.radiation === 0) this.inRadiation = false;
    if (this.radiation > 0 && Math.random() < this.radiation * dt * 30) audio.click();

    if (this.dread > 0.3 && this.time > this.creakAt) {
      audio.creak();
      this.creakAt = this.time + 4 + Math.random() * 16 * (1.15 - this.dread);
    }
    if (this.dread > 0.55 && !this.tideWarned) {
      this.tideWarned = true;
      this.say('Forces de marée : la coque travaille.', 6);
    }

    const slow = this.ship.velocity.lengthSq() < 4000 * 4000;
    const quiet = this.clock > this.messageUntil && !this.scanner.active && this.dread < 0.3;
    // Un choc contre la coque, sans rien autour
    if (this.knockAt > 0 && this.time > this.knockAt && quiet && slow) {
      this.knockAt = -1;
      audio.knock();
      this.knockSaid = this.time + 2.2;
    }
    if (this.knockSaid > 0 && this.time > this.knockSaid) {
      this.knockSaid = 0;
      this.say('Choc enregistré sur la coque arrière. Aucun objet à proximité.', 7);
    }

    // Un contact qui suit le vaisseau, et qui disparaît quand on s'en approche ou qu'on le sème
    if (this.ghostActive) {
      const d = this.distanceTo(this.ghost);
      if (d < 1700 || d > 30000 || this.time > this.ghostUntil) {
        this.ghostActive = false;
        this.ghostAt = this.time + 150 + Math.random() * 130;
        if (this.target === this.ghost) this.target = this.nextStoryBody() ?? this.star;
        this.say('Contact perdu.', 4);
      }
    } else if (quiet && slow && this.ghostCount < 3 && this.time > this.ghostAt && this.scanner.knows(STORY[1])) {
      this.ghostActive = true;
      this.ghostCount++;
      this.ghostUntil = this.time + 55;
      this.ghost.world.copy(this.ship.position).addScaledVector(this.ship.forward, -4300);
      this.ghost.world.y += 700;
      audio.contact();
      this.say('Contact non identifié à 43 000 km. Derrière vous.', 8);
    } else if (quiet && this.time > this.solitudeAt && this.solitudeIndex < SOLITUDE.length) {
      this.say(SOLITUDE[this.solitudeIndex++], 7);
      this.solitudeAt = this.time + 100 + Math.random() * 90;
    }
  }

  // ── Fin ──

  private beginEnding() {
    this.scanner.cancel();
    this.ghostActive = false;
    this.endT = 0;
    this.mode = 'ending';
    this.photo = false;
    this.chase.setLimits();
    this.chase.setDistance(85);
    this.audio.ending(ENDING_SECONDS);
    const catalog = this.bodies.filter((b) => b !== this.ghost);
    hud.set({
      mode: 'ending', sheet: null, panel: null, photo: false, message: '', falling: false,
      end: {
        shipTime: this.shipTime,
        farDelta: this.farTime - this.shipTime,
        discoveries: this.scanner.countIn(catalog),
        total: catalog.length,
        storyComplete: this.scanner.knows(STORY[STORY.length - 1]),
      },
    });
  }

  /** Vu de loin, la chute ne finit jamais : le vaisseau ralentit et se fige au ras de l'horizon. */
  private updateEnding(dt: number) {
    const hole = this.blackHoleBody;
    if (!hole) return;
    this.endT += dt;
    this.input.consume();
    this.tmp.copy(this.ship.position).sub(hole.world);
    const r = this.tmp.length();
    const next = r + (BLACK_HOLE_RS * END_FLOOR - r) * (1 - Math.exp(-dt * 0.6));
    this.ship.position.copy(hole.world).addScaledVector(this.tmp, next / r);
    this.ship.velocity.multiplyScalar(Math.exp(-dt * 2));
    this.dread = 1;

    // La caméra passe sous le vaisseau et regarde vers l'extérieur : à cette profondeur,
    // la lumière du reste de l'univers n'arrive plus que par un cercle qui rétrécit.
    const k = Math.min(1, this.endT / ENDING_SECONDS);
    this.tmp.normalize().multiplyScalar(-(55 + k * 25));
    this.camera.position.lerp(this.tmp, 1 - Math.exp(-dt * 1.4));
    this.camera.up.set(0, 1, 0).applyQuaternion(this.ship.quaternion);
    this.camera.lookAt(0, 0, 0);
    this.camera.fov += (82 - this.camera.fov) * (1 - Math.exp(-dt * 0.8));
    this.camera.updateProjectionMatrix();
    if (this.endT >= ENDING_SECONDS) {
      this.mode = 'ended';
      this.dirty = true;
      hud.set({ mode: 'ended' });
    }
  }

  // ── Boucle ──

  /** Lunes autour de leur planète, gros astéroïde avec sa ceinture. */
  private updateOrbits() {
    for (const { body, parent } of this.orbiters) {
      const o = body.orbit!;
      const a = o.phase + this.time * o.speed;
      body.world.set(Math.cos(a) * o.radius, Math.sin(a) * o.radius * o.tilt, Math.sin(a) * o.radius).add(parent.world);
    }
    if (this.belt && this.asteroid && this.beltParent) this.belt.namedWorld(this.asteroid.world, this.beltParent.world);
  }

  /** À l'échelle réelle, la direction et la taille apparente de l'étoile changent pendant le voyage. */
  private updateSun() {
    this.tmp.copy(this.star.world).sub(this.ship.position);
    const d = this.tmp.length() || 1;
    SUN_DIR.copy(this.tmp).divideScalar(d);
    // Le disque de l'étoile occupe 4,2 % du halo dessiné
    const angular = THREE.MathUtils.clamp(this.star.radius / d / 0.042, 0.02, 1.2);
    this.sky.setSun(SUN_DIR, angular);
    this.blackHole.setSun(SUN_DIR, angular);
    this.sunLight.position.copy(SUN_DIR).multiplyScalar(300);
  }

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min((now - (this.last || now)) / 1000, 0.05);
    this.last = now;
    const frozen = this.mode === 'pause' || this.mode === 'ended';

    if (frozen) {
      if (this.mode === 'pause' && this.input.consume().includes('Escape')) this.setMode('play');
      else this.input.consume();
      this.input.takePointer();
      if (!this.dirty) return;
    } else {
      this.clock += dt;
      if (!this.photo) this.time += this.mode === 'ending' ? dt * 0.45 : dt;
    }

    const ship = this.ship;
    const pointer = this.input.takePointer();
    const step = this.photo ? 0 : dt;
    this.updateOrbits();

    if (this.mode === 'play') {
      this.chase.orbit(pointer.x, pointer.y, pointer.wheel);
      this.simulate(dt);
    } else if (this.mode === 'menu') {
      // Plan d'ensemble lent autour du vaisseau à l'arrêt
      this.chase.azimuth = 0.34 + Math.sin(this.time * 0.05) * 0.2;
      this.chase.elevation = 0.16 + Math.sin(this.time * 0.035) * 0.07;
      this.dread = 0;
    } else if (this.mode === 'ending') {
      this.updateEnding(dt);
    }

    const playing = this.mode === 'play';
    const piloting = playing && !this.photo && !this.jump;
    const speed = ship.velocity.length();
    // Pendant la charge d'un saut, le champ de vision s'étire comme à très haute vitesse
    const charge = this.jump && !this.jump.done ? Math.pow(this.jump.t / JUMP_SECONDS, 2) : 0;
    this.shipModel.group.quaternion.copy(ship.quaternion);
    this.shipModel.update(step, this.time, playing ? Math.max(ship.power, charge * 1.5) : 0.04, ship.yawRate, ship.pitchRate, ship.surge);
    if (this.mode !== 'ending') this.chase.update(dt, ship.quaternion, Math.max(speed / 3200, charge * 2.5), piloting ? ship.surge : 0, (piloting && ship.boosting) || charge > 0.2, this.time);

    // Origine flottante : le vaisseau reste en (0,0,0), c'est l'univers qui se déplace autour de lui.
    const hole = this.blackHoleBody;
    if (hole) {
      this.blackHole.update(this.scenePos.copy(hole.world).sub(ship.position), this.time);
      this.diskLight.position.copy(this.scenePos).normalize().multiplyScalar(300);
      const range = this.scenePos.length() / BLACK_HOLE_RS;
      this.diskLight.intensity = THREE.MathUtils.clamp(9 / range, 0.15, 2.5);
      // Adaptation de l'exposition : près du disque d'accrétion, l'image se referme comme une pupille.
      // Pendant la chute, la lumière qui tombe avec le vaisseau est décalée vers le bleu et s'intensifie.
      const adapt = THREE.MathUtils.smoothstep(range, 5, 40);
      const blueshift = this.mode === 'ending' ? 1 + (this.endT / ENDING_SECONDS) * 5 : 1;
      this.renderer.toneMappingExposure = 1.05 * (0.2 + 0.8 * adapt) * blueshift;
      this.bloom.strength = 0.12 + 0.24 * adapt;
    } else {
      this.diskLight.intensity = 0;
      this.renderer.toneMappingExposure = 1.05;
      this.bloom.strength = 0.36;
    }

    this.planets.forEach((planet, body) => planet.update(this.scenePos.copy(body.world).sub(ship.position), this.time));
    if (this.belt && this.beltParent) this.belt.update(this.scenePos.copy(this.beltParent.world).sub(ship.position), this.time);
    this.objects.forEach((object, body) => {
      object.group.position.copy(body.world).sub(ship.position);
      object.group.visible = object.group.position.length() < object.drawDistance && (body !== this.ghost || this.ghostActive);
      if (object.group.visible) object.update(step, this.time);
    });
    this.dust.update(step, ship.velocity);
    this.sky.follow(this.camera);
    this.updateSun();

    this.camera.updateMatrixWorld();
    this.placeMarker(this.markers.target, this.target, piloting);
    this.placeMarker(this.markers.ghost, this.ghost, piloting && this.ghostActive && this.target !== this.ghost);

    this.composer.render(dt);
    this.dirty = false;
    if (this.capture) { this.capture = false; this.downloadFrame(); }

    this.audio.update({ power: piloting ? ship.power : 0.03, dread: this.mode === 'menu' ? 0 : this.dread, speed: Math.min(speed / 3200, 1.5) });
    this.updateHud(dt, speed);
  };

  private updateHud(dt: number, speed: number) {
    this.frames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) { this.fps = Math.round(this.frames / this.fpsTimer); this.frames = 0; this.fpsTimer = 0; }
    this.hudTimer += dt;
    if (this.mode !== 'play' || this.hudTimer < 0.125) return;
    this.hudTimer = 0;
    const ship = this.ship;
    const body = this.target;
    const state = hud.get();
    const distance = this.distanceTo(body);
    const hole = this.blackHoleBody;
    let nav: NavEntry[] = state.nav;
    if (state.panel === 'nav') {
      nav = this.revealed()
        .map((b) => ({ id: b.sheet.id, name: this.nameOf(b), type: this.typeOf(b), distance: this.distanceTo(b) * KM_PER_UNIT, scanned: this.scanner.isKnown(b), current: b === body }))
        .sort((a, b) => a.distance - b.distance);
    }
    hud.set({
      fps: this.fps,
      speed: speed * KM_PER_UNIT,
      cruise: ship.cruise,
      engines: ship.state,
      energy: ship.energy,
      // Coordonnées en millions de km par rapport à l'origine du système
      coords: [ship.position.x / 1e5, ship.position.y / 1e5, ship.position.z / 1e5],
      targetName: this.nameOf(body),
      targetType: this.typeOf(body),
      targetDistance: distance * KM_PER_UNIT,
      targetScanned: this.scanner.isKnown(body),
      scanner: this.scanner.active ? 'Analyse' : ship.energy < 5 ? 'Hors service' : distance > this.scanRange(body) ? 'Hors de portée' : 'Prêt',
      scanProgress: this.scanner.progress,
      timeFactor: hole ? this.blackHole.timeFactor(hole.world.distanceTo(ship.position)) : 1,
      radiation: this.radiation,
      dread: this.dread,
      falling: this.falling,
      nav,
      message: this.clock > this.messageUntil ? '' : state.message,
    });
  }

  /** Place un repère sur l'objet visé ; s'il est hors champ, une flèche au bord de l'écran indique sa direction. */
  private placeMarker(el: HTMLElement, body: Body, show: boolean) {
    if (!show) { el.style.opacity = '0'; return; }
    const p = this.projected.copy(body.world).sub(this.ship.position);
    const behind = this.tmp.copy(p).applyMatrix4(this.camera.matrixWorldInverse).z > 0;
    p.project(this.camera);
    let x = p.x, y = p.y;
    if (behind) { x = -x; y = -y; }
    const off = behind || Math.abs(x) > 0.94 || Math.abs(y) > 0.88;
    let rotation = '';
    if (off) {
      if (behind && Math.abs(x) < 1e-3 && Math.abs(y) < 1e-3) y = -1;
      const k = 1 / Math.max(Math.abs(x) / 0.94, Math.abs(y) / 0.88);
      x *= k; y *= k;
      rotation = ` rotate(${Math.atan2(-y, x).toFixed(3)}rad)`;
    }
    el.dataset.off = off ? '1' : '0';
    el.style.opacity = '1';
    el.style.transform = `translate(${((x * 0.5 + 0.5) * this.canvas.clientWidth).toFixed(1)}px, ${((-y * 0.5 + 0.5) * this.canvas.clientHeight).toFixed(1)}px)${rotation}`;
  }

  /** Mode photo : enregistre l'image qui vient d'être rendue. */
  private downloadFrame() {
    this.canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      link.href = URL.createObjectURL(blob);
      link.download = `event-horizon-${stamp}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 2000);
      this.say('Image enregistrée.', 2.5);
    }, 'image/png');
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.input.dispose();
    this.audio.dispose();
    this.sky.dispose();
    this.dust.dispose();
    this.blackHole.dispose();
    this.planets.forEach((p) => p.dispose());
    this.objects.forEach((o) => o.dispose());
    this.belt?.dispose();
    this.shipModel.dispose();
    this.environment.dispose();
    this.bloom.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
