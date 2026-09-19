import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown } from 'lucide-react';
import { gsap, prefersReducedMotion } from '@/lib/motion';
import { planetState } from '@/components/three/planetState';
import { TOOLS } from '@/data/tools';

/* ───────────────────────────────────────────────────────────────
   Habillage de la plongée vers les outils (au-dessus de la planète) :
   - télémétrie d'atterrissage : altitude, vitesse, cible, progression, statut ;
   - réticule qui se verrouille sur La Réunion au centre de l'écran ;
   - trois mots qui traversent l'écran, puis une phrase qui se construit
     lettre par lettre dans la lueur finale ;
   - sous la phrase, Jarvis tape un message (curseur plein), puis un cercle
     se dessine autour de l'invitation à défiler.
   Tout suit planetState.dive (0 → 1, piloté par le scroll), dans les deux sens.
   ─────────────────────────────────────────────────────────────── */

const RING = 2 * Math.PI * 34; // périmètre du cercle de l'invitation à défiler

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const range = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
const smooth = (v: number, a: number, b: number) => { const x = range(v, a, b); return x * x * (3 - 2 * x); };

// Fenêtres de la plongée où chaque mot traverse l'écran
// (le texte du hero est parti avant la télémétrie ; un seul mot à la fois ; les panneaux s'effacent avant la phrase finale)
const WORD_WINDOWS: [number, number][] = [[0.4, 0.54], [0.52, 0.66], [0.64, 0.78]];
const GEO_ALTITUDE = 35786; // km (orbite géostationnaire)

