import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Github, Linkedin, Mail, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ToolsSection from '@/components/ToolsSection';
import HeroPlanet from '@/components/three/HeroPlanet';
import { hasWebGL } from '@/components/three/webgl';
import OrbitNav from '@/components/OrbitNav';
import ProjectBand from '@/components/ProjectBand';
import SectionHeading from '@/components/SectionHeading';
import DiveOverlay from '@/components/DiveOverlay';
import SpaceDrift from '@/components/fx/SpaceDrift';
import { useReunionTime } from '@/components/Footer';
import { gsap, ScrollTrigger, magnetic, prefersReducedMotion, useReveal } from '@/lib/motion';
import { planetState } from '@/components/three/planetState';
import { SOFT_SKILLS, TECHNICAL_SKILLS, type Level } from '@/data/profile';
import { onReady } from '@/lib/ready';

const LEVEL_LEDS: Record<Level, number> = { fragile: 1, base: 2, avance: 3, maitrise: 4 };

const Home = () => {
  const { t } = useTranslation();
  const hero = useRef<HTMLElement>(null);
  const skills = useRef<HTMLElement>(null);
  const cta = useRef<HTMLAnchorElement>(null);
  const time = useReunionTime();
  useReveal(skills);
  // Satellites du menu en orbite autour de la planète : grand écran, WebGL, animations permises
  const [orbit] = useState(() => hasWebGL() && !prefersReducedMotion() && window.matchMedia('(min-width: 768px)').matches);

  /* ——— Intro du hero (après l'écran de chargement) + plongée vers les outils au scroll ——— */
  useEffect(() => {
    const root = hero.current;
    if (!root || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      const chars = root.querySelectorAll('.hero-name .split-char');
      const intro = root.querySelectorAll('[data-intro]');
      gsap.set(chars, { yPercent: 115, rotationX: -80, transformPerspective: 800, transformOrigin: '50% 100%' });
      gsap.set(intro, { autoAlpha: 0, y: 26 });
      const off = onReady(() => {
        gsap.timeline({ defaults: { ease: 'expo.out' } })
          .to(chars, { yPercent: 0, rotationX: 0, duration: 1.5, stagger: 0.06 })
          .to(intro, { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.07 }, 0.3);
      });
      // Plongée : le hero reste épinglé pendant qu'on scrolle ; la caméra fonce vers La Réunion,
      // le texte passe de part et d'autre, puis un voile orange fait le raccord avec les outils.
      gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: () => `+=${window.innerHeight * (window.innerWidth < 768 ? 1.1 : 1.3)}`,
          pin: true,
          scrub: 0.6,
          refreshPriority: 1, // calculé avant les animations placées plus bas dans la page
          invalidateOnRefresh: true,
          onUpdate: (self) => { planetState.dive = self.progress; },
        },
      })
        .to('[data-dive-ui]', { scale: 1.9, autoAlpha: 0, ease: 'power2.in', duration: 0.36 }, 0)
        .to('[data-dive-flash]', { autoAlpha: 1, ease: 'power1.in', duration: 0.32 }, 0.68);
      ScrollTrigger.refresh();
      return off;
    }, root);
    return () => ctx.revert();
  }, []);

  useEffect(() => magnetic(cta.current, 0.2), []);

  const socials = [
    { href: 'mailto:f.girardot--lahogue@rt-iut.re', icon: Mail, label: 'Email' },
    { href: 'https://github.com/JLFlo12', icon: Github, label: 'GitHub' },
    { href: 'https://www.linkedin.com/in/florian-girardot-lahogue-4aa367341/', icon: Linkedin, label: 'LinkedIn' },
  ];

  // Sur grand écran, les deux colonnes partagent les lignes de la grille (sous-grille) : surtitre, titre, liste.
  // Les listes commencent ainsi à la même hauteur, même si un titre tient sur deux lignes et l'autre sur une.
  const SkillList = ({ title, list, index }: { title: string; list: typeof TECHNICAL_SKILLS; index: string }) => (
    <div className="lg:row-span-3 lg:grid lg:grid-rows-subgrid">
      <p className="eyebrow mb-6" data-band>
        <span className="eyebrow__index">{index}</span>
        <span className="eyebrow__rule" data-rule aria-hidden="true" />
      </p>
      <h3 className="mb-8 font-display text-[clamp(1.8rem,3.4vw,2.8rem)] font-extrabold uppercase leading-none tracking-tight [font-stretch:118%]" data-band="0.12">
        {title}
      </h3>
      <ul className="self-start divide-y divide-border border-y border-border" data-stagger>
        {list.map((skill) => (
          <li key={skill.name} className="group flex items-center justify-between gap-6 py-4">
            <span className="text-lg font-medium transition-transform duration-500 group-hover:translate-x-2">{skill.name}</span>
            <span className="flex items-center gap-4">
              <span className="label-mono hidden sm:inline">{t(`home.levels.${skill.level}`)}</span>
              <span className="led-bar" role="img" aria-label={t(`home.levels.${skill.level}`)}>
                {[1, 2, 3, 4].map((n) => <i key={n} className={n <= LEVEL_LEDS[skill.level] ? 'is-on' : ''} />)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div>
      {/* ═══════════════ HERO + PLANÈTE 3D ═══════════════ */}
      <section ref={hero} className="relative min-h-[100svh] overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_72%_45%,hsl(var(--primary)/.14),transparent_70%)]" aria-hidden="true" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[.35] [mask-image:radial-gradient(75%_65%_at_50%_50%,#000,transparent)]"
          style={{ backgroundImage: 'linear-gradient(hsl(var(--foreground)/.06) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)/.06) 1px, transparent 1px)', backgroundSize: '64px 64px' }}
          aria-hidden="true"
        />
        <HeroPlanet section={hero} orbit={orbit} />
        <div className="hud-frame inset-x-[max(8px,calc(var(--gutter)-20px))] bottom-6 top-[calc(var(--nav-h)+8px)]" aria-hidden="true" data-dive-ui><i /><i /><i /><i /></div>
        {/* Voile de fin de plongée : même lueur que le haut de la section Outils */}
        <div className="pointer-events-none invisible absolute inset-0 z-[3] bg-background bg-[radial-gradient(70%_48%_at_50%_48%,hsl(var(--primary)/.24),transparent_70%)] opacity-0" aria-hidden="true" data-dive-flash />
        {/* Télémétrie et typographie pendant la plongée */}
        <DiveOverlay />

        <div className="container-x pointer-events-none relative z-[2] flex min-h-[100svh] max-w-[1800px] flex-col justify-between gap-10 pb-14 pt-[calc(var(--nav-h)+36px)]" data-dive-ui>
          {/* Ligne du haut : heure locale, en texte simple, à droite (la localisation est en bas du hero) */}
          <div className="flex justify-end">
            <p className="hidden text-right text-sm leading-snug text-muted-foreground md:block" data-intro>
              {t('ui.localTime')}
              <span className="block tabular-nums text-foreground">{time.slice(0, 5)} <span className="text-muted-foreground">GMT+4</span></span>
            </p>
          </div>

          {/* Bas du hero : nom, rôle, bio, liens */}
          <div>
            <h1 className="hero-name display-xl text-[clamp(3.6rem,14vw,13.5rem)]" aria-label="FLORIAN GIRARDOT LAHOGUE">
              <span className="block overflow-hidden pb-[.04em]" aria-hidden="true">
                {'FLORIAN'.split('').map((c, i) => <span key={i} className="split-char">{c}</span>)}
              </span>
            </h1>
            <p className="mt-3 font-display text-[clamp(1rem,2.4vw,1.9rem)] font-light uppercase tracking-[.32em] text-muted-foreground [font-stretch:125%]" data-intro>
              Girardot Lahogue
            </p>
            <p className="mt-3 text-[clamp(1.1rem,2vw,1.6rem)] font-semibold text-primary" data-intro>
              {t('home.role')}
            </p>

            <div className="mt-10 flex flex-wrap items-end justify-between gap-8">
              <div className="max-w-md space-y-4" data-intro>
                <p className="text-lg leading-relaxed text-foreground/85">
                  {t('home.bio').split(' ').slice(0, -1).join(' ')}{' '}
                  <span className="serif-accent text-[1.2em]">{t('home.bio').split(' ').slice(-1)}</span>
                </p>
                <p className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 text-primary" /> {t('home.location')}
                </p>
              </div>

              <div className="pointer-events-auto flex flex-wrap items-center gap-3" data-intro>
                {socials.map(({ href, icon: Icon, label }) => (
                  <a
                    key={label}
                    href={href}
                    target={href.startsWith('http') ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="liquid inline-flex h-12 w-12 items-center justify-center rounded-full text-foreground transition-all duration-500 hover:-translate-y-1 hover:border-primary hover:text-primary"
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                ))}
                <Link ref={cta} to="/projects" className="btn-neon ml-1">
                  {t('home.cta')} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
        {orbit && <OrbitNav />}
      </section>

      {/* ═══════════════ OUTILS (arrivée de la plongée) ═══════════════ */}
      <ToolsSection />

      {/* ═══════════════ BANDE DE PROJETS 3D ═══════════════ */}
      <ProjectBand />

      {/* ═══════════════ COMPÉTENCES ═══════════════ */}
      <section ref={skills} className="section-y relative">
        {/* Fin du voyage de l'astronaute : il flotte près du titre, dans un champ d'étoiles (derrière le contenu) */}
        <SpaceDrift zone={skills} />
        <div className="container-x relative">
          <SectionHeading index="02" label="skills" title={t('home.skillsHeading')} />
          <div className="mt-16 grid gap-16 lg:grid-cols-2 lg:gap-x-24 lg:gap-y-0">
            <SkillList title={t('home.skillsTitle')} list={TECHNICAL_SKILLS} index="2.1" />
            <SkillList title={t('home.softSkillsTitle')} list={SOFT_SKILLS} index="2.2" />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
