import * as THREE from 'three';

/** 1 unité de scène = 10 km à l'affichage. */
export const KM_PER_UNIT = 10;
export const SECTOR_NAME = 'Seuil de Némésis';
export const UNIVERSE_SEED = 'EH-0001';

/** Unité astronomique, en unités de scène (149,6 millions de km). */
export const AU = 14_960_000;
/** Rayon de l'étoile Hélice : 710 000 km. */
export const STAR_RADIUS = 71_000;

/**
 * Direction de l'étoile vue du vaisseau. Ce vecteur est partagé par tous les shaders et mis à jour
 * à chaque image : à l'échelle réelle, la direction de la lumière change quand on traverse le système.
 */
export const SUN_DIR = new THREE.Vector3(0.55, 0.28, 0.62).normalize();

export type BodyKind =
  | 'star' | 'ocean' | 'moon' | 'gas' | 'lava' | 'ice' | 'blackhole'
  | 'beacon' | 'wreck' | 'pod' | 'probe' | 'twin' | 'anomaly' | 'megastructure' | 'asteroid' | 'ghost';

export interface ScienceSheet {
  id: string;
  name: string;
  designation: string;
  type: string;
  diameter: string;
  mass: string;
  temperature: string;
  composition: string;
  atmosphere: string;
  notes: string;
  /** Enregistrement récupéré à bord ou dans le signal, s'il y en a un. */
  log?: string;
  /** Nom du système où l'objet a été découvert. */
  system?: string;
}

/** Apparence d'une planète ou d'une lune (les surfaces sont calculées par shader à partir de la seed). */
export interface PlanetSpec {
  seed: number;
  /** Tours par seconde. */
  spin: number;
  tilt?: number;
  atmosphere?: [number, number, number];
  rings?: { inner: number; outer: number };
  /** Teinte appliquée à la surface, pour varier d'un monde à l'autre. */
  tint?: [number, number, number];
}

/** Orbite d'un satellite autour d'un autre objet du système. */
export interface OrbitSpec {
  parent: string;
  radius: number;
  /** Radians par seconde. */
  speed: number;
  phase: number;
  tilt: number;
}

export interface Body {
  kind: BodyKind;
  /** Position dans l'univers (double précision, indépendante de l'origine flottante). */
  world: THREE.Vector3;
  radius: number;
  /** Distance maximale d'analyse (Infinity = analyse à longue portée). */
  scanRange: number;
  /** Points de recherche gagnés à la première analyse. */
  research: number;
  /** Nom affiché tant que l'objet n'a pas été analysé. */
  alias?: string;
  /** Identifiant de l'objet qu'il faut avoir analysé pour que celui-ci apparaisse. */
  requires?: string;
  /** Objet non catalogué : il n'apparaît que lorsque le vaisseau passe à cette distance. */
  detectRange?: number;
  /** Message affiché juste après l'analyse (fil de l'histoire). */
  after?: string;
  planet?: PlanetSpec;
  orbit?: OrbitSpec;
  star?: { color: [number, number, number] };
  sheet: ScienceSheet;
}

/** Rayon de Schwarzschild de NEMESIS-01 : 12,7 millions de km, soit 4,3 millions de masses solaires. */
export const BLACK_HOLE_RS = 1_270_000;
const RS = BLACK_HOLE_RS;

const THALIS = new THREE.Vector3(1400, -250, -3600);
// Distances réelles : Thalis est à 1 UA de son étoile, Cendre à 0,4 UA, Morne à 4,7 UA, Givre à 13 UA.
// NEMESIS-01 est à 45 rayons de Schwarzschild du point de départ, soit 3,8 UA.
const HELICE = SUN_DIR.clone().multiplyScalar(AU);
const MORNE = new THREE.Vector3(-0.94, 0.07, 0.33).normalize().multiplyScalar(4.1 * AU);
const NEMESIS = new THREE.Vector3(-0.08, 0.06, -1).normalize().multiplyScalar(45 * RS);
const CENDRE = HELICE.clone().multiplyScalar(0.62).add(new THREE.Vector3(0.45, -0.3, -0.35).multiplyScalar(0.25 * AU));
const GIVRE = new THREE.Vector3(0.75, 0.08, -0.65).normalize().multiplyScalar(12.6 * AU);
const at = (origin: THREE.Vector3, x: number, y: number, z: number) => origin.clone().add(new THREE.Vector3(x, y, z));

