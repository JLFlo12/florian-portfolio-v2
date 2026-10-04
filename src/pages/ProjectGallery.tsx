import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Code, Palette, Pencil, X, Lock, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getProjectGallery, ProjectFile } from '@/data/projectGalleries';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useDynamicProjects, useUpdateProject, DynamicProject, GalleryImage } from '@/hooks/useDynamicProjects';
import GalleryEditor from '@/components/admin/GalleryEditor';
import AdminLoginDialog from '@/components/admin/AdminLoginDialog';
import { AccentTitle, gsap, prefersReducedMotion, useReveal } from '@/lib/motion';
import { allowEmbed, embedAllowed } from '@/data/legal';

// Liens Canva des anciens projets (données locales)
const canvaLinks: { [key: string]: string } = {
  'hygiene-cybersecurite': 'https://www.canva.com/design/DAGR75eU94c/lgzMFgPQ42BKlzcXY9N0mw/view',
  'pilotage-de-led-avec-raspberry-pi': 'https://www.canva.com/design/DAGdTMt714c/HsmxLn-e2kNvwDFtxLDwhg/edit',
  'analyse-de-transmission-wifi': 'https://www.canva.com/design/DAGdsXFIEP0/vEx7owRuxu67lumBODcDQg/edit?utm_content=DAGdsXFIEP0&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton',
  'mesure-et-caracterisation-dun-signal': 'https://www.canva.com/design/DAGqmUrS6yE/xnbNcz-UEiyQwCQW5gZ1HQ/edit',
  'projet-integratif--topologie-centralisee--succursale-gns3': 'https://www.canva.com/design/DAGqmUrS6yE/xnbNcz-UEiyQwCQW5gZ1HQ/edit',
  'creation-dun-site-web-de-suivi-de-commande': 'https://www.canva.com/design/DAGjpZz6DBo/KOSw2rqbdxCLlwOk5y6p8Q/edit',
  'des-jeux-pour-professionnels-du-btiment': 'https://gamma.app/docs/Des-Jeux-pour-Professionnels-du-Batiment-h5a4244sqx07syb'
};

interface Detail { section: string; content: string[] }
interface Shot { url?: string; title: string; description?: string }
interface Neighbour { href: string; title: string }

const pad = (n: number) => String(n).padStart(2, '0');

