
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Mail, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import Logo from '@/components/Logo';
import TrackLinks, { TrackItem } from '@/components/TrackLinks';
import TopoLines from '@/components/fx/TopoLines';
import { useReunionTime } from '@/components/Footer';
import { gsap, hasFinePointer, prefersReducedMotion, useReveal } from '@/lib/motion';
import { isReady, onReady } from '@/lib/ready';

const EMAIL = 'f.girardot--lahogue@rt-iut.re';

/* Emblème : logo dans une bague graduée qui tourne lentement */
const Emblem = () => (
  <div className="contact-emblem" data-contact-fade>
    <svg className="contact-emblem__ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="47" />
      {Array.from({ length: 60 }, (_, i) => (
        <line key={i} x1="50" y1="6" x2="50" y2={i % 5 === 0 ? 12 : 9} transform={`rotate(${i * 6} 50 50)`} />
      ))}
    </svg>
    <Logo size={46} />
  </div>
);

const Contact = () => {
  const { t } = useTranslation();
  const page = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLElement>(null);
  const topo = useRef<SVGSVGElement>(null);
  const [live, setLive] = useState(false);
  const time = useReunionTime();
  useReveal(page);

  const items = useMemo<TrackItem[]>(() => [
    { id: 'email', label: t('contact.stackEmail'), value: EMAIL, href: `mailto:${EMAIL}`, cursor: t('contact.write') },
    { id: 'linkedin', label: t('contact.linkedin'), value: 'linkedin.com/in/florian-girardot-lahogue-4aa367341', href: 'https://www.linkedin.com/in/florian-girardot-lahogue-4aa367341/', external: true, cursor: t('ui.open') },
    { id: 'github', label: t('contact.github'), value: 'github.com/JLFlo12', href: 'https://github.com/JLFlo12', external: true, cursor: t('ui.open') },
    { id: 'cv', label: 'CV', value: t('contact.cvValue'), href: '/mon-cv.pdf', external: true, cursor: t('ui.view') },
  ], [t]);

  // Intro : les courbes de niveau se dessinent, puis les mots se déroulent l'un après l'autre.
  useLayoutEffect(() => {
    const root = hero.current;
    if (!root) return;
    if (prefersReducedMotion()) { setLive(true); return; }
    let unsubscribe = () => {};
    const delay = isReady() ? 0.45 : 0.1; // laisse le rideau de transition se lever
    const ctx = gsap.context(() => {
      const inners = root.querySelectorAll('[data-track-inner]');
      const lines = root.querySelectorAll('[data-topo]');
      const fades = root.querySelectorAll('[data-contact-fade]');
      gsap.set(inners, { yPercent: 110, rotationX: -80, opacity: 0, transformPerspective: 900, transformOrigin: '50% 100%' });
      gsap.set(lines, { attr: { 'stroke-dashoffset': 1 } });
      gsap.set(fades, { autoAlpha: 0, y: 18 });
      const tl = gsap.timeline({ paused: true, delay });
      tl.to(lines, { attr: { 'stroke-dashoffset': 0 }, duration: 2.8, ease: 'power2.inOut', stagger: { each: 0.03, from: 'random' } }, 0)
        .to(inners, { yPercent: 0, rotationX: 0, opacity: 1, duration: 1.3, ease: 'expo.out', stagger: 0.11, clearProps: 'transform' }, 0.1)
        .to(fades, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08, clearProps: 'transform' }, 0.5)
        .call(() => setLive(true), [], 0.8);
      unsubscribe = onReady(() => tl.play());
    }, root);

    // Léger décalage des courbes avec la souris
    let detach = () => {};
    const svg = topo.current;
    if (svg && hasFinePointer()) {
      const x = gsap.quickTo(svg, 'x', { duration: 1.2, ease: 'power3.out' });
      const y = gsap.quickTo(svg, 'y', { duration: 1.2, ease: 'power3.out' });
      const move = (e: PointerEvent) => {
        x((e.clientX / window.innerWidth - 0.5) * -22);
        y((e.clientY / window.innerHeight - 0.5) * -16);
      };
      window.addEventListener('pointermove', move);
      detach = () => window.removeEventListener('pointermove', move);
    }
    return () => { unsubscribe(); detach(); ctx.revert(); };
  }, []);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL);
      toast.success(t('contact.copied'));
    } catch {
      window.location.href = `mailto:${EMAIL}`;
    }
  };

  return (
    <div ref={page} className="pb-24">
      {/* ——— Contacts façon "piste" ——— */}
      <section ref={hero} className="relative isolate flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-4 pb-[clamp(24px,5vh,56px)] pt-[calc(var(--nav-h)+clamp(8px,3vh,40px))] text-center">
        <TopoLines ref={topo} className="topo pointer-events-none absolute -inset-8 -z-10 h-[calc(100%+4rem)] w-[calc(100%+4rem)]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[46vh] w-[62vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[140px]" aria-hidden="true" />

        <h1 className="sr-only">{t('contact.title')}</h1>
        <p className="eyebrow justify-center" data-contact-fade>
          <span className="eyebrow__index">//</span>
          <span className="eyebrow__rule" aria-hidden="true" />
          <span className="eyebrow__label">contact</span>
        </p>
        <p className="serif-accent mb-8 mt-3 text-[clamp(1.4rem,3vw,2.1rem)] leading-none" data-contact-fade>{t('contact.subtitle')}</p>

        <TrackLinks items={items} live={live} />

        <div className="mt-8 flex flex-col items-center">
          <Emblem />
          <p className="label-mono mt-4" data-contact-fade>
            BUT R&amp;T · {t('home.location')} · <span className="tabular-nums text-foreground/80">{time}</span>
          </p>
        </div>
      </section>

      {/* ——— Appel à collaborer ——— */}
      <section className="container-x mt-8">
        <div className="panel relative overflow-hidden p-8 lg:p-14" data-reveal>
          <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-[60%] rounded-full bg-primary/20 blur-[110px]" aria-hidden="true" />
          <div className="hud-frame inset-4" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="relative grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-end">
            <div>
              <h2 className="font-display text-[clamp(2.2rem,5.4vw,4.6rem)] font-black uppercase leading-[.92] tracking-[-.04em] [font-stretch:125%]">
                {t('contact.collabTitle')}
              </h2>
              <p className="mt-5 max-w-lg text-lg text-muted-foreground">{t('contact.collabText')}</p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <a href={`mailto:${EMAIL}`} className="btn-neon">
                <Mail className="h-4 w-4" /> {t('contact.collabButton')}
              </a>
              <button type="button" onClick={copyEmail} className="btn-ghost liquid">
                <Copy className="h-4 w-4" /> {t('contact.copy')}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
