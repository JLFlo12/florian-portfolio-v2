import React, { Fragment, useLayoutEffect } from 'react';
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
   <SplitText> : découpe un texte en mots puis en lettres.
   Les lettres s'animent en 3D quand un parent porte [data-split].
   Le texte complet reste lisible par les lecteurs d'écran (aria-label).
   ─────────────────────────────────────────────────────────────── */
export const SplitText = ({ text, className, hidden = false }: { text: string; className?: string; hidden?: boolean }) => {
  const words = text.split(' ');
  const a11y = hidden ? { 'aria-hidden': true as const } : { 'aria-label': text, role: 'text' };
  return (
    <span className={className} {...a11y}>
      {words.map((word, i) => (
        <Fragment key={`${word}-${i}`}>
          <span className="split-word" aria-hidden="true">
            {[...word].map((ch, j) => (
              <span key={j} className="split-char">{ch}</span>
            ))}
          </span>
          {i < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </span>
  );
};

/* ───────────────────────────────────────────────────────────────
   Titre de section : premier(s) mot(s) en italique à empattements,
   la suite en capitales étirées. Ex. "Mes projets" → "Mes" + "PROJETS".
   ─────────────────────────────────────────────────────────────── */
export const AccentTitle = ({
  text, serifWords = 1, className = 'title-xl', as = 'h2', id,
}: { text: string; serifWords?: number; className?: string; as?: 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div'; id?: string }) => {
  const Tag = as as React.ElementType;
  const words = text.trim().split(/\s+/);
  const n = words.length > 1 ? Math.min(serifWords, words.length - 1) : 0;
  const serif = words.slice(0, n).join(' ');
  const rest = words.slice(n).join(' ');
  return (
    <Tag className={className} id={id} data-split aria-label={text}>
      {serif && <SplitText text={serif} className="serif-accent" hidden />}
      {serif && ' '}
      <SplitText text={rest} hidden />
    </Tag>
  );
};

/* ───────────────────────────────────────────────────────────────
   useReveal : active les animations d'apparition dans un bloc.
   - [data-reveal]   : monte et apparaît
   - [data-stagger]  : ses enfants apparaissent l'un après l'autre
   - [data-split]    : ses lettres basculent en 3D
   - [data-rule]     : filet qui se dessine
   - [data-count]    : compteur de 0 à la valeur
   Relancé quand `deps` change (ex. projets chargés depuis Supabase).
   ─────────────────────────────────────────────────────────────── */
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

      root.querySelectorAll<HTMLElement>('[data-split]').forEach((title) => {
        const chars = title.querySelectorAll('.split-char');
        if (!chars.length) return;
        gsap.set(chars, { yPercent: 110, rotationX: -95, opacity: 0, transformPerspective: 700, transformOrigin: '50% 100%' });
        once(title, () => gsap.to(chars, { yPercent: 0, rotationX: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.022 }));
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
