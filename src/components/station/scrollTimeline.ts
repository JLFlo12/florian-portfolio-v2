import { TOOLS, type Tool } from '@/data/tools';
import { MODULE_PLANS, moduleOfCategory, type ModuleId, type ModulePlan, type V3 } from './layout';

/* ───────────────────────────────────────────────────────────────
   ScrollTimeline : la visite de la station est une seule cinématique continue.
   Chaque étape a un trajet (la caméra se déplace) puis une halte (elle ralentit
   près du module et dérive doucement pendant que son panneau s'affiche).
   Les longueurs sont en hauteurs d'écran (vh) ; la progression t va de 0 à 1
   sur toute la section. La caméra passe par toutes les clés, sans saut :
   la scène interpole position, cible, focale et décalage optique (CameraController).
   ─────────────────────────────────────────────────────────────── */

/** Plan de caméra : position, point visé, focale verticale (°), décalage optique
 *  (shift > 0 : le point visé se place à gauche du centre, pour laisser la droite au panneau). */
export interface Shot { pos: V3; target: V3; fov: number; shift?: number }

export type StopId = 'approach' | 'overview' | ModuleId | 'final';

interface StopDef {
  id: StopId;
  travel: number;   // longueur du trajet qui mène à la halte (vh)
  via?: Shot[];     // plans intermédiaires du trajet (contournements)
  arrive: Shot;     // début de la halte
  mid?: Shot[];     // plans intermédiaires de la halte
  leave: Shot;      // fin de la halte
  dwell: number;    // longueur de la halte (vh)
}

export interface StationModule extends ModulePlan {
  tools: Tool[];
}

/* Modules et leurs outils, lus dans data/tools.tsx (ordre du fichier conservé) */
export const STATION_MODULES: StationModule[] = MODULE_PLANS.map((plan) => ({
  ...plan,
  tools: TOOLS.filter((tool) => moduleOfCategory(tool.category) === plan.id),
}));
export const moduleById = (id: ModuleId) => STATION_MODULES.find((m) => m.id === id)!;

const shot = (pos: V3, target: V3, fov: number, shift = 0): Shot => ({ pos, target, fov, shift });
const P = 0.3; // décalage optique pendant les haltes (le module à gauche, le panneau à droite)

// Halte d'un module : plus longue quand il a beaucoup d'outils (le focus passe d'un outil à l'autre)
const dwellFor = (id: ModuleId) => 24 + 6 * moduleById(id).tools.length;

const STOPS: StopDef[] = [
  // 01 — Approche : la station apparaît au loin et grossit
  {
    id: 'approach', travel: 0, dwell: 95,
    arrive: shot([-640, 170, 960], [0, -6, 0], 21),
    leave: shot([-330, 92, 520], [0, 0, 0], 28),
  },
  // 02 — Vue d'ensemble : la caméra contourne la station par l'avant
  {
    id: 'overview', travel: 30, dwell: 110,
    arrive: shot([-210, 132, 470], [0, 2, 0], 32),
    mid: [shot([90, 182, 500], [0, 6, 0], 32)],
    leave: shot([270, 74, 330], [10, 0, 0], 34),
  },
  // 03 — Security Lab (avant du noyau)
  {
    id: 'security', travel: 56, dwell: dwellFor('security'),
    via: [shot([132, 34, 186], [12, 4, 34], 38, P * 0.5)],
    arrive: shot([64, 14, 92], [0, 1, 46], 40, P),
    leave: shot([50, 20, 102], [0, 2, 47], 40, P),
  },
  // 04 — Network Hub : on longe la poutre et on contourne les antennes
  {
    id: 'network', travel: 50, dwell: dwellFor('network'),
    via: [shot([66, 36, 80], [26, 6, 18], 42, P * 0.6)],
    arrive: shot([78, 28, 44], [44, 6, 0], 42, P),
    leave: shot([84, 15, 35], [46, 5, 0], 42, P),
  },
  // 05 — Telecommunications Array (bout de poutre, côté droit)
  {
    id: 'telecom', travel: 46, dwell: dwellFor('telecom'),
    arrive: shot([142, 36, 60], [104, 9, 0], 42, P),
    leave: shot([150, 23, 47], [106, 8, 0], 42, P),
  },
  // 06 — Data Center : sous le noyau ; la caméra traverse la salle de part en part
  {
    id: 'datacenter', travel: 62, dwell: dwellFor('datacenter') + 18,
    via: [shot([84, -24, 100], [12, -34, 0], 44, P * 0.6)],
    arrive: shot([20, -31, 72], [0, -36, 0], 46, P),
    mid: [shot([3, -35, 22], [0, -36.5, -10], 56, P * 0.7)],
    leave: shot([1.5, -39, -34], [0, -62, -2], 50, P * 0.6),
  },
  // 07 — Technical Archive (bas de l'axe, côté arrière)
  {
    id: 'archive', travel: 46, dwell: dwellFor('archive'),
    arrive: shot([-28, -67, -56], [0, -70, 0], 42, P),
    leave: shot([-38, -59, -52], [0, -70, 0], 42, P),
  },
  // 08 — Virtualization Module (poutre, côté gauche)
  {
    id: 'virtualization', travel: 50, dwell: dwellFor('virtualization'),
    arrive: shot([-76, 17, -42], [-44, 0, 0], 42, P),
    leave: shot([-66, 23, -50], [-44, 1, 0], 42, P),
  },
  // 09 — Development Lab (arrière du noyau)
  {
    id: 'development', travel: 46, dwell: dwellFor('development'),
    arrive: shot([-46, 3, -76], [0, 0, -40], 40, P),
    leave: shot([-36, 9, -86], [0, 1, -41], 40, P),
  },
  // 10 — Game Dev Hangar : la caméra s'approche de la porte ouverte
  {
    id: 'gamedev', travel: 56, dwell: dwellFor('gamedev'),
    via: [shot([-64, 4, -100], [-92, -8, -20], 44, P * 0.6)],
    arrive: shot([-78, -7, -70], [-104, -15, -6], 44, P),
    leave: shot([-88, -11, -50], [-105, -16, 0], 48, P),
  },
  // 11 — Engineering Module (sommet de l'axe : hardware et systèmes)
  {
    id: 'engineering', travel: 70, dwell: dwellFor('engineering'),
    via: [shot([-92, 40, -84], [-30, 50, 0], 42, P * 0.5)],
    arrive: shot([-44, 94, -56], [0, 62, 0], 40, P),
    leave: shot([-22, 101, -63], [0, 62, 0], 40, P),
  },
  // 12 — Vue finale : la caméra s'éloigne, récapitulatif des outils
  {
    id: 'final', travel: 80, dwell: 55,
    via: [shot([90, 160, 240], [0, 20, 0], 34)],
    arrive: shot([390, 232, 650], [0, -84, 0], 28),
    leave: shot([450, 262, 770], [0, -96, 0], 26),
  },
];

