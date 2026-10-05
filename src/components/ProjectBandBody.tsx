import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight } from 'lucide-react';
import { useDynamicProjects } from '@/hooks/useDynamicProjects';
import { useTheme } from '@/contexts/ThemeContext';
import { prefersReducedMotion, useReveal } from '@/lib/motion';
import { hasWebGL } from '@/components/three/webgl';
import type { Ribbon } from '@/components/three/ribbon';

const pad = (n: number) => String(n).padStart(2, '0');

/* ───────────────────────────────────────────────────────────────
   Contenu de la bande de projets (chargé par ProjectBand quand elle approche) :
   les projets défilent sur un ruban 3D qui ondule, façon jesperlandberg.com.
   La scène three.js (components/three/ribbon.ts) est chargée à son tour.
   Sans WebGL ou avec les animations réduites : une simple rangée de cartes.
   ─────────────────────────────────────────────────────────────── */
const ProjectBandBody = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: projects = [], isLoading } = useDynamicProjects();
  const light = useTheme().theme === 'light';
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const ribbon = useRef<Ribbon>();
  const lightNow = useRef(light);
  const [focus, setFocus] = useState(0);
  const [use3d] = useState(() => hasWebGL() && !prefersReducedMotion());
  useReveal(root, [projects.length]);

  const cards = useMemo(() => projects.map((p) => ({ title: p.title, tags: p.tags ?? [], image: p.thumbnail_url })), [projects]);
  const href = (i: number) => `/projects/dynamic-${projects[i]?.id}`;

  useEffect(() => {
    const el = root.current;
    if (!use3d || !cards.length || !el) return;
    let cancelled = false;
    const loader = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      loader.disconnect();
      import('@/components/three/ribbon').then(({ createRibbon }) => {
        if (cancelled || !canvas.current) return;
        ribbon.current = createRibbon(canvas.current, cards, {
          onSelect: (i) => navigate(href(i)),
          onFocus: setFocus,
        }, lightNow.current);
      });
    }, { rootMargin: '600px 0px' });
    loader.observe(el);
    return () => { cancelled = true; loader.disconnect(); ribbon.current?.destroy(); ribbon.current = undefined; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [use3d, cards, navigate]);

  // Thème du site : les cartes sont redessinées (blanches en mode clair), sans recréer la scène
  useEffect(() => {
    lightNow.current = light;
    ribbon.current?.setLight(light);
  }, [light]);

  // Pendant le chargement, la section garde sa place (pas de saut de mise en page)
  if (isLoading) return <section className={use3d ? 'project-band project-band--3d' : 'project-band'} aria-hidden="true" />;
  if (!projects.length) return null;

  return (
    <section ref={root} className={use3d ? 'project-band project-band--3d' : 'project-band'} aria-labelledby="project-band-title">
      <div className="project-band__bar project-band__bar--top container-x">
        <h2 id="project-band-title" className="label-mono" data-band>
          <span className="text-primary">{pad(projects.length)}</span> · {t('home.band.title')}
        </h2>
        <Link to="/projects" className="project-band__all label-mono" data-band="0.1">
          {t('home.band.all')} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {use3d ? (
        <>
          <canvas ref={canvas} className="project-band__canvas" aria-hidden="true" />
          {/* Lecteurs d'écran : la liste des projets (le canvas est purement visuel) */}
          <ul className="sr-only">
            {projects.map((p, i) => <li key={p.id}><Link to={href(i)} tabIndex={-1}>{p.title}</Link></li>)}
          </ul>
          <div className="project-band__bar project-band__bar--bottom container-x" aria-hidden="true">
            <p className="label-mono">{t('home.band.hint')}</p>
            <p className="led text-sm text-primary">{pad(focus + 1)} <span className="text-muted-foreground">/ {pad(projects.length)}</span></p>
          </div>
        </>
      ) : (
        <ul className="project-band__list">
          {projects.map((p, i) => (
            <li key={p.id}>
              <Link to={href(i)} className="project-band__card">
                {p.thumbnail_url
                  ? <img src={p.thumbnail_url} alt="" loading="lazy" decoding="async" />
                  : <span className="project-band__cover">{p.tags[0] ?? p.title.split(' ')[0]}</span>}
                <span className="project-band__title"><span className="led text-primary">{pad(i + 1)}</span> {p.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default ProjectBandBody;
