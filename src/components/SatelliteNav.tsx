import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TAU, arc, handwrite, sketch, toPath, type Pt } from '@/lib/handwriting';
import { prefersReducedMotion } from '@/lib/motion';
import type { SatelliteScene } from '@/components/three/satellites';

/* ───────────────────────────────────────────────────────────────
   Menu en satellites (idée de Florian) : un petit satellite 3D par page, sans capsule de verre.
   Le nom s'écrit à la main sous le satellite : toujours pour la page en cours, au survol
   ou au clavier pour les autres (un seul nom à la fois). Le nom reste lisible par les
   lecteurs d'écran (texte masqué).
   Sur l'accueil, tant que le haut de page est à l'écran, ce menu s'efface : les satellites
   sont alors dans le ciel, autour de la planète (OrbitNav).
   La scène 3D (three/satellites.ts) se charge une fois la page affichée ; en attendant, sans WebGL
   ou avec les animations réduites, des satellites dessinés à la main (même style que l'écran
   de chargement) la remplacent.
   ─────────────────────────────────────────────────────────────── */

const SPACING = 84; // écart moyen entre deux satellites (px)
const canvasW = (n: number) => n * SPACING + 80; // marge pour les satellites décalés aux bords
const CANVAS_H = 120;
// Un peu de désordre, sans exagérer : décalage (px), taille et inclinaison de chaque satellite.
// Les liens (zones cliquables) suivent les mêmes décalages que la scène 3D.
const LAYOUT = [
  { dx: -6, dy: -7, s: 1, rz: 0.08 },
  { dx: 4, dy: 8, s: 0.84, rz: -0.12 },
  { dx: -2, dy: -10, s: 0.94, rz: 0.05 },
  { dx: 6, dy: 6, s: 0.86, rz: -0.07 },
  { dx: -4, dy: -3, s: 0.92, rz: 0.1 },
];
const spotOf = (i: number) => LAYOUT[i % LAYOUT.length];

const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
const ellipse = (cx: number, cy: number, rx: number, ry: number, tilt: number, n = 24): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * TAU;
    const x = rx * Math.cos(a), y = ry * Math.sin(a);
    return [cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)];
  });

// Croquis de secours, dans une boîte de 40 × 28 (dans l'ordre du menu)
const SHAPES: Pt[][][] = [
  // Accueil : satellite à deux panneaux solaires (le croquis de Florian)
  [
    rect(15, 9, 25, 19),
    rect(1, 10, 12, 18), [[5, 10], [5, 18]], [[8.5, 10], [8.5, 18]], [[1, 14], [12, 14]],
    rect(28, 10, 39, 18), [[31.5, 10], [31.5, 18]], [[35, 10], [35, 18]], [[28, 14], [39, 14]],
    [[12, 14], [15, 14]], [[25, 14], [28, 14]],
    [[20, 9], [20, 4]], [[17, 4], [23, 4]],
  ],
  // Projets : satellite à parabole
  [
    rect(0, 11, 5, 19), [[2.5, 11], [2.5, 19]],
    [[5, 15], [7, 15]], rect(7, 10, 15, 20), [[15, 15], [19, 15]],
    Array.from({ length: 11 }, (_, i): Pt => { const y = 5 + i * 2; return [19 + ((y - 15) ** 2) / 14, y]; }),
    [[19, 15], [27, 15]], [[26, 13], [28, 15], [26, 17]],
  ],
  // À propos : Spoutnik, une sphère et quatre longues antennes
  [
    arc(13, 14, 7, 7, 0, TAU, 18), [[9, 11], [12, 9]],
    [[19, 10], [39, 3]], [[20, 13], [40, 10]], [[20, 16], [40, 19]], [[19, 18], [39, 26]],
  ],
  // Contact : satellite qui émet des ondes
  [
    rect(0, 10, 6, 18), [[3, 10], [3, 18]], [[6, 14], [8, 14]],
    rect(8, 9, 16, 19), [[12, 9], [12, 5]], [[10, 5], [14, 5]], [[16, 14], [20, 14]],
    arc(20, 14, 4, 4, -0.8, 0.8, 6), arc(20, 14, 9, 9, -0.75, 0.75, 8), arc(20, 14, 14, 14, -0.7, 0.7, 10),
  ],
  // Jarvis : une petite sphère dans son anneau
  [
    arc(20, 14, 6.5, 6.5, 0, TAU, 18), ellipse(20, 14, 18, 5, -0.28), [[16, 11], [18.5, 9.5]],
  ],
];

// Deux versions de chaque croquis : elles alternent au survol (trait qui « bout »)
const FRAMES = SHAPES.map((shape, k) => [3 + k * 7, 101 + k * 13].map((seed) => sketch(shape, seed, 0.45).map(toPath)));

const Sketch = ({ kind }: { kind: number }) => (
  <svg className="sat-icon" viewBox="-3 -3 46 34" fill="none" aria-hidden="true">
    {FRAMES[kind % FRAMES.length].map((paths, f) => (
      <g key={f} className="sat-frame">
        {paths.map((d, i) => <path key={i} d={d} />)}
      </g>
    ))}
    <circle className="sat-beacon-ring" cx="40" cy="1" r="1.7" />
    <circle className="sat-beacon" cx="40" cy="1" r="1.7" />
  </svg>
);

