import { useEffect, useRef } from 'react';
import { gsap, hasFinePointer, prefersReducedMotion } from '@/lib/motion';

/* Curseur personnalisé (ordinateur uniquement) : point rapide + anneau avec inertie.
   Un élément avec data-cursor="Texte" affiche ce texte dans l'anneau. */
const Cursor = () => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cursor = ref.current;
    if (!cursor || !hasFinePointer() || prefersReducedMotion()) return;
    const root = document.documentElement;
    root.classList.add('has-cursor');

    const dot = cursor.querySelector<HTMLElement>('.cursor__dot')!;
    const ring = cursor.querySelector<HTMLElement>('.cursor__ring')!;
    const label = cursor.querySelector<HTMLElement>('.cursor__label')!;
    const dx = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3.out' });
    const dy = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3.out' });
    const rx = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3.out' });
    const ry = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3.out' });

    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
      cursor.classList.remove('is-hidden');
    };
    const over = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      const interactive = target.closest('a, button, [role="button"], input, textarea, select, [data-cursor]');
      const text = (target.closest('[data-cursor]') as HTMLElement | null)?.dataset.cursor || '';
      cursor.classList.toggle('is-hover', !!interactive);
      cursor.classList.toggle('has-label', !!text);
      if (text) label.textContent = text;
    };
    const leave = () => cursor.classList.add('is-hidden');
    const down = () => cursor.classList.add('is-down');
    const up = () => cursor.classList.remove('is-down');

    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerover', over);
    root.addEventListener('pointerleave', leave);
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    return () => {
      root.classList.remove('has-cursor');
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerover', over);
      root.removeEventListener('pointerleave', leave);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  return (
    <div ref={ref} className="cursor is-hidden" aria-hidden="true">
      <span className="cursor__ring"><span className="cursor__label" /></span>
      <span className="cursor__dot" />
    </div>
  );
};

export default Cursor;
