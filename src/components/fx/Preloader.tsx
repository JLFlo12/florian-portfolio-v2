import { useEffect, useRef } from 'react';
import { gsap } from '@/lib/motion';
import { markReady } from '@/lib/ready';

/* Écran de chargement : trois points en orbite, dont un orange.
   Quand la page est prête (polices chargées, durée minimale écoulée), les points se
   rejoignent au centre, puis l'écran s'ouvre en cercle à partir de ce point.
   Plus court quand on revient pendant la même session. */
const Preloader = () => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (!el || !root.classList.contains('is-loading')) { markReady(); return; }

    let quick = false;
    try { quick = sessionStorage.getItem('florian-boot') === '1'; sessionStorage.setItem('florian-boot', '1'); } catch { /* stockage indisponible */ }

    let tl: gsap.core.Timeline | undefined;
    let cancelled = false;
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();

    Promise.all([wait(quick ? 350 : 1300), Promise.race([fonts, wait(2500)])]).then(() => {
      if (cancelled) return;
      const orbit = el.querySelector('.loader__orbit');
      const others = el.querySelectorAll('.loader__orbit i:not(:last-child)'); // les deux points clairs
      const ring = el.querySelector('.loader__ring');
      const radius = Math.hypot(window.innerWidth, window.innerHeight) / 2 + 20;
      tl = gsap.timeline({ defaults: { overwrite: 'auto' } })
        .to(orbit, { '--r': '0px', duration: 0.55, ease: 'power3.inOut' })
        .to(others, { opacity: 0, duration: 0.2, ease: 'none' }, '-=0.2')
        .to(orbit, { scale: 1.5, duration: 0.2, ease: 'power2.out' }, '-=0.08')
        .addLabel('open')
        .set(ring, { opacity: 1 }, 'open')
        .to(el, { '--hole': `${radius}px`, duration: 1.05, ease: 'expo.inOut' }, 'open')
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
        <div className="loader__orbit"><i /><i /><i /></div>
      </div>
      <div className="loader__ring" />
    </div>
  );
};

export default Preloader;
