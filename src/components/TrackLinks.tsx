import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap, prefersReducedMotion, scrambleText } from '@/lib/motion';

/* ───────────────────────────────────────────────────────────────
   Liste de liens en très grandes capitales (inspirée du menu de
   landonorris.com) :
   - au survol, les lettres "roulent" et laissent place à leur copie orange ;
   - le lien survolé (ou sélectionné au clavier) est barré d'un tracé
     qui se déroule, puis file vers la droite quand on le quitte ;
   - l'adresse du lien survolé s'affiche en dessous, façon terminal
     (l'e-mail par défaut).
   ─────────────────────────────────────────────────────────────── */

export interface TrackItem {
  id: string;
  label: string;   // mot affiché en grand
  value: string;   // adresse affichée sous la liste
  href: string;
  external?: boolean;
  cursor?: string; // texte du curseur personnalisé
}

/* Tracé "circuit" : paliers haut/bas reliés par des courbes douces */
const trackPath = (w: number, h: number, sw: number) => {
  const top = sw / 2 + 0.5;
  const bottom = h - sw / 2 - 0.5;
  const n = Math.max(2, Math.round(w / 140));
  const seg = w / n;
  const bend = Math.min(seg * 0.45, h * 2.2);
  const f = (v: number) => v.toFixed(1);
  let y = top;
  let d = `M0 ${f(top)}`;
  for (let i = 1; i < n; i++) {
    const x = seg * i;
    const ny = y === top ? bottom : top;
    d += `H${f(x - bend / 2)}C${f(x)} ${f(y)} ${f(x)} ${f(ny)} ${f(x + bend / 2)} ${f(ny)}`;
    y = ny;
  }
  return `${d}H${f(w)}`;
};

const TrackLine = ({ on }: { on: boolean }) => {
  const svg = useRef<SVGSVGElement>(null);
  const path = useRef<SVGPathElement>(null);
  const shown = useRef(false);
  const [box, setBox] = useState({ w: 0, h: 0 });

  // Le tracé est recalculé à la taille réelle du mot (police chargée, écran redimensionné…)
  useLayoutEffect(() => {
    const el = svg.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox((b) => (b.w === Math.round(r.width) && b.h === Math.round(r.height) ? b : { w: Math.round(r.width), h: Math.round(r.height) }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Longueur du tracé + marge d'une épaisseur, pour que l'extrémité arrondie
  // ne laisse pas de point visible quand le tracé est caché
  const hiddenOffset = (p: SVGPathElement) => p.getTotalLength() + Math.max(2, box.h * 0.15);

  // Nouvelle taille : longueur mise à jour sans animation
  useLayoutEffect(() => {
    const p = path.current;
    if (!p) return;
    const len = p.getTotalLength();
    const off = hiddenOffset(p);
    gsap.killTweensOf(p);
    gsap.set(p, { strokeDasharray: `${len} ${off + len}`, strokeDashoffset: shown.current ? 0 : off });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box]);

  // Actif : le tracé se déroule de gauche à droite. Inactif : il file vers la droite.
  useEffect(() => {
    const p = path.current;
    if (!p || on === shown.current) return;
    shown.current = on;
    const off = hiddenOffset(p);
    gsap.killTweensOf(p);
    if (prefersReducedMotion()) { gsap.set(p, { strokeDashoffset: on ? 0 : off }); return; }
    if (on) gsap.fromTo(p, { strokeDashoffset: off }, { strokeDashoffset: 0, duration: 1.1, ease: 'expo.out' });
    else gsap.to(p, { strokeDashoffset: -off, duration: 0.55, ease: 'power2.in' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, box.w]);

  const sw = Math.max(2, box.h * 0.15);
  return (
    <svg ref={svg} className="track-line" viewBox={`0 0 ${box.w || 1} ${box.h || 1}`} overflow="visible" aria-hidden="true">
      {box.w > 0 && <path ref={path} d={trackPath(box.w, box.h, sw)} strokeWidth={sw} />}
    </svg>
  );
};

const TrackLinks = ({ items, live }: { items: TrackItem[]; live: boolean }) => {
  // Lien survolé ou sélectionné au clavier (aucun = pas de tracé)
  const [active, setActive] = useState<number | null>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const release = (i: number) => setActive((a) => (a === i ? null : a));
  const value = items[active ?? 0].value;

  // L'adresse est écrite hors de React (effet "décodage" lettre par lettre)
  useEffect(() => {
    const el = readout.current;
    if (!el) return;
    if (live) scrambleText(el, value, 520);
    else el.textContent = value;
  }, [value, live]);

  return (
    <div className="flex w-full flex-col items-center">
      <ul className="track-list font-display">
        {items.map((item, i) => (
          <li key={item.id}>
            <a
              href={item.href}
              target={item.external ? '_blank' : undefined}
              rel={item.external ? 'noopener noreferrer' : undefined}
              className={`track-link${i === active ? ' is-active' : ''}`}
              aria-label={`${item.label} — ${item.value}`}
              data-cursor={item.cursor}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => release(i)}
              onFocus={() => setActive(i)}
              onBlur={() => release(i)}
            >
              <span className="track-clip" aria-hidden="true">
                <span className="track-inner" data-track-inner>
                  {[...item.label].map((ch, j) => (
                    <span key={j} className="track-char" style={{ '--i': j } as React.CSSProperties}>
                      {ch === ' ' ? ' ' : ch}
                    </span>
                  ))}
                </span>
              </span>
              <TrackLine on={live && i === active} />
            </a>
          </li>
        ))}
      </ul>
      <p className="track-readout" aria-hidden="true" data-contact-fade>
        <span className="text-primary">→</span> <span ref={readout} />
      </p>
    </div>
  );
};

export default TrackLinks;
