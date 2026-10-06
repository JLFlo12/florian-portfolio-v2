import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from '@/lib/motion';
import { markReady } from '@/lib/ready';

/* Écran de chargement : un croquis de la planète (trait de la couleur du texte, point orange
   sur La Réunion) et le mot « chargement » écrit à la main. Le dessin se trace, puis son trait
   « bout » : trois versions légèrement différentes se succèdent, comme une animation faite à la main.
   Quand la page est prête (polices chargées, durée minimale écoulée), le mot s'efface et l'écran
   s'ouvre en cercle depuis le centre de la planète. Plus court pendant la même session. */

type Pt = [number, number];
type Stroke = { pts: Pt[]; delay: number; dur: number; word?: boolean };

const TAU = Math.PI * 2;
const C: Pt = [80, 46]; // centre de la planète (unités du viewBox 160 × 108)
const R = 25;           // rayon de la planète

/* Pseudo-aléatoire à graine fixe : le croquis est identique à chaque visite */
const random = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 14): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });

/* Capitales tracées à la main, dans une boîte de 14 de haut : [largeur, traits] */
const GLYPHS: Record<string, [number, Pt[][]]> = {
  A: [10, [[[0, 14], [5, 0], [10, 14]], [[2.3, 8.6], [7.7, 8.6]]]],
  C: [10, [arc(5, 7, 5, 7, -0.75, -5.55)]],
  D: [10, [[[1, 14], [1, 0]], arc(1, 7, 9, 7, -Math.PI / 2, Math.PI / 2)]],
  E: [9, [[[9, 0], [1, 0], [1, 14], [9, 14]], [[1, 7], [7, 7]]]],
  G: [10, [[...arc(5, 7, 5, 7, -0.75, -5.6), [10, 7.6], [6, 7.6]]]],
  H: [10, [[[1, 0], [1, 14]], [[9, 0], [9, 14]], [[1, 7], [9, 7]]]],
  I: [2, [[[1, 0], [1, 14]]]],
  L: [9, [[[1, 0], [1, 14], [8.5, 14]]]],
  M: [12, [[[0.5, 14], [1, 0], [6, 9], [11, 0], [11.5, 14]]]],
  N: [10, [[[1, 14], [1, 0], [9, 14], [9, 0]]]],
  O: [10, [arc(5, 7, 5, 7, -1.4, -1.4 - TAU - 0.3, 18)]],
  R: [10, [[[1, 14], [1, 0]], arc(1, 3.6, 7.5, 3.6, -Math.PI / 2, Math.PI / 2, 8), [[4, 7.2], [9.5, 14]]]],
  T: [10, [[[0, 0.3], [10, 0]], [[5, 0], [5, 14]]]],
};

/* Une version du croquis : même dessin, trait qui bouge un peu selon la graine */
const drawFrame = (seed: number, word: string) => {
  const rnd = random(seed);
  const jit = (amp: number) => (rnd() - 0.5) * 2 * amp;
  const strokes: Stroke[] = [];

  // Planète : cercle légèrement irrégulier, dont la fin du trait déborde comme sur un vrai croquis
  const p1 = rnd() * TAU, p2 = rnd() * TAU, a0 = -2.1 + jit(0.1);
  strokes.push({ delay: 0, dur: 0.65, pts: Array.from({ length: 49 }, (_, i): Pt => {
    const a = a0 + ((TAU + 0.4) * i) / 48;
    const r = R + 0.7 * Math.sin(2 * a + p1) + 0.45 * Math.sin(3 * a + p2) + Math.max(0, i - 44) * 0.35;
    return [C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)];
  }) });

  // Anneau incliné : l'avant passe devant la planète, l'arrière n'est visible qu'en dehors d'elle
  const tilt = -0.244 + jit(0.015), rx = 52 + jit(0.5), ry = 12.5 + jit(0.3);
  const ringPt = (t: number): Pt => {
    const x = rx * Math.cos(t), y = ry * Math.sin(t);
    return [C[0] + x * Math.cos(tilt) - y * Math.sin(tilt), C[1] + 1.5 + x * Math.sin(tilt) + y * Math.cos(tilt)];
  };
  strokes.push({ delay: 0.35, dur: 0.5, pts: Array.from({ length: 41 }, (_, i) => ringPt(-0.12 + ((Math.PI + 0.24) * i) / 40)) });
  const back: Pt[][] = [[]];
  for (let i = 0; i <= 40; i++) {
    const p = ringPt(Math.PI + (Math.PI * i) / 40);
    if (Math.hypot(p[0] - C[0], p[1] - C[1]) > R + 2) back[back.length - 1].push(p);
    else if (back[back.length - 1].length) back.push([]);
  }
  back.filter((s) => s.length > 1).forEach((pts) => strokes.push({ delay: 0.55, dur: 0.3, pts }));

  // Hachures d'ombre, côté droit
  [-1.15, -0.8, -0.45, -0.1].forEach((a, k) => {
    const b: Pt = [C[0] + 17 * Math.cos(a) + jit(0.4), C[1] + 17 * Math.sin(a) + jit(0.4)];
    const h = [3, 4, 4, 3][k];
    strokes.push({ delay: 0.7 + k * 0.05, dur: 0.15, pts: [[b[0] - 0.5 * h, b[1] + 0.87 * h], [b[0] + 0.5 * h + jit(0.3), b[1] - 0.87 * h + jit(0.3)]] });
  });

  // Deux petites étoiles et un point
  ([[24, 20, 3.2], [142, 74, 2.6]] as const).forEach(([x, y, s]) => {
    strokes.push({ delay: 0.8, dur: 0.15, pts: [[x - s + jit(0.3), y + jit(0.3)], [x + s + jit(0.3), y + jit(0.3)]] });
    strokes.push({ delay: 0.85, dur: 0.15, pts: [[x + jit(0.3), y - s + jit(0.3)], [x + jit(0.3), y + s + jit(0.3)]] });
  });
  strokes.push({ delay: 0.9, dur: 0.1, pts: [[138, 14], [138.2, 14.1]] });

  // Mot écrit à la main : chaque lettre penche et décolle un peu de la ligne (toujours de la même façon)
  const shape = random(7);
  const S = 10.5 / 14;
  const GAP = 3.6;
  const letters = [...word].map((ch) => GLYPHS[ch]).filter(Boolean);
  let x = C[0] - (letters.reduce((w, [gw]) => w + gw + GAP, -GAP) * S) / 2;
  letters.forEach(([gw, glyph], i) => {
    const rot = (shape() - 0.5) * 0.16;
    const cx = x + (gw * S) / 2, cy = 92 + 7 * S + (shape() - 0.5) * 2.2;
    glyph.forEach((g) => strokes.push({ word: true, delay: 0.45 + i * 0.06, dur: 0.28, pts: g.map(([px, py]): Pt => {
      const lx = (px - gw / 2) * S + jit(0.3), ly = (py - 7) * S + jit(0.3);
      return [cx + lx * Math.cos(rot) - ly * Math.sin(rot), cy + lx * Math.sin(rot) + ly * Math.cos(rot)];
    }) }));
    x += (gw + GAP) * S;
  });

  return { strokes, dot: [68.5 + jit(0.3), 40 + jit(0.3)] as Pt };
};

