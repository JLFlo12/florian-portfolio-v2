import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Github, Linkedin, Mail, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ToolsSection from '@/components/ToolsSection';
import HeroPlanet from '@/components/three/HeroPlanet';
import Marquee from '@/components/Marquee';
import SectionHeading from '@/components/SectionHeading';
import { useReunionTime } from '@/components/Footer';
import { gsap, magnetic, prefersReducedMotion, useReveal } from '@/lib/motion';
import { onReady } from '@/lib/ready';

type Level = 'maitrise' | 'avance' | 'base' | 'fragile';
const LEVEL_LEDS: Record<Level, number> = { fragile: 1, base: 2, avance: 3, maitrise: 4 };

const technicalSkills: { name: string; level: Level }[] = [
  { name: 'Réseaux & GNS3', level: 'maitrise' },
  { name: 'Linux/Windows Server', level: 'maitrise' },
  { name: 'JavaScript/TypeScript', level: 'base' },
  { name: 'PHP & SQL', level: 'base' },
  { name: 'Cybersécurité', level: 'fragile' },
  { name: 'Virtualisation', level: 'maitrise' }
];

const softSkills: { name: string; level: Level }[] = [
  { name: 'Leadership', level: 'base' },
  { name: 'Communication', level: 'avance' },
  { name: 'Travail d\'équipe', level: 'maitrise' },
  { name: 'Discipline', level: 'maitrise' },
  { name: 'Esprit critique', level: 'avance' }
];

const Home = () => {
  const { t } = useTranslation();
  const hero = useRef<HTMLElement>(null);
  const skills = useRef<HTMLElement>(null);
  const cta = useRef<HTMLAnchorElement>(null);
  const time = useReunionTime();
  useReveal(skills);

  /* ——— Intro du hero (après l'écran de chargement) + sortie au scroll ——— */
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
      gsap.to('[data-hero-part]', {
        y: () => window.innerHeight * 0.12, opacity: 0.15, ease: 'none',
        scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
      });
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

  const marqueeItems = ['Réseaux & GNS3', 'Cybersécurité', 'Linux / Windows Server', 'Virtualisation', 'Unreal Engine 5', 'Raspberry Pi', 'TypeScript', 'Wireshark', 'pfSense'];

  const SkillList = ({ title, list, index }: { title: string; list: typeof technicalSkills; index: string }) => (
    <div>
      <p className="eyebrow mb-6" data-reveal>
        <span className="eyebrow__index">{index}</span>
        <span className="eyebrow__rule" data-rule aria-hidden="true" />
      </p>
      <h3 className="mb-8 font-display text-[clamp(1.8rem,3.4vw,2.8rem)] font-extrabold uppercase leading-none tracking-tight [font-stretch:118%]" data-reveal>
        {title}
      </h3>
      <ul className="divide-y divide-border border-y border-border" data-stagger>
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
        <HeroPlanet section={hero} />
        <div className="hud-frame inset-x-[max(8px,calc(var(--gutter)-20px))] bottom-6 top-[calc(var(--nav-h)+8px)]" aria-hidden="true" data-hero-part><i /><i /><i /><i /></div>

        <div className="container-x pointer-events-none relative z-[2] flex min-h-[100svh] max-w-[1800px] flex-col justify-between gap-10 pb-14 pt-[calc(var(--nav-h)+36px)]">
          {/* Ligne du haut : statut + télémétrie */}
          <div className="flex flex-wrap items-start justify-between gap-4" data-hero-part>
            <p className="pointer-events-auto liquid inline-flex items-center gap-3 rounded-full px-4 py-2 text-sm font-medium" data-intro>
              <span className="status-dot" /> {t('ui.online')} · <span className="text-muted-foreground">{t('home.location')}</span>
            </p>
            <div className="hud-panel hidden min-w-[250px] md:block" data-intro data-liquid>
              <p className="mb-2 flex justify-between gap-6 border-b border-dashed border-primary/30 pb-2 tracking-[.08em] text-primary">
                <span>SYS://FLORIAN.GL</span><span>v{new Date().getFullYear()}</span>
              </p>
              <dl className="grid gap-0.5">
                <div className="flex justify-between gap-6"><dt className="uppercase tracking-[.08em]">{t('ui.status')}</dt><dd className="text-[hsl(var(--online))]">BUT R&T</dd></div>
                <div className="flex justify-between gap-6"><dt className="uppercase tracking-[.08em]">{t('ui.localTime')}</dt><dd className="tabular-nums text-foreground">{time}</dd></div>
                <div className="flex justify-between gap-6"><dt className="uppercase tracking-[.08em]">{t('ui.coords')}</dt><dd className="text-foreground">-21.11 · 55.53</dd></div>
              </dl>
            </div>
          </div>

          {/* Bas du hero : nom, rôle, bio, liens */}
          <div data-hero-part>
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
      </section>

      <Marquee items={marqueeItems} />

      {/* ═══════════════ OUTILS ═══════════════ */}
      <ToolsSection />

      {/* ═══════════════ COMPÉTENCES ═══════════════ */}
      <section ref={skills} className="section-y relative">
        <div className="container-x">
          <SectionHeading index="02" label="skills" title={t('home.skillsHeading')} />
          <div className="mt-16 grid gap-16 lg:grid-cols-2 lg:gap-24">
            <SkillList title={t('home.skillsTitle')} list={technicalSkills} index="2.1" />
            <SkillList title={t('home.softSkillsTitle')} list={softSkills} index="2.2" />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
