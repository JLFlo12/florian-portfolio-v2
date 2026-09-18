
import React, { useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Download, FileText, Code, Palette, ImageIcon, Pencil, X, Lock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { getProjectGallery, ProjectFile } from '@/data/projectGalleries';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useUpdateProject, GalleryImage } from '@/hooks/useDynamicProjects';
import GalleryEditor from '@/components/admin/GalleryEditor';
import AdminLoginDialog from '@/components/admin/AdminLoginDialog';
import { AccentTitle, useReveal } from '@/lib/motion';

// Liens Canva pour chaque projet
const canvaLinks: { [key: string]: string } = {
  'hygiene-cybersecurite': 'https://www.canva.com/design/DAGR75eU94c/lgzMFgPQ42BKlzcXY9N0mw/view',
  'pilotage-de-led-avec-raspberry-pi': 'https://www.canva.com/design/DAGdTMt714c/HsmxLn-e2kNvwDFtxLDwhg/edit',
  'analyse-de-transmission-wifi': 'https://www.canva.com/design/DAGdsXFIEP0/vEx7owRuxu67lumBODcDQg/edit?utm_content=DAGdsXFIEP0&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton',
  'mesure-et-caracterisation-dun-signal': 'https://www.canva.com/design/DAGqmUrS6yE/xnbNcz-UEiyQwCQW5gZ1HQ/edit',
  'projet-integratif--topologie-centralisee--succursale-gns3': 'https://www.canva.com/design/DAGqmUrS6yE/xnbNcz-UEiyQwCQW5gZ1HQ/edit',
  'creation-dun-site-web-de-suivi-de-commande': 'https://www.canva.com/design/DAGjpZz6DBo/KOSw2rqbdxCLlwOk5y6p8Q/edit',
  'des-jeux-pour-professionnels-du-btiment': 'https://gamma.app/docs/Des-Jeux-pour-Professionnels-du-Batiment-h5a4244sqx07syb'
};

/* ——— Petits blocs réutilisés ——— */
const BlockTitle = ({ index, children }: { index: string; children: React.ReactNode }) => (
  <h2 className="mb-8 flex items-baseline gap-4 border-b border-border pb-4 font-display text-[clamp(1.6rem,3.4vw,2.6rem)] font-extrabold uppercase leading-none tracking-tight [font-stretch:118%]" data-reveal>
    <span className="led text-base text-primary">{index}</span> {children}
  </h2>
);

const DetailCard = ({ section, content, index }: { section: string; content: string[]; index: number }) => (
  <div className="panel p-6 lg:p-8">
    <div className="flex items-start gap-5">
      <span className="led mt-1 text-sm text-primary">{String(index + 1).padStart(2, '0')}</span>
      <div className="min-w-0 flex-1">
        <h3 className="mb-4 font-display text-xl font-bold [font-stretch:110%]">{section}</h3>
        <ul className="space-y-2">
          {content.map((item, i) => (
            <li key={i} className="leading-relaxed text-muted-foreground">{item}</li>
          ))}
        </ul>
      </div>
    </div>
  </div>
);

const ImageCard = ({ url, title, description, soon }: { url?: string; title: string; description?: string; soon: string }) => (
  <figure className="panel group" data-cursor={url ? 'Zoom' : undefined}>
    <div className="relative aspect-[4/3] overflow-hidden">
      {url ? (
        <img src={url} alt={title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-[1.2s] [transition-timing-function:var(--ease-out)] group-hover:scale-110" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/40">
          <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
          <span className="text-sm text-muted-foreground/70">{soon}</span>
        </div>
      )}
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="absolute right-3 top-3 liquid liquid-strong inline-flex h-9 w-9 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100" aria-label={title}>
          <ExternalLink className="h-4 w-4" />
        </a>
      )}
    </div>
    <figcaption className="p-5">
      <p className="font-display text-lg font-bold [font-stretch:110%] transition-colors group-hover:text-primary">{title}</p>
      {description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>}
    </figcaption>
  </figure>
);