const toPath = (pts: Pt[]) => `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}`;

const Preloader = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { i18n } = useTranslation();
  const word = i18n.language?.startsWith('en') ? 'LOADING' : 'CHARGEMENT';
  const frames = useMemo(() => [11, 23, 37].map((seed) => drawFrame(seed, word)), [word]);

  useEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (!el || !root.classList.contains('is-loading')) { markReady(); return; }

    let quick = false;
    try { quick = sessionStorage.getItem('florian-boot') === '1'; sessionStorage.setItem('florian-boot', '1'); } catch { /* stockage indisponible */ }
    if (quick) el.classList.add('is-quick');

    let tl: gsap.core.Timeline | undefined;
    let cancelled = false;
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();

    Promise.all([wait(quick ? 350 : 1600), Promise.race([fonts, wait(2500)])]).then(() => {
      if (cancelled) return;
      const ring = el.querySelector('.loader__ring');
      // Le cercle s'ouvre depuis le centre de la planète dessinée
      const planet = el.querySelector('[data-planet]')!.getBoundingClientRect();
      const cx = planet.left + planet.width / 2;
      const cy = planet.top + planet.height / 2;
      const radius = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy)) + 20;
      gsap.set(el, { '--hx': `${cx}px`, '--hy': `${cy}px` });
      tl = gsap.timeline({ defaults: { overwrite: 'auto' } })
        .to(el.querySelectorAll('[data-word]'), { opacity: 0, y: 4, duration: 0.3, ease: 'power2.in' })
        .addLabel('open', '-=0.05')
        .set(ring, { opacity: 1 }, 'open')
        .to(el, { '--hole': `${radius}px`, duration: 1.1, ease: 'expo.inOut' }, 'open')
        .to(ring, { opacity: 0, duration: 0.7, ease: 'power1.in' }, 'open+=0.35')
        .call(markReady, [], 'open+=0.3')
        .call(() => root.classList.remove('is-loading'));
      if (quick) tl.timeScale(1.4);
    });

    return () => { cancelled = true; tl?.kill(); root.classList.remove('is-loading'); markReady(); };
  }, []);

  return (
    <div ref={ref} className="loader" aria-hidden="true">
      <div className="loader__veil">
        <svg className="loader__sketch" viewBox="0 0 160 108" fill="none">
          {frames.map((frame, f) => (
            <g key={f} className="loader__frame">
              {[false, true].map((isWord) => (
                <g key={String(isWord)} data-word={isWord || undefined}>
                  {frame.strokes.filter((s) => !!s.word === isWord).map((s, i) => (
                    <path key={i} d={toPath(s.pts)} pathLength={1} style={{ '--d': `${s.delay}s`, '--t': `${s.dur}s` } as React.CSSProperties} />
                  ))}
                </g>
              ))}
              <circle className="loader__dot" cx={frame.dot[0]} cy={frame.dot[1]} r={2.4} />
            </g>
          ))}
          {/* Repère invisible : centre et taille de la planète, pour ouvrir le cercle depuis elle */}
          <circle data-planet cx={C[0]} cy={C[1]} r={R} />
        </svg>
      </div>
      <div className="loader__ring" />
    </div>
  );
};

export default Preloader;
