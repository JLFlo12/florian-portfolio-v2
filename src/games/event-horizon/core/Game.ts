import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Input } from './input';
import { hud, type GameMode, type HudState, type NavEntry } from './store';
import { QUALITY, type QualityLevel, type QualityPreset } from '../engine/quality';
import { Sky } from '../engine/Sky';
import { Dust } from '../engine/Dust';
import { BlackHole } from '../astronomy/BlackHole';
import { Planet, type PlanetOptions } from '../astronomy/Planet';
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

export interface GameSnapshot {
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

const MOON_ORBIT = 1900;
const BELT_TILT = -0.42;
const ENDING_SECONDS = 9;
/** Distance au centre (en rayons de Schwarzschild) sous laquelle la chute devient irréversible. */
const END_TRIGGER = 1.36;
/** Altitude où le vaisseau se fige pendant la séquence de fin : la caméra reste juste au-dessus de l'horizon. */
const END_FLOOR = 1.22;

/** Ce que l'ordinateur de bord finit par dire quand il ne se passe rien. */
const SOLITUDE = [
  'Bande de détresse : silence. Aucune réponse de la Terre depuis 2 ans et 114 jours.',
  'Aucun autre vaisseau à moins de 4 années-lumière.',
  'Rappel : vous êtes le seul membre d’équipage éveillé.',
  'Dernier message reçu : il y a 847 jours. Contenu : « Bon courage. »',
  'Balayage longue portée terminé. Rien ne bouge.',
];

const PLANETS: Record<string, PlanetOptions> = {
  ocean: { kind: 'ocean', radius: 0, seed: 4.2, spin: 0.0016, tilt: 0.3, atmosphere: new THREE.Color(0.2, 0.42, 0.85) },
  moon: { kind: 'moon', radius: 0, seed: 12.7, spin: 0.0006 },
  gas: { kind: 'gas', radius: 0, seed: 2.3, spin: 0.003, tilt: BELT_TILT, atmosphere: new THREE.Color(0.34, 0.33, 0.36), rings: { inner: 3100, outer: 5400 } },
  lava: { kind: 'lava', radius: 0, seed: 7.9, spin: 0.0011, tilt: 0.1, atmosphere: new THREE.Color(0.5, 0.14, 0.05) },
  ice: { kind: 'ice', radius: 0, seed: 21.4, spin: 0.0009, tilt: -0.2, atmosphere: new THREE.Color(0.3, 0.42, 0.6) },
};

/** Boucle de jeu : relie le moteur de rendu, l'univers, le vaisseau, le son et l'interface. */
export class Game {
  private canvas = document.createElement('canvas');
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(52, 1, 2, 250000);
  private preset: QualityPreset;
  private input: Input;
  private sky: Sky;
  private dust = new Dust();
  private environment: THREE.WebGLRenderTarget;
  private blackHole: BlackHole;
  private planets = new Map<Body, Planet>();
  private objects = new Map<Body, SpaceObject>();
  private belt: AsteroidBelt;
  private bodies: Body[] = createStartSystem();
  private byKind = (kind: Body['kind']) => this.bodies.find((b) => b.kind === kind)!;
  private blackHoleBody = this.byKind('blackhole');
  private moon = this.byKind('moon');
  private moonParent = this.byKind('ocean');
  private gas = this.byKind('gas');
  private asteroid = this.byKind('asteroid');
  private ghost = this.byKind('ghost');
  private shipModel = new ShipModel();
  private ship = new ShipController();
  private chase: ChaseCamera;
  private scanner = new Scanner();
  private progression = new Progression();
  private audio = new AudioEngine();
  private diskLight = new THREE.DirectionalLight(0xffa860, 0.5);
  private target: Body;
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
  private inRadiation = false;
  private tideWarned = false;
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
  private gravity = new THREE.Vector3();
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
    const cube = this.sky.capture(this.renderer, preset.skyCube);
    this.scene.add(this.sky.group);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromCubemap(cube.texture);
    pmrem.dispose();
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 1.6;

    // Lumière de l'étoile, avec ombres resserrées sur le vaisseau (toujours à l'origine)
    const sun = new THREE.DirectionalLight(0xfff1dc, 3.4);
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

    // Corps célestes
    this.blackHole = new BlackHole(BLACK_HOLE_RS, cube.texture, preset);
    this.scene.add(this.blackHole.mesh);
    for (const body of this.bodies) {
      const options = PLANETS[body.kind];
      if (options) this.planets.set(body, new Planet({ ...options, radius: body.radius }, preset));
    }
    this.planets.forEach((planet) => this.scene.add(planet.group));
    this.belt = new AsteroidBelt(preset.asteroids, BELT_TILT, this.asteroid.radius);
    this.scene.add(this.belt.group);

