import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { prefersReducedMotion } from '@/lib/motion';
import { onReady } from '@/lib/ready';
import { markTravel } from '@/lib/timeTravel';
import { preloadPage } from '@/lib/pageLoaders';
import { hasWebGL } from '@/components/three/webgl';
import type { TimeMachine } from '@/components/three/delorean';

/* ───────────────────────────────────────────────────────────────
   La DeLorean du site (three/delorean.ts) : toute petite, elle vole lentement en rond dans le fond de l'écran,
   derrière le contenu des pages, comme les satellites.
   Quand on entre sur la page de Jarvis ou qu'on en sort, c'est elle qui change la page : elle fonce sur nous
   (en entrée) ou vire devant nous et s'enfuit (en sortie), et la page change sous l'éclat de son saut dans le temps.
   Puis elle réapparaît dans le fond et reprend sa ronde.
   Ce composant intercepte les clics sur les liens internes qui font entrer sur la page ou en sortir ;
   tous les autres changements de page gardent le rideau orange du layout.
   Sans WebGL, avec les animations réduites, ou tant que la voiture n'est pas revenue : le lien fonctionne normalement.
   ─────────────────────────────────────────────────────────────── */

const SECTION = '/chatbot';   // Jarvis
const inSection = (path: string) => path === SECTION || path.startsWith(SECTION + '/');

const frames = (n: number) => new Promise<void>((resolve) => {
  const step = () => { if (n-- <= 0) resolve(); else requestAnimationFrame(step); };
  step();
});

/* La nouvelle page est affichée (son code a été préchargé ; au pire on l'attend, 2 s au plus) */
const pageShown = async () => {
  await frames(3);
  const until = performance.now() + 2000;
  while (document.querySelector('[data-page-fallback]') && performance.now() < until) await frames(2);
};

const TimeTravel = () => {
  const navigate = useNavigate();
  const go = useRef(navigate);   // useNavigate change à chaque page : la scène, elle, ne doit pas être recréée
  go.current = navigate;
  const machine = useRef<TimeMachine | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const dim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion() || !hasWebGL()) return;
    let dead = false;
    let busy = false;
    let timer = 0;

    // le modèle se charge une fois le site ouvert, sans gêner le premier affichage
    const off = onReady(() => {
      timer = window.setTimeout(() => {
        import('@/components/three/delorean')
          .then((m) => m.createTimeMachine(canvas.current!, { root: root.current!, dim: dim.current! }))
          .then((tm) => {
            if (dead) { tm.dispose(); return; }
            machine.current = tm;
            root.current?.classList.add('is-ready');
          })
          .catch(() => { /* modèle indisponible : les liens gardent le rideau */ });
      }, 900);
    });

    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const here = window.location.pathname;
      const entering = inSection(url.pathname);
      if (entering === inSection(here)) return;   // on n'entre pas sur la page de Jarvis et on n'en sort pas
      // fichiers (CV en PDF, ancien portfolio…) : ce ne sont pas des pages du site
      if (/\.[a-z0-9]+$/i.test(url.pathname) || url.pathname.startsWith('/portfolio-v1')) return;
      if (busy) { e.preventDefault(); return; }
      const tm = machine.current;
      // la voiture doit être là, dans sa ronde : sinon elle sortirait de nulle part
      if (!tm || !tm.ready()) return;
      if (document.documentElement.classList.contains('is-loading') || document.querySelector('.intro')) return;

      e.preventDefault();   // le lien ne navigue pas tout de suite : c'est la voiture qui changera la page
      busy = true;
      preloadPage(url.pathname);
      tm.travel(entering ? 'in' : 'out', () => {
        markTravel();
        go.current(url.pathname + url.search + url.hash);
        return pageShown();
      }).finally(() => { busy = false; });
    };
    document.addEventListener('click', onClick, true);

    return () => {
      dead = true;
      off();
      window.clearTimeout(timer);
      document.removeEventListener('click', onClick, true);
      machine.current?.dispose();
      machine.current = null;
    };
  }, []);

  return (
    <div ref={root} className="timewarp" aria-hidden="true">
      <div ref={dim} className="timewarp__dim" />
      <canvas ref={canvas} className="timewarp__canvas" />
    </div>
  );
};

export default TimeTravel;
