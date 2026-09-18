import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, ChevronLeft, ChevronRight, Hand, Pause, Play } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SectionHeading from '@/components/SectionHeading';
import { TOOLS, type Tool } from '@/data/tools';
import { gsap, prefersReducedMotion, scrambleText, useReveal } from '@/lib/motion';

/* ───────────────────────────────────────────────────────────────
   Section Outils : une toile holographique façon Jarvis.
   Les 23 outils forment un anneau 3D qu'on attrape pour le faire pivoter
   (souris, doigt, pavé tactile, flèches du clavier ou boutons).
   - Entrée : le projecteur s'allume, un faisceau monte, un balayage passe,
     l'anneau surgit des profondeurs en tournant et les cartes s'allument une à une.
   - Au repos, il tourne lentement ; relâché, il se cale sur la carte la plus proche.
   - Un filtre garde l'anneau entier : ses outils restent allumés, les autres
     s'estompent, et la roue passe d'un outil du filtre à l'autre.
   Animations réduites : grille simple.
   ─────────────────────────────────────────────────────────────── */

const COUNT = TOOLS.length;
const STEP = 360 / COUNT;  // angle entre deux cartes (°)
const FADE_SPAN = 76;      // angle depuis le centre (°) où une carte a fini de s'effacer
const AUTO_SPEED = 4.5;    // rotation automatique (°/s)
const IDLE_DELAY = 2600;   // reprise de la rotation après une interaction (ms)
const HOP_DELAY = 2800;    // filtre actif : temps passé sur chaque outil avant le suivant (ms)
const CARD_GAP = 22;       // écart entre deux cartes voisines (px)
const DIM = 0.14;          // opacité des outils hors du filtre
const ARRIVE_SPIN = 150;   // tour effectué pendant l'entrée (°)
const ARRIVE_DEPTH = 1800; // profondeur d'où surgit l'anneau (px)
const FLICK = 0.4;         // élan conservé quand on lance l'anneau (s)
const DEG = 180 / Math.PI;

const wrap = (a: number) => ((a % 360) + 540) % 360 - 180; // angle ramené dans [-180, 180[
const smooth = (x: number) => x * x * (3 - 2 * x);
const pad = (n: number) => String(n).padStart(2, '0');
// Scintillement d'hologramme pendant l'allumage d'une carte
const flicker = (p: number) => (p >= 1 ? 1 : p * (Math.random() < 0.35 ? 0.2 : 1));

type Drag = { id: number; x0: number; r0: number; moved: boolean; samples: { x: number; t: number }[] };

