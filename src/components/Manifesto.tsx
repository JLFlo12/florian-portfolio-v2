import { useLayoutEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Logo from '@/components/Logo';
import Astronaut from '@/components/fx/Astronaut';
import { gsap, prefersReducedMotion } from '@/lib/motion';
import { STUDIES } from '@/data/profile';

/* ───────────────────────────────────────────────────────────────
   Manifeste (façon landonorris.com) : grande phrase centrée en capitales,
   mots d'accent en italique orange. Les mots s'allument un à un au fil
   du défilement. Dans le texte traduit, *mot* = mot d'accent.
   ─────────────────────────────────────────────────────────────── */
const Manifesto = () => {
  const { t, i18n } = useTranslation();
  const text = t('home.manifesto');
  const words = useMemo(() => text.split(/\s+/).map((raw) => {
    const match = raw.match(/^\*(.+)\*([^*]*)$/);
    return match ? { word: match[1], tail: match[2], accent: true } : { word: raw, tail: '', accent: false };
  }), [text]);
  const plain = text.replace(/\*/g, '');
  const root = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const tween = gsap.fromTo(el.querySelectorAll('.mf-word'), { opacity: 0.13 }, {
      opacity: 1, ease: 'none', stagger: 0.1,
      scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 52%', scrub: 0.6 },
    });
    return () => { tween.scrollTrigger?.kill(); tween.kill(); };
  }, [words, i18n.language]);

  return (
    <div ref={root} className="container-x relative flex flex-col items-center text-center">
      {/* Derrière le texte : le texte est positionné (relative) pour passer devant */}
      <Astronaut zone={root} />
      <Logo size={46} className="relative text-primary" />
      <p className="label-mono relative mt-4" data-band>{t('home.manifestoLabel', { year: STUDIES.start })}</p>
      <p ref={ref} className="manifesto relative mt-10 max-w-[18em]" aria-label={plain}>
        {words.map(({ word, tail, accent }, i) => (
          <span key={`${word}-${i}`} aria-hidden="true">
            <span className={`mf-word ${accent ? 'serif-accent' : ''}`}>{word}</span>
            {tail && <span className="mf-word">{tail}</span>}
            {i < words.length - 1 ? ' ' : null}
          </span>
        ))}
      </p>
    </div>
  );
};

export default Manifesto;