/** Ordre de l'histoire : chaque analyse révèle la suivante. */
export const STORY = ['ECHO-1', 'ORPH-M', 'FAILLE', 'AETH-0'];

export const OBJECTIVES: Record<string, string> = {
  'ECHO-1': 'Un signal faible émet sur la bande de détresse. Trouver sa source.',
  'ORPH-M': 'L’expédition ORPHÉE est partie vers Morne. Retrouver sa trace.',
  'FAILLE': 'Quelque chose, dans la ceinture de Morne, répète le signal.',
  'AETH-0': 'La source du signal se trouve près de NEMESIS-01.',
  done: 'Il ne reste qu’une direction.',
};

/**
 * Système de départ, écrit à la main.
 * La génération procédurale par seed (SectorGenerator, SolarSystemGenerator…) arrive en 0.2.
 */
export const createStartSystem = (): Body[] => [
  {
    kind: 'ocean', world: THALIS.clone(), radius: 620, scanRange: 4200, research: 15,
    planet: { seed: 4.2, spin: 0.0016, tilt: 0.3, atmosphere: [0.2, 0.42, 0.85] },
    sheet: {
      id: 'HEL-II', name: 'Thalis', designation: 'Hélice II', type: 'Planète océanique',
      diameter: '12 400 km', mass: '0,94 masse terrestre', temperature: '288 K en moyenne',
      composition: 'Silicates, noyau fer-nickel, eau liquide sur 71 % de la surface',
      atmosphere: 'Azote 76 %, oxygène 21 %, argon. Pression 1,1 bar',
      notes: 'Calottes polaires étendues. Aucune lumière côté nuit. Aucun signal artificiel.',
    },
  },
  {
    kind: 'moon', world: new THREE.Vector3(), radius: 105, scanRange: 1500, research: 10,
    planet: { seed: 12.7, spin: 0.0006 },
    // 260 000 km de Thalis : à l'échelle réelle, une lune est loin de sa planète
    orbit: { parent: 'HEL-II', radius: 26000, speed: 0.004, phase: 1.1, tilt: 0.14 },
    sheet: {
      id: 'HEL-II-a', name: 'Ostra', designation: 'Hélice II a', type: 'Satellite rocheux',
      diameter: '2 100 km', mass: '0,006 masse terrestre', temperature: '95 K (nuit) à 370 K (jour)',
      composition: 'Basalte, régolithe, traces de glace dans les cratères polaires',
      atmosphere: 'Aucune',
      notes: 'Rotation synchrone. Surface saturée de cratères, très ancienne.',
    },
  },
  {
    kind: 'gas', world: MORNE.clone(), radius: 2400, scanRange: 14000, research: 15,
    planet: { seed: 2.3, spin: 0.003, tilt: -0.42, atmosphere: [0.34, 0.33, 0.36], rings: { inner: 3100, outer: 5400 } },
    sheet: {
      id: 'HEL-V', name: 'Morne', designation: 'Hélice V', type: 'Géante gazeuse à anneaux',
      diameter: '48 000 km', mass: '19 masses terrestres', temperature: '72 K au sommet des nuages',
      composition: 'Hydrogène 81 %, hélium 17 %, méthane, ammoniac',
      atmosphere: 'Bandes de vents jusqu’à 1 400 km/h, pas de surface solide',
      notes: 'Anneaux de glace jusqu’à 54 000 km du centre, puis une ceinture de débris rocheux.',
    },
  },
  {
    kind: 'lava', world: CENDRE.clone(), radius: 380, scanRange: 3000, research: 20,
    planet: { seed: 7.9, spin: 0.0011, tilt: 0.1, atmosphere: [0.5, 0.14, 0.05] },
    sheet: {
      id: 'HEL-I', name: 'Cendre', designation: 'Hélice I', type: 'Planète volcanique',
      diameter: '7 600 km', mass: '0,31 masse terrestre', temperature: '740 K, lave à 1 400 K',
      composition: 'Basalte, soufre, silicates en fusion',
      atmosphere: 'Dioxyde de soufre ténu, panaches volcaniques',
      notes: 'Croûte fracturée par les marées de l’étoile. Les failles restent visibles côté nuit.',
    },
  },
  {
    kind: 'ice', world: GIVRE.clone(), radius: 300, scanRange: 2600, research: 20,
    planet: { seed: 21.4, spin: 0.0009, tilt: -0.2, atmosphere: [0.3, 0.42, 0.6] },
    sheet: {
      id: 'HEL-VII', name: 'Givre', designation: 'Hélice VII', type: 'Planète glacée',
      diameter: '6 000 km', mass: '0,12 masse terrestre', temperature: '48 K',
      composition: 'Glace d’eau et d’azote, noyau rocheux',
      atmosphere: 'Traces d’azote, givre saisonnier',
      notes: 'Réseau de fractures profondes. Un océan liquide est probable sous 90 km de glace.',
    },
  },
  {
    kind: 'blackhole', world: NEMESIS.clone(), radius: BLACK_HOLE_RS, scanRange: BLACK_HOLE_RS * 22, research: 40,
    sheet: {
      id: 'NEM-01', name: 'NEMESIS-01', designation: 'Sgr-N 01', type: 'Trou noir supermassif',
      diameter: 'Horizon : 25,4 millions de km', mass: '4,3 millions de masses solaires',
      temperature: 'Disque d’accrétion : 10⁵ à 10⁷ K',
      composition: 'Singularité. Disque de plasma ionisé (hydrogène, hélium, fer). Deux jets relativistes',
      atmosphere: 'Sans objet',
      notes: 'Lentille gravitationnelle forte. Radiations intenses autour du disque. Aucune orbite stable sous 3 rayons de l’horizon. Le temps de bord ralentit à l’approche.',
    },
  },
  {
    kind: 'star', world: HELICE.clone(), radius: STAR_RADIUS, scanRange: Infinity, research: 10,
    star: { color: [1, 0.93, 0.82] },
    sheet: {
      id: 'HEL', name: 'Hélice', designation: 'EH-0001 A', type: 'Étoile naine jaune (G1 V)',
      diameter: '1,42 million de km', mass: '1,08 masse solaire', temperature: '5 840 K en surface',
      composition: 'Hydrogène 73 %, hélium 25 %, éléments lourds 2 %',
      atmosphere: 'Photosphère et couronne, vent stellaire modéré',
      notes: 'Étoile stable, âge estimé à 5,1 milliards d’années.',
    },
  },

  // ── Fil de l'histoire ──
  {
    kind: 'beacon', world: new THREE.Vector3(-700, 200, -1500), radius: 6, scanRange: 900, research: 10,
    alias: 'Signal de détresse',
    after: 'Une expédition est passée ici avant vous. Nouvelle piste : Morne.',
    sheet: {
      id: 'ECHO-1', name: 'Balise Écho-1', designation: 'Expédition ORPHÉE', type: 'Balise de détresse',
      diameter: '11 m', mass: '2,4 tonnes', temperature: '31 K',
      composition: 'Titane, pile au plutonium presque épuisée',
      atmosphere: 'Aucune',
      notes: 'En service depuis 61 ans. Elle émet toujours, toutes les 61 secondes.',
      log: '« Ici ORPHÉE. Nous avons capté un signal régulier venant de Hélice V. Quatre membres d’équipage, tous en bonne santé. Nous allons voir. Nous laissons cette balise pour ceux qui suivront. »',
    },
  },
  {
    kind: 'wreck', world: at(MORNE, 1500, 700, 6500), radius: 40, scanRange: 1100, research: 25,
    alias: 'Écho métallique', requires: 'ECHO-1',
    after: 'L’anomalie dont parle le journal se trouve dans la ceinture de débris.',
    sheet: {
      id: 'ORPH-M', name: 'ORPHÉE, module de service', designation: 'Épave', type: 'Épave de vaisseau',
      diameter: '74 m', mass: '310 tonnes', temperature: '58 K',
      composition: 'Alliage d’aluminium, réservoirs éventrés de l’intérieur',
      atmosphere: 'Dépressurisé',
      notes: 'Module largué volontairement. Aucun corps à bord. Trois combinaisons sur quatre manquent.',
      log: '« Jour 212. Jonas n’est pas revenu de la sortie. L’anomalie dans la ceinture répète notre balise. Elle la répète onze secondes avant que nous l’émettions. Maren dit que c’est impossible. Maren ne dort plus. »',
    },
  },
  {
    kind: 'anomaly', world: at(MORNE, -5200, 300, -3500), radius: 70, scanRange: 1400, research: 30,
    alias: 'Source du signal répété', requires: 'ORPH-M',
    after: 'Le signal copié vient de NEMESIS-01. Nouvelle cible près du trou noir.',
    sheet: {
      id: 'FAILLE', name: 'Faille de Morne', designation: 'Anomalie A-1', type: 'Anomalie gravitationnelle',
      diameter: '1 400 km (variable)', mass: 'Non mesurable', temperature: '2,7 K',
      composition: 'Aucune matière détectée',
      atmosphere: 'Aucune',
      notes: 'Distorsion locale de l’espace-temps. Elle relaie un signal dont l’origine est NEMESIS-01.',
      log: 'Le motif relayé n’est pas la balise d’ORPHÉE. C’est le code d’identification d’AETHER-01. Le vôtre. Datation du signal : 61 ans.',
    },
  },
  {
    kind: 'twin', world: at(NEMESIS, 3.1 * RS, 4.76 * RS, 4.52 * RS), radius: 45, scanRange: 1300, research: 40,
    alias: 'Épave non identifiée', requires: 'FAILLE',
    after: 'Le signal continue, plus bas. Il vient de l’horizon.',
    sheet: {
      id: 'AETH-0', name: 'AETHER-01', designation: 'Épave', type: 'Vaisseau scientifique',
      diameter: '810 m', mass: '48 000 tonnes', temperature: '120 K, coque irradiée',
      composition: 'Identique à votre vaisseau, pièce pour pièce',
      atmosphere: 'Dépressurisé',
      notes: 'Numéro de coque identique au vôtre. Âge de la structure : 61 ans. Équipage prévu : 1. Aucun corps à bord.',
      log: 'Dernière commande enregistrée par le pilote : cap sur l’horizon. Dernière ligne du journal : « Je sais maintenant d’où vient le signal. Je suis désolé. Ne me suivez pas. »',
    },
  },

  // ── Découvertes libres, hors catalogue ──
  {
    kind: 'probe', world: at(THALIS, -1300, 500, 700), radius: 8, scanRange: 900, research: 20,
    alias: 'Écho radar', detectRange: 2600,
    sheet: {
      id: 'VESPER', name: 'Sonde Vésper', designation: 'Sonde automatique', type: 'Sonde d’observation',
      diameter: '14 m', mass: '3,1 tonnes', temperature: '44 K',
      composition: 'Aluminium, panneaux solaires brûlés',
      atmosphere: 'Aucune',
      notes: 'En orbite depuis au moins 40 ans. Origine inconnue : elle ne figure dans aucun registre.',
      log: 'Mémoire : 14 600 images de Thalis, une par jour. Sur la dernière, la sonde ne regarde plus la planète. Elle s’est tournée vers votre position de départ.',
    },
  },
  {
    kind: 'pod', world: at(GIVRE, 700, 200, 500), radius: 5, scanRange: 900, research: 25,
    alias: 'Écho radar', detectRange: 3200,
    sheet: {
      id: 'POD-3', name: 'Capsule de survie', designation: 'ORPHÉE, capsule 3', type: 'Capsule de sauvetage',
      diameter: '6 m', mass: '1,8 tonne', temperature: '50 K',
      composition: 'Composite, bouclier thermique intact',
      atmosphere: 'Dépressurisée',
      notes: 'Sas ouvert de l’intérieur. Réserves intactes pour 90 jours. Occupant absent.',
      log: '« Maren. Je me suis éloignée le plus possible. Ça ne change rien, on l’entend aussi d’ici. Ce n’est pas un appel à l’aide. Je crois que c’est un avertissement, et qu’il arrive trop tôt. »',
    },
  },
  {
    kind: 'anomaly', world: at(CENDRE, 900, 300, -600), radius: 55, scanRange: 1300, research: 25,
    alias: 'Perturbation', detectRange: 3200,
    sheet: {
      id: 'NOEUD', name: 'Nœud de Cendre', designation: 'Anomalie A-2', type: 'Anomalie gravitationnelle',
      diameter: '900 km (variable)', mass: 'Non mesurable', temperature: '2,7 K',
      composition: 'Aucune matière détectée',
      atmosphere: 'Aucune',
      notes: 'Même signature que la Faille de Morne, sans aucun signal. Elle semble attendre.',
    },
  },
  {
    // Sur la route entre le système et le trou noir : on le détecte en allant vers NEMESIS-01
    kind: 'megastructure', world: NEMESIS.clone().multiplyScalar(1 - 21 / 45).add(new THREE.Vector3(2.4 * RS, -1.6 * RS, 0)), radius: 900, scanRange: 9000, research: 45,
    alias: 'Masse sombre', detectRange: 5 * RS,
    sheet: {
      id: 'TEMOIN', name: 'Le Témoin', designation: 'Objet X-1', type: 'Structure artificielle, origine inconnue',
      diameter: '18 000 km', mass: '4 × 10¹⁹ kg', temperature: '2,7 K, à l’équilibre avec le vide',
      composition: 'Matériau non identifié, n’émet et ne réfléchit presque rien',
      atmosphere: 'Aucune',
      notes: 'Âge estimé : 2,1 milliards d’années. Aucune émission, aucune réponse. L’axe de l’anneau reste pointé sur NEMESIS-01, au degré près.',
    },
  },
  {
    kind: 'asteroid', world: new THREE.Vector3(), radius: 95, scanRange: 1500, research: 10,
    alias: 'Gros débris', detectRange: 5000,
    sheet: {
      id: 'M-217', name: 'Astéroïde M-217', designation: 'Ceinture de Morne', type: 'Astéroïde rocheux',
      diameter: '1 900 km', mass: '9 × 10²⁰ kg', temperature: '70 K',
      composition: 'Chondrite carbonée, glace, nickel',
      atmosphere: 'Aucune',
      notes: 'Le plus gros corps de la ceinture. Une tranchée rectiligne de 300 km entaille sa surface.',
    },
  },

  // ── Présence ──
  {
    kind: 'ghost', world: new THREE.Vector3(), radius: 1, scanRange: 0, research: 0,
    sheet: {
      id: 'GHOST', name: 'Contact non identifié', designation: '', type: 'Écho intermittent',
      diameter: '', mass: '', temperature: '', composition: '', atmosphere: '', notes: '',
    },
  },
];
