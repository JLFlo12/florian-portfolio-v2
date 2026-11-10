import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hashSeed, makeRng } from '../utils/rng';
import type { QualityPreset } from '../engine/quality';

/** Ce que le joueur sait déjà, pour que les notes de bord évoluent avec l'histoire. */
export interface InteriorContext {
  knows: (id: string) => boolean;
  discoveries: number;
}

export interface InteriorNote {
  id: string;
  title: string;
  text: string;
  /** 'seat' : reprendre les commandes. 'knock' : un bruit accompagne la lecture. */
  action?: 'seat' | 'knock';
}

export interface InteriorStatus {
  system: string;
  speed: string;
  target: string;
  distance: string;
}

export interface WalkInput {
  forward: number;
  strafe: number;
  turn: number;
  lookX: number;
  lookY: number;
  run: boolean;
}

type Mat = 'wall' | 'floor' | 'ceiling' | 'dark' | 'trim' | 'light' | 'screen' | 'cloth' | 'white' | 'red' | 'ember' | 'glass';
type Rect = [number, number, number, number]; // x0, x1, z0, z1

interface Room { id: string; name: string; rect: Rect; h: number; light: number; color: number }
interface Opening { a: number; b: number; y0: number; y1: number }
interface Spot { id: string; x: number; y: number; z: number; label: string; title: string; text: (c: InteriorContext) => string; action?: 'seat' | 'knock' }

const EYE = 1.66;
const MARGIN = 0.38;
const DOOR: [number, number] = [0, 2.1];

// Plan du pont principal, en mètres. L'avant du vaisseau est vers -Z, comme en vol.
const ROOMS: Room[] = [
  { id: 'bridge', name: 'Passerelle', rect: [-6, 6, -34, -24], h: 3.2, light: 30, color: 0xa9bcd6 },
  { id: 'corridor', name: 'Coursive centrale', rect: [-1.2, 1.2, -24, 14], h: 2.6, light: 12, color: 0xd8c8a8 },
  { id: 'quarters', name: 'Quartiers de l’équipage', rect: [-8, -1.2, -22, -13], h: 2.6, light: 20, color: 0xe0c9a0 },
  { id: 'cryo', name: 'Cryogénie', rect: [-8, -1.2, -11, -2], h: 2.6, light: 18, color: 0x7fa8e0 },
  { id: 'lab', name: 'Laboratoire', rect: [-8, -1.2, 0, 10], h: 2.6, light: 22, color: 0xc8d4e0 },
  { id: 'mess', name: 'Salle commune', rect: [1.2, 9, -22, -10], h: 2.6, light: 20, color: 0xe6caa0 },
  { id: 'airlock', name: 'Sas', rect: [1.2, 6, -8, -2], h: 2.6, light: 16, color: 0xc8d4e0 },
  { id: 'storage', name: 'Soute', rect: [1.2, 8, 0, 10], h: 2.6, light: 11, color: 0xd8c8a8 },
  { id: 'engine', name: 'Salle des machines', rect: [-7, 7, 14, 28], h: 4.5, light: 60, color: 0xff9a4a },
];

/** Portes latérales de la coursive : [z début, z fin] côté bâbord (x = -1,2) puis tribord (x = 1,2). */
const DOORS_PORT: [number, number][] = [[-18.6, -17.4], [-7.1, -5.9], [4.4, 5.6]];
const DOORS_STARBOARD: [number, number][] = [[-16.6, -15.4], [-5.6, -4.4], [4.4, 5.6]];

const STORY = { beacon: 'ECHO-1', wreck: 'ORPH-M', rift: 'FAILLE', twin: 'AETH-0' };

