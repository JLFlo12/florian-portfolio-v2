/* ───────────────────────────────────────────────────────────────
   Écriture et dessin « à la main » : capitales tracées en traits (boîte de 14 de haut)
   et petit tremblé de crayon. Partagés par l'écran de chargement, le menu en satellites et les
   boutons de l'en-tête (planète, soucoupe volante, pulsar, soleil).
   Tout est tiré d'une graine fixe : le même mot s'écrit toujours de la même façon.
   ─────────────────────────────────────────────────────────────── */

export type Pt = [number, number];
export const TAU = Math.PI * 2;

/* Pseudo-aléatoire à graine fixe */
export const random = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

export const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 14): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });

/* Capitales : [largeur, traits] ; y de 0 (haut) à 14 (ligne de base) */
export const GLYPHS: Record<string, [number, Pt[][]]> = {
  A: [10, [[[0, 14], [5, 0], [10, 14]], [[2.3, 8.6], [7.7, 8.6]]]],
  B: [10, [[[1, 14], [1, 0]], arc(1, 3.5, 7, 3.5, -Math.PI / 2, Math.PI / 2, 8), arc(1, 10.5, 8, 3.5, -Math.PI / 2, Math.PI / 2, 8)]],
  C: [10, [arc(5, 7, 5, 7, -0.75, -5.55)]],
  D: [10, [[[1, 14], [1, 0]], arc(1, 7, 9, 7, -Math.PI / 2, Math.PI / 2)]],
  E: [9, [[[9, 0], [1, 0], [1, 14], [9, 14]], [[1, 7], [7, 7]]]],
  F: [9, [[[9, 0], [1, 0], [1, 14]], [[1, 7], [7, 7]]]],
  G: [10, [[...arc(5, 7, 5, 7, -0.75, -5.6), [10, 7.6], [6, 7.6]]]],
  H: [10, [[[1, 0], [1, 14]], [[9, 0], [9, 14]], [[1, 7], [9, 7]]]],
  I: [2, [[[1, 0], [1, 14]]]],
  J: [10, [[[9, 0], ...arc(5, 10, 4, 4, 0, Math.PI, 8)]]],
  K: [10, [[[1, 0], [1, 14]], [[9, 0], [1, 8.5]], [[3.6, 6], [9.5, 14]]]],
  L: [9, [[[1, 0], [1, 14], [8.5, 14]]]],
  M: [12, [[[0.5, 14], [1, 0], [6, 9], [11, 0], [11.5, 14]]]],
  N: [10, [[[1, 14], [1, 0], [9, 14], [9, 0]]]],
  O: [10, [arc(5, 7, 5, 7, -1.4, -1.4 - TAU - 0.3, 18)]],
  P: [9, [[[1, 14], [1, 0]], arc(1, 3.6, 7.5, 3.6, -Math.PI / 2, Math.PI / 2, 8)]],
  Q: [10, [arc(5, 7, 5, 7, -1.4, -1.4 - TAU - 0.3, 18), [[6, 10], [10, 14.5]]]],
  R: [10, [[[1, 14], [1, 0]], arc(1, 3.6, 7.5, 3.6, -Math.PI / 2, Math.PI / 2, 8), [[4, 7.2], [9.5, 14]]]],
  S: [10, [[...arc(5, 3.6, 4, 3.6, -0.45, -Math.PI * 1.5, 9), ...arc(5, 10.4, 4.5, 3.6, -Math.PI / 2, Math.PI + 0.45, 9).slice(1)]]],
  T: [10, [[[0, 0.3], [10, 0]], [[5, 0], [5, 14]]]],
  U: [10, [[[1, 0], ...arc(5, 9, 4, 5, Math.PI, 0, 10), [9, 0]]]],
  V: [10, [[[0, 0], [5, 14], [10, 0]]]],
  X: [10, [[[0.5, 0], [9.5, 14]], [[9.5, 0], [0.5, 14]]]],
};
/* Lettres accentuées : lettre de base + un trait (accent grave, aigu, cédille) */
const GRAVE: Pt[] = [[2.5, -4.5], [6, -1.8]];
const ACUTE: Pt[] = [[3, -1.8], [6.5, -4.5]];
const CEDILLA: Pt[] = [[5.2, 14], [5.8, 15.6], [3.8, 17]];
const ACCENTED: Record<string, [string, Pt[]]> = { 'À': ['A', GRAVE], 'É': ['E', ACUTE], 'È': ['E', GRAVE], 'Ç': ['C', CEDILLA] };

/* Trait à main levée : chaque point bouge un peu et les longs segments se courbent légèrement */
export const sketch = (strokes: Pt[][], seed: number, amp: number): Pt[][] => {
  const rnd = random(seed);
  const j = () => (rnd() - 0.5) * 2 * amp;
  return strokes.map((stroke) => {
    const out: Pt[] = [];
    stroke.forEach(([x, y], i) => {
      const p: Pt = [x + j(), y + j()];
      if (i > 0) {
        const q = out[out.length - 1];
        const len = Math.hypot(p[0] - q[0], p[1] - q[1]);
        if (len > 10) {
          const bow = j() * 1.2;
          out.push([(q[0] + p[0]) / 2 - ((p[1] - q[1]) / len) * bow, (q[1] + p[1]) / 2 + ((p[0] - q[0]) / len) * bow]);
        }
      }
      out.push(p);
    });
    return out;
  });
};

export const toPath = (pts: Pt[]) => `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}`;

/* Un mot écrit à la main, en pixels : chaque lettre penche et décolle un peu de la ligne.
   Renvoie les traits (dans l'ordre d'écriture), la largeur et la hauteur (place pour un accent comprise). */
export const handwrite = (text: string, { cap = 10, gap = 3.6, seed = 7, jitter = 0.25 } = {}) => {
  const S = cap / 14;
  const shape = random(seed);
  const noise = random(seed * 31 + 3);
  const top = 5 * S; // place pour l'accent
  const strokes: Pt[][] = [];
  let x = 0;
  for (const ch of text) {
    if (ch === ' ') { x += 6 * S; continue; }
    const accent = ACCENTED[ch];
    const glyph = GLYPHS[accent ? accent[0] : ch];
    if (!glyph) continue;
    const [gw, parts] = glyph;
    const rot = (shape() - 0.5) * 0.14;
    const cx = x + (gw * S) / 2, cy = top + 7 * S + (shape() - 0.5) * 1.6 * S;
    for (const stroke of accent ? [...parts, accent[1]] : parts) {
      strokes.push(stroke.map(([px, py]): Pt => {
        const lx = (px - gw / 2) * S + (noise() - 0.5) * 2 * jitter;
        const ly = (py - 7) * S + (noise() - 0.5) * 2 * jitter;
        return [cx + lx * Math.cos(rot) - ly * Math.sin(rot), cy + lx * Math.sin(rot) + ly * Math.cos(rot)];
      }));
    }
    x += (gw + gap) * S;
  }
  return { strokes, width: Math.max(0, x - gap * S), height: top + 16 * S };
};
