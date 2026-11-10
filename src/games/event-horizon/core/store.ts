import { useSyncExternalStore } from 'react';
import type { QualityLevel } from '../engine/quality';
import type { ScienceSheet } from '../universe/bodies';

export type GameMode = 'menu' | 'play' | 'pause';
export type EngineState = 'Arrêt' | 'Poussée' | 'Rétro' | 'Freinage' | 'Surrégime' | 'Inertie';
export type ScannerState = 'Prêt' | 'Analyse' | 'Hors de portée';

export interface HudState {
  mode: GameMode;
  quality: QualityLevel;
  fps: number;
  /** km/s */
  speed: number;
  cruise: boolean;
  engines: EngineState;
  energy: number;
  coords: [number, number, number];
  sector: string;
  targetName: string;
  targetType: string;
  /** km */
  targetDistance: number;
  targetScanned: boolean;
  scanner: ScannerState;
  scanProgress: number;
  /** Écoulement du temps à bord par rapport à un observateur lointain (1 = normal). */
  timeFactor: number;
  message: string;
  sheet: ScienceSheet | null;
  journal: ScienceSheet[];
  journalOpen: boolean;
  helpOpen: boolean;
}

const initial: HudState = {
  mode: 'menu',
  quality: 'high',
  fps: 0,
  speed: 0,
  cruise: false,
  engines: 'Arrêt',
  energy: 100,
  coords: [0, 0, 0],
  sector: '',
  targetName: '',
  targetType: '',
  targetDistance: 0,
  targetScanned: false,
  scanner: 'Prêt',
  scanProgress: 0,
  timeFactor: 1,
  message: '',
  sheet: null,
  journal: [],
  journalOpen: false,
  helpOpen: true,
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
