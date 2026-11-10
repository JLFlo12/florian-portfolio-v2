import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Input } from './input';
import { hud, type GameMode } from './store';
import { QUALITY, type QualityLevel, type QualityPreset } from '../engine/quality';
import { Sky } from '../engine/Sky';
import { Dust } from '../engine/Dust';
import { BlackHole } from '../astronomy/BlackHole';
import { Planet } from '../astronomy/Planet';
import { ShipModel } from '../ship/ShipModel';
import { ShipController, type ShipSnapshot } from '../ship/ShipController';
import { ChaseCamera } from '../ship/ChaseCamera';
import { Scanner } from '../exploration/Scanner';
import { BLACK_HOLE_RS, KM_PER_UNIT, SECTOR_NAME, SUN_DIR, createStartSystem, type Body } from '../universe/bodies';

export interface GameSnapshot {
  ship: ShipSnapshot;
  target: number;
  time: number;
}

const MOON_ORBIT = 1900;

/** Boucle de jeu : relie le moteur de rendu, l'univers, le vaisseau et l'interface. */
export class Game {
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
  private bodies: Body[] = createStartSystem();
  private blackHoleBody: Body;
  private moon: Body;
  private moonParent: Body;
  private shipModel = new ShipModel();
  private ship = new ShipController();
  private chase: ChaseCamera;
  private scanner: Scanner;
  private diskLight = new THREE.DirectionalLight(0xffa860, 0.5);
  private target = 0;
  private mode: GameMode = 'menu';
  private time = 0;
  private raf = 0;
  private last = 0;
  private hudTimer = 0;
  private frames = 0;
  private fpsTimer = 0;
  private fps = 0;
  private messageUntil = 0;
  private dirty = true;
  private resizeObserver: ResizeObserver;
  private scenePos = new THREE.Vector3();
  private gravity = new THREE.Vector3();
  private projected = new THREE.Vector3();

  private canvas = document.createElement('canvas');

  constructor(container: HTMLElement, private marker: HTMLElement, quality: QualityLevel, restore?: GameSnapshot) {
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

    // Lumière de l'étoile, avec ombres douces resserrées sur le vaisseau (toujours à l'origine)
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
    this.blackHoleBody = this.bodies.find((b) => b.kind === 'blackhole')!;
    this.moon = this.bodies.find((b) => b.kind === 'moon')!;
    this.moonParent = this.bodies.find((b) => b.kind === 'ocean')!;
    this.blackHole = new BlackHole(BLACK_HOLE_RS, cube.texture, preset);
    this.scene.add(this.blackHole.mesh);
    for (const body of this.bodies) {
      if (body.kind === 'ocean') {
        this.planets.set(body, new Planet({ kind: 'ocean', radius: body.radius, seed: 4.2, spin: 0.0016, tilt: 0.3, atmosphere: new THREE.Color(0.2, 0.42, 0.85) }, preset));
      } else if (body.kind === 'moon') {
        this.planets.set(body, new Planet({ kind: 'moon', radius: body.radius, seed: 12.7, spin: 0.0006 }, preset));
      } else if (body.kind === 'gas') {
        this.planets.set(body, new Planet({
          kind: 'gas', radius: body.radius, seed: 2.3, spin: 0.003, tilt: -0.42,
          atmosphere: new THREE.Color(0.34, 0.33, 0.36), rings: { inner: 3100, outer: 5400 },
        }, preset));
      }
    }
    this.planets.forEach((planet) => this.scene.add(planet.group));

    this.scene.add(this.shipModel.group, this.dust.lines);
    this.chase = new ChaseCamera(this.camera);
    this.chase.azimuth = 0.5;
    this.chase.setDistance(115, true);
    this.scanner = new Scanner();

    if (restore) {
      this.ship.restore(restore.ship);
      this.target = restore.target;
      this.time = restore.time;
      this.chase.azimuth = 0;
    }
    this.chase.snapTo(this.ship.quaternion);

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

    hud.set({ quality, sector: SECTOR_NAME, journal: this.scanner.discovered(this.bodies) });
    this.raf = requestAnimationFrame(this.tick);
  }

