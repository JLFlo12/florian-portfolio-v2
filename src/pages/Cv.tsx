import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Github, Linkedin, Mail, MapPin, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CV } from '@/data/cv';
import { CONTACT } from '@/data/profile';
import { useReveal } from '@/lib/motion';

/* ───────────────────────────────────────────────────────────────
   CV en version web : plus rapide à lire sur mobile que le PDF,
   et imprimable (mise en page A4 dédiée, voir .cv-sheet dans index.css).
   ─────────────────────────────────────────────────────────────── */

const Block = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="cv-block">
    <h2 className="cv-block__title">{title}</h2>
    {children}
  </section>
);

const Cv = () => {
  const { t, i18n } = useTranslation();
  const cv = CV[i18n.language === 'en' ? 'en' : 'fr'];
  const page = useRef<HTMLDivElement>(null);
  useReveal(page);

  // Nom du fichier proposé quand on enregistre la page en PDF
  useEffect(() => {
    const previous = document.title;
    document.title = 'CV - Florian GIRARDOT LAHOGUE';
    return () => { document.title = previous; };
  }, []);

  const contacts = [
    { icon: Mail, label: CONTACT.email, href: `mailto:${CONTACT.email}` },
    { icon: Linkedin, label: 'Florian GIRARDOT LAHOGUE', href: CONTACT.linkedin },
    { icon: Github, label: 'github.com/JLFlo12', href: CONTACT.github },
    { icon: MapPin, label: CONTACT.location, href: '' },
  ];

  return (
    <div ref={page} className="cv-page pb-24 pt-[calc(var(--nav-h)+40px)]">
      <div className="container-x max-w-[1080px]">
        {/* Barre d'actions (masquée à l'impression) */}
        <div className="no-print mb-8 flex flex-wrap items-center justify-between gap-4" data-reveal>
          <Link to="/about" className="inline-flex items-center gap-2 font-mono text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {t('nav.about')}
          </Link>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => window.print()} className="btn-neon !py-2.5 text-sm">
              <Printer className="h-4 w-4" /> {t('cv.print')}
            </button>
            <a href="/mon-cv.pdf" download className="btn-ghost liquid !py-2.5 text-sm">
              <Download className="h-4 w-4" /> {t('cv.pdf')}
            </a>
          </div>
        </div>

        <article className="cv-sheet" data-reveal>
          {/* Colonne latérale */}
          <aside className="cv-side">
            <Block title={cv.labels.contact}>
              <ul className="space-y-2.5 text-sm">
                {contacts.map(({ icon: Icon, label, href }) => (
                  <li key={label} className="flex min-w-0 items-center gap-2.5">
                    <Icon className="h-4 w-4 flex-none text-primary" />
                    {href
                      ? <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className={`min-w-0 break-words hover:text-primary ${href.startsWith('mailto:') ? 'email-text' : ''}`}>{label}</a>
                      : <span className="min-w-0 break-words">{label}</span>}
                  </li>
                ))}
              </ul>
            </Block>

            <Block title={cv.labels.education}>
              <ul className="space-y-4">
                {cv.education.map((e) => (
                  <li key={e.school}>
                    <p className="font-semibold">{e.school}</p>
                    <p className="text-sm text-muted-foreground">{e.degree}</p>
                    <p className="cv-years">{e.years}</p>
                  </li>
                ))}
              </ul>
            </Block>

            <Block title={cv.labels.skills}>
              <ul className="flex flex-wrap gap-1.5">
                {cv.skills.map((s) => <li key={s} className="cv-chip">{s}</li>)}
              </ul>
            </Block>

            <Block title={cv.labels.languages}>
              <ul className="space-y-1.5 text-sm">
                {cv.languages.map((l) => (
                  <li key={l.name}><span className="font-semibold">{l.name}</span> <span className="text-muted-foreground">· {l.level}</span></li>
                ))}
              </ul>
            </Block>
          </aside>

          {/* Colonne principale */}
          <div className="cv-main">
            <header className="cv-head">
              <p className="cv-first">Florian</p>
              <h1 className="cv-name">Girardot Lahogue</h1>
              <p className="cv-title">{cv.title}</p>
            </header>

            <Block title={cv.labels.about}>
              <p className="leading-relaxed text-foreground/85">{cv.about}</p>
            </Block>

            <Block title={cv.labels.experience}>
              <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {cv.experience.map((x) => (
                  <li key={x.title}>
                    <p className="font-semibold">{x.title}</p>
                    <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                      {x.items.map((item) => <li key={item} className="cv-bullet">{item}</li>)}
                    </ul>
                  </li>
                ))}
              </ul>
            </Block>

            <Block title={cv.labels.interests}>
              <ul className="space-y-1.5">
                {cv.interests.map((x) => (
                  <li key={x.name}><span className="font-semibold">{x.name}</span> <span className="text-muted-foreground">: {x.text}</span></li>
                ))}
              </ul>
            </Block>
          </div>
        </article>
      </div>
    </div>
  );
};

export default Cv;
