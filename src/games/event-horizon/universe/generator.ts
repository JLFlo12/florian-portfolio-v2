import * as THREE from 'three';
import { hashSeed, makeRng, type Rng } from '../utils/rng';
import { AU, UNIVERSE_SEED, createStartSystem, type Body, type BodyKind, type PlanetSpec, type ScienceSheet } from './bodies';

/** Case de la grille galactique. Chaque case contient exactement un système stellaire. */
export interface Sector { x: number; y: number; z: number }

export interface SystemInfo {
  key: string;
  sector: Sector;
  name: string;
  starType: string;
  starColor: [number, number, number];
  /** Position dans la galaxie, en années-lumière. */
  position: [number, number, number];
  home: boolean;
}

export interface BeltSpec { parentId: string; inner: number; outer: number; tilt: number; namedId?: string }

export interface StarSystem {
  info: SystemInfo;
  bodies: Body[];
  /** Point d'arrivée du vaisseau et point vers lequel il regarde. */
  arrival: THREE.Vector3;
  lookAt: THREE.Vector3;
  /** Orientation du fond d'étoiles : d'un système à l'autre, le ciel n'est plus le même. */
  skyRotation: [number, number, number];
  belt?: BeltSpec;
}

/** Côté d'une case, en années-lumière : les étoiles voisines sont à quelques années-lumière, comme autour du Soleil. */
const CELL = 6;
export const HOME: Sector = { x: 0, y: 0, z: 0 };
export const keyOf = (s: Sector) => `${s.x}.${s.y}.${s.z}`;
export const parseKey = (key: string): Sector => {
  const [x, y, z] = key.split('.').map(Number);
  return { x: x || 0, y: y || 0, z: z || 0 };
};

const fr = (value: number, digits = 0) => value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pick = <T>(rng: Rng, list: T[]) => list[Math.floor(rng() * list.length)];
const between = (rng: Rng, [a, b]: number[]) => a + rng() * (b - a);

// ── Étoiles ──

interface StarClass { p: number; type: string; spec: string; radius: number[]; temp: number[]; color: [number, number, number]; mass: number; note: string }
const STARS: StarClass[] = [
  { p: 0.44, type: 'Naine rouge', spec: 'M', radius: [0.18, 0.5], temp: [2900, 3800], color: [1, 0.56, 0.36], mass: 0.3, note: 'Éruptions fréquentes. Elle brûlera encore dans cent milliards d’années.' },
  { p: 0.2, type: 'Naine orange', spec: 'K', radius: [0.65, 0.85], temp: [4000, 5100], color: [1, 0.76, 0.52], mass: 0.75, note: 'Étoile calme, très stable.' },
  { p: 0.14, type: 'Naine jaune', spec: 'G', radius: [0.9, 1.15], temp: [5300, 6000], color: [1, 0.93, 0.82], mass: 1, note: 'Proche du Soleil par la taille et la couleur.' },
  { p: 0.08, type: 'Étoile blanc-jaune', spec: 'F', radius: [1.2, 1.5], temp: [6100, 7300], color: [0.98, 0.97, 1], mass: 1.35, note: 'Plus chaude et plus brève que le Soleil.' },
  { p: 0.05, type: 'Étoile blanche', spec: 'A', radius: [1.6, 2.3], temp: [7600, 9800], color: [0.8, 0.87, 1], mass: 2, note: 'Rayonnement ultraviolet intense.' },
  { p: 0.05, type: 'Géante rouge', spec: 'K III', radius: [18, 45], temp: [3600, 4500], color: [1, 0.5, 0.3], mass: 1.3, note: 'Étoile en fin de vie. Elle a déjà englouti ses planètes intérieures.' },
  { p: 0.04, type: 'Naine blanche', spec: 'D', radius: [0.009, 0.014], temp: [9000, 22000], color: [0.76, 0.86, 1], mass: 0.6, note: 'Cœur nu d’une étoile morte, de la taille d’une planète.' },
];
/** Rayon du Soleil en unités de scène (696 000 km). */
const SUN_R = 69_600;

