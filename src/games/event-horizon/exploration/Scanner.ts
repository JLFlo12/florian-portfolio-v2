import type { Body, ScienceSheet } from '../universe/bodies';

const KEY = 'event-horizon-discoveries';
const DURATION = 3;

/**
 * Scanner scientifique. Les découvertes sont mémorisées par identifiant, indépendamment
 * des objets 3D (stockage local en 0.1 ; IndexedDB avec versions de données prévu en 0.4).
 */
export class Scanner {
  active = false;
  progress = 0;
  private known = new Set<string>();

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (Array.isArray(saved)) saved.forEach((id) => typeof id === 'string' && this.known.add(id));
    } catch { /* stockage indisponible ou corrompu : on repart d'un journal vide */ }
  }

  isKnown(body: Body) { return this.known.has(body.sheet.id); }

  discovered(bodies: Body[]): ScienceSheet[] {
    return bodies.filter((b) => this.isKnown(b)).map((b) => b.sheet);
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

  update(dt: number, body: Body, distance: number): 'done' | 'lost' | null {
    if (!this.active) return null;
    if (distance > body.scanRange) { this.cancel(); return 'lost'; }
    this.progress += dt / DURATION;
    if (this.progress < 1) return null;
    this.cancel();
    this.known.add(body.sheet.id);
    try { localStorage.setItem(KEY, JSON.stringify([...this.known])); } catch { /* stockage indisponible */ }
    return 'done';
  }
}
