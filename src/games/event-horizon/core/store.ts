import { useSyncExternalStore } from 'react';
import type { QualityLevel } from '../engine/quality';
import type { ScienceSheet } from '../universe/bodies';
import type { UpgradeId } from '../progression/Progression';

export type GameMode = 'menu' | 'play' | 'pause' | 'ending' | 'ended';
export type EngineState = 'Arrêt' | 'Poussée' | 'Rétro' | 'Freinage' | 'Surrégime' | 'Inertie';
export type ScannerState = 'Prêt' | 'Analyse' | 'Hors de portée' | 'Hors service';

export interface NavEntry {
  id: string;
  name: string;
  type: string;
  /** km */
  distance: number;
  scanned: boolean;
  current: boolean;
}

/** Un système sur la carte galactique, positionné par rapport au système actuel. */
export interface MapEntry {
  key: string;
  name: string;
  starType: string;
  color: [number, number, number];
  /** Écart avec le système actuel, en années-lumière. */
  dx: number;
  dy: number;
  dz: number;
  distance: number;
  visited: boolean;
  discoveries: number;
  home: boolean;
}

export interface EndStats {
  /** Secondes de jeu écoulées à bord. */
  shipTime: number;
  /** Secondes gagnées par l'univers extérieur avant l'horizon. */
  farDelta: number;
  discoveries: number;
  total: number;
  storyComplete: boolean;
}

export interface HudState {
  mode: GameMode;
  quality: QualityLevel;
  muted: boolean;
  fps: number;
  /** km/s */
  speed: number;
  cruise: boolean;
  engines: EngineState;
  energy: number;
  energyMax: number;
  coords: [number, number, number];
  sector: string;
  objective: string;
  targetName: string;
  targetType: string;
  /** km */
  targetDistance: number;
  targetScanned: boolean;
  scanner: ScannerState;
  scanProgress: number;
  /** Écoulement du temps à bord par rapport à un observateur lointain (1 = normal). */
  timeFactor: number;
  /** Intensité des radiations subies, 0 à 1. */
  radiation: number;
  /** Proximité du trou noir, 0 à 1 : assombrit les bords de l'image. */
  dread: number;
  research: number;
  upgrades: UpgradeId[];
  message: string;
  sheet: ScienceSheet | null;
  journal: ScienceSheet[];
  nav: NavEntry[];
  map: MapEntry[];
  /** Saut en cours : nom de la destination, et si le vaisseau vient d'arriver. */
  jump: { name: string; arrived: boolean } | null;
  /** Sous la dernière orbite stable du trou noir. */
  falling: boolean;
  /** À pied dans le vaisseau : salle où l'on se trouve et action proposée. */
  interior: { room: string; prompt: string } | null;
  /** Note de bord en cours de lecture. */
  note: { title: string; text: string } | null;
  panel: 'journal' | 'nav' | 'upgrades' | 'map' | null;
  helpOpen: boolean;
  photo: boolean;
  end: EndStats | null;
}

const initial: HudState = {
  mode: 'menu',
  quality: 'high',
  muted: false,
  fps: 0,
  speed: 0,
  cruise: false,
  engines: 'Arrêt',
  energy: 100,
  energyMax: 100,
  coords: [0, 0, 0],
  sector: '',
  objective: '',
  targetName: '',
  targetType: '',
  targetDistance: 0,
  targetScanned: false,
  scanner: 'Prêt',
  scanProgress: 0,
  timeFactor: 1,
  radiation: 0,
  dread: 0,
  research: 0,
  upgrades: [],
  message: '',
  sheet: null,
  journal: [],
  nav: [],
  map: [],
  jump: null,
  falling: false,
  interior: null,
  note: null,
  panel: null,
  helpOpen: true,
  photo: false,
  end: null,
};

/** Petit magasin d'état (même principe que Zustand, sans dépendance supplémentaire). */
let state = initial;
const listeners = new Set<() => void>();

export const hud = {
  get: () => state,
  set: (patch: Partial<HudState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  reset: () => { state = initial; },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

export const useHud = () => useSyncExternalStore(hud.subscribe, hud.get);
