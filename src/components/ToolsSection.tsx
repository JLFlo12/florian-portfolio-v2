import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, ChevronLeft, ChevronRight, Hand, Pause, Play } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SectionHeading from '@/components/SectionHeading';
import { TOOLS, type Tool } from '@/data/tools';
import { gsap, prefersReducedMotion, scrambleText, useReveal } from '@/lib/motion';

/* ───────────────────────────────────────────────────────────────
   Section Outils : une toile holographique façon Jarvis.
   Les outils forment un anneau 3D qu'on attrape pour le faire pivoter
   (souris, doigt, pavé tactile, flèches du clavier ou boutons).
   Au repos il tourne lentement ; relâché, il se cale sur la carte la plus
   proche. Il surgit des profondeurs en tournant, à la suite de la plongée.
   Filtre avec peu d'outils, ou animations réduites : grille simple.
   ─────────────────────────────────────────────────────────────── */

const MIN_WHEEL = 6;       // en dessous, trop peu de cartes pour fermer l'anneau
const FADE_SPAN = 76;      // angle depuis le centre (°) où une carte a fini de s'effacer
const AUTO_SPEED = 4.5;    // rotation automatique (°/s)
const IDLE_DELAY = 2600;   // reprise de la rotation après une interaction (ms)
const CARD_GAP = 22;       // écart entre deux cartes voisines (px)
const ARRIVE_SPIN = 150;   // tour effectué pendant l'arrivée (°)
const ARRIVE_DEPTH = 1800; // profondeur d'où surgit l'anneau (px)
const FLICK = 0.4;         // élan conservé quand on lance l'anneau (s)
const DEG = 180 / Math.PI;

const wrap = (a: number) => ((a % 360) + 540) % 360 - 180; // angle ramené dans [-180, 180[
const smooth = (x: number) => x * x * (3 - 2 * x);
const pad = (n: number) => String(n).padStart(2, '0');

type Drag = { id: number; x0: number; r0: number; moved: boolean; samples: { x: number; t: number }[] };

