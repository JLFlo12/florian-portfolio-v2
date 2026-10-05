import { useEffect, useRef, useState, type RefObject } from 'react';
import { gsap, ScrollTrigger, prefersReducedMotion } from '@/lib/motion';

/* ───────────────────────────────────────────────────────────────
   Astronaute qui tombe (accueil, derrière le manifeste, juste après la
   plongée vers La Réunion) : pendant que le bloc `zone` traverse l'écran,
   il tombe depuis le haut de l'écran en tournant sur lui-même, apparaît en
   fondu, puis s'éloigne en rapetissant et s'efface avant d'atteindre le bas.
   La chute suit le défilement mais ne revient jamais en arrière : en remontant,
   il reste où il en est, porté par la page ; elle repart de zéro une fois la
   zone repassée sous l'écran. À l'arrêt, il flotte (animation CSS de l'image).
   Photo détourée : public/astronaut.webp. Animations réduites : pas d'astronaute.
   ─────────────────────────────────────────────────────────────── */
const RANGE = 1.5; // défilement de la chute : hauteur de la zone + 1,5 hauteur d'écran
const LAND = 0.75;  // hauteur d'écran qu'il atteindrait en fin de chute

const Astronaut = ({ zone }: { zone: RefObject<HTMLElement> }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [on] = useState(() => !prefersReducedMotion());

  // useEffect (pas useLayoutEffect) : la ref de la zone, posée par le parent, n'est prête qu'après le rendu des enfants
  useEffect(() => {
    const el = ref.current;
    const area = zone.current;
    if (!el || !area) return;
    // Chute complète (0 → 1), placée en haut de la zone : à 0 il est juste au-dessus de l'écran quand la zone
    // entre par le bas ; elle dure le passage de la zone plus une demi-hauteur d'écran, et à 1 il serait aux 3/4
    // de l'écran (il s'est effacé avant) : une chute lente. Position dans la zone = position voulue à l'écran
    // + défilement écoulé. Opacité nulle aux deux bouts : invisible avant et après la chute.
    const fall = gsap.timeline({ paused: true, defaults: { ease: 'none' } })
      .fromTo(el, { y: () => -(window.innerHeight + el.offsetHeight), x: 0, rotation: -30, scale: 1 }, {
        y: () => area.offsetHeight + window.innerHeight * (RANGE - 1 + LAND),
        x: () => -window.innerWidth * 0.04,
        rotation: 210,
        scale: 0.55, // il s'éloigne en tombant
        duration: 1,
      }, 0)
      .fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.12 }, 0.04)
      .to(el, { opacity: 0, duration: 0.24, ease: 'power1.in' }, 0.66);

    // La chute n'avance que vers le bas : on garde la plus grande progression atteinte, avec un amorti (comme un scrub)
    let reached = 0;
    const trigger = ScrollTrigger.create({
      trigger: area,
      start: 'top bottom',
      end: () => `+=${area.offsetHeight + window.innerHeight * RANGE}`,
      onUpdate: (self) => {
        if (self.progress <= reached) return;
        reached = self.progress;
        gsap.to(fall, { progress: reached, duration: 0.8, ease: 'power3.out', overwrite: true });
      },
      // Zone repassée sous l'écran : prêt pour une nouvelle chute
      onLeaveBack: () => { reached = 0; gsap.killTweensOf(fall); fall.progress(0); },
      // Écran ou page redimensionnés : trajectoire recalculée, au même point de la chute
      onRefresh: () => { const at = fall.progress(); fall.invalidate().progress(0).progress(at); },
    });
    // Page ouverte (ou rechargée) au milieu ou après la zone
    reached = trigger.progress;
    fall.progress(reached);
    return () => { trigger.kill(); gsap.killTweensOf(fall); fall.kill(); };
  }, [zone, on]);

  if (!on) return null;
  return (
    <div ref={ref} className="astronaut" aria-hidden="true">
      <img src="/astronaut.webp" alt="" width={300} height={461} loading="lazy" decoding="async" />
    </div>
  );
};

export default Astronaut;