const SYLLABLES_A = ['Ka', 'Or', 'Ve', 'Tal', 'Mi', 'Sa', 'Dre', 'Lu', 'Ny', 'Era', 'Ob', 'Is', 'Va', 'Cal', 'Ren', 'Tho', 'Al', 'Sy', 'Me', 'Ar'];
const SYLLABLES_B = ['el', 'yn', 'ra', 'os', 'ane', 'ir', 'eth', 'une', 'ix', 'ora', 'en', 'ys', 'ade', 'ium', 'ar', 'oe'];
const SYLLABLES_C = ['', '', '', 'is', 'a', 'on', 'e', 'us'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

const pickStar = (rng: Rng) => {
  let roll = rng();
  for (const star of STARS) { if ((roll -= star.p) <= 0) return star; }
  return STARS[0];
};

/** Fiche d'identité d'un système : peu coûteuse, elle sert à la carte galactique. */
export const systemInfo = (sector: Sector): SystemInfo => {
  const key = keyOf(sector);
  const home = sector.x === 0 && sector.y === 0 && sector.z === 0;
  const rng = makeRng(hashSeed(`${UNIVERSE_SEED}:${key}`));
  const jitter = () => (home ? 0.5 : 0.15 + rng() * 0.7);
  const position: [number, number, number] = [(sector.x + jitter()) * CELL, (sector.y + jitter()) * CELL, (sector.z + jitter()) * CELL];
  const star = pickStar(rng);
  const name = pick(rng, SYLLABLES_A) + pick(rng, SYLLABLES_B) + pick(rng, SYLLABLES_C);
  if (home) return { key, sector, name: 'Hélice', starType: 'Naine jaune', starColor: [1, 0.93, 0.82], position, home };
  return { key, sector, name, starType: star.type, starColor: star.color, position, home };
};

export const distanceLy = (a: SystemInfo, b: SystemInfo) =>
  Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2]);

/** Les systèmes des cases voisines, du plus proche au plus lointain. La grille n'a pas de bord. */
export const neighbours = (centre: Sector, radius = 2): SystemInfo[] => {
  const here = systemInfo(centre);
  const list: SystemInfo[] = [];
  for (let x = -radius; x <= radius; x++) for (let y = -radius; y <= radius; y++) for (let z = -radius; z <= radius; z++) {
    if (x || y || z) list.push(systemInfo({ x: centre.x + x, y: centre.y + y, z: centre.z + z }));
  }
  return list.sort((a, b) => distanceLy(here, a) - distanceLy(here, b));
};

// ── Planètes ──

