import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Github, Linkedin, Mail } from 'lucide-react';
import { useReveal, AccentTitle } from '@/lib/motion';
import { useLenis } from '@/components/fx/SmoothScroll';

/* Heure de La Réunion (UTC+4), mise à jour chaque seconde */
export const useReunionTime = () => {
  const format = () => new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Indian/Reunion' }).format(new Date());
  const [time, setTime] = useState(format);
  useEffect(() => {
    const id = setInterval(() => setTime(format()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
};

export const SOCIALS = [
  { icon: Mail, label: 'Email', value: 'f.girardot--lahogue@rt-iut.re', href: 'mailto:f.girardot--lahogue@rt-iut.re' },
  { icon: Github, label: 'GitHub', value: 'github.com/JLFlo12', href: 'https://github.com/JLFlo12' },
  { icon: Linkedin, label: 'LinkedIn', value: 'linkedin.com/in/florian-girardot-lahogue-4aa367341', href: 'https://www.linkedin.com/in/florian-girardot-lahogue-4aa367341/' },
];

const Footer = () => {
  const { t } = useTranslation();
  const ref = useRef<HTMLElement>(null);
  const lenis = useLenis();
  const time = useReunionTime();
  useReveal(ref);

  const nav = [
    { path: '/', label: t('nav.home') },
    { path: '/projects', label: t('nav.projects') },
    { path: '/about', label: t('nav.about') },
    { path: '/contact', label: t('nav.contact') },
    { path: '/chatbot', label: t('nav.chatbot') },
    { path: '/games', label: t('nav.games') },
  ];

  const toTop = () => (lenis ? lenis.scrollTo(0, { duration: 1.4 }) : window.scrollTo({ top: 0, behavior: 'smooth' }));

  return (
    <footer ref={ref} className="relative overflow-hidden border-t border-border">
      <div className="pointer-events-none absolute -bottom-40 left-1/2 h-80 w-[70vw] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" aria-hidden="true" />
      <div className="container-x relative py-20 lg:py-28">
        <Link to="/contact" className="group block" data-cursor={t('nav.contact')}>
          <AccentTitle
            as="p"
            text={`${t('ui.footerTitle')}`}
            serifWords={0}
            className="display-xl text-[clamp(2.4rem,8.4vw,8rem)]"
          />
          <span className="mt-2 flex items-center gap-4">
            <span className="serif-accent text-[clamp(2.6rem,8vw,7.5rem)] leading-none">{t('ui.footerAccent')}</span>
            <ArrowUpRight className="h-[clamp(2rem,6vw,5rem)] w-[clamp(2rem,6vw,5rem)] text-primary transition-transform duration-700 group-hover:translate-x-2 group-hover:-translate-y-2" strokeWidth={1.4} />
          </span>
        </Link>

        <div className="mt-16 grid gap-10 border-t border-border pt-10 md:grid-cols-3">
          <div>
            <p className="label-mono mb-4">{t('ui.menu')}</p>
            <ul className="grid grid-cols-2 gap-y-2 text-sm">
              {nav.map((item) => (
                <li key={item.path}><Link to={item.path} className="text-foreground/80 transition-colors hover:text-primary">{item.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label-mono mb-4">{t('nav.contact')}</p>
            <ul className="space-y-2 text-sm">
              {SOCIALS.map(({ icon: Icon, label, href }) => (
                <li key={label}>
                  <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="inline-flex items-center gap-2 text-foreground/80 transition-colors hover:text-primary">
                    <Icon className="h-4 w-4" /> {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="font-mono text-sm text-muted-foreground">
            <p className="label-mono mb-4">{t('home.location')}</p>
            <p className="flex items-center gap-2 text-foreground/80"><span className="status-dot" /> {t('ui.localTime')} · <span className="tabular-nums">{time}</span></p>
            <p className="mt-2">-21.11° S · 55.53° E</p>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} GIRARDOT LAHOGUE Florian. {t('ui.rights')}</p>
          <button type="button" onClick={toTop} className="inline-flex items-center gap-2 transition-colors hover:text-foreground">
            {t('ui.backTop')} ↑
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
