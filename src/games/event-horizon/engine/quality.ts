export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

export interface QualityPreset {
  label: string;
  /** Plafond du ratio de pixels (résolution de rendu). */
  maxPixelRatio: number;
  /** Pas d'intégration des rayons lumineux autour du trou noir. */
  blackHoleSteps: number;
  stars: number;
  /** Résolution de la carte du ciel utilisée par la lentille gravitationnelle. */
  skyCube: number;
  /** 0 = pas d'ombres. */
  shadowMap: number;
  msaa: number;
  octaves: number;
  planetSegments: number;
  asteroids: number;
}

export const QUALITY: Record<QualityLevel, QualityPreset> = {
  low: { label: 'Basse', maxPixelRatio: 0.75, blackHoleSteps: 48, stars: 3000, skyCube: 512, shadowMap: 0, msaa: 0, octaves: 4, planetSegments: 64, asteroids: 250 },
  medium: { label: 'Moyenne', maxPixelRatio: 1, blackHoleSteps: 80, stars: 6000, skyCube: 1024, shadowMap: 1024, msaa: 2, octaves: 5, planetSegments: 96, asteroids: 450 },
  high: { label: 'Élevée', maxPixelRatio: 1.5, blackHoleSteps: 112, stars: 9000, skyCube: 1024, shadowMap: 2048, msaa: 4, octaves: 5, planetSegments: 128, asteroids: 700 },
  ultra: { label: 'Ultra', maxPixelRatio: 2, blackHoleSteps: 160, stars: 14000, skyCube: 2048, shadowMap: 4096, msaa: 4, octaves: 6, planetSegments: 192, asteroids: 1100 },
};

export const QUALITY_ORDER: QualityLevel[] = ['low', 'medium', 'high', 'ultra'];

const KEY = 'event-horizon-quality';

export const loadQuality = (): QualityLevel => {
  try {
    const saved = localStorage.getItem(KEY) as QualityLevel | null;
    if (saved && saved in QUALITY) return saved;
  } catch { /* stockage indisponible */ }
  return 'high';
};

export const saveQuality = (level: QualityLevel) => {
  try { localStorage.setItem(KEY, level); } catch { /* stockage indisponible */ }
};
