import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SectionHeading from '@/components/SectionHeading';
import Manifesto from '@/components/Manifesto';
import CategoryNavigation from '@/components/station/CategoryNavigation';
import { ToolDisplay, type Logos } from '@/components/station/HolographicInterface';
import { hasWebGL } from '@/components/three/webgl';
import { TOOLS, type Tool } from '@/data/tools';
import { isCompactStation, stationHeight } from '@/components/station/scrollTimeline';
import { prefersReducedMotion, useReveal } from '@/lib/motion';

/* ───────────────────────────────────────────────────────────────
   Section Outils de l'accueil.
   - Manifeste (inchangé) ;
   - visite d'une station spatiale en 3D pilotée par le défilement (StationExperience,
     chargée à part) : un module par famille d'outils, panneaux holographiques ;
   - version de secours (animations réduites, pas de WebGL, contexte WebGL perdu) :
     filtres de catégories et grille simple, comme avant ;
   - dans les deux cas, un clic sur un outil ouvre sa fiche (fenêtre de description).
   Les outils viennent de data/tools.tsx, les logos de data/toolLogos.ts.
   ─────────────────────────────────────────────────────────────── */

const StationExperience = lazy(() => import('@/components/station/StationExperience'));

const pad = (n: number) => String(n).padStart(2, '0');

/* Carte de la grille de secours */
const CardBody = ({ tool, logos, index, category }: { tool: Tool; logos: Logos; index: number; category: string }) => (
  <>
    <span className="flex items-start justify-between gap-2">
      <span className="led text-xs text-muted-foreground">{pad(index + 1)}</span>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary group-hover:opacity-100" />
    </span>
    <span className="tool-card__icon text-muted-foreground transition-colors duration-300 group-hover:text-primary"><ToolDisplay tool={tool} logos={logos} size="h-8 w-8" /></span>
    <span>
      <span className="block font-display text-[.95rem] font-bold leading-tight [font-stretch:110%]">{tool.name}</span>
      <span className="label-mono mt-1 block !text-[.62rem]">{category}</span>
    </span>
  </>
);

const ToolsSection = () => {
  const { t } = useTranslation();
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [filter, setFilter] = useState<string>('all');
  // La station demande WebGL et des animations ; sinon, grille simple
  const [station, setStation] = useState(() => !prefersReducedMotion() && hasWebGL());
  const section = useRef<HTMLElement>(null);
  useReveal(section, [station]);

  const [logos, setLogos] = useState<Logos>(null);
  useEffect(() => {
    let alive = true;
    import('@/data/toolLogos').then((m) => { if (alive) setLogos(m.LOGOS); }).catch(() => { /* icônes génériques */ });
    return () => { alive = false; };
  }, []);
  const targets = useMemo(() => TOOLS.flatMap((tool, i) => (filter === 'all' || tool.category === filter ? [i] : [])), [filter]);

  return (
    <section ref={section} className="section-y relative">
      {/* Lueur d'arrivée : prolonge le voile orange de la fin de plongée */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[90vh] bg-[radial-gradient(70%_45%_at_50%_42%,hsl(var(--primary)/.12),transparent_70%)] [mask-image:linear-gradient(to_bottom,transparent,#000_35%)]" aria-hidden="true" />
      <Manifesto />

      {station ? (
        <div className="mt-[clamp(5rem,12vw,9rem)]">
          {/* En attendant le code de la station : un bloc de la même hauteur (la page ne saute pas) */}
          <Suspense fallback={<div className="station-placeholder" style={{ height: stationHeight(isCompactStation()) }} aria-hidden="true" />}>
            <StationExperience onOpen={setSelectedTool} onLost={() => setStation(false)} />
          </Suspense>
        </div>
      ) : (
        <div className="container-x relative mt-[clamp(6rem,14vw,11rem)]">
          <SectionHeading index="01" label="tools" title={t('home.toolsTitle')} lede={t('home.toolsHint')} />
          {/* Filtres par catégorie */}
          <div className="mt-12" data-reveal>
            <CategoryNavigation active={[filter]} onSelect={setFilter} filter className="[&_ul]:flex-wrap" />
          </div>
          <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(140px,180px))] justify-center gap-3 sm:grid-cols-[repeat(auto-fit,minmax(180px,220px))]">
            {targets.map((i) => (
              <button
                key={TOOLS[i].name}
                type="button"
                onClick={() => setSelectedTool(TOOLS[i])}
                className="panel group flex h-full min-h-[150px] w-full flex-col justify-between p-4 text-left"
              >
                <CardBody tool={TOOLS[i]} logos={logos} index={i} category={t(`home.categories.${TOOLS[i].category}`)} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fenêtre de description */}
      <Dialog open={!!selectedTool} onOpenChange={(open) => { if (!open) setSelectedTool(null); }}>
        <DialogContent className="panel max-w-md border-primary/30 p-0 sm:rounded-[22px]">
          {selectedTool && (
            <div className="relative p-7">
              <div className="hud-frame inset-3" aria-hidden="true"><i /><i /><i /><i /></div>
              <DialogHeader className="space-y-4 text-left">
                <p className="label-mono">{t(`home.categories.${selectedTool.category}`)}</p>
                <DialogTitle className="flex items-center gap-3 font-display text-2xl font-extrabold uppercase [font-stretch:118%]">
                  <span className="text-primary"><ToolDisplay tool={selectedTool} logos={logos} size="h-8 w-8" /></span>
                  {selectedTool.name}
                </DialogTitle>
                <DialogDescription className="text-base leading-relaxed text-muted-foreground">
                  {selectedTool.description}
                </DialogDescription>
              </DialogHeader>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default ToolsSection;