    // Épaves, balises, anomalies, structures
    for (const body of this.bodies) {
      let object: SpaceObject | null = null;
      if (body.kind === 'beacon') object = makeBeacon();
      else if (body.kind === 'wreck') object = makeWreck(body.sheet.id);
      else if (body.kind === 'pod') object = makePod();
      else if (body.kind === 'probe') object = makeProbe();
      else if (body.kind === 'twin') object = makeTwin();
      else if (body.kind === 'anomaly') object = makeAnomaly(body.radius, cube.texture);
      else if (body.kind === 'megastructure') object = makeMegastructure(body.radius, this.tmp.copy(this.blackHoleBody.world).sub(body.world));
      else if (body.kind === 'ghost') object = makeGhost();
      if (object) { this.objects.set(body, object); this.scene.add(object.group); }
    }

    this.scene.add(this.shipModel.group, this.dust.lines);
    this.chase = new ChaseCamera(this.camera);
    this.chase.azimuth = 0.5;
    this.chase.setDistance(115, true);
    this.applyUpgrades();
    this.ship.energy = this.ship.mods.energyMax;

    this.target = this.nextStoryBody() ?? this.moonParent;
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

    // Compile tous les shaders dès le chargement : sans cela, l'image se fige une seconde
    // la première fois qu'une planète ou une épave entre dans le champ.
    // Une image d'échauffement dessine tout, même hors champ, pour que le pilote graphique
    // finisse de préparer chaque programme avant la première vraie image.
    const culled: THREE.Object3D[] = [];
    this.scene.traverse((o) => { if (o.frustumCulled) { o.frustumCulled = false; culled.push(o); } });
    this.composer.render(0);
    culled.forEach((o) => { o.frustumCulled = true; });

    hud.set({ quality, sector: SECTOR_NAME, muted: this.audio.muted, ...this.progressState() });
    this.raf = requestAnimationFrame(this.tick);
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
        if (!this.scanner.knows(STORY[0])) {
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
    if (this.progression.buy(id, this.scanner.research(this.bodies))) {
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
    if (this.photo === on) return;
    this.photo = on;
    if (on) this.chase.setLimits(30, 5000);
    else { this.chase.setLimits(); this.chase.setDistance(150); }
    hud.set({ photo: on, sheet: null, panel: null });
  }

  savePhoto() { this.capture = true; }

  snapshot(): GameSnapshot {
    return { ship: this.ship.snapshot(), target: this.target.sheet.id, time: this.time, shipTime: this.shipTime, farTime: this.farTime };
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
      journal: this.scanner.discovered(this.bodies),
      research: this.scanner.research(this.bodies) - this.progression.spent(),
      upgrades: this.progression.list(),
      objective: OBJECTIVES[next ?? 'done'],
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
        this.say(this.ship.cruise ? 'Mode croisière engagé' : 'Mode impulsion', 2.2);
      } else if (key === 't') {
        const list = this.revealed();
        this.target = list[(list.indexOf(this.target) + 1) % list.length];
        this.scanner.cancel();
      } else if (key === 'j') toggle('journal');
      else if (key === 'n') toggle('nav');
      else if (key === 'u') toggle('upgrades');
      else if (key === 'p') this.setPhoto(true);
      else if (key === 'm') this.say('Carte galactique : pas encore disponible. Touche N pour la navigation.');
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
    this.handleKeys();
    if (this.mode !== 'play' || this.photo) return;

    // Champ gravitationnel et radiations de NEMESIS-01
    this.gravity.copy(this.blackHoleBody.world).sub(ship.position);
    const r = this.gravity.length();
    const range = r / BLACK_HOLE_RS;
    this.gravity.multiplyScalar(this.blackHole.gravityAt(r) / r);
    const timeFactor = this.blackHole.timeFactor(r);
    const zone = this.progression.radiationZone;
    this.radiation = 1 - THREE.MathUtils.smoothstep(range, zone * 0.55, zone);
    ship.update(dt, this.input, this.gravity, this.radiation * 16);
    this.shipTime += dt;
    this.farTime += dt / Math.max(timeFactor, 0.05);

    if (r < BLACK_HOLE_RS * END_TRIGGER) { this.beginEnding(); return; }

    // Les planètes sont solides : le vaisseau glisse le long de leur haute atmosphère
    this.planets.forEach((_, body) => {
      const limit = body.radius * 1.05 + 45;
      this.tmp.copy(ship.position).sub(body.world);
      const d = this.tmp.length();
      if (d < limit) {
        this.tmp.divideScalar(d);
        ship.position.copy(body.world).addScaledVector(this.tmp, limit);
        const inward = ship.velocity.dot(this.tmp);
        if (inward < 0) ship.velocity.addScaledVector(this.tmp, -inward);
      }
    });

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

    const quiet = this.clock > this.messageUntil && !this.scanner.active && this.dread < 0.3;
    // Un choc contre la coque, sans rien autour
    if (this.knockAt > 0 && this.time > this.knockAt && quiet) {
      this.knockAt = -1;
      audio.knock();
      this.knockSaid = this.time + 2.2;
    }
    if (this.knockSaid > 0 && this.time > this.knockSaid) {
      this.knockSaid = 0;
      this.say('Choc enregistré sur la coque arrière. Aucun objet à proximité.', 7);
    }

    // Un contact qui suit le vaisseau, et qui disparaît quand on s'en approche
    if (this.ghostActive) {
      if (this.distanceTo(this.ghost) < 1700 || this.time > this.ghostUntil) {
        this.ghostActive = false;
        this.ghostAt = this.time + 150 + Math.random() * 130;
        if (this.target === this.ghost) this.target = this.nextStoryBody() ?? this.blackHoleBody;
        this.say('Contact perdu.', 4);
      }
    } else if (quiet && this.ghostCount < 3 && this.time > this.ghostAt && this.scanner.knows(STORY[1])) {
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
      mode: 'ending', sheet: null, panel: null, photo: false, message: '',
      end: {
        shipTime: this.shipTime,
        farDelta: this.farTime - this.shipTime,
        discoveries: this.scanner.discovered(catalog).length,
        total: catalog.length,
        storyComplete: this.scanner.knows(STORY[STORY.length - 1]),
      },
    });
  }