export interface CameraKey { t: number; shot: Shot }

export interface TimelineStop {
  id: StopId;
  index: number;
  /** début du trajet, début et fin de la halte, fin (= début du trajet suivant), en progression 0..1 */
  start: number; arrive: number; leave: number; end: number;
}

export interface Timeline { keys: CameraKey[]; stops: TimelineStop[]; totalVh: number }

/** Allure de la visite : plus la valeur est grande, moins la caméra avance à chaque cran de molette. */
const PACE = 1.5;

/** Construit la timeline. compact : écrans étroits, défilement un peu plus court. */
export function buildTimeline(compact = false): Timeline {
  const k = (compact ? 0.82 : 1) * PACE;
  const raw: { u: number; shot: Shot }[] = [];
  const spans: { id: StopId; start: number; arrive: number; leave: number }[] = [];
  let u = 0;
  for (const stop of STOPS) {
    const start = u;
    const travel = stop.travel * k;
    (stop.via ?? []).forEach((s, i, all) => raw.push({ u: start + (travel * (i + 1)) / (all.length + 1), shot: s }));
    u += travel;
    const arrive = u;
    raw.push({ u, shot: stop.arrive });
    const dwell = stop.dwell * k;
    (stop.mid ?? []).forEach((s, i, all) => raw.push({ u: arrive + (dwell * (i + 1)) / (all.length + 1), shot: s }));
    u += dwell;
    raw.push({ u, shot: stop.leave });
    spans.push({ id: stop.id, start, arrive, leave: u });
  }
  const total = u;
  const keys = raw.map(({ u: at, shot: s }) => ({ t: at / total, shot: s }));
  const stops = spans.map((s, index) => ({
    id: s.id,
    index,
    start: s.start / total,
    arrive: s.arrive / total,
    leave: s.leave / total,
    end: index < spans.length - 1 ? spans[index + 1].start / total : 1,
  }));
  return { keys, stops, totalVh: total };
}

/** Hauteur CSS de la section (la scène collée à l'écran + la longueur du défilement). */
export const isCompactStation = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
export const stationHeight = (compact: boolean) => `calc(${buildTimeline(compact).totalVh.toFixed(2)}vh + 100svh)`;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => {
  const x = clamp01((v - a) / (b - a || 1e-6));
  return x * x * (3 - 2 * x);
};

/** Étape en cours : du milieu de son trajet au milieu du trajet suivant. */
export function stopIndexAt(stops: TimelineStop[], t: number) {
  for (let i = stops.length - 1; i >= 0; i--) {
    const s = stops[i];
    if (t >= s.start + (s.arrive - s.start) * 0.5) return i;
  }
  return 0;
}

/** Présence de l'interface d'une étape (0..1) : apparaît en fin de trajet, s'efface au départ. */
export function presenceAt(stop: TimelineStop, t: number) {
  const rise = Math.max(1e-4, (stop.arrive - stop.start) * 0.4);
  const fall = Math.max(1e-4, (stop.end - stop.leave) * 0.32);
  return smooth(stop.arrive - rise, stop.arrive, t) * (1 - smooth(stop.leave, stop.leave + fall, t));
}

/** Avancée dans la halte (0..1). */
export const dwellAt = (stop: TimelineStop, t: number) => clamp01((t - stop.arrive) / Math.max(1e-6, stop.leave - stop.arrive));

/** Outil mis en avant pendant la halte : le défilement passe de l'un à l'autre. */
export const focusAt = (stop: TimelineStop, t: number, count: number) =>
  Math.min(count - 1, Math.max(0, Math.floor(dwellAt(stop, t) * count * 0.999)));
