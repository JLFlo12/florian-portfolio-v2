import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown } from 'lucide-react';
import { TOOLS, type Tool } from '@/data/tools';
import { ScrollTrigger, hasFinePointer } from '@/lib/motion';
import { useLenis } from '@/components/fx/SmoothScroll';
import type { OrbitalScene, SceneFrame } from '@/components/three/station/OrbitalScene';
import type { Quality } from '@/components/three/station/kit';
import CategoryNavigation from './CategoryNavigation';
import ExplorationProgress from './ExplorationProgress';
import HolographicInterface, { ToolDisplay, type Logos } from './HolographicInterface';
import { moduleOfCategory, type ModuleId } from './layout';
import { createStationAudio, type StationAudio } from './stationAudio';
import { STATION_MODULES, buildTimeline, focusAt, isCompactStation, presenceAt, stationHeight, stopIndexAt, type StationModule } from './scrollTimeline';

/* ───────────────────────────────────────────────────────────────
   Section Outils : visite d'une station spatiale en 3D, pilotée par le défilement.
   La section est haute (≈ 12 écrans) ; la scène reste collée à l'écran (sticky)
   pendant que le défilement fait avancer la caméra le long de la timeline.
   - la scène three.js n'est chargée qu'à l'approche de la section ;
   - l'interface (titre, étiquettes des modules, panneau holographique, récapitulatif,
     progression) suit la progression lissée de la scène, image par image ;
   - les filtres de catégories, les repères de la barre et précédent / suivant
     font défiler la page jusqu'à l'étape voulue : la caméra y vole sans saut.
   ─────────────────────────────────────────────────────────────── */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => { const x = clamp01((v - a) / (b - a || 1e-6)); return x * x * (3 - 2 * x); };
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// Un module sans outil (catégorie retirée des données) n'a ni panneau ni halte affichée
const moduleOf = (id: string) => STATION_MODULES.find((m) => m.id === id && m.tools.length > 0) ?? null;

interface Props {
  onOpen: (tool: Tool) => void;
  onLost: () => void;
}