const DiveOverlay = () => {
  const { t, i18n } = useTranslation();
  const words = t('home.dive.words', { returnObjects: true }) as string[];
  const phases = t('home.dive.phases', { returnObjects: true }) as string[];
  const refs = {
    top: useRef<HTMLDivElement>(null), left: useRef<HTMLDivElement>(null), right: useRef<HTMLDivElement>(null),
    phase: useRef<HTMLSpanElement>(null), alt: useRef<HTMLSpanElement>(null), speed: useRef<HTMLSpanElement>(null),
    pct: useRef<HTMLSpanElement>(null), bar: useRef<HTMLElement>(null), reticle: useRef<HTMLDivElement>(null),
    line: useRef<HTMLDivElement>(null), jarvis: useRef<HTMLParagraphElement>(null), typed: useRef<HTMLSpanElement>(null),
    hint: useRef<HTMLDivElement>(null), ring: useRef<SVGCircleElement>(null),
  };
  const message = t('home.dive.jarvis', { tools: TOOLS.length, categories: new Set(TOOLS.map((tool) => tool.category)).size });
  const wordRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const r = Object.fromEntries(Object.entries(refs).map(([k, v]) => [k, v.current])) as Record<keyof typeof refs, HTMLElement>;
    const chars = Array.from(r.line?.querySelectorAll<HTMLElement>('.dive-char') ?? []);
    const number = new Intl.NumberFormat(i18n.language === 'en' ? 'en-GB' : 'fr-FR');
    const decimal = new Intl.NumberFormat(i18n.language === 'en' ? 'en-GB' : 'fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const last: Record<string, string> = {};
    const write = (key: string, el: HTMLElement | null, text: string) => { if (el && last[key] !== text) { el.textContent = text; last[key] = text; } };
    let d = 0;
    let idle = false;

    const tick = (_time: number, deltaMs: number) => {
      // Suit la progression du scroll avec un léger amorti
      d += (planetState.dive - d) * (1 - Math.exp(-(deltaMs / 1000) * 9));
      if (d < 0.001 && planetState.dive === 0) { if (idle) return; idle = true; d = 0; } else idle = false;

      // Télémétrie
      const hud = smooth(d, 0.22, 0.32) * (1 - smooth(d, 0.8, 0.88));
      [r.top, r.left, r.right].forEach((el) => { if (el) el.style.opacity = String(hud); });
      write('alt', r.alt, number.format(Math.round(GEO_ALTITUDE * Math.pow(1 - smooth(d, 0.1, 0.96), 2))));
      write('speed', r.speed, decimal.format(3.1 + 8.1 * smooth(d, 0.1, 0.9)));
      const progress = range(d, 0.05, 0.98);
      write('pct', r.pct, `${String(Math.round(progress * 100)).padStart(3, '0')}%`);
      if (r.bar) r.bar.style.transform = `scaleX(${progress})`;
      const phase = d < 0.36 ? 0 : d < 0.5 ? 1 : d < 0.68 ? 2 : d < 0.84 ? 3 : 4;
      write('phase', r.phase, phases[phase] ?? '');

      // Réticule : se resserre sur La Réunion puis se verrouille
      if (r.reticle) {
        const shown = smooth(d, 0.2, 0.28) * (1 - smooth(d, 0.42, 0.5));
        r.reticle.style.opacity = String(shown);
        r.reticle.style.transform = `scale(${1.9 - 0.9 * smooth(d, 0.2, 0.38)}) rotate(${(1 - smooth(d, 0.2, 0.38)) * 45}deg)`;
        r.reticle.classList.toggle('is-locked', d > 0.36);
      }

      // Mots qui traversent l'écran (on passe "à travers")
      wordRefs.current.forEach((el, i) => {
        if (!el) return;
        const [a, b] = WORD_WINDOWS[i];
        const x = range(d, a, b);
        const opacity = Math.min(smooth(x, 0, 0.2), 1 - smooth(x, 0.6, 0.95));
        el.style.opacity = String(opacity);
        el.style.transform = `translate3d(0, ${(0.5 - x) * 40}px, 0) scale(${0.62 + x * 0.7})`;
      });

      // Phrase d'arrivée : lettre par lettre pendant le voile
      const lp = range(d, 0.76, 0.92);
      const n = chars.length;
      chars.forEach((c, k) => {
        const p = smooth(lp * (n + 8) - k, 0, 8);
        c.style.opacity = String(p);
        c.style.transform = `translate3d(0, ${(1 - p) * 0.6}em, 0) rotateX(${(1 - p) * -70}deg)`;
      });

      // Jarvis tape son message sous la phrase
      if (r.jarvis) r.jarvis.style.opacity = String(smooth(d, 0.84, 0.88));
      write('typed', r.typed, message.slice(0, Math.round(range(d, 0.86, 0.975) * message.length)));

      // Cercle qui se dessine autour de l'invitation à défiler
      if (r.hint) r.hint.style.opacity = String(smooth(d, 0.9, 0.95));
      if (r.ring) r.ring.style.strokeDashoffset = (RING * (1 - smooth(d, 0.9, 1))).toFixed(1);
    };

    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language, message]);

  if (typeof window !== 'undefined' && prefersReducedMotion()) return null;

  const split = (text: string) => [...text].map((ch, i) => <span key={i} className="dive-char">{ch === ' ' ? ' ' : ch}</span>);

  return (
    <div className="pointer-events-none absolute inset-0 z-[4] select-none overflow-hidden" aria-hidden="true">
      {/* Statut de la descente */}
      <div ref={refs.top} className="absolute inset-x-0 top-[calc(var(--nav-h)+26px)] flex justify-center opacity-0">
        <p className="dive-chip"><span className="status-dot" /> FLORIAN.SYS <span className="text-primary">//</span> <span ref={refs.phase} /></p>
      </div>

      {/* Télémétrie gauche : altitude et vitesse */}
      <div ref={refs.left} className="absolute left-[var(--gutter)] top-1/2 hidden -translate-y-1/2 opacity-0 md:block">
        <p className="label-mono">{t('home.dive.altitude')}</p>
        <p className="led mt-1 text-[clamp(1.8rem,2.8vw,2.8rem)] leading-none text-foreground">
          <span ref={refs.alt}>{GEO_ALTITUDE}</span> <span className="text-[.45em] text-primary">KM</span>
        </p>
        <p className="label-mono mt-6">{t('home.dive.speed')}</p>
        <p className="led mt-1 text-2xl leading-none text-foreground">
          <span ref={refs.speed}>3,1</span> <span className="text-[.55em] text-primary">KM/S</span>
        </p>
      </div>

      {/* Télémétrie droite : cible et progression */}
      <div ref={refs.right} className="absolute right-[var(--gutter)] top-1/2 hidden -translate-y-1/2 text-right opacity-0 md:block">
        <p className="label-mono">{t('home.dive.target')}</p>
        <p className="mt-1 font-display text-2xl font-extrabold uppercase leading-none [font-stretch:118%]">La Réunion</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">-21.11° S · 55.53° E</p>
        <p className="label-mono mt-6">{t('home.dive.progress')} · <span ref={refs.pct} className="text-foreground">000%</span></p>
        <span className="ml-auto mt-2 block h-0.5 w-40 overflow-hidden bg-foreground/15">
          <i ref={refs.bar} className="block h-full origin-left scale-x-0 bg-primary" />
        </span>
      </div>

      {/* Réticule de visée, centré sur La Réunion */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div ref={refs.reticle} className="dive-reticle opacity-0">
          <i /><i /><i /><i />
          <span className="dive-reticle__label">{t('home.dive.locked')}</span>
        </div>
      </div>

      {/* Mots qui traversent l'écran */}
      {words.map((word, i) => (
        <div key={word} className="absolute inset-0 flex items-center justify-center">
          <p ref={(el) => { wordRefs.current[i] = el; }} className="dive-word opacity-0">{word}</p>
        </div>
      ))}

      {/* Phrase d'arrivée, dans la lueur finale */}
      <div ref={refs.line} className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center [perspective:800px]">
        <p className="serif-accent text-[clamp(2rem,5.6vw,4.6rem)] leading-none">{split(t('home.dive.line1'))}</p>
        <p className="display-xl mt-2 text-[clamp(2.4rem,8.6vw,8rem)]">{split(t('home.dive.line2'))}</p>
      </div>

      {/* Sous la phrase : message de Jarvis, puis invitation à défiler */}
      <div className="absolute inset-x-0 top-[calc(50%+clamp(5.5rem,9.5vw,9.5rem))] flex flex-col items-center gap-[clamp(2rem,5vh,3.5rem)] px-6 text-center">
        <p ref={refs.jarvis} className="dive-jarvis opacity-0">
          <span className="text-primary">JARVIS ›</span> <span ref={refs.typed} /><span className="dive-caret" />
        </p>
        <div ref={refs.hint} className="flex flex-col items-center gap-3 opacity-0">
          <span className="relative grid h-[76px] w-[76px] place-items-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 76 76" fill="none">
              <circle cx="38" cy="38" r="34" stroke="hsl(var(--foreground) / .12)" strokeWidth="1" />
              <circle ref={refs.ring} cx="38" cy="38" r="34" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeDasharray={RING} strokeDashoffset={RING} />
            </svg>
            <ArrowDown className="dive-hint-arrow h-5 w-5 text-foreground" strokeWidth={1.5} />
          </span>
          <span className="label-mono tracking-[.3em]">{t('home.dive.scroll')}</span>
        </div>
      </div>
    </div>
  );
};

export default DiveOverlay;