/** Tout ce qu'on peut examiner à bord. Les textes changent quand l'enquête avance. */
const SPOTS: Spot[] = [
  { id: 'seat', x: 0, y: 0.9, z: -30.4, label: 'Reprendre les commandes', title: '', text: () => '', action: 'seat' },
  {
    id: 'log', x: 0, y: 0.95, z: -32.3, label: 'Lire le journal de bord', title: 'Journal de bord',
    text: (c) => [
      'AETHER-01, jour 847. Équipage : six. Éveillés : un. Mission : cartographier NEMESIS-01. Durée prévue : 300 jours. Dernier contact avec la Terre : jour 0.',
      c.knows(STORY.beacon) && 'Balise ORPHÉE analysée. Cette expédition ne figure dans aucune archive de bord.',
      c.knows(STORY.wreck) && 'Le signal répété précède nos émissions de onze secondes. Erreur d’horloge exclue, vérifiée trois fois.',
      c.knows(STORY.rift) && 'Le code relayé par l’anomalie est le nôtre. Je n’ai rien émis.',
      c.knows(STORY.twin) && 'L’épave porte notre numéro de coque. Je suis descendu vérifier le nôtre. Il est toujours là.',
    ].filter(Boolean).join('\n\n'),
  },
  {
    id: 'desk', x: -7.4, y: 0.8, z: -17.5, label: 'Lire la note sur le bureau', title: 'Votre bureau',
    text: (c) => 'Une liste, de votre main : « Vérifier les filtres. Réveiller Ilse au jour 900. Ne pas oublier de dormir. »'
      + (c.knows(STORY.twin) ? '\n\nDessous, une seconde note de la même écriture, que vous ne vous souvenez pas d’avoir écrite : « Tu l’as déjà fait. Tu le referas. Ne réveille personne. »' : ''),
  },
  { id: 'lockers', x: -2.3, y: 1.2, z: -13.7, label: 'Ouvrir les casiers', title: 'Casiers', text: () => 'Cinq casiers fermés à clé. Le sixième, le vôtre, est ouvert. Il contient deux combinaisons de vol à votre nom. Vous n’en avez emporté qu’une.' },
  { id: 'cryo', x: -1.9, y: 1.1, z: -10.1, label: 'Consulter le terminal', title: 'Cryogénie', text: () => 'Capsules 1 à 5 : sommeil nominal.\nCapsule 6 : ouverte, occupant éveillé.\nCapsule 7 : sommeil nominal.\n\nCette salle ne compte que six capsules.' },
  { id: 'pod', x: -6.5, y: 1.3, z: -7.2, label: 'Regarder dans la capsule', title: 'Capsule 3', text: () => 'Sous le givre, un visage. Les yeux sont ouverts. Le moniteur indique : sommeil profond, aucun rêve.' },
  { id: 'lab', x: -4.6, y: 1.0, z: 5, label: 'Consulter le terminal', title: 'Laboratoire', text: (c) => `Découvertes cataloguées : ${c.discoveries}.\nÉchantillons physiques : aucun.\n\nRemarque automatique : l’horloge de bord a été remise à zéro 61 fois. Aucune remise à zéro n’est prévue par la procédure.` },
  { id: 'table', x: 5.2, y: 0.8, z: -16, label: 'Regarder la table', title: 'Salle commune', text: () => 'Six couverts, dressés depuis le départ. Un seul a servi. La tasse est encore tiède. Vous n’avez pas fait de café aujourd’hui.' },
  { id: 'suits', x: 3.6, y: 1.2, z: -7.3, label: 'Compter les combinaisons', title: 'Sas', text: () => 'Six emplacements, cinq combinaisons. La sixième n’est pas à bord.\n\nRegistre : le sas a été ouvert une fois, de l’extérieur, il y a 61 jours.' },
  { id: 'crate', x: 5.4, y: 0.6, z: 7, label: 'Examiner la caisse', title: 'Soute', text: () => 'Une caisse sans étiquette, absente du manifeste. Les sangles sont neuves. Elle est tiède au toucher.' },
  {
    id: 'sealed', x: 1.05, y: 1.2, z: 11.6, label: 'Examiner la porte', title: 'Compartiment 4',
    text: (c) => 'Scellé sur ordre du commandant. Le commandant, c’est vous. Vous ne vous souvenez pas d’avoir donné cet ordre.'
      + (c.knows(STORY.rift) ? '\n\nOn frappe de l’autre côté. Trois coups, espacés. Puis plus rien.' : ''),
    action: 'knock',
  },
  { id: 'reactor', x: 0, y: 1.1, z: 16.7, label: 'Consulter le pupitre', title: 'Salle des machines', text: () => 'Réacteur à 31 %. Autonomie restante : 212 ans. C’est bien plus qu’il n’en faut pour rentrer.\n\nAucune trajectoire de retour n’a jamais été programmée.' },
];