const StationExperience = ({ onOpen, onLost }: Props) => {
  const { t } = useTranslation();
  const lenis = useLenis();
  const lenisRef = useRef(lenis);
  lenisRef.current = lenis;
  const [compact] = useState(isCompactStation);
  const [quality] = useState<Quality>(() => (compact || !window.matchMedia('(pointer: fine)').matches || (navigator.hardwareConcurrency ?? 8) <= 4 ? 'low' : 'high'));
  const timeline = useMemo(() => buildTimeline(compact), [compact]);
  const { stops } = timeline;
  const stopIndexOf = useMemo(() => new Map(stops.map((s, i) => [s.id, i])), [stops]);

  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<OrbitalScene | null>(null);
  const trigger = useRef<ScrollTrigger | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const leader = useRef<SVGPolylineElement>(null);
  const leaderDot = useRef<SVGCircleElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const hint = useRef<HTMLDivElement>(null);
  const hud = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const readyRef = useRef(false);
  const [stopIndex, setStopIndex] = useState(0);
  const [scrollFocus, setScrollFocus] = useState(0);
  const [manual, setManual] = useState<number | null>(null);
  const [ambient, setAmbient] = useState(true);
  const [logos, setLogos] = useState<Logos>(null);
  const stopRef = useRef(0);
  const focusRef = useRef(0);
  // Mesures de mise en page gardées en cache (relues au changement d'étape, au redimensionnement, ou toutes les 30 images)
  const layout = useRef<{ host: DOMRect | null; rect: DOMRect | null; half: number; age: number }>({ host: null, rect: null, half: 0, age: 99 });
  const audio = useRef<StationAudio | null>(null);

  // Vrais logos (tracés Simple Icons, chargés à part)
  useEffect(() => {
    let alive = true;
    import('@/data/toolLogos').then((m) => { if (alive) setLogos(m.LOGOS); }).catch(() => { /* icônes du site */ });
    return () => { alive = false; };
  }, []);

  const stop = stops[stopIndex];
  const mod: StationModule | null = moduleOf(stop.id);
  const focus = manual ?? scrollFocus;

  /* ——— Interface posée à chaque image (sans rendu React, sauf changement d'étape ou d'outil) ——— */
  const paint = useCallback((tt: number, frame: SceneFrame | null) => {
    const L = layout.current;
    if (++L.age > 30) {
      L.host = stage.current?.getBoundingClientRect() ?? null;
      L.rect = panel.current?.getBoundingClientRect() ?? null;
      L.half = (labels.current?.clientWidth ?? 0) * 0.5;
      L.age = 0;
    }
    const { host, rect, half } = L;
    const idx = stopIndexAt(stops, tt);
    const st = stops[idx];
    if (idx !== stopRef.current) { stopRef.current = idx; setStopIndex(idx); setManual(null); L.age = 26; }
    const m = moduleOf(st.id);
    const p = m ? presenceAt(st, tt) : 0;
    if (m) {
      const f = focusAt(st, tt, m.tools.length);
      if (f !== focusRef.current) { focusRef.current = f; setScrollFocus(f); setManual(null); }
    }
    const approach = stops[0];
    const overview = stops[stopIndexOf.get('overview')!];
    const final = stops[stops.length - 1];
    if (intro.current) {
      const k = 1 - smooth(approach.leave * 0.55, approach.leave, tt);
      intro.current.style.opacity = k.toFixed(3);
      intro.current.style.transform = `translate3d(0, ${(-(1 - k) * 40).toFixed(1)}px, 0) scale(${(1 + (1 - k) * 0.06).toFixed(3)})`;
      intro.current.style.visibility = k < 0.01 ? 'hidden' : '';
    }
    if (hint.current) hint.current.style.opacity = (1 - smooth(0.004, 0.03, tt)).toFixed(3);
    if (bar.current) bar.current.style.transform = `scaleX(${tt.toFixed(4)})`;
    if (hud.current) hud.current.style.opacity = smooth(0.01, 0.05, tt).toFixed(3);
    const pf = presenceAt(final, tt);
    if (summary.current) {
      summary.current.style.setProperty('--p', pf.toFixed(3));
      summary.current.style.visibility = pf < 0.01 ? 'hidden' : '';
    }
    // Étiquettes des modules pendant la vue d'ensemble
    const po = presenceAt(overview, tt);
    if (labels.current) {
      labels.current.style.opacity = po.toFixed(3);
      labels.current.style.visibility = po < 0.01 || !frame ? 'hidden' : '';
      if (frame && po > 0.01) {
        const nodes = labels.current.children;
        frame.anchors.forEach((a, i) => {
          const el = nodes[i] as HTMLElement | undefined;
          if (!el) return;
          el.style.transform = `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0)`;
          el.style.opacity = a.front ? '' : '0';
          // Étiquette tournée vers l'extérieur de la station (moins de chevauchements)
          const side = a.x < half ? 'l' : 'r';
          if (el.dataset.side !== side) el.dataset.side = side;
        });
      }
    }
    // Panneau holographique et sa ligne jusqu'à l'émetteur du module
    if (panel.current) {
      panel.current.style.setProperty('--p', p.toFixed(3));
      panel.current.style.visibility = p < 0.01 ? 'hidden' : '';
    }
    if (leader.current && leaderDot.current) {
      const a = frame && m ? frame.anchors.find((x) => x.id === m.id) : null;
      if (a && a.front && rect && host && p > 0.01) {
        const vertical = host.width < 768;
        const px = vertical ? rect.left - host.left + rect.width * 0.5 : rect.left - host.left;
        const py = vertical ? rect.top - host.top : rect.top - host.top + 46;
        const ax = a.x;
        const ay = a.y;
        // Coude à 45° : la ligne part de l'émetteur, monte en biais puis rejoint le panneau
        const ex = vertical ? ax + (px - ax) * 0.35 : ax + (px - ax) * 0.45;
        const ey = vertical ? ay + (py - ay) * 0.6 : py;
        leader.current.setAttribute('points', `${ax.toFixed(1)},${ay.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)} ${px.toFixed(1)},${py.toFixed(1)}`);
        leader.current.style.opacity = p.toFixed(3);
        leader.current.style.strokeDashoffset = ((1 - p) * 600).toFixed(1);
        leaderDot.current.setAttribute('cx', ax.toFixed(1));
        leaderDot.current.setAttribute('cy', ay.toFixed(1));
        leaderDot.current.style.opacity = p.toFixed(3);
      } else {
        leader.current.style.opacity = '0';
        leaderDot.current.style.opacity = '0';
      }
    }
  }, [stops, stopIndexOf]);

  // Défilement → progression (la scène lisse elle-même ; sans scène, l'interface suit le défilement)
  useLayoutEffect(() => {
    const el = section.current;
    if (!el) return;
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        scene.current?.setProgress(self.progress);
        if (!readyRef.current) paint(self.progress, null);
      },
    });
    trigger.current = st;
    paint(st.progress, null);
    // La section vient d'apparaître (chargée à part) : les déclencheurs placés plus bas se recalent
    const raf = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => { cancelAnimationFrame(raf); st.kill(); trigger.current = null; };
  }, [paint]);

  // Chargement de la scène à l'approche de la section (1,5 écran avant)
  useEffect(() => {
    const el = section.current;
    if (!el || status !== 'idle') return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatus('loading'); }, { rootMargin: '150% 0px 150% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [status]);

  useEffect(() => {
    if (status !== 'loading' || !canvas.current) return;
    let alive = true;
    let handle: OrbitalScene | null = null;
    import('@/components/three/station/OrbitalScene').then(({ createOrbitalScene }) => {
      if (!alive || !canvas.current) return;
      handle = createOrbitalScene(canvas.current, {
        timeline,
        quality,
        onFrame: (f) => { paint(f.t, f); audio.current?.update(f.speed, f.motion); },
        onReady: () => { if (alive) { readyRef.current = true; setStatus('ready'); } },
        onLost,
      });
      handle.setProgress(trigger.current?.progress ?? 0, true);
      scene.current = handle;
    }).catch(() => onLost());
    return () => {
      alive = false;
      readyRef.current = false;
      handle?.dispose();
      scene.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status === 'idle']);

  // Rendu en pause quand la section est hors de l'écran (et bruitages coupés)
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      scene.current?.setVisible(e.isIntersecting);
      if (!e.isIntersecting) audio.current?.silence();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [status]);

  // Bruitages discrets (souffle du déplacement, mécanismes des modules)
  useEffect(() => {
    const a = createStationAudio();
    audio.current = a;
    const onResize = () => { layout.current.age = 99; };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); a.dispose(); audio.current = null; };
  }, []);

  useEffect(() => { scene.current?.setAmbient(ambient); }, [ambient, status]);

  // Léger mouvement de caméra lié à la souris
  useEffect(() => {
    if (!hasFinePointer()) return;
    const move = (e: PointerEvent) => scene.current?.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, []);

  /* ——— Navigation : on fait défiler la page, la caméra suit tout le trajet ——— */
  const scrollToProgress = useCallback((tt: number) => {
    const st = trigger.current;
    if (!st) return;
    const y = st.start + clamp01(tt) * (st.end - st.start);
    const dist = Math.abs(y - window.scrollY);
    const l = lenisRef.current;
    if (l) l.scrollTo(y, { duration: Math.min(3.6, 1.1 + (dist / window.innerHeight) * 0.18), easing: ease });
    else window.scrollTo({ top: y, behavior: 'smooth' });
  }, []);
  const goTo = useCallback((i: number) => {
    const s = stops[Math.max(0, Math.min(stops.length - 1, i))];
    scrollToProgress(s.id === 'approach' ? 0 : s.arrive + (s.leave - s.arrive) * 0.03);
  }, [stops, scrollToProgress]);
  const onCategory = useCallback((cat: string) => {
    const id: string = cat === 'all' ? 'final' : moduleOfCategory(cat);
    goTo(stopIndexOf.get(id as ModuleId) ?? stops.length - 1);
  }, [goTo, stopIndexOf, stops.length]);
  const skip = () => {
    const st = trigger.current;
    if (!st) return;
    const l = lenisRef.current;
    if (l) l.scrollTo(st.end + 2, { duration: 1.2 }); else window.scrollTo({ top: st.end + 2 });
  };

  const stopLabel = (i: number) => {
    const s = stops[i];
    const m = moduleOf(s.id);
    if (m) return m.name;
    return t(`home.station.${s.id}`);
  };
  const activeCats = stop.id === 'final' ? ['all'] : mod ? mod.categories : [];

  return (
    <section
      ref={section}
      className="station dark"
      style={{ height: stationHeight(compact) }}
      aria-label={t('home.station.label')}
    >
      <div ref={stage} className={`station__stage ${ambient ? '' : 'is-paused'}`}>
        <canvas ref={canvas} className={`station__canvas ${status === 'ready' ? 'is-ready' : ''}`} aria-hidden="true" />
        <div className="station__veil" aria-hidden="true" />

        {/* 01 — Titre de l'approche */}
        <div ref={intro} className="station-intro">
          <p className="eyebrow justify-center">
            <span className="eyebrow__index">01</span>
            <span className="eyebrow__rule" aria-hidden="true" />
            <span className="eyebrow__label">tools</span>
          </p>
          <h2 className="station-intro__title">{t('home.station.title')}</h2>
          <p className="station-intro__sub">{t('home.station.subtitle', { count: TOOLS.length })}</p>
          {status !== 'ready' && <p className="station-intro__loading">{t('home.station.loading')}</p>}
        </div>

        {/* 02 — Étiquettes des modules (suivent leur position 3D) */}
        <div ref={labels} className="station-labels" aria-hidden="true">
          {STATION_MODULES.map((m) => (
            <span key={m.id} className="station-label">
              <i />
              <span className="station-label__name">{m.name}</span>
              <span className="station-label__count">{m.tools.length}</span>
            </span>
          ))}
        </div>

        {/* Ligne du panneau holographique vers l'émetteur du module */}
        <svg className="station-leader" aria-hidden="true">
          <polyline ref={leader} />
          <circle ref={leaderDot} r="4" />
        </svg>

        {/* 03 à 11 — Panneau holographique du module visité */}
        <div className="station-panel-slot">
          {mod && (
            <HolographicInterface
              ref={panel}
              module={mod}
              index={stopIndex + 1}
              focus={Math.min(focus, mod.tools.length - 1)}
              logos={logos}
              onFocus={setManual}
              onOpen={onOpen}
            />
          )}
        </div>

        {/* 12 — Récapitulatif final */}
        <div ref={summary} className="station-summary">
          <p className="station-summary__title">{t('home.station.summary', { count: TOOLS.length })}</p>
          <div className="station-summary__grid">
            {STATION_MODULES.filter((m) => m.tools.length).map((m, k) => (
              <div key={m.id} className="station-summary__module" style={{ '--i': k } as React.CSSProperties}>
                <p className="station-summary__name">{m.name}</p>
                <ul>
                  {m.tools.map((tool) => (
                    <li key={tool.name}>
                      <button type="button" onClick={() => onOpen(tool)} className="station-summary__tool" title={tool.name}>
                        <ToolDisplay tool={tool} logos={logos} size="h-4 w-4" />
                        <span>{tool.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="station-summary__hint">{t('home.station.hint')}</p>
        </div>

        {/* Filtres de catégories : emmènent la caméra au module */}
        <CategoryNavigation active={activeCats} onSelect={onCategory} className="station-cats" />

        {/* Défile pour explorer */}
        <div ref={hint} className="station-hint" aria-hidden="true">
          <span>{t('home.station.scroll')}</span>
          <ArrowDown className="h-4 w-4" />
        </div>

        <div ref={hud} className="station-hud-wrap">
          <ExplorationProgress
            ref={bar}
            stops={stops}
            current={stopIndex}
            label={stopLabel(stopIndex)}
            ambient={ambient}
            onStep={(dir) => goTo(stopIndex + dir)}
            onGo={goTo}
            onToggleAmbient={() => setAmbient((a) => !a)}
            stopLabel={stopLabel}
          />
          <button type="button" className="station-skip" onClick={skip}>{t('home.station.skip')}</button>
        </div>

        {/* Pour les lecteurs d'écran : la liste complète */}
        <div className="sr-only">
          {STATION_MODULES.map((m) => (
            <div key={m.id}>
              <h3>{m.name}</h3>
              <ul>{m.tools.map((tool) => <li key={tool.name}>{tool.name} ({t(`home.categories.${tool.category}`)}) : {tool.description}</li>)}</ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StationExperience;
