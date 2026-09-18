import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { planetState } from './planetState';
import { onReady } from '@/lib/ready';

// La scène three.js est chargée à part (elle ne ralentit pas l'affichage du reste du site)
const Planet = lazy(() => import('./Planet'));

const hasWebGL = () => {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    (gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch { return false; }
};

/* Conteneur de la planète 3D du hero : charge la scène, lui transmet la souris,
   met le rendu en pause quand le hero n'est plus visible.
   (La plongée au scroll est pilotée par la page d'accueil via planetState.dive.) */
const HeroPlanet = ({ section }: { section: React.RefObject<HTMLElement> }) => {
  const { t } = useTranslation();
  const label = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [webgl] = useState(hasWebGL);

  useEffect(() => onReady(() => { planetState.ready = true; }), []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      planetState.px = (e.clientX / window.innerWidth) * 2 - 1;
      planetState.py = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      planetState.ready = false;
      planetState.dive = 0;
    };
  }, []);

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [section]);

  // Sans WebGL : un simple globe lumineux en CSS
  const fallback = (
    <div className="absolute right-[8%] top-1/2 aspect-square w-[min(46vw,560px)] -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_35%_35%,hsl(var(--primary)/.55),hsl(var(--background))_62%)] shadow-[0_0_120px_-20px_hsl(var(--primary)/.6)] max-lg:right-1/2 max-lg:top-[34%] max-lg:w-[72vw] max-lg:translate-x-1/2" />
  );

  return (
    <div className="absolute inset-0" aria-hidden="true">
      {webgl ? (
        <Suspense fallback={fallback}>
          <Planet label={label} visible={visible} />
        </Suspense>
      ) : fallback}
      {/* Étiquette qui suit la balise La Réunion sur la planète */}
      <div ref={label} className="pointer-events-none absolute left-0 top-0 opacity-0 will-change-transform">
        <span className="ml-3 -mt-3 inline-flex items-center gap-2 whitespace-nowrap liquid liquid-strong rounded-full border-primary/50 px-3 py-1 font-mono text-[.68rem] text-foreground">
          <span className="status-dot" /> {t('ui.homeBeacon')}
        </span>
      </div>
    </div>
  );
};

export default HeroPlanet;