const tile = (seed: string, base: number[], seam: string, cells: number) => {
  const rng = makeRng(hashSeed(seed));
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const step = size / cells;
  for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
    const k = 0.9 + rng() * 0.2;
    ctx.fillStyle = `rgb(${base.map((c) => Math.round(c * k)).join(',')})`;
    ctx.fillRect(x * step, y * step, step, step);
    ctx.strokeStyle = seam;
    ctx.lineWidth = 2;
    ctx.strokeRect(x * step + 1, y * step + 1, step - 2, step - 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
};

/**
 * Intérieur d'AETHER-01 : un pont à parcourir à pied, construit par code.
 * La scène est dessinée par-dessus celle de l'espace : les hublots sont de vrais trous dans les
 * cloisons, on y voit donc le trou noir ou les planètes là où le vaisseau se trouve réellement.
 */
export class Interior {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.05, 160);
  x = 0;
  z = -28.6;
  yaw = 0;
  pitch = 0;
  private stride = 0;
  private walk: Rect[] = [];
  private blockers: Rect[] = [];
  private disposables: { dispose: () => void }[] = [];
  private lamps: { light: THREE.PointLight; base: number; room: string }[] = [];
  private sun = new THREE.DirectionalLight(0xfff1dc, 0);
  private alarm = new THREE.PointLight(0xff3520, 0, 40, 1.6);
  private ember: THREE.MeshStandardMaterial;
  private stripLight: THREE.MeshStandardMaterial;
  private screen: { ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture } | null = null;
  private flickerAt = 6;
  private flicker = 0;

  constructor(preset: QualityPreset, environment: THREE.Texture) {
    this.scene.environment = environment;
    this.scene.environmentIntensity = 0.25;
    this.scene.fog = new THREE.Fog(0x05070d, 18, 70);
    const keep = <T extends { dispose: () => void }>(item: T) => { this.disposables.push(item); return item; };

    const wallMap = keep(tile('wall', [168, 174, 182], 'rgba(20,24,30,.55)', 2));
    const floorMap = keep(tile('floor', [92, 97, 106], 'rgba(8,10,14,.8)', 4));
    const standard = (options: THREE.MeshStandardMaterialParameters) => keep(new THREE.MeshStandardMaterial(options));
    this.ember = standard({ color: 0x1a0d04, emissive: 0xff8a32, emissiveIntensity: 1.6 });
    this.stripLight = standard({ color: 0x222018, emissive: 0xffe2b8, emissiveIntensity: 0.8 });
    const materials: Record<Mat, THREE.Material> = {
      wall: standard({ map: wallMap, roughness: 0.78, metalness: 0.25 }),
      floor: standard({ map: floorMap, roughness: 0.7, metalness: 0.3 }),
      ceiling: standard({ color: 0x4a4f58, roughness: 0.85, metalness: 0.3 }),
      dark: standard({ color: 0x23272e, roughness: 0.6, metalness: 0.7 }),
      trim: standard({ color: 0xe58a32, roughness: 0.55, metalness: 0.3 }),
      light: this.stripLight,
      screen: standard({ color: 0x06090d, emissive: 0x2c5a8c, emissiveIntensity: 0.42 }),
      cloth: standard({ color: 0x4a5566, roughness: 0.95, metalness: 0 }),
      white: standard({ color: 0xc9cdd3, roughness: 0.5, metalness: 0.2 }),
      red: standard({ color: 0x1a0504, emissive: 0xff2a1a, emissiveIntensity: 1.8 }),
      ember: this.ember,
      glass: standard({ color: 0x9cc4f0, emissive: 0x2a5a9a, emissiveIntensity: 0.2, transparent: true, opacity: 0.24, roughness: 0.15, metalness: 0.1 }),
    };

    const parts: Record<string, THREE.BufferGeometry[]> = {};
    const push = (mat: Mat, geometry: THREE.BufferGeometry) => { (parts[mat] ??= []).push(geometry); return geometry; };
    const box = (mat: Mat, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
      push(mat, new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
    const cyl = (mat: Mat, x: number, y: number, z: number, r: number, h: number, axis: 'x' | 'y' | 'z' = 'y', sides = 20) => {
      const g = new THREE.CylinderGeometry(r, r, h, sides);
      if (axis === 'x') g.rotateZ(Math.PI / 2);
      if (axis === 'z') g.rotateX(Math.PI / 2);
      return push(mat, g.translate(x, y, z));
    };
    const block = (x0: number, x1: number, z0: number, z1: number) => { this.blockers.push([x0, x1, z0, z1]); };

    // ── Cloisons, avec leurs portes et leurs hublots ──
    const T = 0.1;
    const pieces = (from: number, to: number, h: number, openings: Opening[], make: (a: number, b: number, y0: number, y1: number) => void) => {
      let cursor = from;
      for (const o of [...openings].sort((p, q) => p.a - q.a)) {
        if (o.a > cursor) make(cursor, o.a, 0, h);
        if (o.y0 > 0) make(o.a, o.b, 0, o.y0);
        if (o.y1 < h) make(o.a, o.b, o.y1, h);
        cursor = o.b;
      }
      if (cursor < to) make(cursor, to, 0, h);
    };
    const wallX = (z: number, x0: number, x1: number, h: number, openings: Opening[] = []) =>
      pieces(x0, x1, h, openings, (a, b, y0, y1) => box('wall', a, b, y0, y1, z - T, z + T));
    const wallZ = (x: number, z0: number, z1: number, h: number, openings: Opening[] = []) =>
      pieces(z0, z1, h, openings, (a, b, y0, y1) => box('wall', x - T, x + T, y0, y1, a, b));
    const door = ([a, b]: [number, number]): Opening => ({ a, b, y0: DOOR[0], y1: DOOR[1] });
    const windowAt = (a: number, b: number, y0: number, y1: number): Opening => ({ a, b, y0, y1 });

    for (const room of ROOMS) {
      const [x0, x1, z0, z1] = room.rect;
      box('floor', x0 - T, x1 + T, -0.2, 0, z0 - T, z1 + T);
      box('ceiling', x0 - T, x1 + T, room.h, room.h + 0.2, z0 - T, z1 + T);
      this.walk.push([x0 + MARGIN, x1 - MARGIN, z0 + MARGIN, z1 - MARGIN]);
      // Rampe lumineuse au plafond et sa lumière
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const along = z1 - z0 > x1 - x0;
      const count = room.id === 'corridor' ? 6 : 1;
      for (let i = 0; i < count; i++) {
        const lz = room.id === 'corridor' ? z0 + ((i + 0.5) * (z1 - z0)) / count : cz;
        if (along) box('light', cx - 0.12, cx + 0.12, room.h - 0.04, room.h, lz - (room.id === 'corridor' ? 0.9 : (z1 - z0) * 0.3), lz + (room.id === 'corridor' ? 0.9 : (z1 - z0) * 0.3));
        else box('light', cx - (x1 - x0) * 0.3, cx + (x1 - x0) * 0.3, room.h - 0.04, room.h, lz - 0.12, lz + 0.12);
        if (room.id !== 'corridor' || i % 2 === 0) {
          const light = new THREE.PointLight(room.color, room.light, room.id === 'engine' ? 30 : 17, 1.7);
          light.position.set(cx, room.h - 0.5, lz);
          this.scene.add(light);
          this.lamps.push({ light, base: room.light, room: room.id });
        }
      }
    }

    // Passerelle : grande baie avant, baies latérales
    wallX(-34, -6, 6, 3.2, [windowAt(-5.2, 5.2, 0.95, 2.85)]);
    wallZ(-6, -34, -24, 3.2, [windowAt(-33, -26, 0.95, 2.7)]);
    wallZ(6, -34, -24, 3.2, [windowAt(-33, -26, 0.95, 2.7)]);
    wallX(-24, -6, 6, 3.2, [door([-1, 1])]);
    // Coursive
    wallZ(-1.2, -24, 14, 2.6, DOORS_PORT.map(door));
    wallZ(1.2, -24, 14, 2.6, DOORS_STARBOARD.map(door));
    // Bâbord : quartiers, cryogénie, laboratoire
    wallX(-22, -8, -1.2, 2.6); wallX(-13, -8, -1.2, 2.6); wallZ(-8, -22, -13, 2.6, [windowAt(-20, -15, 1.0, 2.0)]);
    wallX(-11, -8, -1.2, 2.6); wallX(-2, -8, -1.2, 2.6); wallZ(-8, -11, -2, 2.6);
    wallX(0, -8, -1.2, 2.6); wallX(10, -8, -1.2, 2.6); wallZ(-8, 0, 10, 2.6, [windowAt(2, 8, 1.0, 2.0)]);
    // Tribord : salle commune (grande baie d'observation), sas (hublot), soute
    wallX(-22, 1.2, 9, 2.6); wallX(-10, 1.2, 9, 2.6); wallZ(9, -22, -10, 2.6, [windowAt(-21, -11, 0.55, 2.4)]);
    wallX(-8, 1.2, 6, 2.6); wallX(-2, 1.2, 6, 2.6); wallZ(6, -8, -2, 2.6, [windowAt(-5.4, -4.6, 1.25, 1.95)]);
    wallX(0, 1.2, 8, 2.6); wallX(10, 1.2, 8, 2.6); wallZ(8, 0, 10, 2.6);
    // Machines
    wallX(14, -7, 7, 4.5, [door([-1, 1])]); wallX(28, -7, 7, 4.5); wallZ(-7, 14, 28, 4.5); wallZ(7, 14, 28, 4.5);

    // Seuils : passages entre la coursive et les salles
    DOORS_PORT.forEach(([a, b]) => this.walk.push([-2, -0.6, a + 0.32, b - 0.32]));
    DOORS_STARBOARD.forEach(([a, b]) => this.walk.push([0.6, 2, a + 0.32, b - 0.32]));
    this.walk.push([-0.68, 0.68, -24.8, -23.2], [-0.68, 0.68, 13.2, 14.8]);

    // ── Passerelle ──
    box('dark', -4.2, 4.2, 0, 0.85, -33.1, -32.1); block(-4.2, 4.2, -33.6, -32.1);
    box('screen', -3.6, -1.5, 0.86, 0.88, -32.9, -32.35); box('screen', 1.5, 3.6, 0.86, 0.88, -32.9, -32.35);
    box('trim', -4.2, 4.2, 0.83, 0.86, -32.12, -32.08);
    cyl('dark', 0, 0.22, -30.6, 0.26, 0.45); box('dark', -0.36, 0.36, 0.45, 0.6, -30.95, -30.25); box('dark', -0.36, 0.36, 0.6, 1.5, -30.3, -30.18);
    block(-0.4, 0.4, -30.95, -30.2);
    for (const side of [-1, 1]) {
      box('dark', side * 4.6, side * 5.8, 0, 0.85, -30.5, -26.5); block(Math.min(side * 4.6, side * 5.8), Math.max(side * 4.6, side * 5.8), -30.5, -26.5);
      box('screen', side * 4.85, side * 5.55, 0.86, 0.88, -29.9, -28.6); box('screen', side * 4.85, side * 5.55, 0.86, 0.88, -28.3, -27.1);
    }
    // ── Coursive : liserés au sol, conduites, porte scellée ──
    box('trim', -1.1, -1.02, 0, 0.012, -24, 14); box('trim', 1.02, 1.1, 0, 0.012, -24, 14);
    cyl('dark', 0.82, 2.42, -5, 0.07, 38, 'z', 10); cyl('dark', 0.62, 2.46, -5, 0.045, 38, 'z', 8);
    box('dark', 1.04, 1.12, 0, 2.1, 11, 12.2); box('red', 1.02, 1.05, 2.12, 2.17, 11.1, 12.1); box('trim', 1.02, 1.05, 0.95, 1.15, 11.5, 11.7);
    // ── Quartiers : couchettes, casiers, bureau ──
    for (const [bx, bz] of [[-7.8, -21.9], [-5.4, -21.9], [-7.8, -13.95], [-5.4, -13.95]]) {
      box('dark', bx, bx + 2, 0.25, 0.45, bz, bz + 0.85); box('cloth', bx + 0.05, bx + 1.95, 0.45, 0.58, bz + 0.05, bz + 0.8);
      block(bx, bx + 2, bz, bz + 0.85);
    }
    box('dark', -3.2, -1.4, 0, 2.05, -13.5, -13.1); block(-3.2, -1.4, -13.5, -13.1);
    for (let i = 0; i < 6; i++) box('trim', -3.17 + i * 0.3, -3.15 + i * 0.3, 0.1, 1.95, -13.52, -13.5);
    box('dark', -7.9, -7.2, 0.72, 0.76, -18.6, -16.4); box('dark', -7.85, -7.8, 0, 0.72, -18.55, -18.5); box('dark', -7.85, -7.8, 0, 0.72, -16.5, -16.45);
    box('white', -7.7, -7.4, 0.762, 0.766, -17.7, -17.3); block(-7.9, -7.2, -18.6, -16.4);
    // ── Cryogénie : six capsules, dont une ouverte ──
    for (let i = 0; i < 6; i++) {
      const zc = -10 + i * 1.4;
      box('dark', -7.85, -6.8, 0, 0.25, zc - 0.55, zc + 0.55); box('dark', -7.85, -7.6, 0.25, 2.25, zc - 0.55, zc + 0.55);
      if (i < 5) {
        cyl('glass', -7.15, 1.25, zc, 0.46, 1.95, 'y', 18);
        push('dark', new THREE.CapsuleGeometry(0.2, 1.15, 4, 10).translate(-7.2, 1.2, zc));
      } else {
        box('white', -7.6, -6.7, 2.2, 2.28, zc - 0.5, zc + 0.5);
        box('cloth', -7.55, -6.85, 0.25, 0.32, zc - 0.4, zc + 0.4);
      }
      box('screen', -6.82, -6.8, 0.4, 0.55, zc - 0.2, zc + 0.2);
    }
    block(-8, -6.7, -10.7, -2.3);
    box('dark', -2.3, -1.5, 0, 1.05, -10.5, -9.8); box('screen', -2.25, -1.55, 1.06, 1.1, -10.45, -9.85); block(-2.3, -1.4, -10.5, -9.8);
    // ── Laboratoire ──
    box('dark', -7.8, -2, 0, 0.9, 0.1, 0.9); box('dark', -7.8, -2, 0, 0.9, 9.1, 9.9); box('dark', -5.6, -3.6, 0, 0.9, 4, 6);
    block(-7.8, -2, 0.1, 0.9); block(-7.8, -2, 9.1, 9.9); block(-5.6, -3.6, 4, 6);
    box('screen', -5.1, -4.1, 0.91, 0.93, 4.5, 5.5);
    for (let i = 0; i < 6; i++) cyl('glass', -7.2 + i * 0.9, 1.15, 0.5, 0.12, 0.5, 'y', 12);
    // ── Salle commune ──
    box('dark', 4, 6.4, 0.72, 0.78, -16.7, -15.3); block(4, 6.4, -16.7, -15.3);
    for (const [lx, lz] of [[4.2, -16.5], [6.2, -16.5], [4.2, -15.5], [6.2, -15.5]]) cyl('dark', lx, 0.36, lz, 0.05, 0.72);
    for (let i = 0; i < 6; i++) cyl('dark', 4.4 + (i % 3) * 0.8, 0.22, i < 3 ? -17.2 : -14.8, 0.2, 0.45);
    for (let i = 0; i < 6; i++) cyl('white', 4.4 + (i % 3) * 0.8, 0.79, i < 3 ? -16.45 : -15.55, 0.13, 0.012);
    cyl('white', 4.75, 0.83, -16.2, 0.045, 0.1, 'y', 12);
    box('dark', 1.6, 6, 0, 0.9, -21.9, -21.2); block(1.6, 6, -21.9, -21.2);
    // ── Sas : cinq combinaisons sur six, écoutille ──
    box('dark', 1.6, 5.7, 2.05, 2.12, -7.8, -7.6); block(1.6, 5.7, -8, -7.3);
    for (let i = 0; i < 6; i++) {
      if (i === 3) continue;
      const sx = 1.9 + i * 0.7;
      push('white', new THREE.CapsuleGeometry(0.24, 0.9, 4, 10).translate(sx, 1.05, -7.65));
      push('white', new THREE.SphereGeometry(0.22, 12, 10).translate(sx, 1.82, -7.65));
      box('dark', sx - 0.14, sx + 0.14, 1.76, 1.9, -7.47, -7.44);
    }
    push('dark', new THREE.TorusGeometry(0.72, 0.09, 8, 28).rotateY(Math.PI / 2).translate(5.88, 1.6, -5));
    box('trim', 5.86, 5.9, 0.4, 0.6, -5.5, -4.5);
    // ── Soute ──
    const rng = makeRng(hashSeed('hold'));
    for (let i = 0; i < 9; i++) {
      const cx = 2 + rng() * 5, cz = 0.8 + rng() * 1.6 + (i > 4 ? 6.4 : 0), s = 0.5 + rng() * 0.5;
      box('dark', cx - s, cx + s, 0, s * 1.6, cz - s * 0.7, cz + s * 0.7); block(cx - s, cx + s, cz - s * 0.7, cz + s * 0.7);
    }
    box('dark', 5.6, 7, 0, 0.9, 6.4, 7.6); box('ember', 5.58, 7.02, 0.44, 0.46, 6.38, 7.62); block(5.6, 7, 6.4, 7.6);
    // ── Machines : réacteur, conduites, garde-corps, pupitre ──
    cyl('dark', 0, 2.1, 21, 2.2, 4.2, 'y', 28);
    for (const y of [0.9, 2.1, 3.3]) cyl('ember', 0, y, 21, 2.24, 0.1, 'y', 28);
    for (const side of [-1, 1]) { cyl('dark', side * 3.4, 3.6, 21, 0.28, 13.6, 'z', 12); cyl('dark', side * 5.2, 0.5, 21, 0.4, 13.6, 'z', 12); }
    for (const [a, b, c, d] of [[-3.3, 3.3, 17.7, 17.76], [-3.3, 3.3, 24.24, 24.3], [-3.3, -3.24, 17.7, 24.3], [3.24, 3.3, 17.7, 24.3]]) box('trim', a, b, 0.98, 1.04, c, d);
    block(-2.5, 2.5, 18.5, 23.5); block(-5.7, -4.7, 14.3, 27.7); block(4.7, 5.7, 14.3, 27.7);
    box('dark', -0.7, 0.7, 0, 1.05, 15.6, 16.2); box('screen', -0.6, 0.6, 1.06, 1.1, 15.65, 16.15); block(-0.7, 0.7, 15.6, 16.2);

    // Textures plaquées selon la position : même densité sur toutes les cloisons, quelle que soit leur taille
    const worldUv = (geometry: THREE.BufferGeometry, scale: number) => {
      const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv');
      for (let i = 0; i < p.count; i++) {
        const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
        if (ay > 0.5) uv.setXY(i, p.getX(i) / scale, p.getZ(i) / scale);
        else if (ax > 0.5) uv.setXY(i, p.getZ(i) / scale, p.getY(i) / scale);
        else uv.setXY(i, p.getX(i) / scale, p.getY(i) / scale);
      }
    };
    const shadows = preset.shadowMap > 0;
    for (const key of Object.keys(parts) as Mat[]) {
      const merged = keep(mergeGeometries(parts[key].map((g) => (g.index ? g : g))) as THREE.BufferGeometry);
      parts[key].forEach((g) => g.dispose());
      if (key === 'wall') worldUv(merged, 2.4);
      if (key === 'floor') worldUv(merged, 2);
      const mesh = new THREE.Mesh(merged, materials[key]);
      mesh.castShadow = shadows && key !== 'glass' && key !== 'light';
      mesh.receiveShadow = shadows;
      this.scene.add(mesh);
    }

    // ── Plaques des portes et écran de navigation ──
    const plaque = (text: string, x: number, y: number, z: number, rotation: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 96;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#0b0e13'; ctx.fillRect(0, 0, 512, 96);
      ctx.fillStyle = '#e58a32'; ctx.fillRect(0, 0, 10, 96);
      ctx.fillStyle = '#dce5ef'; ctx.font = '600 42px "Segoe UI", system-ui, sans-serif'; ctx.textBaseline = 'middle';
      ctx.fillText(text.toUpperCase(), 30, 50);
      const texture = keep(new THREE.CanvasTexture(canvas));
      texture.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.25, 0.235)), keep(new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })));
      mesh.position.set(x, y, z);
      mesh.rotation.y = rotation;
      this.scene.add(mesh);
    };
    const names = ['Quartiers', 'Cryogénie', 'Laboratoire'];
    DOORS_PORT.forEach(([a, b], i) => plaque(names[i], -1.09, 2.32, (a + b) / 2, Math.PI / 2));
    const namesStarboard = ['Salle commune', 'Sas', 'Soute'];
    DOORS_STARBOARD.forEach(([a, b], i) => plaque(namesStarboard[i], 1.09, 2.32, (a + b) / 2, -Math.PI / 2));
    plaque('Compartiment 4', 1.0, 2.34, 11.6, -Math.PI / 2);
    plaque('Passerelle', 0, 2.34, -23.88, 0);
    plaque('Machines', 0, 2.34, 13.88, Math.PI);

    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 256;
    const texture = keep(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    this.screen = { ctx: canvas.getContext('2d')!, texture };
    const nav = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.7, 0.68)), keep(new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })));
    nav.position.set(0, 0.99, -32.6);
    nav.rotation.x = -1.2;
    this.scene.add(nav);
    this.setStatus({ system: '', speed: '', target: '', distance: '' });

    // ── Lumières ──
    this.scene.add(new THREE.HemisphereLight(0x9fb2cc, 0x2a241c, 0.5));
    this.sun.position.set(0, 30, 0);
    this.sun.target.position.set(0, 1, -3);
    if (shadows) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.setScalar(Math.min(preset.shadowMap, 2048));
      const s = this.sun.shadow.camera;
      s.left = s.bottom = -40; s.right = s.top = 40; s.near = 20; s.far = 160;
      this.sun.shadow.bias = -0.0006;
      this.sun.shadow.normalBias = 0.04;
    }
    this.alarm.position.set(0, 2.2, -5);
    this.scene.add(this.sun, this.sun.target, this.alarm);
  }

  /** Entrée dans le vaisseau : debout derrière le siège du pilote, face à la baie avant. */
  enter() {
    this.x = 0.9; this.z = -29.4; this.yaw = 0; this.pitch = 0;
  }

  setAspect(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Écran de navigation de la passerelle, redessiné deux fois par seconde. */
  setStatus(status: InteriorStatus) {
    if (!this.screen) return;
    const { ctx, texture } = this.screen;
    ctx.fillStyle = '#05080c'; ctx.fillRect(0, 0, 640, 256);
    ctx.fillStyle = '#e58a32'; ctx.fillRect(0, 0, 640, 6);
    ctx.textBaseline = 'top';
    const row = (label: string, value: string, y: number) => {
      ctx.fillStyle = 'rgba(220,229,239,.55)'; ctx.font = '22px "Geist Mono", Consolas, monospace'; ctx.fillText(label, 28, y);
      ctx.fillStyle = '#dce5ef'; ctx.font = '600 32px "Segoe UI", system-ui, sans-serif'; ctx.fillText(value, 28, y + 26);
    };
    row('SYSTÈME', status.system, 22);
    row('VITESSE', status.speed, 96);
    row('CIBLE', `${status.target}  ·  ${status.distance}`, 170);
    texture.needsUpdate = true;
  }

  private free(x: number, z: number) {
    if (!this.walk.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1)) return false;
    return !this.blockers.some(([x0, x1, z0, z1]) => x > x0 - 0.3 && x < x1 + 0.3 && z > z0 - 0.3 && z < z1 + 0.3);
  }

  /** Salle où se trouve le joueur. */
  room() {
    const room = ROOMS.find(({ rect: [x0, x1, z0, z1] }) => this.x >= x0 && this.x <= x1 && this.z >= z0 && this.z <= z1);
    return room ?? ROOMS[1];
  }

  /** Ce que le joueur regarde et peut examiner, s'il y a quelque chose à portée. */
  lookedAt(): Spot | null {
    const dirX = -Math.sin(this.yaw) * Math.cos(this.pitch), dirY = Math.sin(this.pitch), dirZ = -Math.cos(this.yaw) * Math.cos(this.pitch);
    let best: Spot | null = null, score = 0.55;
    for (const spot of SPOTS) {
      const dx = spot.x - this.x, dy = spot.y - EYE, dz = spot.z - this.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > 2.6) continue;
      const facing = (dx * dirX + dy * dirY + dz * dirZ) / (d || 1) - d * 0.06;
      if (facing > score) { score = facing; best = spot; }
    }
    return best;
  }

  read(spot: Spot, context: InteriorContext): InteriorNote {
    return { id: spot.id, title: spot.title, text: spot.text(context), action: spot.action };
  }

  /**
   * @param sunLocal direction de l'étoile dans le repère du vaisseau : sa lumière entre par les hublots
   * @param gain compensation de l'exposition (près du trou noir l'image extérieure est assombrie)
   * @returns true à chaque pas, pour le bruit des pas
   */
  update(dt: number, input: WalkInput, time: number, sunLocal: THREE.Vector3, alarm: boolean, gain: number) {
    this.yaw -= input.lookX * 0.0026 + input.turn * dt * 1.9;
    this.pitch = THREE.MathUtils.clamp(this.pitch - input.lookY * 0.0026, -1.25, 1.25);
    const length = Math.hypot(input.forward, input.strafe);
    let stepped = false;
    if (length > 0) {
      const speed = (input.run ? 5.4 : 3.1) * dt / Math.max(1, length);
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const dx = (-sin * input.forward + cos * input.strafe) * speed;
      const dz = (-cos * input.forward - sin * input.strafe) * speed;
      // Un axe à la fois : on glisse le long des cloisons au lieu de rester bloqué
      const before = this.stride;
      if (this.free(this.x + dx, this.z)) { this.x += dx; this.stride += Math.abs(dx); }
      if (this.free(this.x, this.z + dz)) { this.z += dz; this.stride += Math.abs(dz); }
      stepped = Math.floor(this.stride / 0.78) !== Math.floor(before / 0.78);
    }
    const bob = Math.sin((this.stride / 0.78) * Math.PI) * 0.028;
    this.camera.position.set(this.x, EYE + bob, this.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    // Éclairage : la coursive vacille de temps en temps, le réacteur respire
    if (time > this.flickerAt) { this.flicker = 0.5 + Math.random() * 0.9; this.flickerAt = time + 9 + Math.random() * 26; }
    this.flicker = Math.max(0, this.flicker - dt);
    const waver = this.flicker > 0 ? (Math.sin(time * 71) * Math.sin(time * 23) > 0.1 ? 0.12 : 1) : 1;
    const boost = Math.min(3.2, Math.pow(gain, 0.8));
    for (const lamp of this.lamps) {
      const pulse = lamp.room === 'engine' ? 0.8 + 0.2 * Math.sin(time * 1.3) : lamp.room === 'corridor' ? waver : 1;
      lamp.light.intensity = lamp.base * pulse * boost * (alarm ? 0.35 : 1);
    }
    this.stripLight.emissiveIntensity = 0.8 * waver * (alarm ? 0.25 : 1);
    this.ember.emissiveIntensity = 1.3 + 0.6 * Math.sin(time * 1.3);
    this.alarm.intensity = alarm ? (Math.sin(time * 4.2) > 0 ? 60 * boost : 4) : 0;
    this.alarm.position.set(this.x, 2.2, this.z);
    this.sun.position.copy(sunLocal).multiplyScalar(70).add(this.sun.target.position);
    this.sun.intensity = 2.6 * boost;
    return stepped;
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
