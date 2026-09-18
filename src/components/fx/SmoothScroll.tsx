import React, { createContext, useContext, useEffect, useState } from 'react';
import Lenis from 'lenis';
import { gsap, ScrollTrigger, prefersReducedMotion } from '@/lib/motion';

const LenisContext = createContext<Lenis | null>(null);

/** Accès à l'instance Lenis (null si les animations sont réduites). */
export const useLenis = () => useContext(LenisContext);

/* Défilement fluide avec inertie (Lenis), synchronisé avec GSAP ScrollTrigger. */
const SmoothScroll = ({ children }: { children: React.ReactNode }) => {
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    const instance = new Lenis({
      lerp: 0.09,
      smoothWheel: true,
      // Zones qui gardent leur propre défilement (modales, fil du chatbot…)
      prevent: (node: HTMLElement) => !!node.closest?.('[data-lenis-prevent], [role="dialog"], [role="menu"], [role="listbox"]'),
    });
    instance.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // Les modales Radix bloquent le défilement du body : on met Lenis en pause pendant ce temps
    const observer = new MutationObserver(() => {
      if (document.body.hasAttribute('data-scroll-locked')) instance.stop();
      else instance.start();
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-scroll-locked'] });

    setLenis(instance);
    return () => {
      observer.disconnect();
      gsap.ticker.remove(tick);
      instance.destroy();
      setLenis(null);
    };
  }, []);

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
};

export default SmoothScroll;
