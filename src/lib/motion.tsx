import React, { useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

/** Vrai si l'utilisateur a demandé à réduire les animations. */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Vrai sur ordinateur (souris précise). */
export const hasFinePointer = () =>
  typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ───────────────────────────────────────────────────────────────
   Titre de section : premier(s) mot(s) en italique à empattements,
   la suite en capitales étirées. Ex. "Mes projets" → "Mes" + "PROJETS".
   Il apparaît avec la bande de couleur ; `band` = délai (s).
   ─────────────────────────────────────────────────────────────── */
export const AccentTitle = ({
  text, serifWords = 1, className = 'title-xl', as = 'h2', id, band = 0,
}: { text: string; serifWords?: number; className?: string; as?: 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div'; id?: string; band?: number }) => {
  const Tag = as as React.ElementType;
  const words = text.trim().split(/\s+/);
  const n = words.length > 1 ? Math.min(serifWords, words.length - 1) : 0;
  const serif = words.slice(0, n).join(' ');
  const rest = words.slice(n).join(' ');
  return (
    <Tag className={className} id={id} data-band={band || ''} aria-label={text}>
      {serif && <span className="serif-accent" aria-hidden="true">{serif}</span>}
      {serif && ' '}
      <span aria-hidden="true">{rest}</span>
    </Tag>
  );
};

/* ───────────────────────────────────────────────────────────────
   Bande de couleur (façon landonorris.com) : sur chaque ligne du texte,
   une bande orange arrive de la gauche et couvre la ligne, puis se retire
   vers la droite en laissant le texte derrière elle.
   Les lignes sont mesurées au moment de l'animation (Range.getClientRects) :
   le texte n'est pas découpé, React garde la main sur son contenu.
   Le texte est caché (visibility) tant que toutes les lignes ne sont pas couvertes.
   ─────────────────────────────────────────────────────────────── */
function textLines(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 1 && r.height > 1).sort((a, b) => a.top - b.top);
  const lines: { mid0: number; mid1: number; left: number; right: number; top: number; bottom: number }[] = [];
  rects.forEach((r) => {
    const mid = r.top + r.height / 2;
    const line = lines.find((l) => mid >= l.mid0 && mid <= l.mid1);
    if (line) {
      line.left = Math.min(line.left, r.left); line.right = Math.max(line.right, r.right);
      line.top = Math.min(line.top, r.top); line.bottom = Math.max(line.bottom, r.bottom);
    } else {
      lines.push({ mid0: r.top, mid1: r.bottom, left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    }
  });
  const box = el.getBoundingClientRect();
  const ox = box.left + el.clientLeft;
  const oy = box.top + el.clientTop;
  return lines.map((l) => {
    const h = l.bottom - l.top;
    const pad = h * 0.13; // l'italique déborde de sa boîte (surtout à gauche)
    return { x: l.left - ox - pad, y: l.top - oy - h * 0.03, w: l.right - l.left + pad * 2, h: h * 1.06 };
  });
}

export function bandReveal(el: HTMLElement, delay = 0) {
  el.querySelectorAll(':scope > .band').forEach((band) => band.remove());
  const lines = textLines(el);
  if (!lines.length) { el.style.removeProperty('visibility'); return; }
  const positioned = getComputedStyle(el).position !== 'static';
  if (!positioned) el.style.position = 'relative';
  const bands = lines.map(({ x, y, w, h }) => {
    const band = document.createElement('span');
    band.className = 'band';
    band.setAttribute('aria-hidden', 'true');
    Object.assign(band.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    el.appendChild(band);
    return band;
  });
  const each = 0.09;   // décalage entre deux lignes (s)
  const cover = 0.5;   // arrivée de la bande
  const covered = (bands.length - 1) * each + cover;
  gsap.timeline({
    delay,
    onComplete: () => {
      bands.forEach((band) => band.remove());
      if (!positioned) el.style.removeProperty('position');
      el.style.removeProperty('visibility');
    },
  })
    .fromTo(bands, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: cover, ease: 'power3.inOut', stagger: each }, 0)
    .set(el, { visibility: 'visible' }, covered)
    .set(bands, { transformOrigin: '100% 50%' }, covered)
    .to(bands, { scaleX: 0, duration: 0.55, ease: 'power3.inOut', stagger: each }, covered);
}

/* ───────────────────────────────────────────────────────────────
   useReveal : active les animations d'apparition dans un bloc.
   - [data-reveal]   : monte et apparaît
   - [data-stagger]  : ses enfants apparaissent l'un après l'autre
   - [data-band]     : le texte apparaît derrière une bande de couleur (valeur = délai en s)
   - [data-rule]     : filet qui se dessine
   - [data-count]    : compteur de 0 à la valeur
   Relancé quand `deps` change (ex. projets chargés depuis Supabase).
   ─────────────────────────────────────────────────────────────── */
const banded = new WeakSet<Element>();

export function useReveal(scope: React.RefObject<HTMLElement>, deps: React.DependencyList = []) {
  useLayoutEffect(() => {
    const root = scope.current;
    if (!root || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const once = (trigger: Element, onEnter: () => void, start = 'top 88%') =>
        ScrollTrigger.create({ trigger, start, once: true, onEnter });

      root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
        gsap.set(el, { autoAlpha: 0, y: 44 });
        once(el, () => gsap.to(el, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'power3.out', clearProps: 'transform' }));
      });

      root.querySelectorAll<HTMLElement>('[data-stagger]').forEach((group) => {
        const items = Array.from(group.children);
        const flip = group.dataset.stagger === 'flip';
        gsap.set(items, flip
          ? { autoAlpha: 0, y: 70, rotationY: -55, z: -160, transformPerspective: 1100, transformOrigin: '0% 50%' }
          : { autoAlpha: 0, y: 50 });
        once(group, () => gsap.to(items, {
          autoAlpha: 1, y: 0, rotationY: 0, z: 0,
          duration: flip ? 1.4 : 1, ease: flip ? 'expo.out' : 'power3.out', stagger: 0.08,
          clearProps: 'transform', // rend la main aux effets de survol CSS
        }), 'top 90%');
      });

      // Hors du contexte : une bande lancée va au bout même si le bloc relance ses animations
      // (ex. projets arrivés de Supabase), et ne rejoue pas.
      root.querySelectorAll<HTMLElement>('[data-band]').forEach((el) => {
        if (banded.has(el)) return;
        el.style.visibility = 'hidden';
        once(el, () => {
          banded.add(el);
          gsap.context().ignore(() => bandReveal(el, Number(el.dataset.band) || 0));
        });
      });

      root.querySelectorAll<HTMLElement>('[data-rule]').forEach((rule) => {
        gsap.set(rule, { scaleX: 0 });
        once(rule, () => gsap.to(rule, { scaleX: 1, duration: 1.2, ease: 'expo.out' }));
      });

      root.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
        const target = Number(el.dataset.count || 0);
        const pad = Number(el.dataset.pad || 0);
        const state = { v: 0 };
        const write = () => { el.textContent = String(Math.round(state.v)).padStart(pad, '0'); };
        write();
        once(el, () => gsap.to(state, { v: target, duration: 1.6, ease: 'power2.out', onUpdate: write }));
      });
    }, root);

    ScrollTrigger.refresh();
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Petit effet "aimant" : l'élément suit légèrement la souris. */
export function magnetic(el: HTMLElement | null, strength = 0.25) {
  if (!el || !hasFinePointer() || prefersReducedMotion()) return () => {};
  const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
  const y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
  const move = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    x((e.clientX - r.left - r.width / 2) * strength);
    y((e.clientY - r.top - r.height / 2) * strength);
  };
  const leave = () => { x(0); y(0); };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerleave', leave);
  return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); };
}

/** Texte "décodé" façon terminal (lettres aléatoires qui se stabilisent).
 *  Un nouvel appel sur le même élément annule le précédent. */
const scrambleRuns = new WeakMap<HTMLElement, number>();
export function scrambleText(el: HTMLElement, text: string, duration = 700) {
  cancelAnimationFrame(scrambleRuns.get(el) ?? 0);
  if (prefersReducedMotion()) { el.textContent = text; return; }
  const glyphs = '▓▒░<>/\\|#?*_01';
  const start = performance.now();
  const step = (now: number) => {
    const p = Math.min((now - start) / duration, 1);
    el.textContent = [...text].map((ch, i) => (ch === ' ' || i < p * text.length ? ch : glyphs[(Math.random() * glyphs.length) | 0])).join('');
    if (p < 1) scrambleRuns.set(el, requestAnimationFrame(step));
  };
  scrambleRuns.set(el, requestAnimationFrame(step));
}