/* Nom écrit à la main au bout d'un trait (croquis de Florian) : le trait part du satellite, descend,
   s'arrondit puis file à l'horizontale (vers la droite, ou vers la gauche pour les derniers) ;
   le nom s'écrit au-dessus. Le trait se trace d'abord, puis les lettres (--i : ordre du trait).
   Un contour couleur du fond passe sous le trait pour qu'il reste lisible sur le décor. */
const PAD = 4;
export const Callout = ({ text, dir, drop, cap = 9 }: { text: string; dir: 1 | -1; drop: number; cap?: number }) => {
  const g = useMemo(() => {
    const word = handwrite(text, { cap });
    const run = 16 + word.width + 10;
    const lead = sketch([[[0, 0], [0.8, 8], [2.5, 15], [6, 20], [11, 22.5], [16, 23], [run, 23]]], 17, 0.35)[0]
      .map(([x, y]): Pt => [x * dir, y]);
    const tx = dir > 0 ? 17 : -(17 + word.width);
    const ty = 19.5 - (word.height - (2 * cap) / 14); // ligne de base du mot juste au-dessus du trait
    const strokes = [lead, ...word.strokes.map((s) => s.map(([x, y]): Pt => [x + tx, y + ty]))];
    const xs = strokes.flat().map((p) => p[0]), ys = strokes.flat().map((p) => p[1]);
    const minX = Math.min(...xs) - PAD, minY = Math.min(...ys) - PAD;
    return { paths: strokes.map(toPath), minX, minY, w: Math.max(...xs) + PAD - minX, h: Math.max(...ys) + PAD - minY };
  }, [text, dir, cap]);
  const order = (i: number) => ({ '--i': i }) as React.CSSProperties;
  return (
    <svg
      className="sat-label"
      style={{ left: `calc(50% + ${g.minX}px)`, top: `calc(50% + ${drop + g.minY}px)` }}
      width={g.w}
      height={g.h}
      viewBox={`${g.minX} ${g.minY} ${g.w} ${g.h}`}
      fill="none"
      aria-hidden="true"
    >
      {g.paths.map((d, i) => <path key={`h${i}`} className="sat-halo" d={d} pathLength={1} style={order(i)} />)}
      {g.paths.map((d, i) => <path key={`t${i}`} d={d} pathLength={1} style={order(i)} />)}
    </svg>
  );
};

type Item = { path: string; label: string };

const SatelliteNav = ({ items, isActive }: { items: Item[]; isActive: (path: string) => boolean }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<SatelliteScene | null>(null);
  const [ready, setReady] = useState(false);
  const activeIndex = items.findIndex((item) => isActive(item.path));
  const activeRef = useRef(activeIndex);
  activeRef.current = activeIndex;

  // Scène 3D : chargée quand le navigateur est libre, seulement sur grand écran et si les animations sont permises
  useEffect(() => {
    if (prefersReducedMotion() || !window.matchMedia('(min-width: 768px)').matches) return;
    let cancelled = false;
    const n = items.length;
    const start = () => {
      import('@/components/three/satellites')
        .then(({ createSatellites }) => {
          if (cancelled || !canvas.current) return;
          const spots = Array.from({ length: n }, (_, i) => ({ ...spotOf(i), x: (i - (n - 1) / 2) * SPACING + spotOf(i).dx, y: spotOf(i).dy }));
          scene.current = createSatellites(canvas.current, spots, canvasW(n), CANVAS_H);
          scene.current.setActive(activeRef.current);
          setReady(true);
        })
        .catch(() => { /* pas de WebGL : les croquis restent */ });
    };
    const idle = window.requestIdleCallback ? window.requestIdleCallback(start, { timeout: 1500 }) : window.setTimeout(start, 600);
    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle); else window.clearTimeout(idle);
      scene.current?.dispose();
      scene.current = null;
    };
  }, [items.length]);

  useEffect(() => { scene.current?.setActive(activeIndex); }, [activeIndex]);

  const hover = (i: number) => () => scene.current?.setHover(i);

  return (
    <div className={`sat-nav hidden items-center md:flex ${ready ? 'is-3d' : ''}`}>
      <canvas ref={canvas} className="sat-canvas" style={{ width: canvasW(items.length), height: CANVAS_H }} aria-hidden="true" />
      {items.map((item, i) => {
        const active = i === activeIndex;
        const spot = spotOf(i);
        return (
          <Link
            key={item.path}
            to={item.path}
            className="sat-link"
            style={{ translate: `${spot.dx}px ${spot.dy}px`, '--s': spot.s } as React.CSSProperties}
            data-active={active}
            aria-current={active ? 'page' : undefined}
            onPointerEnter={hover(i)}
            onPointerLeave={hover(-1)}
            onFocus={hover(i)}
            onBlur={hover(-1)}
          >
            <Sketch kind={i} />
            <span className="sr-only">{item.label}</span>
            <Callout text={item.label.toLocaleUpperCase('fr')} dir={i < 3 ? 1 : -1} drop={Math.round(16 * spot.s)} />
          </Link>
        );
      })}
    </div>
  );
};

export default SatelliteNav;
