import type { Body, ScienceSheet } from '../universe/bodies';

const KEY = 'event-horizon-discoveries';
const DETECTED_KEY = 'event-horizon-detected';

const load = (key: string) => {
  const set = new Set<string>();
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(saved)) saved.forEach((id) => typeof id === 'string' && set.add(id));
  } catch { /* stockage indisponible ou corrompu : on repart de zéro */ }
  return set;
};
const save = (key: string, set: Set<string>) => {
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch { /* stockage indisponible */ }
};

/**
 * Scanner scientifique. Les découvertes sont mémorisées par identifiant, indépendamment
 * des objets 3D (stockage local ; IndexedDB avec versions de données prévu en 0.4).
 */
export class Scanner {
  active = false;
  progress = 0;
  /** Durée d'une analyse en secondes (réduite par l'amélioration du scanner). */
  duration = 3;
  private known = load(KEY);
  private detected = load(DETECTED_KEY);

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
    save(DETECTED_KEY, this.detected);
    return true;
  }

  discovered(bodies: Body[]): ScienceSheet[] {
    return bodies.filter((b) => this.isKnown(b)).map((b) => b.sheet);
  }

  research(bodies: Body[]) {
    return bodies.reduce((sum, b) => sum + (this.isKnown(b) ? b.research : 0), 0);
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
    this.known.add(body.sheet.id);
    save(KEY, this.known);
    return 'done';
  }
}