/* Présentation (Canva, Gamma…) intégrée dans un cadre façon écran */
const SlidesFrame = ({ src, title }: { src: string; title: string }) => (
  <div className="relative mt-8 rounded-[22px] border border-border bg-card p-3" data-reveal>
    <div className="hud-frame -inset-2" aria-hidden="true"><i /><i /><i /><i /></div>
    <iframe src={src} className="aspect-video w-full rounded-2xl border-0 bg-background" title={title} loading="lazy" allowFullScreen />
  </div>
);

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
        .from('projects' as any)
        .select('*')
        .eq('id', dynamicId!)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const gallery = !isDynamic && projectId ? getProjectGallery(projectId) : undefined;
  const canvaLink = !isDynamic && projectId ? canvaLinks[projectId] : undefined;

  useReveal(page, [!!dynamicProject, editing, projectId]);

  const handleSaveGallery = async (data: { detailed_content: any[]; gallery_images: GalleryImage[] }) => {
    await updateProject.mutateAsync({ id: dynamicId!, ...data } as any);
    queryClient.invalidateQueries({ queryKey: ['dynamic-project', dynamicId] });
    setEditing(false);
  };

  // Icône selon le type de fichier
  const getFileIcon = (type: string) => {
    switch (type) {
      case 'html': return <FileText className="h-5 w-5" />;
      case 'css': return <Palette className="h-5 w-5" />;
      case 'js': return <Code className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  const FileCard = ({ file }: { file: ProjectFile }) => (
    <div className="panel group flex items-center justify-between gap-4 p-5">
      <div className="flex min-w-0 items-center gap-4">
        <span className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">{getFileIcon(file.type)}</span>
        <div className="min-w-0">
          <h3 className="truncate font-semibold transition-colors group-hover:text-primary">{file.title}</h3>
          {file.description && <p className="mt-0.5 text-sm text-muted-foreground">{file.description}</p>}
        </div>
      </div>
      <div className="flex flex-none gap-2">
        <a href={file.url} target="_blank" rel="noopener noreferrer" aria-label={file.title} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border transition-colors hover:border-primary hover:text-primary">
          <ExternalLink className="h-4 w-4" />
        </a>
        <a href={file.url} download aria-label={`Télécharger ${file.title}`} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border transition-colors hover:border-primary hover:text-primary">
          <Download className="h-4 w-4" />
        </a>
      </div>
    </div>
  );

  const BackLink = () => (
    <Link to="/projects" className="btn-ghost liquid !py-2.5 text-sm">
      <ArrowLeft className="h-4 w-4" /> {t('gallery.back')}
    </Link>
  );

  const wrapper = 'pb-24 pt-[calc(var(--nav-h)+48px)]';

  // ——— Projet dynamique (Supabase) ———
  if (isDynamic && dynamicProject) {
    const details = dynamicProject.detailed_content || [];
    const galleryImages: GalleryImage[] = dynamicProject.gallery_images || [];
    const description = i18n.language === 'en' && dynamicProject.description_en ? dynamicProject.description_en : dynamicProject.description_fr;
    const slideSrc = dynamicProject.slideshow_url
      ? (dynamicProject.slideshow_url.includes('/edit') ? dynamicProject.slideshow_url.replace('/edit', '/view?embed') : dynamicProject.slideshow_url + '?embed')
      : null;

    return (
      <div ref={page} className={wrapper}>
        <div className="container-x">
          <div className="flex flex-wrap items-center justify-between gap-3" data-reveal>
            <BackLink />
            <div className="flex gap-2">
              {!isAdmin ? (
                <Button variant="outline" size="sm" onClick={() => setShowLoginDialog(true)} className="gap-2 rounded-full">
                  <Lock className="h-4 w-4" /> {t('gallery.admin')}
                </Button>
              ) : (
                <>
                  <Button size="sm" variant={editing ? 'destructive' : 'default'} onClick={() => setEditing(!editing)} className="gap-2 rounded-full">
                    {editing ? <><X className="h-4 w-4" /> {t('gallery.cancel')}</> : <><Pencil className="h-4 w-4" /> {t('gallery.edit')}</>}
                  </Button>
                  <Button variant="outline" size="sm" onClick={logout} className="gap-2 rounded-full">
                    <LogOut className="h-4 w-4" /> {t('gallery.logout')}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* En-tête du projet */}
          <header className="mt-14 grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-end">
            <div>
              <p className="eyebrow" data-reveal>
                <span className="eyebrow__index">{dynamicProject.status === 'completed' ? '✓' : '··'}</span>
                <span className="eyebrow__rule" data-rule aria-hidden="true" />
                <span className="eyebrow__label">{dynamicProject.status === 'completed' ? t('projects.completed') : t('projects.inProgress')}</span>
              </p>
              <AccentTitle as="h1" text={dynamicProject.title} serifWords={0} className="mt-5 font-display text-[clamp(2.2rem,6vw,5.2rem)] font-extrabold uppercase leading-[.92] tracking-[-.035em] [font-stretch:118%]" />
            </div>
            <div className="space-y-5" data-reveal>
              <p className="border-l border-primary/40 pl-5 text-lg leading-relaxed text-muted-foreground">{description}</p>
              <div className="flex flex-wrap gap-2">
                {(dynamicProject.tags || []).map((tag: string) => <span key={tag} className="chip">{tag}</span>)}
              </div>
            </div>
          </header>

          {slideSrc && (
            <div className="mt-12">
              <a href={dynamicProject.slideshow_url} target="_blank" rel="noopener noreferrer" className="btn-neon" data-reveal>
                <ExternalLink className="h-4 w-4" /> {t('gallery.slides')}
              </a>
              <SlidesFrame src={slideSrc} title={dynamicProject.title} />
            </div>
          )}

          {/* Mode édition */}
          {editing && isAdmin && (
            <div className="mt-12">
              <GalleryEditor projectId={dynamicId!} detailedContent={details} galleryImages={galleryImages} onSave={handleSaveGallery} />
            </div>
          )}

          {/* Mode lecture */}
          {!editing && (
            <>
              {details.length > 0 && (
                <section className="mt-20">
                  <BlockTitle index="01">{t('gallery.details')}</BlockTitle>
                  <div className="grid gap-4" data-stagger>
                    {details.map((detail: any, index: number) => (
                      <DetailCard key={index} section={detail.section} content={detail.content} index={index} />
                    ))}
                  </div>
                </section>
              )}

              {galleryImages.length > 0 && (
                <section className="mt-20">
                  <BlockTitle index="02">{t('gallery.images')}</BlockTitle>
                  <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3" data-stagger>
                    {galleryImages.map((image, index) => (
                      <ImageCard key={index} url={image.url} title={image.title} description={image.description} soon={t('gallery.soon')} />
                    ))}
                  </div>
                </section>
              )}

              {galleryImages.length === 0 && dynamicProject.thumbnail_url && (
                <section className="mt-20">
                  <BlockTitle index="02">{t('gallery.image')}</BlockTitle>
                  <img src={dynamicProject.thumbnail_url} alt={dynamicProject.title} loading="lazy" className="w-full max-w-3xl rounded-[22px] border border-border" data-reveal />
                </section>
              )}
            </>
          )}
        </div>

        <AdminLoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} onLogin={login} />
      </div>
    );
  }

  // Chargement d'un projet dynamique
  if (isDynamic && isLoading) {
    return (
      <div className={wrapper}>
        <div className="container-x space-y-6">
          <div className="h-10 w-48 animate-pulse rounded-full bg-muted" />
          <div className="h-24 w-3/4 animate-pulse rounded-2xl bg-muted" />
          <div className="aspect-video w-full animate-pulse rounded-[22px] bg-muted" />
        </div>
      </div>
    );
  }

  if (!gallery && !dynamicProject) {
    return (
      <div className={`${wrapper} min-h-[70vh]`}>
        <div className="container-x flex flex-col items-start gap-8">
          <p className="led text-[clamp(4rem,14vw,10rem)] leading-none text-primary">404</p>
          <h1 className="title-xl">{t('gallery.notFound')}</h1>
          <BackLink />
        </div>
      </div>
    );
  }

  if (!gallery) return null;

  // ——— Projet statique (données locales) ———
  return (
    <div ref={page} className={wrapper}>
      <div className="container-x">
        <div data-reveal><BackLink /></div>
        <header className="mt-14">
          <p className="eyebrow" data-reveal>
            <span className="eyebrow__index">//</span>
            <span className="eyebrow__rule" data-rule aria-hidden="true" />
            <span className="eyebrow__label">projects</span>
          </p>
          <AccentTitle as="h1" text={gallery.projectTitle} serifWords={0} className="mt-5 font-display text-[clamp(2.2rem,6vw,5.2rem)] font-extrabold uppercase leading-[.92] tracking-[-.035em] [font-stretch:118%]" />
        </header>

        {canvaLink && (
          <div className="mt-12">
            <a href={canvaLink} target="_blank" rel="noopener noreferrer" className="btn-neon" data-reveal>
              <ExternalLink className="h-4 w-4" /> {t('gallery.canva')}
            </a>
            <SlidesFrame src={canvaLink.replace('/edit', '/view').replace('/view', '/view?embed')} title={gallery.projectTitle} />
          </div>
        )}

        {gallery.details && gallery.details.length > 0 && (
          <section className="mt-20">
            <BlockTitle index="01">{t('gallery.plan')}</BlockTitle>
            <div className="grid gap-4" data-stagger>
              {gallery.details.map((detail, index) => (
                <DetailCard key={index} section={detail.section} content={detail.content} index={index} />
              ))}
            </div>
          </section>
        )}

        {gallery.files && gallery.files.length > 0 && (
          <section className="mt-20">
            <BlockTitle index="02">{t('gallery.files')}</BlockTitle>
            <div className="grid gap-4 md:grid-cols-2" data-stagger>
              {gallery.files.map((file) => <FileCard key={file.id} file={file} />)}
            </div>
          </section>
        )}

        {gallery.images.length > 0 && (
          <section className="mt-20">
            <BlockTitle index="03">{t('gallery.images')}</BlockTitle>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3" data-stagger>
              {gallery.images.map((image) => (
                <ImageCard key={image.id} url={image.url} title={image.title} description={image.description} soon={t('gallery.soon')} />
              ))}
            </div>
          </section>
        )}

        {gallery.images.length === 0 && (!gallery.files || gallery.files.length === 0) && (
          <p className="py-16 text-center text-lg text-muted-foreground">{t('gallery.empty')}</p>
        )}
      </div>
    </div>
  );
};

export default ProjectGallery;