const NOTES: Record<string, string[]> = {
  ocean: ['Aucune lumière côté nuit. Aucun signal artificiel.', 'Océan global, quelques archipels. Personne.', 'Marées fortes. Nuages permanents sur l’équateur.', 'Chlorophylle possible sur les continents. Aucune réponse sur toutes les fréquences.'],
  moon: ['Surface saturée de cratères, très ancienne.', 'Rotation synchrone : une face ne voit jamais son étoile.', 'Tempêtes de poussière à l’échelle du globe.', 'Aucune activité géologique depuis des milliards d’années.'],
  lava: ['Croûte fracturée par les marées de l’étoile.', 'Face jour en fusion permanente.', 'Volcans actifs sur tout l’hémisphère éclairé.'],
  ice: ['Réseau de fractures profondes. Un océan liquide est possible sous la glace.', 'Givre d’azote saisonnier.', 'Surface lisse, presque sans cratères : elle se renouvelle.'],
  gas: ['Tempête anticyclonique plus large qu’une planète tellurique.', 'Vents supérieurs à 1 500 km/h.', 'Aurores intenses aux deux pôles.', 'Pas de surface solide.'],
};
const COMPOSITION: Record<string, string[]> = {
  ocean: ['Silicates, noyau fer-nickel, eau liquide en surface', 'Roches silicatées, océans salés'],
  moon: ['Basalte et régolithe', 'Silicates, oxydes de fer', 'Roche carbonée, poussière'],
  lava: ['Basalte, soufre, silicates en fusion', 'Roche en fusion, fer'],
  ice: ['Glace d’eau et d’azote, noyau rocheux', 'Glace d’eau, méthane gelé'],
  gas: ['Hydrogène et hélium, méthane', 'Hydrogène, hélium, ammoniac', 'Hydrogène, hélium, glaces en profondeur'],
};
const ATMOSPHERE: Record<string, string[]> = {
  ocean: ['Azote et oxygène, vapeur d’eau', 'Azote, dioxyde de carbone, vapeur d’eau'],
  moon: ['Aucune', 'Traces de dioxyde de carbone', 'Aucune'],
  lava: ['Dioxyde de soufre ténu', 'Vapeurs de roche'],
  ice: ['Traces d’azote', 'Aucune'],
  gas: ['Très épaisse, bandes de vents', 'Très épaisse, brumes de méthane'],
};
const KIND_LABEL: Record<string, string> = { ocean: 'Planète océanique', moon: 'Planète rocheuse', lava: 'Planète volcanique', ice: 'Planète glacée', gas: 'Géante gazeuse' };
const DENSITY: Record<string, number> = { ocean: 0.95, moon: 0.9, lava: 1.05, ice: 0.35 };
const TINTS: Record<string, [number, number, number][]> = {
  ocean: [[1, 1, 1], [0.92, 1.04, 0.98], [1.06, 0.98, 0.92]],
  moon: [[1, 1, 1], [1.3, 0.86, 0.62], [1.15, 1.05, 0.72], [0.8, 0.86, 1]],
  lava: [[1, 1, 1]],
  ice: [[1, 1, 1], [0.92, 1, 1.08], [1.08, 0.96, 1.02]],
  gas: [[1, 1, 1], [0.55, 0.78, 1.25], [1.2, 0.82, 0.62], [0.78, 1, 0.9], [1.1, 1.02, 0.75]],
};
const ATMOSPHERE_COLOR: Record<string, [number, number, number] | undefined> = {
  ocean: [0.2, 0.42, 0.85], gas: [0.34, 0.33, 0.36], lava: [0.5, 0.14, 0.05], ice: [0.3, 0.42, 0.6], moon: undefined,
};

const LOGS_PROBE = [
  'Mémoire presque vide. Une seule entrée : des coordonnées, celles d’une étoile nommée Hélice.',
  'La sonde a tenté d’émettre pendant 61 ans. Personne n’écoutait dans cette direction.',
  'Dernière image enregistrée : le ciel, sans rien de particulier. Puis une seconde image, identique, où il manque une étoile.',
  'Aucune donnée. La mémoire a été effacée volontairement, bloc par bloc.',
];
const LOGS_WRECK = [
  '« Nous avons fait demi-tour trop tard. Si quelqu’un trouve ceci : ne suivez pas le signal. »',
  '« Jour 340. Plus de réponse de l’expédition. Nous restons ici. Il n’y a nulle part où aller. »',
  'Journal illisible, sauf une ligne répétée sur quatre cents pages : « Il arrive avant nous. »',
];

interface Draft { kind: BodyKind; radius: number; orbitAu: number; temp: number }

const sheetFor = (id: string, name: string, designation: string, draft: Draft, rng: Rng, system: string, type = KIND_LABEL[draft.kind]): ScienceSheet => {
  const km = draft.radius * 20;
  const earth = draft.kind === 'gas' ? Math.pow(draft.radius / 7150, 3) * 318 * (0.6 + rng() * 0.6) : Math.pow(draft.radius / 637, 3) * (DENSITY[draft.kind] ?? 1);
  const mass = earth > 80 ? `${fr(earth / 318, 2)} masse de Jupiter` : `${fr(earth, earth < 0.1 ? 3 : 2)} masse terrestre`;
  return {
    id, name, designation, type, system,
    diameter: `${fr(Math.round(km / 100) * 100)} km`,
    mass,
    temperature: `${fr(Math.round(draft.temp))} K ${draft.kind === 'gas' ? 'au sommet des nuages' : 'en moyenne'}`,
    composition: pick(rng, COMPOSITION[draft.kind]),
    atmosphere: pick(rng, ATMOSPHERE[draft.kind]),
    notes: pick(rng, NOTES[draft.kind]),
  };
};

