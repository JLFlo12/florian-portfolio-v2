import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from '@/lib/motion';
import { markReady } from '@/lib/ready';
import Logo from '@/components/Logo';

/* Écran de chargement "florian.sys" : compteur LED, journal de démarrage, volets qui s'ouvrent.
   Plus court quand on revient pendant la même session. */
const Preloader = () => {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const lines = t('ui.loaderLines', { returnObjects: true }) as string[];

  useEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (!el || !root.classList.contains('is-loading')) { markReady(); return; }

    let quick = false;
    try { quick = sessionStorage.getItem('florian-boot') === '1'; sessionStorage.setItem('florian-boot', '1'); } catch { /* stockage indisponible */ }

    const count = el.querySelector<HTMLElement>('[data-loader-count]')!;
    const bar = el.querySelector<HTMLElement>('.loader__bar i')!;
    const items = Array.from(el.querySelectorAll<HTMLElement>('.loader__log li'));
    const dur = quick ? 0.6 : 1.8;
    const state = { v: 0 };

    const tl = gsap.timeline();
    tl.to(state, {
      v: 100, duration: dur, ease: 'power2.inOut',
      onUpdate: () => {
        count.textContent = String(Math.round(state.v)).padStart(3, '0');
        bar.style.transform = `scaleX(${state.v / 100})`;
      },
    }, 0);
    items.forEach((li, i) => {
      const at = (dur / items.length) * i;
      tl.to(li, { opacity: 1, duration: 0.15 }, at).call(() => li.classList.add('is-done'), [], at + (dur / items.length) * 0.8);
    });
    tl.to(el.querySelector('.loader__inner'), { autoAlpha: 0, y: -24, scale: 0.96, duration: 0.45, ease: 'power2.in' }, dur + 0.1)
      .to(el.querySelector('.loader__panel--top'), { yPercent: -100, duration: 1, ease: 'expo.inOut' }, dur + 0.35)
      .to(el.querySelector('.loader__panel--bottom'), { yPercent: 100, duration: 1, ease: 'expo.inOut' }, dur + 0.35)
      .call(markReady, [], dur + 0.55)
      .call(() => root.classList.remove('is-loading'), [], dur + 1.35);

    return () => { tl.kill(); root.classList.remove('is-loading'); markReady(); };
  }, []);

  return (
    <div ref={ref} className="loader" aria-hidden="true">
      <div className="loader__panel loader__panel--top" />
      <div className="loader__panel loader__panel--bottom" />
      <div className="loader__inner">
        <div className="text-[#ff6a1f] scale-125"><Logo /></div>
        <p className="loader__count"><span data-loader-count>000</span><small>%</small></p>
        <div className="loader__bar"><i /></div>
        <ul className="loader__log">
          {lines.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </div>
    </div>
  );
};

export default Preloader;
