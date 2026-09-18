
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, Download, FileText, GraduationCap, Network, Server, ShieldCheck } from 'lucide-react';
import SectionHeading from '@/components/SectionHeading';
import { useReveal } from '@/lib/motion';

const About = () => {
  const { t } = useTranslation();
  const page = useRef<HTMLDivElement>(null);
  useReveal(page);

  const expertise = [
    { icon: Network, title: t('about.networkTitle'), text: t('about.networkDescription') },
    { icon: Server, title: t('about.systemsTitle'), text: t('about.systemsDescription') },
    { icon: ShieldCheck, title: t('about.cybersecurityTitle'), text: t('about.cybersecurityDescription') },
  ];

  // Intro en grand, avec le dernier mot en italique d'accent
  const introWords = t('about.intro').split(' ');

  return (
    <div ref={page} className="pb-24 pt-[calc(var(--nav-h)+56px)]">
      {/* ——— En-tête ——— */}
      <section className="container-x">
        <SectionHeading as="h1" index="//" label="about" title={t('about.title')} />
        <p className="mt-14 max-w-5xl font-sans text-[clamp(1.7rem,4.2vw,3.6rem)] font-medium leading-[1.1] tracking-[-.035em] [font-stretch:108%]" data-reveal>
          {introWords.slice(0, -1).join(' ')}{' '}
          <span className="serif-accent">{introWords.slice(-1)}</span>
        </p>
      </section>

      {/* ——— Formation ——— */}
      <section className="container-x section-y !pb-0">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <h2 className="flex items-baseline gap-4 font-display text-[clamp(1.8rem,3.6vw,3rem)] font-extrabold uppercase leading-none tracking-tight [font-stretch:118%]" data-reveal>
            <span className="led text-base text-primary">01</span> {t('about.educationTitle')}
          </h2>
          <div className="panel group p-7 lg:p-9" data-reveal>
            <div className="flex items-start gap-5">
              <span className="inline-flex h-14 w-14 flex-none items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
                <GraduationCap className="h-7 w-7" />
              </span>
              <div>
                <h3 className="font-display text-[clamp(1.3rem,2.4vw,2rem)] font-extrabold leading-tight [font-stretch:110%]">{t('about.educationDegree')}</h3>
                <p className="mt-3 flex items-center gap-2 text-muted-foreground">
                  <span className="status-dot !bg-primary" /> {t('about.educationDescription')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ——— Expertise ——— */}
      <section className="container-x section-y !pb-0">
        <h2 className="mb-10 flex items-baseline gap-4 border-b border-border pb-5 font-display text-[clamp(1.8rem,3.6vw,3rem)] font-extrabold uppercase leading-none tracking-tight [font-stretch:118%]" data-reveal>
          <span className="led text-base text-primary">02</span> {t('about.expertiseTitle')}
        </h2>
        <div className="grid gap-5 md:grid-cols-3" data-stagger="flip">
          {expertise.map(({ icon: Icon, title, text }, i) => (
            <article key={title} className="panel group flex min-h-[280px] flex-col justify-between p-7 transition-transform duration-500 [transition-timing-function:var(--ease-out)] hover:-translate-y-1.5">
              <div className="flex items-start justify-between">
                <span className="text-primary transition-transform duration-700 group-hover:rotate-[-8deg] group-hover:scale-110"><Icon className="h-9 w-9" strokeWidth={1.5} /></span>
                <span className="led text-sm text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <div>
                <h3 className="font-display text-2xl font-extrabold uppercase tracking-tight [font-stretch:118%]">{title}</h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">{text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ——— CV ——— */}
      <section className="container-x section-y !pb-0">
        <div className="panel relative overflow-hidden p-8 lg:p-14" data-reveal>
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/25 blur-[100px]" aria-hidden="true" />
          <div className="hud-frame inset-4" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="relative flex flex-wrap items-end justify-between gap-8">
            <div>
              <p className="eyebrow">
                <span className="eyebrow__index">03</span>
                <span className="eyebrow__rule" aria-hidden="true" />
                <span className="eyebrow__label">cv.pdf</span>
              </p>
              <h2 className="mt-5 font-display text-[clamp(2.4rem,6vw,5rem)] font-black uppercase leading-[.9] tracking-[-.04em] [font-stretch:125%]">
                {t('about.cvTitle')}
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="/mon-cv.pdf" target="_blank" rel="noopener noreferrer" className="btn-neon">
                <Download className="h-4 w-4" /> {t('about.downloadCV')}
              </a>
              <Link to="/cv" className="btn-ghost liquid">
                <FileText className="h-4 w-4" /> {t('about.viewCV')} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