const specFor = (kind: BodyKind, radius: number, rng: Rng): PlanetSpec => {
  const spec: PlanetSpec = {
    seed: 1 + rng() * 40,
    spin: 0.0006 + rng() * 0.003,
    tilt: (rng() - 0.5) * 0.9,
    tint: pick(rng, TINTS[kind] ?? [[1, 1, 1]]),
    atmosphere: kind === 'moon' && radius < 350 ? undefined : ATMOSPHERE_COLOR[kind] ?? (rng() < 0.5 ? [0.5, 0.35, 0.25] : undefined),
  };
  if (kind === 'gas' && rng() < 0.45) spec.rings = { inner: radius * (1.25 + rng() * 0.15), outer: radius * (1.9 + rng() * 0.6) };
  return spec;
};

const RADIUS: Record<string, number[]> = { ocean: [450, 800], moon: [200, 700], lava: [250, 600], ice: [150, 520], gas: [1800, 7000] };
const RESEARCH: Record<string, number> = { ocean: 20, moon: 10, lava: 12, ice: 12, gas: 12 };

/** Type de planète selon la température d'équilibre à cette distance de l'étoile. */
const kindAt = (temp: number, rng: Rng): BodyKind => {
  if (temp > 700) return 'lava';
  if (temp > 340) return 'moon';
  if (temp > 225) return rng() < 0.4 ? 'ocean' : 'moon';
  return rng() < 0.55 ? 'gas' : 'ice';
};

/**
 * Construit un système complet à partir de sa case. Tout dépend de la seed et de la case :
 * la même case redonne toujours le même système, sans rien stocker.
 */