  setMode(mode: GameMode) {
    if (mode === 'play' && this.mode === 'menu') {
      this.chase.azimuth = 0;
      this.chase.elevation = 0.2;
      this.chase.setDistance(150);
    }
    if (mode === 'menu') this.chase.setDistance(115);
    this.mode = mode;
    this.frameView();
    this.dirty = true;
    this.input.consume();
    hud.set({ mode });
  }

  snapshot(): GameSnapshot {
    return { ship: this.ship.snapshot(), target: this.target, time: this.time };
  }

  closePanels() { hud.set({ sheet: null, journalOpen: false }); }

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

  private say(message: string, seconds = 4.5) {
    this.messageUntil = this.time + seconds;
    hud.set({ message });
  }

  private handleKeys() {
    const state = hud.get();
    for (const key of this.input.consume()) {
      if (key === 'Escape') {
        if (state.sheet || state.journalOpen) this.closePanels();
        else this.setMode('pause');
      } else if (key === 'f') {
        if (state.sheet) hud.set({ sheet: null });
        else this.startScan();
      } else if (key === 'c') {
        this.ship.toggleCruise();
        this.say(this.ship.cruise ? 'Mode croisière engagé' : 'Mode impulsion', 2.2);
      } else if (key === 't') {
        this.target = (this.target + 1) % this.bodies.length;
        this.scanner.cancel();
      } else if (key === 'j') {
        hud.set({ journalOpen: !state.journalOpen, sheet: null });
      } else if (key === 'm') {
        this.say('Carte galactique : prévue pour la version 0.2');
      } else if (key === 'h') {
        hud.set({ helpOpen: !state.helpOpen });
      }
    }
  }

  private distanceTo(body: Body) {
    return Math.max(0, body.world.distanceTo(this.ship.position) - body.radius);
  }

  private startScan() {
    const body = this.bodies[this.target];
    if (this.scanner.isKnown(body)) { hud.set({ sheet: body.sheet, journalOpen: false }); return; }
    if (this.distanceTo(body) > body.scanRange) {
      const km = Math.round((body.scanRange * KM_PER_UNIT) / 1000) * 1000;
      this.say(`${body.sheet.name} est hors de portée du scanner. Approchez à moins de ${km.toLocaleString('fr-FR')} km.`);
      return;
    }
    this.scanner.start(body);
  }

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min((now - (this.last || now)) / 1000, 0.05);
    this.last = now;

    if (this.mode === 'pause') {
      if (this.input.consume().includes('Escape')) this.setMode('play');
      this.input.takePointer();
      if (!this.dirty) return;
    } else {
      this.time += dt;
    }

    const ship = this.ship;
    const pointer = this.input.takePointer();

    // La lune suit son orbite autour de Thalis
    const angle = 1.1 + this.time * 0.004;
    this.moon.world.set(Math.cos(angle) * MOON_ORBIT, Math.sin(angle) * MOON_ORBIT * 0.14, Math.sin(angle) * MOON_ORBIT).add(this.moonParent.world);

    let timeFactor = 1;
    if (this.mode === 'play') {
      this.handleKeys();
      this.chase.orbit(pointer.x, pointer.y, pointer.wheel);

      // Champ gravitationnel de NEMESIS-01
      this.gravity.copy(this.blackHoleBody.world).sub(ship.position);
      const r = this.gravity.length();
      this.gravity.multiplyScalar(this.blackHole.gravityAt(r) / r);
      timeFactor = this.blackHole.timeFactor(r);
      ship.update(dt, this.input, this.gravity);

      if (r < BLACK_HOLE_RS * 1.03) {
        ship.reset();
        this.chase.snapTo(ship.quaternion);
        this.scanner.cancel();
        this.say('Horizon franchi : signal perdu. AETHER-01 est restauré à son point de départ.', 7);
      }
      // Les planètes sont solides : le vaisseau glisse le long de leur haute atmosphère
      this.planets.forEach((_, body) => {
        const limit = body.radius * 1.05 + 45;
        this.scenePos.copy(ship.position).sub(body.world);
        const d = this.scenePos.length();
        if (d < limit) {
          this.scenePos.divideScalar(d);
          ship.position.copy(body.world).addScaledVector(this.scenePos, limit);
          const inward = ship.velocity.dot(this.scenePos);
          if (inward < 0) ship.velocity.addScaledVector(this.scenePos, -inward);
        }
      });

      const result = this.scanner.update(dt, this.bodies[this.target], this.distanceTo(this.bodies[this.target]));
      if (result === 'done') {
        hud.set({ sheet: this.bodies[this.target].sheet, journal: this.scanner.discovered(this.bodies), journalOpen: false });
      } else if (result === 'lost') {
        this.say('Analyse interrompue : cible sortie de la portée du scanner.');
      }
    } else if (this.mode === 'menu') {
      // Plan d'ensemble lent autour du vaisseau à l'arrêt
      this.chase.azimuth = 0.34 + Math.sin(this.time * 0.05) * 0.2;
      this.chase.elevation = 0.16 + Math.sin(this.time * 0.035) * 0.07;
    }