/* Contenu d'une carte (anneau et grille) */
const CardBody = ({ tool, category }: { tool: Tool; category: string }) => (
  <>
    <span className="flex items-start justify-between gap-2">
      <span className="led text-xs text-muted-foreground">{pad(TOOLS.indexOf(tool) + 1)}</span>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary group-hover:opacity-100" />
    </span>
    <span className="tool-card__icon text-muted-foreground transition-colors duration-300 group-hover:text-primary">{tool.icon}</span>
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
  const [focused, setFocused] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [reduced] = useState(prefersReducedMotion);
  const section = useRef<HTMLElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  useReveal(section);

  // Catégories présentes, dans l'ordre d'apparition
  const categories = useMemo(() => Array.from(new Set(TOOLS.map((tool) => tool.category))), []);
  const visible = useMemo(() => (filter === 'all' ? TOOLS : TOOLS.filter((tool) => tool.category === filter)), [filter]);
  const count = visible.length;
  const wheel = !reduced && count >= MIN_WHEEL;
  const step = 360 / count;
  const current = visible[Math.min(focused, count - 1)];

  // ——— État de l'anneau, hors React (modifié à chaque image) ———
  const stage = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const nameEl = useRef<HTMLSpanElement>(null);
  const rotEl = useRef<HTMLSpanElement>(null);
  const live = useRef({ rot: 0, arrive: 1, intro: 1, radius: 600 }).current;
  const hold = useRef({ hover: false, focus: false, inView: false, until: 0 }).current;
  const focusedRef = useRef(0);
  const drag = useRef<Drag | null>(null);
  const tween = useRef<ReturnType<typeof gsap.to> | null>(null);
  const arrived = useRef(false);
  const finishArrival = useRef<() => void>(() => {});
  const suppressClick = useRef(false);
  const autoplayRef = useRef(autoplay);
  autoplayRef.current = autoplay;
  const dialogRef = useRef(false);
  dialogRef.current = !!selectedTool;

  /* Applique la rotation : anneau, fondu et taille des cartes selon leur angle, carte de face */
  const render = useCallback(() => {
    const el = ring.current;
    if (!el) return;
    const fadeSpan = Math.max(FADE_SPAN, step * 1.9); // peu de cartes : les voisines restent visibles
    const rot = live.rot + (1 - live.arrive) * ARRIVE_SPIN + (1 - live.intro) * 70;
    el.style.setProperty('--rot', `${rot.toFixed(2)}deg`);
    el.style.setProperty('--fly', `${((1 - live.arrive) * ARRIVE_DEPTH + (1 - live.intro) * 500).toFixed(1)}px`);
    let best = 0;
    let bestDist = 360;
    for (let i = 0; i < count; i++) {
      const card = cards.current[i];
      if (!card) continue;
      const dist = Math.abs(wrap(rot + i * step));
      if (dist < bestDist) { bestDist = dist; best = i; }
      const k = Math.min(1, dist / fadeSpan);
      const hidden = k >= 1;
      card.style.opacity = hidden ? '0' : (live.intro * (1 - smooth(Math.max(0, (k - 0.55) / 0.45)))).toFixed(3);
      card.style.setProperty('--s', (1.08 - 0.22 * k).toFixed(3));
      const visibility = hidden ? 'hidden' : '';
      if (card.style.visibility !== visibility) card.style.visibility = visibility;
    }
    if (rotEl.current) {
      const deg = `${String(Math.round(((-rot % 360) + 360) % 360)).padStart(3, '0')}°`;
      if (rotEl.current.textContent !== deg) rotEl.current.textContent = deg;
    }
    if (best !== focusedRef.current) { focusedRef.current = best; setFocused(best); }
  }, [count, step, live]);

  /* Rayon de l'anneau : deux cartes voisines ne se chevauchent jamais,
     et un petit anneau garde la même courbure qu'un grand */
  const measure = useCallback(() => {
    const width = cards.current[0]?.offsetWidth || 180;
    live.radius = Math.round(Math.max(width * 3.2, (width + CARD_GAP) / (2 * Math.sin(Math.PI / count))));
    ring.current?.style.setProperty('--radius', `${live.radius}px`);
  }, [count, live]);

  const spinTo = useCallback((target: number, duration = 0.7) => {
    tween.current?.kill();
    tween.current = gsap.to(live, { rot: target, duration, ease: 'power3.out', onUpdate: render });
  }, [live, render]);

  /* Amène la carte i face à soi, par le chemin le plus court */
  const goTo = useCallback((i: number) => {
    hold.until = performance.now() + IDLE_DELAY;
    const base = -i * step;
    spinTo(base + 360 * Math.round((live.rot - base) / 360));
  }, [hold, live, spinTo, step]);

  const snap = useCallback((rot: number, duration = 0.9) => spinTo(Math.round(rot / step) * step, duration), [spinTo, step]);

  // Mise en place (et à chaque filtre) : rayon, rotation remise à zéro
  useLayoutEffect(() => {
    if (!wheel) return;
    live.rot = 0;
    focusedRef.current = -1;
    measure();
    render();
    const onResize = () => { measure(); render(); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); tween.current?.kill(); };
  }, [wheel, measure, render, live]);

  /* Arrivée (suite de la plongée dans la planète) : l'anneau surgit des profondeurs
     en tournant, au rythme du scroll. Une seule fois : ensuite il reste en place. */
  useLayoutEffect(() => {
    const el = stage.current;
    if (!wheel || !el) return;
    if (arrived.current) { live.arrive = 1; render(); return; }
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: el, start: 'top 98%', end: 'top 30%', scrub: 0.8, onLeave: () => finishArrival.current() },
    });
    tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 0)
      .fromTo(live, { arrive: 0 }, { arrive: 1, duration: 1, ease: 'power2.out', onUpdate: render }, 0);
    render();
    finishArrival.current = () => {
      arrived.current = true;
      tl.scrollTrigger?.kill();
      tl.progress(1).kill();
      finishArrival.current = () => {};
    };
    return () => { tl.scrollTrigger?.kill(); tl.kill(); };
  }, [wheel, render, live]);

  // Changement de filtre : l'anneau se reforme, ou les cartes de la grille basculent
  const firstFilter = useRef(true);
  useLayoutEffect(() => {
    if (firstFilter.current) { firstFilter.current = false; return; }
    if (reduced) return;
    if (wheel) {
      gsap.fromTo(live, { intro: 0 }, { intro: 1, duration: 1.1, ease: 'expo.out', overwrite: 'auto', onUpdate: render });
      render();
    } else if (grid.current) {
      gsap.fromTo(grid.current.children, { autoAlpha: 0, y: 24, rotationX: -25 }, {
        autoAlpha: 1, y: 0, rotationX: 0, duration: 0.7, ease: 'expo.out', stagger: 0.03, overwrite: true, clearProps: 'transform',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // Rotation automatique au repos (en pause hors écran, au survol d'une carte, au clavier, fenêtre ouverte)
  useEffect(() => {
    if (!wheel) return;
    const tick = (_time: number, deltaMs: number) => {
      if (!autoplayRef.current || !hold.inView || hold.hover || hold.focus || drag.current || dialogRef.current) return;
      if (performance.now() < hold.until || tween.current?.isActive()) return;
      live.rot -= (AUTO_SPEED * Math.min(deltaMs, 64)) / 1000;
      render();
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [wheel, render, hold, live]);

  useEffect(() => {
    const el = stage.current;
    if (!wheel || !el) return;
    const io = new IntersectionObserver(([entry]) => { hold.inView = entry.isIntersecting; });
    io.observe(el);
    return () => { io.disconnect(); hold.inView = false; };
  }, [wheel, hold]);

  // Pavé tactile : glisser deux doigts à l'horizontale fait tourner l'anneau
  useEffect(() => {
    const el = stage.current;
    if (!wheel || !el) return;
    let timer = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) < 2 || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
      e.preventDefault();
      tween.current?.kill();
      live.rot -= (e.deltaX * DEG) / live.radius;
      hold.until = performance.now() + IDLE_DELAY;
      render();
      clearTimeout(timer);
      timer = window.setTimeout(() => snap(live.rot, 0.6), 140);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => { el.removeEventListener('wheel', onWheel); clearTimeout(timer); };
  }, [wheel, render, snap, hold, live]);

  // Nom de l'outil de face, "décodé" façon terminal
  useEffect(() => {
    if (nameEl.current && current) scrambleText(nameEl.current, current.name, 420);
  }, [current]);

  /* ——— Glisser pour faire tourner (souris et doigt) ———
     Le glissement ne démarre qu'après quelques pixels : un simple clic ouvre toujours la carte. */
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { id: e.pointerId, x0: e.clientX, r0: live.rot, moved: false, samples: [] };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved) {
      if (Math.abs(e.clientX - d.x0) < 6) return;
      d.moved = true;
      d.x0 = e.clientX;
      tween.current?.kill();
      d.r0 = live.rot;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ }
    }
    // La carte de face suit le pointeur
    live.rot = d.r0 + ((e.clientX - d.x0) * DEG) / live.radius;
    render();
    d.samples.push({ x: e.clientX, t: performance.now() });
    if (d.samples.length > 6) d.samples.shift();
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) return;
    hold.until = performance.now() + IDLE_DELAY;
    suppressClick.current = true; // le clic qui suit un glissement n'ouvre pas de carte
    window.setTimeout(() => { suppressClick.current = false; }, 0);
    // Élan : vitesse des derniers mouvements (nulle si on s'est arrêté avant de relâcher)
    const a = d.samples[0];
    const b = d.samples[d.samples.length - 1];
    const dt = b && a ? (b.t - a.t) / 1000 : 0;
    const speed = dt > 0.008 && performance.now() - b.t < 90 ? (b.x - a.x) / dt : 0;
    snap(live.rot + ((speed * DEG) / live.radius) * FLICK);
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  // Clavier : la carte qui reçoit le focus vient de face ; flèches gauche/droite
  const onFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!target.matches(':focus-visible')) return;
    hold.focus = true;
    const i = cards.current.indexOf(target as HTMLButtonElement);
    if (i >= 0 && i < count) goTo(i);
  };
  const onBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hold.focus = false;
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (focusedRef.current + (e.key === 'ArrowRight' ? 1 : -1) + count) % count;
    goTo(next);
    cards.current[next]?.focus({ preventScroll: true });
  };

  const applyFilter = (value: string) => {
    if (value === filter) return;
    finishArrival.current();
    setFilter(value);
  };

  const control = 'liquid inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground transition-[transform,color] duration-500 hover:-translate-y-0.5 hover:text-primary';

  return (
    <section ref={section} className="section-y relative">
      {/* Lueur d'arrivée : prolonge le voile orange de la fin de plongée */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[90vh] bg-[radial-gradient(70%_45%_at_50%_42%,hsl(var(--primary)/.12),transparent_70%)] [mask-image:linear-gradient(to_bottom,transparent,#000_35%)]" aria-hidden="true" />
      <div className="container-x relative">
        <SectionHeading index="01" label="tools" title={t('home.toolsTitle')} lede={t('home.toolsHint')} />

        {/* Filtres par catégorie */}
        <div className="mt-12 flex flex-wrap gap-2" data-reveal>
          {['all', ...categories].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => applyFilter(cat)}
              aria-pressed={filter === cat}
              className={`rounded-full border px-4 py-2 font-mono text-xs transition-colors ${
                filter === cat ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/60 hover:text-foreground'
              }`}
            >
              {cat === 'all' ? t('home.allTools') : t(`home.categories.${cat}`)}
              <span className="ml-2 opacity-60">{cat === 'all' ? TOOLS.length : TOOLS.filter((tool) => tool.category === cat).length}</span>
            </button>
          ))}
        </div>
      </div>

      {wheel ? (
        <div className="relative mt-10 overflow-x-clip">
          {/* Halo du projecteur */}
          <div className="pointer-events-none absolute inset-x-0 top-[10%] h-[80%] bg-[radial-gradient(45%_55%_at_50%_70%,hsl(var(--primary)/.14),transparent_70%)]" aria-hidden="true" />

          <div
            ref={stage}
            className="tools-stage"
            role="group"
            aria-roledescription="carousel"
            aria-label={t('home.toolsCarousel')}
            data-cursor={t('ui.drag')}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClickCapture={onClickCapture}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
          >
            <div className="tools-base" aria-hidden="true" />
            <div ref={ring} className="tools-ring">
              {visible.map((tool, i) => (
                <button
                  key={tool.name}
                  ref={(el) => { cards.current[i] = el; }}
                  type="button"
                  onClick={() => { goTo(i); setSelectedTool(tool); }}
                  onPointerEnter={(e) => { if (e.pointerType === 'mouse') hold.hover = true; }}
                  onPointerLeave={(e) => { if (e.pointerType === 'mouse') hold.hover = false; }}
                  data-cursor={t('ui.open')}
                  data-focused={i === focused}
                  style={{ '--card-angle': `${i * step}deg` } as React.CSSProperties}
                  className="tool-card panel group flex min-h-[158px] flex-col justify-between p-4 text-left"
                >
                  <span className="card-frame" aria-hidden="true"><i /><i /><i /><i /></span>
                  <CardBody tool={tool} category={t(`home.categories.${tool.category}`)} />
                </button>
              ))}
            </div>
          </div>

          {/* Commandes : précédent / outil de face / suivant / pause */}
          <div className="container-x relative z-[2] mt-2 flex flex-col items-center gap-4">
            {/* Télémétrie de la boîte à outils */}
            <div className="hud-panel absolute right-[var(--gutter)] top-0 hidden w-[210px] lg:block" aria-hidden="true">
              <p className="mb-2 flex justify-between gap-4 border-b border-dashed border-primary/30 pb-2 tracking-[.08em] text-primary">
                <span>SYS://TOOLKIT</span>
                <span className={autoplay ? 'text-[hsl(var(--online))]' : ''}>{autoplay ? 'AUTO' : 'PAUSE'}</span>
              </p>
              <dl className="grid gap-0.5">
                <div className="flex justify-between gap-6"><dt className="uppercase tracking-[.08em]">{t('home.toolsStatsTools')}</dt><dd className="tabular-nums text-foreground">{TOOLS.length}</dd></div>
                <div className="flex justify-between gap-6"><dt className="uppercase tracking-[.08em]">{t('home.toolsStatsCategories')}</dt><dd className="tabular-nums text-foreground">{categories.length}</dd></div>
                <div className="flex justify-between gap-6"><dt className="uppercase tracking-[.08em]">{t('home.toolsStatsRotation')}</dt><dd className="tabular-nums text-foreground"><span ref={rotEl}>000°</span></dd></div>
              </dl>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button type="button" onClick={() => goTo((focusedRef.current - 1 + count) % count)} aria-label={t('home.toolsPrev')} className={control}>
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="hud-panel w-[min(58vw,300px)] text-center">
                <p className="led text-sm text-primary">{pad(Math.min(focused, count - 1) + 1)} <span className="text-muted-foreground">/ {pad(count)}</span></p>
                <p className="mt-1 truncate font-display text-lg font-bold uppercase leading-tight text-foreground [font-stretch:118%]">
                  <span ref={nameEl} aria-hidden="true" />
                  <span className="sr-only">{current?.name}</span>
                </p>
                <p className="label-mono mt-1 !text-[.62rem]">{current && t(`home.categories.${current.category}`)}</p>
              </div>
              <button type="button" onClick={() => goTo((focusedRef.current + 1) % count)} aria-label={t('home.toolsNext')} className={control}>
                <ChevronRight className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => setAutoplay((on) => !on)} aria-label={autoplay ? t('home.toolsPause') : t('home.toolsPlay')} aria-pressed={!autoplay} className={control}>
                {autoplay ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
            </div>
            <p className="label-mono flex items-center gap-2 text-center">
              <Hand className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" /> {t('home.toolsWheelHint')}
            </p>
          </div>
        </div>
      ) : (
        /* Grille : peu d'outils dans le filtre, ou animations réduites */
        <div className="container-x">
          <div ref={grid} className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(140px,180px))] justify-center gap-3 [perspective:1400px] sm:grid-cols-[repeat(auto-fit,minmax(180px,220px))]">
            {visible.map((tool) => (
              <button
                key={tool.name}
                type="button"
                onClick={() => setSelectedTool(tool)}
                data-cursor={t('ui.open')}
                className="panel group flex h-full min-h-[150px] w-full flex-col justify-between p-4 text-left transition-transform duration-500 [transition-timing-function:var(--ease-out)] hover:-translate-y-1"
              >
                <CardBody tool={tool} category={t(`home.categories.${tool.category}`)} />
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
                  <span className="text-primary">{selectedTool.icon}</span>
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
