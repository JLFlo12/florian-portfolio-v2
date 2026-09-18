import { forwardRef, useMemo } from 'react';

/* ───────────────────────────────────────────────────────────────
   Fond "courbes de niveau" (carte topographique), généré une fois.
   Chaque colline = des boucles emboîtées qui ne se croisent pas.
   Les tracés ont pathLength=1 pour pouvoir les "dérouler" avec GSAP
   (attribut stroke-dashoffset de 1 à 0).
   ─────────────────────────────────────────────────────────────── */

// Générateur pseudo-aléatoire à graine : même dessin à chaque visite
const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Boucle fermée lissée (Catmull-Rom → courbes de Bézier)
const smoothLoop = (pts: [number, number][]) => {
  const n = pts.length;
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
};

const HILLS = [
  { cx: 180, cy: 860, levels: 8 },
  { cx: 1420, cy: 140, levels: 8 },
  { cx: 1320, cy: 930, levels: 5 },
  { cx: 560, cy: 90, levels: 5 },
  { cx: 860, cy: 520, levels: 3 },
];

const buildTopo = () => {
  const rand = mulberry32(974);
  return HILLS.map(({ cx, cy, levels }) => {
    const step = 62 + rand() * 26;
    const rot = rand() * Math.PI;
    const sx = 0.8 + rand() * 0.5, sy = 0.8 + rand() * 0.5;
    // Forme commune de la colline (harmoniques), bornée pour que les boucles ne se croisent pas
    const harm = [2, 3, 4, 5].map((k) => ({ k, a: (0.05 + rand() * 0.07) * (2 / k), p: rand() * Math.PI * 2 }));
    const wobble = rand() * Math.PI * 2;
    const loops: string[] = [];
    for (let l = 1; l <= levels; l++) {
      const pts: [number, number][] = [];
      for (let i = 0; i < 64; i++) {
        const th = (i / 64) * Math.PI * 2;
        const shape = harm.reduce((s, h) => s + h.a * Math.sin(h.k * th + h.p), 0);
        const r = step * l * (1 + shape) + step * 0.18 * Math.sin(3 * th + wobble + l * 0.9);
        const x = Math.cos(th) * r * sx, y = Math.sin(th) * r * sy;
        pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
      }
      loops.push(smoothLoop(pts));
    }
    return loops;
  });
};

const TopoLines = forwardRef<SVGSVGElement, { className?: string }>(({ className }, ref) => {
  const hills = useMemo(buildTopo, []);
  return (
    <svg ref={ref} className={className} viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
      {hills.map((loops, i) => (
        <g key={i}>
          {loops.map((d, j) => (
            <path key={j} d={d} pathLength={1} strokeDasharray="1" strokeDashoffset="0" data-topo />
          ))}
        </g>
      ))}
    </svg>
  );
});
TopoLines.displayName = 'TopoLines';

export default TopoLines;