    const speed = ship.velocity.length();
    this.shipModel.group.quaternion.copy(ship.quaternion);
    this.shipModel.update(dt, this.time, this.mode === 'play' ? ship.power : 0.05, ship.yawRate, ship.pitchRate, ship.surge);
    this.chase.update(dt, ship.quaternion, speed / 3200, ship.surge, ship.boosting, this.time);

    // Origine flottante : le vaisseau reste en (0,0,0), c'est l'univers qui se déplace autour de lui.
    this.blackHole.update(this.scenePos.copy(this.blackHoleBody.world).sub(ship.position), this.time);
    this.diskLight.position.copy(this.scenePos).normalize().multiplyScalar(300);
    const range = this.scenePos.length() / BLACK_HOLE_RS;
    this.diskLight.intensity = THREE.MathUtils.clamp(9 / range, 0.15, 2.5);
    // Adaptation de l'exposition : près du disque d'accrétion, l'image se referme comme une pupille
    const adapt = THREE.MathUtils.smoothstep(range, 5, 40);
    this.renderer.toneMappingExposure = 1.05 * (0.2 + 0.8 * adapt);
    this.bloom.strength = 0.12 + 0.24 * adapt;
    this.planets.forEach((planet, body) => planet.update(this.scenePos.copy(body.world).sub(ship.position), this.time));
    this.dust.update(ship.position, ship.velocity);
    this.sky.follow(this.camera);
    this.updateMarker();

    this.composer.render(dt);
    this.dirty = false;

    // Interface : rafraîchie 8 fois par seconde, largement suffisant pour des chiffres
    this.frames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) { this.fps = Math.round(this.frames / this.fpsTimer); this.frames = 0; this.fpsTimer = 0; }
    this.hudTimer += dt;
    if (this.mode === 'play' && this.hudTimer >= 0.125) {
      this.hudTimer = 0;
      const body = this.bodies[this.target];
      const state = hud.get();
      hud.set({
        fps: this.fps,
        speed: speed * KM_PER_UNIT,
        cruise: ship.cruise,
        engines: ship.state,
        energy: ship.energy,
        coords: [ship.position.x / 100, ship.position.y / 100, ship.position.z / 100],
        targetName: body.sheet.name,
        targetType: body.sheet.type,
        targetDistance: this.distanceTo(body) * KM_PER_UNIT,
        targetScanned: this.scanner.isKnown(body),
        scanner: this.scanner.active ? 'Analyse' : this.distanceTo(body) > body.scanRange ? 'Hors de portée' : 'Prêt',
        scanProgress: this.scanner.progress,
        timeFactor,
        message: this.time > this.messageUntil ? '' : state.message,
      });
    }
  };

  /** Place le repère de cible de l'interface sur l'objet visé. */
  private updateMarker() {
    const body = this.bodies[this.target];
    this.projected.copy(body.world).sub(this.ship.position);
    const behind = this.projected.clone().sub(this.camera.position).dot(this.camera.getWorldDirection(this.scenePos)) <= 0;
    if (this.mode !== 'play' || behind) { this.marker.style.opacity = '0'; return; }
    this.projected.project(this.camera);
    const x = (this.projected.x * 0.5 + 0.5) * this.canvas.clientWidth;
    const y = (-this.projected.y * 0.5 + 0.5) * this.canvas.clientHeight;
    this.marker.style.opacity = '1';
    this.marker.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.input.dispose();
    this.sky.dispose();
    this.dust.dispose();
    this.blackHole.dispose();
    this.planets.forEach((p) => p.dispose());
    this.shipModel.dispose();
    this.environment.dispose();
    this.bloom.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
