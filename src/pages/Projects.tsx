
import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, ExternalLink, Plus, Trash2, Lock, LogOut, Pencil } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useDynamicProjects, useCreateProject, useUpdateProject, useDeleteProject, DynamicProject } from '@/hooks/useDynamicProjects';
import AdminLoginDialog from '@/components/admin/AdminLoginDialog';
import ProjectFormDialog from '@/components/admin/ProjectFormDialog';
import SectionHeading from '@/components/SectionHeading';
import { useReveal } from '@/lib/motion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const Projects = () => {
  const { t, i18n } = useTranslation();
  const { isAdmin, adminPassword, login, logout } = useAdminAuth();
  const { data: dynamicProjects = [], isLoading } = useDynamicProjects();
  const createProject = useCreateProject(adminPassword);
  const updateProject = useUpdateProject(adminPassword);
  const deleteProject = useDeleteProject(adminPassword);

  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<DynamicProject | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  const page = useRef<HTMLDivElement>(null);
  useReveal(page, [dynamicProjects.length, isAdmin]);

  const inProgressProjects = dynamicProjects.filter(p => p.status === 'inProgress');
  const completedProjects = dynamicProjects.filter(p => p.status === 'completed');
  const description = (p: DynamicProject) => (i18n.language === 'en' && p.description_en ? p.description_en : p.description_fr);

  /* ——— Carte projet ——— */
  const ProjectCard = ({ project, number }: { project: DynamicProject; number: number }) => {
    const done = project.status === 'completed';
    return (
      <article className="panel group relative flex h-full flex-col" data-cursor={t('ui.view')}>
        {/* Visuel : image du projet, ou couverture générée */}
        <div className="relative aspect-[16/10] overflow-hidden border-b border-border">
          {project.thumbnail_url ? (
            <img
              src={project.thumbnail_url}
              alt={project.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-[1.2s] [transition-timing-function:var(--ease-out)] group-hover:scale-[1.07]"
            />
          ) : (
            <div className="relative flex h-full w-full items-end overflow-hidden bg-[radial-gradient(80%_90%_at_80%_10%,hsl(var(--primary)/.35),transparent_60%),hsl(var(--card))] p-6">
              <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(hsl(var(--foreground)/.08) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)/.08) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
              <span className="relative font-display text-[clamp(2.2rem,5vw,3.6rem)] font-black uppercase leading-[.85] tracking-tight text-foreground/90 [font-stretch:125%] transition-transform duration-700 group-hover:-translate-y-1">
                {project.tags[0] ?? project.title.split(' ')[0]}
              </span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
          <span className="led absolute left-4 top-4 rounded-md bg-background/70 px-2 py-1 text-sm text-primary backdrop-blur">{String(number).padStart(2, '0')}</span>
          <span className={`absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[.68rem] uppercase tracking-wider backdrop-blur ${done ? 'border-[hsl(var(--online)/.4)] bg-background/70 text-[hsl(var(--online))]' : 'border-primary/50 bg-background/70 text-primary'}`}>
            {done ? '✓' : <span className="status-dot !bg-primary" />} {done ? t('projects.completed') : t('projects.inProgress')}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-4 p-6">
          <h3 className="font-display text-[clamp(1.25rem,2vw,1.6rem)] font-extrabold leading-tight tracking-tight [font-stretch:110%] transition-colors group-hover:text-primary">
            {/* Lien étendu : toute la carte est cliquable */}
            <Link to={`/projects/dynamic-${project.id}`} className="after:absolute after:inset-0 after:z-[1] after:content-['']">
              {project.title}
            </Link>
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{description(project)}</p>
          <div className="flex flex-wrap gap-2">
            {project.tags.map((tag) => <span key={tag} className="chip">{tag}</span>)}
          </div>
          <div className="mt-auto flex items-center justify-between gap-4 border-t border-border pt-4">
            {project.slideshow_url ? (
              <a
                href={project.slideshow_url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative z-[2] inline-flex items-center gap-2 text-sm text-primary transition-colors hover:text-primary/80"
              >
                <ExternalLink className="h-3.5 w-3.5" /> {t('projects.viewSlides')}
              </a>
            ) : <span />}
            <span className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-foreground">
              {t('projects.viewProject')} <ArrowUpRight className="h-4 w-4 transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>

        {isAdmin && (
          <div className="absolute right-4 top-14 z-[3] flex gap-1">
            <Button size="icon" variant="secondary" className="h-8 w-8" aria-label="Modifier" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingProject(project); setShowFormDialog(true); }}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="destructive" className="h-8 w-8" aria-label="Supprimer" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeletingProjectId(project.id); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </article>
    );
  };

  const handleCreateOrUpdate = async (data: Partial<DynamicProject>) => {
    if (editingProject) {
      await updateProject.mutateAsync({ ...data, id: editingProject.id } as any);
    } else {
      await createProject.mutateAsync(data);
    }
    setShowFormDialog(false);
    setEditingProject(null);
  };

  const handleDelete = async () => {
    if (deletingProjectId) {
      await deleteProject.mutateAsync(deletingProjectId);
      setDeletingProjectId(null);
    }
  };

  const Group = ({ title, index, list, offset }: { title: string; index: string; list: DynamicProject[]; offset: number }) => (
    <section className="container-x pt-16 lg:pt-24">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5" data-reveal>
        <h2 className="flex items-baseline gap-4 font-display text-[clamp(1.8rem,4vw,3.2rem)] font-extrabold uppercase leading-none tracking-tight [font-stretch:118%]">
          <span className="led text-base text-primary">{index}</span> {title}
        </h2>
        <span className="label-mono"><span className="led text-lg text-foreground">{String(list.length).padStart(2, '0')}</span> {t('projects.count')}</span>
      </div>
      <div className="grid gap-5 md:grid-cols-2" data-stagger="flip">
        {list.map((project, i) => <ProjectCard key={project.id} project={project} number={offset + i + 1} />)}
      </div>
    </section>
  );

  return (
    <div ref={page} className="pb-24 pt-[calc(var(--nav-h)+56px)]">
      <div className="container-x">
        <SectionHeading
          as="h1"
          index="//"
          label="projects"
          title={t('projects.title')}
          lede={<span><span className="led text-3xl text-foreground">{String(dynamicProjects.length).padStart(2, '0')}</span> <span className="label-mono">{t('projects.count')}</span></span>}
        >
          {/* Contrôles administrateur */}
          <div className="mt-5 flex flex-wrap gap-3">
            {!isAdmin ? (
              <Button variant="outline" size="sm" onClick={() => setShowLoginDialog(true)} className="gap-2 rounded-full">
                <Lock className="h-4 w-4" /> {t('projects.adminMode')}
              </Button>
            ) : (
              <>
                <Button size="sm" onClick={() => { setEditingProject(null); setShowFormDialog(true); }} className="gap-2 rounded-full">
                  <Plus className="h-4 w-4" /> {t('projects.addProject')}
                </Button>
                <Button variant="outline" size="sm" onClick={logout} className="gap-2 rounded-full">
                  <LogOut className="h-4 w-4" /> {t('projects.logout')}
                </Button>
              </>
            )}
          </div>
        </SectionHeading>
      </div>

      {isLoading && (
        <div className="container-x mt-16 grid gap-5 md:grid-cols-2">
          {[0, 1].map((i) => <div key={i} className="panel aspect-[16/12] animate-pulse" />)}
        </div>
      )}

      {inProgressProjects.length > 0 && <Group title={t('projects.inProgress')} index="01" list={inProgressProjects} offset={0} />}
      {completedProjects.length > 0 && <Group title={t('projects.completed')} index="02" list={completedProjects} offset={inProgressProjects.length} />}

      {/* Dialogs */}
      <AdminLoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} onLogin={login} />
      <ProjectFormDialog
        open={showFormDialog}
        onOpenChange={(open) => { setShowFormDialog(open); if (!open) setEditingProject(null); }}
        onSubmit={handleCreateOrUpdate}
        project={editingProject}
        loading={createProject.isPending || updateProject.isPending}
      />
      <AlertDialog open={!!deletingProjectId} onOpenChange={(open) => { if (!open) setDeletingProjectId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('projects.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('projects.deleteText')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('projects.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('projects.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Projects;
