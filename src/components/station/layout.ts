/* ───────────────────────────────────────────────────────────────
   Plan de la station orbitale (section Outils de l'accueil).
   Partagé par la scène 3D (chargée à part) et par l'interface React :
   identifiants des modules, catégories d'outils qu'ils accueillent,
   et point d'ancrage de leur panneau holographique (coordonnées monde).
   Repère : Y vers le haut, poutre principale le long de X, noyau à l'origine,
   avant de la station vers +Z. 1 unité ≈ 1 mètre (≈ 420 m d'envergure).
   ─────────────────────────────────────────────────────────────── */

export type ModuleId =
  | 'security' | 'network' | 'telecom' | 'datacenter' | 'archive'
  | 'virtualization' | 'development' | 'gamedev' | 'engineering';

export type V3 = readonly [number, number, number];

export interface ModulePlan {
  id: ModuleId;
  /** Nom du module (nom propre, identique en français et en anglais) */
  name: string;
  /** Catégories de data/tools.tsx accueillies par ce module */
  categories: readonly string[];
  /** Ancrage du panneau holographique et de l'étiquette (monde) */
  anchor: V3;
}

/* Ordre de visite (le parcours de la caméra suit cet ordre) */
export const MODULE_PLANS: readonly ModulePlan[] = [
  { id: 'security', name: 'Security Lab', categories: ['security'], anchor: [0, 14, 48.8] },
  { id: 'network', name: 'Network Hub', categories: ['network'], anchor: [44, 6.2, 14.2] },
  { id: 'telecom', name: 'Telecommunications Array', categories: ['telecom'], anchor: [106, 9.6, -6.5] },
  { id: 'datacenter', name: 'Data Center', categories: ['server'], anchor: [0, -19.4, 12.3] },
  { id: 'archive', name: 'Technical Archive', categories: ['tools'], anchor: [0, -53.4, -4] },
  { id: 'virtualization', name: 'Virtualization Module', categories: ['virtualization'], anchor: [-44, 12.2, -10.5] },
  { id: 'development', name: 'Development Lab', categories: ['development'], anchor: [0, 11.2, -40] },
  { id: 'gamedev', name: 'Game Dev Hangar', categories: ['gamedev'], anchor: [-104, -2.4, -15.5] },
  { id: 'engineering', name: 'Engineering Module', categories: ['hardware', 'os'], anchor: [-5, 76.8, -6] },
];

/** Module qui accueille une catégorie (les catégories inconnues vont aux archives techniques). */
export const moduleOfCategory = (category: string): ModuleId =>
  MODULE_PLANS.find((m) => m.categories.includes(category))?.id ?? 'archive';
