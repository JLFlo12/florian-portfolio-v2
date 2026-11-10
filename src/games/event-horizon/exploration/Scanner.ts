import type { Body, ScienceSheet } from '../universe/bodies';

const KEY = 'event-horizon-journal';
const OLD_KEY = 'event-horizon-discoveries';
const DETECTED_KEY = 'event-horizon-detected';

interface Entry { sheet: ScienceSheet; research: number }

const loadSet = (key: string) => {
  const set = new Set<string>();
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(saved)) saved.forEach((id) => typeof id === 'string' && set.add(id));
  } catch { /* stockage indisponible ou corrompu : on repart de zéro */ }
  return set;
};

/**
 * Scanner scientifique et journal des découvertes.
 * L'univers est sans fin et régénéré à la demande : le journal garde donc la fiche complète de chaque
 * objet analysé, pour la retrouver sans avoir à reconstruire le système d'où elle vient.
 * (Stockage local ; IndexedDB avec versions de données reste à faire.)
 */
export class Scanner {
  active = false;
  progress = 0;
  /** Durée d'une analyse en secondes (réduite par l'amélioration du scanner). */
  duration = 3;
  private known = new Map<string, Entry>();
  private detected = loadSet(DETECTED_KEY);

  /** @param home objets du système de départ, pour reprendre un journal enregistré à l'ancien format */
  constructor(home: Body[]) {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (Array.isArray(saved)) {
        for (const entry of saved) {
          if (entry?.sheet?.id && typeof entry.sheet.name === 'string') this.known.set(entry.sheet.id, { sheet: entry.sheet, research: Number(entry.research) || 0 });
        }
      }
    } catch { /* stockage indisponible ou corrompu */ }
    if (!this.known.size) {
      const old = loadSet(OLD_KEY);
      home.forEach((body) => { if (old.has(body.sheet.id)) this.known.set(body.sheet.id, { sheet: body.sheet, research: body.research }); });
      if (this.known.size) this.save();
    }
  }

  private save() {
    try { localStorage.setItem(KEY, JSON.stringify([...this.known.values()])); } catch { /* stockage plein ou indisponible */ }
  }

  isKnown(body: Body) { return this.known.has(body.sheet.id); }
  knows(id: string) { return this.known.has(id); }

  /** Un objet apparaît dans la navigation s'il est catalogué, révélé par l'histoire ou détecté de près. */
  isRevealed(body: Body) {
    if (body.kind === 'ghost') return false;
    if (this.isKnown(body)) return true;
    if (body.requires && !this.known.has(body.requires)) return false;
    if (body.detectRange && !this.detected.has(body.sheet.id)) return false;
    return true;
  }

  /** @returns true si l'objet vient d'être détecté pour la première fois */
  detect(body: Body) {
    if (this.detected.has(body.sheet.id)) return false;
    this.detected.add(body.sheet.id);
    try { localStorage.setItem(DETECTED_KEY, JSON.stringify([...this.detected])); } catch { /* stockage indisponible */ }
    return true;
  }

  /** Toutes les découvertes, les plus récentes d'abord. */
  discovered(): ScienceSheet[] {
    return [...this.known.values()].map((e) => e.sheet).reverse();
  }

  countIn(bodies: Body[]) { return bodies.reduce((n, b) => n + (this.isKnown(b) ? 1 : 0), 0); }
  countInSystem(name: string) { let n = 0; this.known.forEach((e) => { if (e.sheet.system === name) n++; }); return n; }

  research() {
    let sum = 0;
    this.known.forEach((e) => { sum += e.research; });
    return sum;
  }

  start(body: Body) {
    if (this.isKnown(body)) return;
    this.active = true;
    this.progress = 0;
  }

  cancel() {
    this.active = false;
    this.progress = 0;
  }

  update(dt: number, body: Body, distance: number, range: number): 'done' | 'lost' | null {
    if (!this.active) return null;
    if (distance > range) { this.cancel(); return 'lost'; }
    this.progress += dt / this.duration;
    if (this.progress < 1) return null;
    this.cancel();
    this.known.set(body.sheet.id, { sheet: body.sheet, research: body.research });
    this.save();
    return 'done';
  }
}