/* Contenu d'une carte (anneau et grille) */
const CardBody = ({ tool, index, category }: { tool: Tool; index: number; category: string }) => (
  <>
    <span className="flex items-start justify-between gap-2">
      <span className="led text-xs text-muted-foreground">{pad(index + 1)}</span>
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
  const wheel = !reduced;
  const section = useRef<HTMLElement>(null);
  useReveal(section);

  // Catégories présentes, dans l'ordre d'apparition ; outils retenus par le filtre (indices dans TOOLS)
  const categories = useMemo(() => Array.from(new Set(TOOLS.map((tool) => tool.category))), []);
  const targets = useMemo(() => TOOLS.flatMap((tool, i) => (filter === 'all' || tool.category === filter ? [i] : [])), [filter]);
  const inFilter = useMemo(() => new Set(targets), [targets]);
  const current = TOOLS[focused];
  const position = Math.max(0, targets.indexOf(focused));

  // ——— État de l'anneau, hors React (modifié à chaque image) ———
  const stage = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const nameEl = useRef<HTMLSpanElement>(null);
  const rotEl = useRef<HTMLSpanElement>(null);
  const live = useRef({ rot: 0, arrive: 0, pulse: 0, radius: 600 }).current;
  const fx = useRef({ dim: TOOLS.map(() => ({ v: 1 })), appear: TOOLS.map(() => ({ v: 0 })) }).current;
  const hold = useRef({ hover: false, focus: false, inView: false, booted: false, ready: false, until: 0, hop: 0 }).current;
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const focusedRef = useRef(-1);
  const drag = useRef<Drag | null>(null);
  const tween = useRef<ReturnType<typeof gsap.to> | null>(null);
  const suppressClick = useRef(false);
  const autoplayRef = useRef(autoplay);
  autoplayRef.current = autoplay;
  const dialogRef = useRef(false);
  dialogRef.current = !!selectedTool;

  /* Applique la rotation : anneau, fondu et taille des cartes selon leur angle, carte de face */
  const render = useCallback(() => {
    const el = ring.current;
    if (!el) return;
    const rot = live.rot + (1 - live.arrive) * ARRIVE_SPIN;
    el.style.setProperty('--rot', `${rot.toFixed(2)}deg`);
    el.style.setProperty('--fly', `${((1 - live.arrive) * ARRIVE_DEPTH + live.pulse * 320).toFixed(1)}px`);
    for (let i = 0; i < COUNT; i++) {
      const card = cards.current[i];
      if (!card) continue;
      const k = Math.min(1, Math.abs(wrap(rot + i * STEP)) / FADE_SPAN);
      const on = fx.appear[i].v;
      const hidden = k >= 1 || on <= 0.001;
      card.style.opacity = hidden ? '0' : (on * fx.dim[i].v * (1 - smooth(Math.max(0, (k - 0.55) / 0.45)))).toFixed(3);
      card.style.setProperty('--s', ((1.08 - 0.22 * k) * (0.82 + 0.18 * Math.min(1, on))).toFixed(3));
      const visibility = hidden ? 'hidden' : '';
      if (card.style.visibility !== visibility) card.style.visibility = visibility;
    }
    // Carte de face : l'outil du filtre le plus proche du centre
    let best = targetsRef.current[0] ?? 0;
    let bestDist = 360;
    for (const i of targetsRef.current) {
      const dist = Math.abs(wrap(rot + i * STEP));
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    if (rotEl.current) {
      const deg = `${String(Math.round(((-rot % 360) + 360) % 360)).padStart(3, '0')}°`;
      if (rotEl.current.textContent !== deg) rotEl.current.textContent = deg;
    }
    if (best !== focusedRef.current) { focusedRef.current = best; setFocused(best); }
  }, [live, fx]);

  /* Rayon de l'anneau : deux cartes voisines ne se chevauchent jamais */
  const measure = useCallback(() => {
    const width = cards.current[0]?.offsetWidth || 180;
    live.radius = Math.round((width + CARD_GAP) / (2 * Math.sin(Math.PI / COUNT)));
    ring.current?.style.setProperty('--radius', `${live.radius}px`);
  }, [live]);

  const spinTo = useCallback((target: number, duration = 0.7, ease = 'power3.out') => {
    tween.current?.kill();
    tween.current = gsap.to(live, { rot: target, duration, ease, onUpdate: render });
  }, [live, render]);

  /* Amène la carte i face à soi : par le plus court (0), en avançant (1) ou en reculant (-1) */
  const spinToCard = useCallback((i: number, dir: -1 | 0 | 1 = 0, duration = 0.7, ease?: string) => {
    const base = -i * STEP;
    const turns = (live.rot - base) / 360;
    const k = dir > 0 ? Math.floor(turns + 1e-6) : dir < 0 ? Math.ceil(turns - 1e-6) : Math.round(turns);
    spinTo(base + 360 * k, duration, ease);
  }, [live, spinTo]);

  // Toute interaction suspend la rotation automatique un moment
  const interact = useCallback(() => { hold.until = performance.now() + IDLE_DELAY; hold.hop = 0; }, [hold]);

  const goTo = useCallback((i: number, dir: -1 | 0 | 1 = 0) => { interact(); spinToCard(i, dir); }, [interact, spinToCard]);

  /* Se cale sur l'outil du filtre le plus proche */
  const snap = useCallback((rot: number, duration = 0.9) => {
    let target = rot;
    let bestDist = Infinity;
    for (const i of targetsRef.current) {
      const d = wrap(rot + i * STEP);
      if (Math.abs(d) < bestDist) { bestDist = Math.abs(d); target = rot - d; }
    }
    spinTo(target, duration);
  }, [spinTo]);

  // Relance le balayage lumineux sur l'anneau
  const scan = useCallback(() => {
    const el = stage.current;
    if (!el) return;
    el.classList.remove('is-scan');
    void el.offsetWidth;
    el.classList.add('is-scan');
  }, []);

  /* ——— Entrée : allumage de l'hologramme (une seule fois) ——— */
  const boot = useCallback(() => {
    if (hold.booted || !stage.current) return;
    hold.booted = true;
    // 1. le socle s'allume et le faisceau monte (CSS, .is-on)
    stage.current.classList.add('is-on');
    // 2. le balayage "dessine" les cartes, qui s'allument du centre vers l'arrière en scintillant
    // 3. pendant ce temps l'anneau remonte des profondeurs en tournant, puis les commandes arrivent
    const rank: number[] = [];
    TOOLS.map((_, i) => i)
      .sort((a, b) => Math.abs(wrap(live.rot + a * STEP)) - Math.abs(wrap(live.rot + b * STEP)))
      .forEach((i, r) => { rank[i] = r; });
    gsap.timeline({ onUpdate: render, onComplete: () => { hold.ready = true; hold.until = performance.now() + 800; } })
      .to(live, { arrive: 1, duration: 2.8, ease: 'power3.out' }, 0.45)
      .call(scan, [], 0.6)
      .to(fx.appear, { v: 1, duration: 0.7, ease: flicker, stagger: (i: number) => 0.7 + rank[i] * 0.07 }, 0)
      .fromTo(controls.current, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'expo.out' }, 1.8);
  }, [hold, live, fx, render, scan]);

  // Mise en place : rayon, anneau éteint en attendant l'entrée
  useLayoutEffect(() => {
    if (!wheel) return;
    measure();
    render();
    if (!hold.booted) gsap.set(controls.current, { autoAlpha: 0 });
    const onResize = () => { measure(); render(); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); tween.current?.kill(); };
  }, [wheel, measure, render, hold]);

  // L'entrée démarre quand le haut de l'anneau passe aux trois quarts de l'écran
  useEffect(() => {
    const el = stage.current;
    if (!wheel || !el) return;
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) boot(); }, { rootMargin: '0px 0px -22% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [wheel, boot]);

  useEffect(() => {
    const el = stage.current;
    if (!wheel || !el) return;
    const io = new IntersectionObserver(([entry]) => { hold.inView = entry.isIntersecting; });
    io.observe(el);
    return () => { io.disconnect(); hold.inView = false; };
  }, [wheel, hold]);

  /* Changement de filtre : les outils du filtre restent allumés, les autres s'estompent,
     l'anneau recule d'un coup, un balayage passe et la roue pivote vers le premier outil */
  const firstFilter = useRef(true);
  useEffect(() => {
    if (firstFilter.current) { firstFilter.current = false; return; }
    if (!wheel) return;
    const dimTo = (i: number) => (inFilter.has(i) ? 1 : DIM);
    if (!hold.booted) {
      fx.dim.forEach((d, i) => { d.v = dimTo(i); });
      if (filter !== 'all') live.rot = -targets[0] * STEP;
      render();
      boot();
      return;
    }
    interact();
    gsap.to(fx.dim, { v: (i: number) => dimTo(i), duration: 0.6, ease: 'power2.out', overwrite: true, onUpdate: render });
    gsap.timeline({ onUpdate: render })
      .to(live, { pulse: 1, duration: 0.35, ease: 'power2.out' })
      .to(live, { pulse: 0, duration: 1, ease: 'expo.out' });
    if (filter === 'all') snap(live.rot, 0.8);
    else spinToCard(targets[0], 0, 1.3, 'power3.inOut');
    scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // Rotation automatique au repos (en pause hors écran, au survol d'une carte, au clavier, fenêtre ouverte).
  // Avec un filtre : la roue passe d'un outil du filtre au suivant.
  useEffect(() => {
    if (!wheel) return;
    const tick = (_time: number, deltaMs: number) => {
      if (!hold.ready || !autoplayRef.current || !hold.inView || hold.hover || hold.focus || drag.current || dialogRef.current) return;
      if (performance.now() < hold.until || tween.current?.isActive()) return;
      const list = targetsRef.current;
      if (list.length === COUNT) {
        live.rot -= (AUTO_SPEED * Math.min(deltaMs, 64)) / 1000;
        render();
        return;
      }
      if (list.length < 2) return;
      hold.hop += deltaMs;
      if (hold.hop < HOP_DELAY) return;
      hold.hop = 0;
      spinToCard(list[(list.indexOf(focusedRef.current) + 1) % list.length], 1, 1.2, 'power3.inOut');
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [wheel, render, spinToCard, hold, live]);

  // Pavé tactile : glisser deux doigts à l'horizontale fait tourner l'anneau
  useEffect(() => {
    const el = stage.current;
    if (!wheel || !el) return;
    let timer = 0;
    const onWheel = (e: WheelEvent) => {
      if (!hold.ready || Math.abs(e.deltaX) < 2 || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
      e.preventDefault();
      tween.current?.kill();
      live.rot -= (e.deltaX * DEG) / live.radius;
      interact();
      render();
      clearTimeout(timer);
      timer = window.setTimeout(() => snap(live.rot, 0.6), 140);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => { el.removeEventListener('wheel', onWheel); clearTimeout(timer); };
  }, [wheel, render, snap, interact, hold, live]);

  // Nom de l'outil de face, "décodé" façon terminal
  useEffect(() => {
    if (nameEl.current) scrambleText(nameEl.current, current.name, 420);
  }, [current]);

  /* ——— Glisser pour faire tourner (souris et doigt) ———
     Le glissement ne démarre qu'après quelques pixels : un simple clic ouvre toujours la carte. */
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hold.ready || (e.pointerType === 'mouse' && e.button !== 0)) return;
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
    interact();
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

  // Clavier : la carte qui reçoit le focus vient de face ; flèches gauche/droite parmi les outils du filtre
  const step = (dir: 1 | -1) => {
    const list = targetsRef.current;
    if (list.length < 2) return -1;
    const next = list[(list.indexOf(focusedRef.current) + dir + list.length) % list.length];
    goTo(next, dir);
    return next;
  };
  const onFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!target.matches(':focus-visible')) return;
    hold.focus = true;
    const i = cards.current.indexOf(target as HTMLButtonElement);
    if (i >= 0 && inFilter.has(i)) goTo(i);
  };
  const onBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hold.focus = false;
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = step(e.key === 'ArrowRight' ? 1 : -1);
    if (next >= 0) cards.current[next]?.focus({ preventScroll: true });
  };

  const control = 'liquid inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground transition-[transform,color,opacity] duration-500 hover:-translate-y-0.5 hover:text-primary disabled:pointer-events-none disabled:opacity-40';
  const filterLabel = filter === 'all' ? t('home.allTools') : t(`home.categories.${filter}`);

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
              onClick={() => setFilter(cat)}
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
            <div className="tools-beam" aria-hidden="true" />
            <div ref={ring} className="tools-ring">
              {TOOLS.map((tool, i) => {
                const on = inFilter.has(i);
                return (
                  <button
                    key={tool.name}
                    ref={(el) => { cards.current[i] = el; }}
                    type="button"
                    onClick={() => { goTo(i); setSelectedTool(tool); }}
                    onPointerEnter={(e) => { if (e.pointerType === 'mouse') hold.hover = true; }}
                    onPointerLeave={(e) => { if (e.pointerType === 'mouse') hold.hover = false; }}
                    tabIndex={on ? undefined : -1}
                    aria-hidden={on ? undefined : true}
                    data-dim={!on}
                    data-cursor={t('ui.open')}
                    data-focused={i === focused}
                    style={{ '--card-angle': `${i * STEP}deg`, opacity: 0, visibility: 'hidden' } as React.CSSProperties}
                    className="tool-card panel group flex min-h-[158px] flex-col justify-between p-4 text-left"
                  >
                    <span className="card-frame" aria-hidden="true"><i /><i /><i /><i /></span>
                    <CardBody tool={tool} index={i} category={t(`home.categories.${tool.category}`)} />
                  </button>
                );
              })}
            </div>
            <div className="tools-scan" aria-hidden="true" />
          </div>

          {/* Commandes : précédent / outil de face / suivant / pause */}
          <div ref={controls} className="container-x relative z-[2] mt-2 flex flex-col items-center gap-4">
            {/* Télémétrie de la boîte à outils */}
            <div className="hud-panel absolute right-[var(--gutter)] top-0 hidden w-[220px] lg:block" aria-hidden="true">
              <p className="mb-2 flex justify-between gap-4 border-b border-dashed border-primary/30 pb-2 tracking-[.08em] text-primary">
                <span>SYS://TOOLKIT</span>
                <span className={autoplay ? 'text-[hsl(var(--online))]' : ''}>{autoplay ? 'AUTO' : 'PAUSE'}</span>
              </p>
              <dl className="grid gap-0.5">
                <div className="flex justify-between gap-6"><dt className="uppercase tracking-[.08em]">{t('home.toolsStatsTools')}</dt><dd className="tabular-nums text-foreground">{pad(targets.length)}/{TOOLS.length}</dd></div>
                <div className="flex justify-between gap-6"><dt className="uppercase tracking-[.08em]">{t('home.toolsStatsFilter')}</dt><dd className="truncate text-foreground">{filterLabel}</dd></div>
                <div className="flex justify-between gap-6"><dt className="uppercase tracking-[.08em]">{t('home.toolsStatsRotation')}</dt><dd className="tabular-nums text-foreground"><span ref={rotEl}>000°</span></dd></div>
              </dl>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button type="button" onClick={() => step(-1)} disabled={targets.length < 2} aria-label={t('home.toolsPrev')} className={control}>
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="hud-panel w-[min(58vw,300px)] text-center">
                <p className="led text-sm text-primary">{pad(position + 1)} <span className="text-muted-foreground">/ {pad(targets.length)}</span></p>
                <p className="mt-1 truncate font-display text-lg font-bold uppercase leading-tight text-foreground [font-stretch:118%]">
                  <span ref={nameEl} aria-hidden="true" />
                  <span className="sr-only">{current.name}</span>
                </p>
                <p className="label-mono mt-1 !text-[.62rem]">{t(`home.categories.${current.category}`)}</p>
              </div>
              <button type="button" onClick={() => step(1)} disabled={targets.length < 2} aria-label={t('home.toolsNext')} className={control}>
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
        /* Animations réduites : grille simple */
        <div className="container-x">
          <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(140px,180px))] justify-center gap-3 sm:grid-cols-[repeat(auto-fit,minmax(180px,220px))]">
            {targets.map((i) => (
              <button
                key={TOOLS[i].name}
                type="button"
                onClick={() => setSelectedTool(TOOLS[i])}
                data-cursor={t('ui.open')}
                className="panel group flex h-full min-h-[150px] w-full flex-col justify-between p-4 text-left"
              >
                <CardBody tool={TOOLS[i]} index={i} category={t(`home.categories.${TOOLS[i].category}`)} />
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