  /** Vu de loin, la chute ne finit jamais : le vaisseau ralentit et se fige au ras de l'horizon. */
  private updateEnding(dt: number) {
    this.endT += dt;
    this.input.consume();
    const centre = this.blackHoleBody.world;
    this.tmp.copy(this.ship.position).sub(centre);
    const r = this.tmp.length();
    const next = r + (BLACK_HOLE_RS * END_FLOOR - r) * (1 - Math.exp(-dt * 0.6));
    this.ship.position.copy(centre).addScaledVector(this.tmp, next / r);
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

    // Orbites : la lune autour de Thalis, le gros astéroïde avec sa ceinture
    const angle = 1.1 + this.time * 0.004;
    this.moon.world.set(Math.cos(angle) * MOON_ORBIT, Math.sin(angle) * MOON_ORBIT * 0.14, Math.sin(angle) * MOON_ORBIT).add(this.moonParent.world);
    this.belt.namedWorld(this.asteroid.world, this.gas.world);

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
    const piloting = playing && !this.photo;
    const speed = ship.velocity.length();
    this.shipModel.group.quaternion.copy(ship.quaternion);
    this.shipModel.update(step, this.time, playing ? ship.power : 0.04, ship.yawRate, ship.pitchRate, ship.surge);
    if (this.mode !== 'ending') this.chase.update(dt, ship.quaternion, speed / 3200, piloting ? ship.surge : 0, piloting && ship.boosting, this.time);

    // Origine flottante : le vaisseau reste en (0,0,0), c'est l'univers qui se déplace autour de lui.
    this.blackHole.update(this.scenePos.copy(this.blackHoleBody.world).sub(ship.position), this.time);
    this.diskLight.position.copy(this.scenePos).normalize().multiplyScalar(300);
    const range = this.scenePos.length() / BLACK_HOLE_RS;
    this.diskLight.intensity = THREE.MathUtils.clamp(9 / range, 0.15, 2.5);
    // Adaptation de l'exposition : près du disque d'accrétion, l'image se referme comme une pupille
    const adapt = THREE.MathUtils.smoothstep(range, 5, 40);
    // Pendant la chute, la lumière qui tombe avec le vaisseau est décalée vers le bleu et s'intensifie
    const blueshift = this.mode === 'ending' ? 1 + (this.endT / ENDING_SECONDS) * 5 : 1;
    this.renderer.toneMappingExposure = 1.05 * (0.2 + 0.8 * adapt) * blueshift;
    this.bloom.strength = 0.12 + 0.24 * adapt;

    this.planets.forEach((planet, body) => planet.update(this.scenePos.copy(body.world).sub(ship.position), this.time));
    this.belt.update(this.scenePos.copy(this.gas.world).sub(ship.position), this.time);
    this.objects.forEach((object, body) => {
      object.group.position.copy(body.world).sub(ship.position);
      object.group.visible = object.group.position.length() < object.drawDistance && (body !== this.ghost || this.ghostActive);
      if (object.group.visible) object.update(step, this.time);
    });
    this.dust.update(ship.position, ship.velocity);
    this.sky.follow(this.camera);

    this.camera.updateMatrixWorld();
    this.placeMarker(this.markers.target, this.target, piloting);
    this.placeMarker(this.markers.ghost, this.ghost, piloting && this.ghostActive && this.target !== this.ghost);

    this.composer.render(dt);
    this.dirty = false;
    if (this.capture) { this.capture = false; this.downloadFrame(); }

    this.audio.update({ power: piloting ? ship.power : 0.03, dread: this.mode === 'menu' ? 0 : this.dread, speed: speed / 3200 });
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
    const r = this.blackHoleBody.world.distanceTo(ship.position);
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
      coords: [ship.position.x / 100, ship.position.y / 100, ship.position.z / 100],
      targetName: this.nameOf(body),
      targetType: this.typeOf(body),
      targetDistance: distance * KM_PER_UNIT,
      targetScanned: this.scanner.isKnown(body),
      scanner: this.scanner.active ? 'Analyse' : ship.energy < 5 ? 'Hors service' : distance > this.scanRange(body) ? 'Hors de portée' : 'Prêt',
      scanProgress: this.scanner.progress,
      timeFactor: this.blackHole.timeFactor(r),
      radiation: this.radiation,
      dread: this.dread,
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
    this.belt.dispose();
    this.shipModel.dispose();
    this.environment.dispose();
    this.bloom.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
