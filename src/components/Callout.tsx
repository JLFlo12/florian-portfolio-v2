import React, { useMemo } from 'react';
import { handwrite, sketch, toPath, type Pt } from '@/lib/handwriting';

/* Nom écrit à la main au bout d'un trait (d'après le croquis de Florian) : le trait part de l'objet
   (satellite, bouton 3D), descend, s'arrondit puis file à l'horizontale, vers la droite (dir 1) ou
   vers la gauche (dir -1) ; le nom s'écrit au-dessus. Le trait se trace d'abord, puis les lettres (--i : ordre du trait).
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