// Rubriques et listes commencent parfois par un emoji (« 📡 contexte ») : on le retire
// (le tiret orange sert déjà de puce) et les titres prennent une majuscule.
const stripEmoji = (s: string) => s.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '').trim();
const cleanSection = (s: string) => {
  const text = stripEmoji(s);
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// Lien de présentation (Canva, Gamma…) → adresse intégrable + nom du service.
// Gamma n'autorise l'intégration que par /embed/<id> : ses pages /docs/ refusent d'être affichées sur un autre site.
const slidesOf = (url: string | null | undefined) => {
  if (!url) return null;
  const gamma = url.match(/gamma\.app\/(?:docs|embed)\/(?:[^/?#]*-)?([a-z0-9]{8,})(?:[/?#]|$)/i);
  const src = gamma ? `https://gamma.app/embed/${gamma[1]}`
    : url.includes('/edit') ? url.replace('/edit', '/view?embed')
      : url.includes('?') ? `${url}&embed` : `${url}?embed`;
  const host = /canva\.com/.test(url) ? 'Canva' : gamma ? 'Gamma' : '';
  return { href: url, src, host };
};

// Taille du titre selon sa longueur : les titres longs restent sur quelques lignes
const titleSize = (title: string) => (
  title.length <= 24 ? 'text-[clamp(2.8rem,8.6vw,7.8rem)]'
    : title.length <= 42 ? 'text-[clamp(2.4rem,6.2vw,5.6rem)]'
      : 'text-[clamp(2rem,4.6vw,4.2rem)]'
);

const fileIcon = (type: string) => {
  switch (type) {
    case 'css': return <Palette className="h-5 w-5" />;
    case 'js': return <Code className="h-5 w-5" />;
    default: return <FileText className="h-5 w-5" />;
  }
};

/* ——— En-tête de section : numéro LED, titre, action à droite ——— */
const SectionHead = ({ index, title, action }: { index: string; title: string; action?: React.ReactNode }) => (
  <div className="case-head">
    <h2 data-band><span className="led text-base text-primary">{index}</span>{title}</h2>
    {action}
  </div>
);

/* ——— Couverture : image du projet en parallaxe, ou couverture générée ——— */
const Cover = ({ src, word, title }: { src?: string | null; word: string; title: string }) => {
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = frame.current;
    const img = el?.querySelector('img');
    if (!el || !img || prefersReducedMotion()) return;
    const tween = gsap.fromTo(img, { yPercent: -6 }, {
      yPercent: 6, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
    });
    return () => { tween.scrollTrigger?.kill(); tween.kill(); };
  }, [src]);
  return (
    <figure className="case-cover container-x" data-reveal>
      <div ref={frame} className="case-cover__frame">
        {src
          ? <img src={src} alt={title} decoding="async" />
          : (
            <div className="case-cover__generated" aria-hidden="true">
              <span style={{ fontSize: `min(10rem, calc((100cqw - 2 * clamp(1.25rem, 4cqw, 3.5rem)) / ${(word.length * 0.92).toFixed(2)}))` }}>{word}</span>
            </div>
          )}
        <div className="hud-frame inset-4" aria-hidden="true"><i /><i /><i /><i /></div>
      </div>
    </figure>
  );
};

/* ——— Présentation intégrée : chargée seulement après un clic, car Canva et Gamma déposent leurs
   propres cookies. Le choix est retenu par service (réinitialisable sur la page Mentions légales). ——— */
const SlidesEmbed = ({ slides, title, cover }: { slides: NonNullable<ReturnType<typeof slidesOf>>; title: string; cover?: string | null }) => {
  const { t } = useTranslation();
  const host = slides.host || new URL(slides.href).hostname;
  const [loaded, setLoaded] = useState(() => embedAllowed(host));
  return (
    <div className="case-screen" data-reveal>
      {loaded ? <iframe src={slides.src} title={title} loading="lazy" allowFullScreen /> : (
        <div className="case-embed">
          {cover && <img src={cover} alt="" aria-hidden="true" className="case-embed__bg" />}
          <div className="case-embed__panel">
            <p className="label-mono">{t('gallery.embedFrom', { host })}</p>
            <button type="button" className="btn-neon" onClick={() => { allowEmbed(host); setLoaded(true); }}>{t('gallery.embedLoad')}</button>
            <p className="case-embed__note">
              {t('gallery.embedNote', { host })} <Link to="/mentions-legales">{t('gallery.embedMore')}</Link>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

/* ——— Mise en page commune à tous les projets ——— */
interface CaseStudyProps {
  title: string;
  status?: string;
  done?: boolean;
  description?: string;
  tags: string[];
  cover?: string | null;
  slides: ReturnType<typeof slidesOf>;
  details: Detail[];
  detailsTitle: string;
  files?: ProjectFile[];
  shots: Shot[];
  counter?: { index: number; total: number; prev?: Neighbour; next?: Neighbour };
  toolbar?: React.ReactNode;
  editor?: React.ReactNode;
}

const CaseStudy = ({ title, status, done, description, tags, cover, slides, details, detailsTitle, files = [], shots, counter, toolbar, editor }: CaseStudyProps) => {
  const { t } = useTranslation();
  let section = 0;
  const next = () => pad(++section);

  const meta = [
    status && { label: t('gallery.status'), value: <span className="inline-flex items-center gap-2">{done ? <span className="text-[hsl(var(--online))]">✓</span> : <span className="status-dot !bg-primary" />}{status}</span> },
    tags.length > 0 && { label: t('gallery.field'), value: tags.slice(0, 3).join(' · ') },
    (slides || details.length > 0 || shots.length > 0) && {
      label: t('gallery.format'),
      value: slides ? `${t('gallery.presentation')} ${slides.host}`.trim() : details.length ? t('gallery.sections', { count: details.length }) : t('gallery.shots', { count: shots.length }),
    },
  ].filter(Boolean) as { label: string; value: React.ReactNode }[];

  return (
    <>
      {/* Barre du haut : retour, position dans la liste, projet précédent / suivant, admin */}
      <div className="container-x flex flex-wrap items-center justify-between gap-3" data-reveal>
        <Link to="/projects" className="btn-ghost liquid !py-2.5 text-sm">
          <ArrowLeft className="h-4 w-4" /> {t('gallery.back')}
        </Link>
        <div className="flex items-center gap-2">
          {counter && (
            <>
              <span className="led mr-2 text-sm text-primary">{pad(counter.index)} <span className="text-muted-foreground">/ {pad(counter.total)}</span></span>
              {counter.prev && (
                <Link to={counter.prev.href} aria-label={`${t('gallery.prev')} : ${counter.prev.title}`} className="liquid inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:text-primary">
                  <ChevronLeft className="h-4 w-4" />
                </Link>
              )}
              {counter.next && (
                <Link to={counter.next.href} aria-label={`${t('gallery.next')} : ${counter.next.title}`} className="liquid inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:text-primary">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </>
          )}
          {toolbar}
        </div>
      </div>

      {/* En-tête : statut, titre, fiche technique */}
      <header className="container-x mt-12 lg:mt-16">
        <p className="eyebrow" data-band>
          <span className="eyebrow__index">{done ? '✓' : '··'}</span>
          <span className="eyebrow__rule" data-rule aria-hidden="true" />
          <span className="eyebrow__label">{status ?? 'projets'}</span>
        </p>
        <AccentTitle as="h1" text={title} serifWords={0} band={0.12} className={`case-title mt-6 ${titleSize(title)}`} />
        {meta.length > 0 && (
          <dl className="case-meta" data-stagger>
            {meta.map(({ label, value }) => (
              <div key={label}><dt className="label-mono">{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
        )}
      </header>

      <Cover src={cover} word={tags[0] ?? title.split(' ')[0]} title={title} />

      {editor ? <div className="container-x mt-16">{editor}</div> : (
        <>
          {/* À propos : la description en grand, les mots-clés dessous */}
          {(description || tags.length > 0) && (
            <section className="case-row container-x">
              <p className="case-row__label label-mono">{t('gallery.about')}</p>
              <div>
                {description && <p className={`case-lede${description.length > 160 ? ' case-lede--long' : ''}`} data-band="0.1">{description}</p>}
                {tags.length > 0 && (
                  <div className="mt-8 flex flex-wrap gap-2" data-reveal>
                    {tags.map((tag) => <span key={tag} className="chip">{tag}</span>)}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Présentation (Canva, Gamma…) dans un cadre d'écran */}
          {slides && (
            <section className="case-section container-x">
              <SectionHead
                index={next()}
                title={t('gallery.presentation')}
                action={(
                  <a href={slides.href} target="_blank" rel="noopener noreferrer" className="btn-ghost !py-2.5 text-sm" data-reveal>
                    {t('gallery.slides')} <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              />
              <SlidesEmbed slides={slides} title={title} cover={cover} />
            </section>
          )}

          {/* Détails : rubriques en deux colonnes, façon fiche */}
          {details.length > 0 && (
            <section className="case-section container-x">
              <SectionHead index={next()} title={detailsTitle} />
              <div className="case-details" data-stagger>
                {details.map((detail, i) => (
                  <article key={i} className="case-detail">
                    <p className="led text-sm text-primary">{pad(i + 1)}</p>
                    <h3 className="case-detail__title">{cleanSection(detail.section)}</h3>
                    <ul className="case-detail__list">
                      {detail.content.map((item, j) => <li key={j}>{stripEmoji(item)}</li>)}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Fichiers (anciens projets) */}
          {files.length > 0 && (
            <section className="case-section container-x">
              <SectionHead index={next()} title={t('gallery.files')} />
              <ul className="case-files" data-stagger>
                {files.map((file) => (
                  <li key={file.id}>
                    <span className="case-files__icon">{fileIcon(file.type)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{file.title}</span>
                      {file.description && <span className="mt-0.5 block text-sm text-muted-foreground">{file.description}</span>}
                    </span>
                    <a href={file.url} target="_blank" rel="noopener noreferrer" aria-label={file.title} className="case-files__action"><ExternalLink className="h-4 w-4" /></a>
                    <a href={file.url} download aria-label={`${t('gallery.download')} ${file.title}`} className="case-files__action"><Download className="h-4 w-4" /></a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Galerie : la première image en grand, les suivantes deux par deux */}
          {shots.length > 0 && (
            <section className="case-section container-x">
              <SectionHead index={next()} title={t('gallery.images')} />
              <div className="case-gallery" data-stagger>
                {shots.map((shot, i) => (
                  <figure key={i} className="case-shot">
                    {shot.url
                      ? <a href={shot.url} target="_blank" rel="noopener noreferrer" className="case-shot__frame"><img src={shot.url} alt={shot.title} loading="lazy" decoding="async" /></a>
                      : <span className="case-shot__frame case-shot__frame--empty">{t('gallery.soon')}</span>}
                    <figcaption>
                      <span className="led text-xs text-primary">{pad(i + 1)}</span>
                      <span className="font-semibold text-foreground">{shot.title}</span>
                      {shot.description && <span className="text-muted-foreground"> — {shot.description}</span>}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          {!slides && details.length === 0 && files.length === 0 && shots.length === 0 && !description && (
            <p className="container-x py-16 text-center text-lg text-muted-foreground">{t('gallery.empty')}</p>
          )}
        </>
      )}

      {/* Projet suivant, en grand */}
      {counter?.next && (
        <nav className="case-next container-x" aria-label={t('gallery.next')}>
          <Link to={counter.next.href} className="case-next__link">
            <span className="label-mono">{t('gallery.next')} — {pad(counter.index % counter.total + 1)}</span>
            <span className="case-next__title">
              <span>{counter.next.title}</span>
              <ArrowUpRight className="case-next__arrow" aria-hidden="true" />
            </span>
          </Link>
        </nav>
      )}
    </>
  );
};

const ProjectGallery = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { t, i18n } = useTranslation();
  const { isAdmin, adminPassword, login, logout } = useAdminAuth();
  const updateProject = useUpdateProject(adminPassword);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const page = useRef<HTMLDivElement>(null);

  const isDynamic = projectId?.startsWith('dynamic-');
  const dynamicId = isDynamic ? projectId.replace('dynamic-', '') : null;

  const { data: dynamicProject, isLoading } = useQuery({
    queryKey: ['dynamic-project', dynamicId],
    enabled: !!dynamicId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects' as never)
        .select('*')
        .eq('id', dynamicId as string)
        .single();
      if (error) throw error;
      return data as unknown as DynamicProject;
    },
  });
  // Liste des projets : position « 04 / 12 », projet précédent et suivant
  const { data: allProjects = [] } = useDynamicProjects();

  const gallery = !isDynamic && projectId ? getProjectGallery(projectId) : undefined;
  const canvaLink = !isDynamic && projectId ? canvaLinks[projectId] : undefined;

  useReveal(page, [!!dynamicProject, editing, projectId]);
  useEffect(() => setEditing(false), [projectId]);

  const handleSaveGallery = async (data: { detailed_content: Detail[]; gallery_images: GalleryImage[] }) => {
    await updateProject.mutateAsync({ id: dynamicId as string, ...data });
    queryClient.invalidateQueries({ queryKey: ['dynamic-project', dynamicId] });
    setEditing(false);
  };

  const wrapper = 'pb-8 pt-[calc(var(--nav-h)+40px)]';

  // ——— Projet Supabase ———
  if (isDynamic && dynamicProject) {
    const details: Detail[] = dynamicProject.detailed_content || [];
    const images: GalleryImage[] = dynamicProject.gallery_images || [];
    const position = allProjects.findIndex((p) => p.id === dynamicProject.id);
    const at = (i: number) => {
      const p = allProjects[(i + allProjects.length) % allProjects.length];
      return { href: `/projects/dynamic-${p.id}`, title: p.title };
    };
    const counter = position >= 0 && allProjects.length > 1
      ? { index: position + 1, total: allProjects.length, prev: at(position - 1), next: at(position + 1) }
      : undefined;
    const done = dynamicProject.status === 'completed';

    const toolbar = !isAdmin ? (
      <button type="button" onClick={() => setShowLoginDialog(true)} aria-label={t('gallery.admin')} className="liquid ml-1 inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary">
        <Lock className="h-4 w-4" />
      </button>
    ) : (
      <>
        <button type="button" onClick={() => setEditing(!editing)} className={`ml-1 !py-2 text-sm ${editing ? 'btn-ghost' : 'btn-neon'}`}>
          {editing ? <><X className="h-4 w-4" /> {t('gallery.cancel')}</> : <><Pencil className="h-4 w-4" /> {t('gallery.edit')}</>}
        </button>
        <button type="button" onClick={logout} aria-label={t('gallery.logout')} className="liquid inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary">
          <LogOut className="h-4 w-4" />
        </button>
      </>
    );

    return (
      <div ref={page} className={wrapper}>
        <CaseStudy
          title={dynamicProject.title}
          status={done ? t('gallery.done') : t('gallery.ongoing')}
          done={done}
          description={i18n.language === 'en' && dynamicProject.description_en ? dynamicProject.description_en : dynamicProject.description_fr}
          tags={dynamicProject.tags || []}
          cover={dynamicProject.thumbnail_url}
          slides={slidesOf(dynamicProject.slideshow_url)}
          details={details}
          detailsTitle={t('gallery.details')}
          shots={images}
          counter={counter}
          toolbar={toolbar}
          editor={editing && isAdmin
            ? <GalleryEditor projectId={dynamicId as string} detailedContent={details} galleryImages={images} onSave={handleSaveGallery} />
            : undefined}
        />
        <AdminLoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} onLogin={login} />
      </div>
    );
  }

  // Chargement d'un projet Supabase
  if (isDynamic && isLoading) {
    return (
      <div className={wrapper}>
        <div className="container-x space-y-8">
          <div className="h-10 w-48 animate-pulse rounded-full bg-muted" />
          <div className="h-28 w-3/4 animate-pulse rounded-2xl bg-muted" />
          <div className="aspect-[21/9] w-full animate-pulse rounded-[22px] bg-muted" />
        </div>
      </div>
    );
  }

  if (!gallery) {
    return (
      <div className={`${wrapper} min-h-[70vh]`}>
        <div className="container-x flex flex-col items-start gap-8">
          <p className="led text-[clamp(4rem,14vw,10rem)] leading-none text-primary">404</p>
          <h1 className="title-xl">{t('gallery.notFound')}</h1>
          <Link to="/projects" className="btn-ghost liquid !py-2.5 text-sm"><ArrowLeft className="h-4 w-4" /> {t('gallery.back')}</Link>
        </div>
      </div>
    );
  }

  // ——— Ancien projet (données locales) ———
  return (
    <div ref={page} className={wrapper}>
      <CaseStudy
        title={gallery.projectTitle}
        tags={[]}
        cover={gallery.images.find((image) => image.url)?.url}
        slides={slidesOf(canvaLink)}
        details={gallery.details ?? []}
        detailsTitle={t('gallery.plan')}
        files={gallery.files}
        shots={gallery.images}
      />
    </div>
  );
};

export default ProjectGallery;
