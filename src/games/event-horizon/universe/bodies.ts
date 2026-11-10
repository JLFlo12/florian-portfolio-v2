import * as THREE from 'three';

/** 1 unité de scène = 10 km à l'affichage. */
export const KM_PER_UNIT = 10;
export const SECTOR_NAME = 'Seuil de Némésis';
export const UNIVERSE_SEED = 'EH-0001';

/** Direction de l'étoile Hélice (source de lumière du système). */
export const SUN_DIR = new THREE.Vector3(0.55, 0.28, 0.62).normalize();

export type BodyKind = 'star' | 'ocean' | 'moon' | 'gas' | 'blackhole';

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
}

export interface Body {
  kind: BodyKind;
  /** Position dans l'univers (double précision, indépendante de l'origine flottante). */
  world: THREE.Vector3;
  radius: number;
  /** Distance maximale d'analyse (Infinity = analyse à longue portée). */
  scanRange: number;
  sheet: ScienceSheet;
}

export const BLACK_HOLE_RS = 420;

/**
 * Système de départ de la version 0.1, écrit à la main.
 * La génération procédurale par seed (SectorGenerator, SolarSystemGenerator…) arrive en 0.2.
 */
export const createStartSystem = (): Body[] => [
  {
    kind: 'ocean',
    world: new THREE.Vector3(1400, -250, -3600),
    radius: 620,
    scanRange: 4200,
    sheet: {
      id: 'HEL-II',
      name: 'Thalis',
      designation: 'Hélice II',
      type: 'Planète océanique',
      diameter: '12 400 km',
      mass: '0,94 masse terrestre',
      temperature: '288 K en moyenne',
      composition: 'Silicates, noyau fer-nickel, eau liquide sur 71 % de la surface',
      atmosphere: 'Azote 76 %, oxygène 21 %, argon. Pression 1,1 bar',
      notes: 'Calottes polaires étendues. Aucun signal artificiel détecté.',
    },
  },
  {
    kind: 'moon',
    world: new THREE.Vector3(),
    radius: 105,
    scanRange: 1500,
    sheet: {
      id: 'HEL-II-a',
      name: 'Ostra',
      designation: 'Hélice II a',
      type: 'Satellite rocheux',
      diameter: '2 100 km',
      mass: '0,006 masse terrestre',
      temperature: '95 K (nuit) à 370 K (jour)',
      composition: 'Basalte, régolithe, traces de glace dans les cratères polaires',
      atmosphere: 'Aucune',
      notes: 'Rotation synchrone. Surface saturée de cratères, très ancienne.',
    },
  },
  {
    kind: 'gas',
    world: new THREE.Vector3(-13000, 900, 4500),
    radius: 2400,
    scanRange: 14000,
    sheet: {
      id: 'HEL-V',
      name: 'Morne',
      designation: 'Hélice V',
      type: 'Géante gazeuse à anneaux',
      diameter: '48 000 km',
      mass: '19 masses terrestres',
      temperature: '72 K au sommet des nuages',
      composition: 'Hydrogène 81 %, hélium 17 %, méthane, ammoniac',
      atmosphere: 'Bandes de vents jusqu’à 1 400 km/h, pas de surface solide',
      notes: 'Anneaux de glace et de poussière de 31 000 à 54 000 km du centre.',
    },
  },
  {
    kind: 'blackhole',
    world: new THREE.Vector3(-1500, 1200, -19000),
    radius: BLACK_HOLE_RS,
    scanRange: BLACK_HOLE_RS * 22,
    sheet: {
      id: 'NEM-01',
      name: 'NEMESIS-01',
      designation: 'Sgr-N 01',
      type: 'Trou noir supermassif',
      diameter: 'Horizon : 25,4 millions de km',
      mass: '4,3 millions de masses solaires',
      temperature: 'Disque d’accrétion : 10⁵ à 10⁷ K',
      composition: 'Singularité. Disque de plasma ionisé (hydrogène, hélium, fer)',
      atmosphere: 'Sans objet',
      notes: 'Lentille gravitationnelle forte. Le temps de bord ralentit à l’approche de l’horizon.',
    },
  },
  {
    kind: 'star',
    world: SUN_DIR.clone().multiplyScalar(600000),
    radius: 7100,
    scanRange: Infinity,
    sheet: {
      id: 'HEL',
      name: 'Hélice',
      designation: 'EH-0001 A',
      type: 'Étoile naine jaune (G1 V)',
      diameter: '1,42 million de km',
      mass: '1,08 masse solaire',
      temperature: '5 840 K en surface',
      composition: 'Hydrogène 73 %, hélium 25 %, éléments lourds 2 %',
      atmosphere: 'Photosphère et couronne, vent stellaire modéré',
      notes: 'Étoile stable, âge estimé à 5,1 milliards d’années.',
    },
  },
];