export const generateSystem = (sector: Sector): StarSystem => {
  const info = systemInfo(sector);
  if (info.home) {
    const bodies = createStartSystem();
    bodies.forEach((b) => { b.sheet.system = info.name; });
    return {
      info, bodies, arrival: new THREE.Vector3(), lookAt: new THREE.Vector3(0, 0, -1), skyRotation: [0, 0, 0],
      belt: { parentId: 'HEL-V', inner: 6200, outer: 7900, tilt: -0.42, namedId: 'M-217' },
    };
  }

  // Même tirage que systemInfo pour retrouver la même étoile, puis la suite pour le reste
  const rng = makeRng(hashSeed(`${UNIVERSE_SEED}:${info.key}`));
  rng(); rng(); rng();
  const star = pickStar(rng);
  rng(); rng(); rng();
  const starRadius = between(rng, star.radius);
  const starTemp = between(rng, star.temp);
  const luminosity = starRadius * starRadius * Math.pow(starTemp / 5772, 4);
  const bodies: Body[] = [];
  const id = (suffix: string) => `${info.key}:${suffix}`;

  bodies.push({
    kind: 'star', world: new THREE.Vector3(), radius: starRadius * SUN_R, scanRange: Infinity, research: 8,
    star: { color: star.color },
    sheet: {
      id: id('S'), name: info.name, designation: `EH-${info.key}`, type: `${star.type} (${star.spec})`, system: info.name,
      diameter: starRadius > 0.1 ? `${fr(starRadius * 1.392, 2)} million${starRadius * 1.392 >= 2 ? 's' : ''} de km` : `${fr(Math.round(starRadius * 1392000 / 100) * 100)} km`,
      mass: `${fr(star.mass * (0.85 + rng() * 0.3), 2)} masse solaire`,
      temperature: `${fr(Math.round(starTemp / 10) * 10)} K en surface`,
      composition: star.spec === 'D' ? 'Carbone et oxygène dégénérés' : 'Hydrogène, hélium, éléments lourds',
      atmosphere: star.spec === 'D' ? 'Mince couche d’hydrogène' : 'Photosphère et couronne',
      notes: star.note,
    },
  });

  // Planètes : orbites de plus en plus espacées, comme dans les systèmes observés
  const count = star.spec === 'D' ? Math.floor(rng() * 3) : 1 + Math.floor(rng() * 6);
  let orbit = Math.max((0.22 + rng() * 0.3) * Math.sqrt(luminosity), (starRadius * SUN_R * 3) / AU, 0.03);
  const planets: Body[] = [];
  for (let i = 0; i < count; i++) {
    const temp = (278 * Math.pow(luminosity, 0.25)) / Math.sqrt(orbit);
    const kind = kindAt(temp, rng);
    const radius = Math.round(between(rng, RADIUS[kind]));
    const angle = rng() * Math.PI * 2;
    const world = new THREE.Vector3(Math.cos(angle), (rng() - 0.5) * 0.08, Math.sin(angle)).multiplyScalar(orbit * AU);
    const draft: Draft = { kind, radius, orbitAu: orbit, temp: kind === 'ocean' ? temp + 30 : temp };
    const name = `${info.name} ${ROMAN[i]}`;
    const spec = specFor(kind, radius, rng);
    const planet: Body = {
      kind, world, radius, scanRange: radius * (kind === 'gas' ? 5 : 6) + 800, research: RESEARCH[kind], planet: spec,
      sheet: sheetFor(id(`P${i + 1}`), name, `${fr(orbit, 2)} UA de l’étoile`, draft, rng, info.name),
    };
    bodies.push(planet);
    planets.push(planet);

    // Lunes
    const moons = kind === 'gas' ? Math.floor(rng() * 4) : rng() < 0.35 ? 1 : 0;
    let moonOrbit = (spec.rings ? spec.rings.outer * 1.8 : radius * 7) * (1 + rng());
    for (let m = 0; m < moons; m++) {
      const moonKind: BodyKind = temp < 200 && rng() < 0.6 ? 'ice' : 'moon';
      const moonRadius = Math.round(50 + rng() * (kind === 'gas' ? 260 : 120));
      const letter = String.fromCharCode(97 + m);
      bodies.push({
        kind: moonKind, world: new THREE.Vector3(), radius: moonRadius, scanRange: moonRadius * 6 + 700, research: 6,
        planet: { ...specFor(moonKind, moonRadius, rng), atmosphere: undefined },
        orbit: { parent: planet.sheet.id, radius: moonOrbit, speed: 0.0015 + rng() * 0.004, phase: rng() * 6.28, tilt: (rng() - 0.5) * 0.3 },
        sheet: sheetFor(id(`P${i + 1}${letter}`), `${name} ${letter}`, `Satellite de ${name}`, { kind: moonKind, radius: moonRadius, orbitAu: orbit, temp }, rng, info.name, moonKind === 'ice' ? 'Satellite glacé' : 'Satellite rocheux'),
      });
      moonOrbit *= 1.6 + rng();
    }
    orbit *= 1.5 + rng() * 0.7;
  }

  // Ceinture de débris autour d'une géante, parfois
  let belt: BeltSpec | undefined;
  const giant = planets.find((p) => p.kind === 'gas');
  if (giant && rng() < 0.4) {
    const outerRing = giant.planet?.rings?.outer ?? giant.radius * 2;
    belt = { parentId: giant.sheet.id, inner: outerRing * 1.15, outer: outerRing * 1.5, tilt: giant.planet?.tilt ?? 0 };
  }

  // Rencontres rares : la plupart des systèmes sont vides, et c'est voulu
  const near = (parent: Body, factor: number) => parent.world.clone().add(
    new THREE.Vector3(rng() - 0.5, (rng() - 0.5) * 0.4, rng() - 0.5).normalize().multiplyScalar(parent.radius * factor + 400));
  if (planets.length && rng() < 0.14) {
    const parent = pick(rng, planets);
    bodies.push({
      kind: 'anomaly', world: near(parent, 2.4), radius: 40 + rng() * 40, scanRange: 1400, research: 25,
      alias: 'Perturbation', detectRange: parent.radius * 6 + 4000,
      sheet: {
        id: id('X1'), name: `Anomalie ${info.name}-A`, designation: 'Anomalie', type: 'Anomalie gravitationnelle', system: info.name,
        diameter: `${fr(600 + Math.round(rng() * 12) * 100)} km (variable)`, mass: 'Non mesurable', temperature: '2,7 K',
        composition: 'Aucune matière détectée', atmosphere: 'Aucune',
        notes: 'Même signature que la Faille de Morne. Elle n’émet rien. Elle semble attendre.',
      },
    });
  }
  if (planets.length && rng() < 0.14) {
    const parent = pick(rng, planets);
    bodies.push({
      kind: 'probe', world: near(parent, 2), radius: 8, scanRange: 900, research: 20,
      alias: 'Écho radar', detectRange: parent.radius * 5 + 3000,
      sheet: {
        id: id('X2'), name: 'Sonde inconnue', designation: 'Sonde automatique', type: 'Sonde d’observation', system: info.name,
        diameter: '14 m', mass: `${fr(2 + rng() * 2, 1)} tonnes`, temperature: `${fr(20 + Math.round(rng() * 40))} K`,
        composition: 'Aluminium, panneaux solaires brûlés', atmosphere: 'Aucune',
        notes: 'Origine inconnue. Elle ne figure dans aucun registre.',
        log: pick(rng, LOGS_PROBE),
      },
    });
  }
  if (planets.length && rng() < 0.07) {
    const parent = pick(rng, planets);
    bodies.push({
      kind: 'wreck', world: near(parent, 2.2), radius: 40, scanRange: 1100, research: 30,
      alias: 'Écho métallique', detectRange: parent.radius * 5 + 3500,
      sheet: {
        id: id('X3'), name: 'Épave inconnue', designation: 'Épave', type: 'Épave de vaisseau', system: info.name,
        diameter: `${fr(50 + Math.round(rng() * 60))} m`, mass: `${fr(200 + Math.round(rng() * 300))} tonnes`, temperature: `${fr(30 + Math.round(rng() * 40))} K`,
        composition: 'Alliage d’aluminium, coque ouverte', atmosphere: 'Dépressurisé',
        notes: 'Aucun corps à bord. Les capsules de survie sont toutes parties.',
        log: pick(rng, LOGS_WRECK),
      },
    });
  }

  bodies.push({
    kind: 'ghost', world: new THREE.Vector3(), radius: 1, scanRange: 0, research: 0,
    sheet: { id: 'GHOST', name: 'Contact non identifié', designation: '', type: 'Écho intermittent', diameter: '', mass: '', temperature: '', composition: '', atmosphere: '', notes: '' },
  });

  // Arrivée : du côté éclairé de la planète la plus accueillante, ou près de l'étoile s'il n'y a rien
  const host = planets.find((p) => p.kind === 'ocean') ?? planets[0];
  let arrival: THREE.Vector3, lookAt: THREE.Vector3;
  if (host) {
    const toStar = host.world.clone().negate().normalize();
    const side = new THREE.Vector3(0, 1, 0).cross(toStar).normalize();
    // De trois quarts : la planète montre son croissant, décalée sur le côté de l'image
    const offset = toStar.clone().multiplyScalar(0.5).addScaledVector(side, 0.85).add(new THREE.Vector3(0, 0.18, 0)).normalize();
    arrival = host.world.clone().addScaledVector(offset, host.radius * 5.5 + 1500);
    const right = host.world.clone().sub(arrival).cross(new THREE.Vector3(0, 1, 0)).normalize();
    lookAt = host.world.clone().addScaledVector(right, -host.radius * 1.9);
  } else {
    arrival = new THREE.Vector3(1, 0.15, 0.4).normalize().multiplyScalar(Math.max(starRadius * SUN_R * 60, 0.3 * AU));
    lookAt = new THREE.Vector3();
  }

  return { info, bodies, arrival, lookAt, skyRotation: [rng() * 6.28, rng() * 6.28, rng() * 6.28], belt };
};
